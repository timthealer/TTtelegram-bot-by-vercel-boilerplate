// src/archivist.ts
import { analyzeMessage } from './gemini';
import { callCEO, CEOSession } from './ceo';
import { Decision, ConversationState } from './types';
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
      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      const ceoDecision = await callCEO(decision, { projects, people, agents });

      if (ceoDecision.decision === 'ASK_USER') {
        // Сохраняем вопрос CEO в состоянии
        const session: CEOSession = {
          question: ceoDecision.message,
          decision
        };
        return {
          type: 'ask',
          message: ceoDecision.message,
          nextState: {
            step: 'waiting_ceo_answer',
            data: { session }
          }
        };
      }

      // Если решение принято — сохраняем
      let notePath = '';
      for (const action of ceoDecision.actions || []) {
        if (action.type === 'create_note') {
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
      const session = data.session as CEOSession;
      if (!session) {
        return {
          type: 'error',
          message: '❌ Ошибка: потерян контекст вопроса. Начните сначала.',
          nextState: { step: 'idle', data: {} }
        };
      }

      // Передаём ответ пользователя CEO
      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      const ceoDecision = await callCEO(
        session.decision,
        { projects, people, agents },
        text // ответ пользователя
      );

      if (ceoDecision.decision === 'ASK_USER') {
        // Если CEO снова спрашивает — обновляем состояние
        const newSession: CEOSession = {
          question: ceoDecision.message,
          decision: session.decision
        };
        return {
          type: 'ask',
          message: ceoDecision.message,
          nextState: {
            step: 'waiting_ceo_answer',
            data: { session: newSession }
          }
        };
      }

      // Сохраняем
      let notePath = '';
      for (const action of ceoDecision.actions || []) {
        if (action.type === 'create_note') {
          notePath = await createNote(session.decision, ceoDecision);
        }
      }

      return {
        type: 'confirm',
        decision: session.decision,
        ceoDecision,
        message: ceoDecision.message,
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
