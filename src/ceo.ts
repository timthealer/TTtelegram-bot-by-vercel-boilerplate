import { Decision, CEODecision } from './types';
import { getGitHubFile } from './github';
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export async function callCEO(decision: Decision, registryData: any): Promise<CEODecision> {
  const systemPrompt = await getCEOSystemPrompt();
  const userPrompt = `
Registry:
Проекты: ${JSON.stringify(registryData.projects, null, 2)}
Люди: ${JSON.stringify(registryData.people, null, 2)}
Агенты: ${JSON.stringify(registryData.agents, null, 2)}

Сообщение пользователя (извлечённые сущности):
${JSON.stringify(decision, null, 2)}

Прими решение и верни JSON в формате, описанном в System Prompt.
`;

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: combinedPrompt }] }],
  });

  const raw = res.data.candidates[0].content.parts[0].text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Не удалось извлечь JSON из ответа CEO');
  return JSON.parse(jsonMatch[0]);
}

async function getCEOSystemPrompt(): Promise<string> {
  const content = await getGitHubFile('10_Agents/000_CEO/System_Prompt.md');
  if (!content) {
    return `Ты — CEO TOS. ... (полный текст промпта)`;
  }
  return content;
}
