// src/archivist.ts
import { analyzeMessage } from './gemini';
import { runCEORules } from './ceoRules';
import { Decision, ConversationState, CEODecision } from './types';
import { getProjects, getPeople, getAgents, addPerson, addProject } from './registry';
import { createNote } from './notes';
import { normalizeText } from './alias';

export async function handleMessage(
  text: string,
  chatId: number,
  state: ConversationState
): Promise<any> {
  const step = state.step || 'idle';
  const data = state.data || {};

  switch (step) {
    case 'idle': {
      const normalizedText = await normalizeText(text);
      const decision = await analyzeMessage(normalizedText);
      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      const ceoDecision: CEODecision = runCEORules(decision, { projects, people, agents });

      if (ceoDecision.decision === 'ASK_USER') {
        return {
          type: 'ask',
          message: ceoDecision.message,
          buttons: ceoDecision.buttons || [],
          nextState: {
            step: 'waiting_ceo_answer',
            data: { decision, ceoDecision }
          }
        };
      }

      let notePath = '';
      for (const action of ceoDecision.actions || []) {
        if (action.type === 'set_project' || action.type === 'create_note') {
          notePath = await createNote(decision, ceoDecision);
        }
      }

      return {
        type: 'confirm',
        decision,
        ceoDecision,
        message: ceoDecision.message,
        notePath,
        nextState: { step: 'idle', data: {} }
      };
    }

    case 'waiting_ceo_answer': {
      const savedDecision = data.decision as Decision;
      const savedCEODecision = data.ceoDecision as CEODecision;
      if (!savedDecision) {
        return {
          type: 'error',
          message: '❌ Потерян контекст. Начните сначала.',
          nextState: { step: 'idle', data: {} }
        };
      }

      // Обрабатываем ответ пользователя (выбор из кнопок или текстовый ответ)
      let updatedDecision = savedDecision;
      let updatedCEODecision = savedCEODecision;

      // Проверяем, является ли ответ выбором из кнопок
      if (text.startsWith('person_existing_')) {
        const personId = text.replace('person_existing_', '');
        const people = await getPeople();
        const selectedPerson = people.find(p => p.id === personId);
        if (selectedPerson) {
          // Добавляем человека в решение
          updatedCEODecision.actions = updatedCEODecision.actions || [];
          updatedCEODecision.actions.push({ type: 'link_person', person_id: selectedPerson.id });
          updatedCEODecision.message = `✅ Использую существующего человека: ${selectedPerson.name}`;
        }
      } else if (text === 'person_create') {
        // TODO: запросить имя нового человека (пока заглушка)
        // Временно создаём человека с именем "Новый человек"
        const newPerson = {
          id: `person-${Date.now()}`,
          name: 'Новый человек',
          aliases: [],
          projects: []
        };
        await addPerson(newPerson);
        updatedCEODecision.actions = updatedCEODecision.actions || [];
        updatedCEODecision.actions.push({ type: 'link_person', person_id: newPerson.id });
        updatedCEODecision.message = `✅ Создан новый человек: ${newPerson.name}`;
      } else if (text.startsWith('project_existing_')) {
        const projectId = text.replace('project_existing_', '');
        const projects = await getProjects();
        const selectedProject = projects.find(p => p.id === projectId);
        if (selectedProject) {
          updatedCEODecision.actions = updatedCEODecision.actions || [];
          updatedCEODecision.actions.push({ type: 'set_project', project: selectedProject.folder || '12_Inbox' });
          updatedCEODecision.message = `✅ Использую существующий проект: ${selectedProject.name}`;
        }
      } else if (text === 'project_create') {
        // TODO: запросить название нового проекта (пока заглушка)
        const newProject = {
          id: `project-${Date.now()}`,
          name: 'Новый проект',
          status: 'активен',
          folder: '12_Inbox',
          created: new Date().toISOString().slice(0, 10),
          tags: []
        };
        await addProject(newProject);
        updatedCEODecision.actions = updatedCEODecision.actions || [];
        updatedCEODecision.actions.push({ type: 'set_project', project: '12_Inbox' });
        updatedCEODecision.message = `✅ Создан новый проект: ${newProject.name}`;
      } else if (text === 'cancel') {
        return {
          type: 'response',
          message: '❌ Отменено.',
          nextState: { step: 'idle', data: {} }
        };
      } else {
        // Если не распознано — просто сохраняем с текущим решением
        // Можно спросить ещё раз
        return {
          type: 'ask',
          message: '❌ Не понял ответ. Пожалуйста, выберите из предложенных вариантов.',
          buttons: savedCEODecision.buttons || [],
          nextState: { step: 'waiting_ceo_answer', data: { decision: savedDecision, ceoDecision: savedCEODecision } }
        };
      }

      // Сохраняем заметку с обновлённым решением
      let notePath = '';
      for (const action of updatedCEODecision.actions || []) {
        if (action.type === 'set_project' || action.type === 'create_note') {
          notePath = await createNote(updatedDecision, updatedCEODecision);
        }
      }

      return {
        type: 'confirm',
        decision: updatedDecision,
        ceoDecision: updatedCEODecision,
        message: updatedCEODecision.message,
        notePath,
        nextState: { step: 'idle', data: {} }
      };
    }

    default: {
      return {
        type: 'error',
        message: '❌ Неизвестное состояние. Начните сначала.',
        nextState: { step: 'idle', data: {} }
      };
    }
  }
}
