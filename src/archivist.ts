import { analyzeMessage } from './gemini';
import { callCEO } from './ceo';
import { Decision, ConversationState } from './types';
import { getProjects, getPeople, getAgents } from './registry';
import { createNote } from './notes';

export async function handleMessage(
  text: string,
  chatId: number,
  state: ConversationState | null
) {
  // Если ожидаем ответ на вопрос CEO
  if (state && state.step === 'waiting_ceo_decision') {
    // Пока просто подтверждаем, что ответ получен
    // Завтра здесь будет передача ответа CEO
    return {
      type: 'response',
      message: `✅ Понял: "${text}". Обрабатываю... (пока заглушка, завтра доделаем)`
    };
  }

  // Если есть другое состояние — сбрасываем
  if (state && state.step !== 'idle') {
    return {
      type: 'response',
      message: '❌ Неизвестное состояние. Начните сначала.'
    };
  }

  // Основной поток
  const decision = await analyzeMessage(text);

  // Временно убираем проверку needConfirmation, чтобы не было лишних вопросов
  // if (decision.confidence < 0.8 || decision.needConfirmation) {
  //   return { type: 'ask', message: `Уточните, пожалуйста...` };
  // }

  const projects = await getProjects();
  const people = await getPeople();
  const agents = await getAgents();

  const ceoDecision = await callCEO(decision, { projects, people, agents });

  if (ceoDecision.decision === 'ASK_USER') {
    return { type: 'ask', message: ceoDecision.message };
  }

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
    notePath
  };
}
