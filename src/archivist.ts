import { analyzeMessage } from './gemini';
import { callCEO } from './ceo';
import { Decision, ConversationState } from './types';
import { getProjects, getPeople, getAgents } from './registry';
import { createNote } from './notes';

console.log('archivist.ts loaded');

export async function handleMessage(text: string, chatId: number, state: ConversationState | null) {
  console.log('handleMessage called with text:', text);

  if (state && state.step !== 'idle') {
    console.log('State is not idle, returning placeholder');
    return { type: 'response', message: 'Пока не реализовано' };
  }

  console.log('Calling analyzeMessage...');
  const decision = await analyzeMessage(text);
  console.log('Decision from Gemini:', JSON.stringify(decision, null, 2));

  if (decision.confidence < 0.8 || decision.needConfirmation) {
    console.log('Confidence low or need confirmation, asking user');
    return {
      type: 'ask',
      message: `Уточните, пожалуйста, это относится к проекту "${decision.project}" или к человеку "${decision.people}"?`
    };
  }

  console.log('Loading registry...');
  const projects = await getProjects();
  const people = await getPeople();
  const agents = await getAgents();
  console.log(`Registry loaded: projects=${projects.length}, people=${people.length}, agents=${agents.length}`);

  console.log('Calling CEO...');
  const ceoDecision = await callCEO(decision, { projects, people, agents });
  console.log('CEO decision:', JSON.stringify(ceoDecision, null, 2));

  if (ceoDecision.decision === 'ASK_USER') {
    console.log('CEO asks user');
    return { type: 'ask', message: ceoDecision.message };
  }

  let notePath = '';
  for (const action of ceoDecision.actions || []) {
    if (action.type === 'create_note') {
      console.log('Creating note...');
      notePath = await createNote(decision, ceoDecision);
      console.log('Note created:', notePath);
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
