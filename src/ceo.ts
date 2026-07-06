// src/ceo.ts

import axios from "axios";
import { getGitHubFile } from "./github";
import { Decision, CEODecision } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export async function callCEO(
  decision: Decision,
  registryData: any,
  userAnswer?: string
): Promise<CEODecision> {
  const systemPrompt = await getCEOSystemPrompt();

  const prompt = `
${systemPrompt}

=========================
РЕЕСТР

Проекты:
${JSON.stringify(registryData.projects, null, 2)}

Люди:
${JSON.stringify(registryData.people, null, 2)}

Агенты:
${JSON.stringify(registryData.agents, null, 2)}

=========================

Сообщение:

${JSON.stringify(decision, null, 2)}

${
  userAnswer
    ? `
Ответ пользователя:

${userAnswer}
`
    : ""
}

=========================

Верни ТОЛЬКО JSON.

Формат:

{
  "decision":"ASK_USER | USE_EXISTING_PROJECT | CREATE_NEW_PROJECT | UPDATE_REGISTRY",

  "message":"что написать пользователю",

  "question":{
      "type":"confirmAlias|selectProject|confirmCreateProject",

      "title":"короткий вопрос",

      "buttons":[
          {
              "id":"yes",
              "text":"✅ Да"
          },
          {
              "id":"no",
              "text":"❌ Нет"
          }
      ]
  },

  "actions":[]
}

Правила:

Если нужно уточнение —

НЕ пиши вопросы списком.

НЕ используй нумерацию.

НЕ пиши длинные объяснения.

Всегда используй question.buttons.

Например:

{
 "decision":"ASK_USER",

 "message":"Макс — это Максим?",

 "question":{
   "type":"confirmAlias",
   "title":"Макс = Максим?",
   "buttons":[
      {
         "id":"yes",
         "text":"✅ Да"
      },
      {
         "id":"no",
         "text":"❌ Нет"
      }
   ]
 }

}

Если проект неизвестен —

{
 "decision":"ASK_USER",

 "message":"К какому проекту относится задача?",

 "question":{
   "type":"selectProject",
   "buttons":[
      {
        "id":"project:Вода",
        "text":"💧 Вода"
      },
      {
        "id":"project:Фермы",
        "text":"🌾 Фермы"
      },
      {
        "id":"project:new",
        "text":"➕ Новый проект"
      }
   ]
 }

}

НИКОГДА не задавай больше одного вопроса одновременно.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await axios.post(url, {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  });

  const raw = res.data.candidates[0].content.parts[0].text;

  const json = raw.match(/\{[\s\S]*\}/);

  if (!json) {
    throw new Error("CEO вернул не JSON");
  }

  return JSON.parse(json[0]) as CEODecision;
}

async function getCEOSystemPrompt(): Promise<string> {
  try {
    const prompt = await getGitHubFile(
      "10_Agents/000_CEO/System_Prompt.md"
    );

    if (prompt?.trim()) return prompt;
  } catch {}

  return `
Ты CEO системы знаний TOS.

Ты принимаешь архитектурные решения.

Если уверен — принимай решение.

Если не уверен — задавай ОДИН вопрос.

Не задавай несколько вопросов сразу.

Возвращай только JSON.
`;
}
