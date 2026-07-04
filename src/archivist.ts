import { analyzeMessage } from './gemini';
import { callCEO } from './ceo';
import { Decision, ConversationState } from './types';
import { getProjects, getPeople, getAgents } from './registry';
import { createNote } from './notes';

export async function handleMessage(text: string, chatId: number, state: ConversationState | null) {
  if (state && state.step !== 'idle') {
    return { type: 'response', message: 'Пока не реализовано' };
  }

  const decision = await analyzeMessage(text);

  if (decision.confidence < 0.8 || decision.needConfirmation) {
    return {
      type: 'ask',
      message: `Уточните, пожалуйста, это относится к проекту "${decision.project}" или к человеку "${decision.people}"?`
    };
  }

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
