// src/archivist.ts
import { analyzeMessage } from './gemini';
import { runCEORules } from './ceoRules';
import { Decision, ConversationState, CEODecision } from './types';
import { getProjects, getPeople, getAgents } from './registry';
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
      // Нормализуем текст (алиасы)
      const normalizedText = await normalizeText(text);
      const decision = await analyzeMessage(normalizedText);

      // Загружаем Registry
      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      // Запускаем детерминированные правила CEO
      const ceoDecision: CEODecision = runCEORules(decision, { projects, people, agents });

      if (ceoDecision.decision === 'ASK_USER') {
        // Сохраняем вопрос и контекст
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

      // Если решение принято — сохраняем заметку
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
      // Получаем сохранённый контекст
      const savedDecision = data.decision as Decision;
      const savedCEODecision = data.ceoDecision as CEODecision;
      if (!savedDecision) {
        return {
          type: 'error',
          message: '❌ Потерян контекст. Начните сначала.',
          nextState: { step: 'idle', data: {} }
        };
      }

      // Ответ пользователя — это текст кнопки (например, "project_create")
      const userAnswer = text;

      // Загружаем Registry заново (возможно, уже изменился)
      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      // В зависимости от ответа пользователя модифицируем решение
      // Здесь можно реализовать логику обработки конкретных ответов
      // Например, если пользователь выбрал "project_create" — создаём новый проект
      // Пока просто передаём ответ в ceoRules для повторного анализа
      // (можно расширить логику позже)

      // Временно: просто сохраняем заметку с выбранным проектом
      let notePath = '';
      for (const action of savedCEODecision.actions || []) {
        if (action.type === 'set_project' || action.type === 'create_note') {
          notePath = await createNote(savedDecision, savedCEODecision);
        }
      }

      return {
        type: 'confirm',
        decision: savedDecision,
        ceoDecision: savedCEODecision,
        message: `✅ Заметка сохранена.`,
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
