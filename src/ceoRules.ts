// src/ceoRules.ts

import { CEODecision, Decision } from "./types";

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function startsLike(a: string, b: string) {
  a = normalize(a);
  b = normalize(b);

  return (
    a === b ||
    a.startsWith(b) ||
    b.startsWith(a)
  );
}

export async function runCEORules(
  decision: Decision,
  projects: any[],
  people: any[],
  agents: any[],
  userAnswer?: string
): Promise<CEODecision> {

  // ==========================================
  // пользователь ответил на вопрос
  // ==========================================

  if (userAnswer) {

    if (userAnswer === "yes") {

      return {
        decision: "UPDATE_REGISTRY",
        message: "Отлично. Использую существующую запись.",
        actions: [
          {
            type: "merge_entity"
          },
          {
            type: "create_note"
          }
        ]
      };
    }

    if (userAnswer === "no") {

      return {
        decision: "CREATE_NEW_ENTITY",
        message: "Создам новую запись.",
        actions: [
          {
            type: "create_entity"
          },
          {
            type: "create_note"
          }
        ]
      };
    }

    if (userAnswer.startsWith("project:")) {

      const project = userAnswer.replace("project:", "");

      if (project === "new") {

        return {
          decision: "ASK_USER",

          message: "Введите название нового проекта.",

          question: {
            type: "inputProjectName",
            title: "Название проекта"
          }
        };
      }

      return {
        decision: "USE_EXISTING_PROJECT",

        message: `Проект выбран: ${project}`,

        actions: [
          {
            type: "set_project",
            project
          },
          {
            type: "create_note"
          }
        ]
      };
    }

    return {

      decision: "CREATE_NEW_PROJECT",

      message: `Создаю проект "${userAnswer}".`,

      actions: [
        {
          type: "create_project",
          name: userAnswer
        },
        {
          type: "create_note"
        }
      ]
    };
  }

  // ==========================================
  // проверяем людей
  // ==========================================

  for (const entity of decision.entities || []) {

    if (entity.type !== "person") continue;

    for (const person of people) {

      if (startsLike(entity.name, person.name)) {

        return {

          decision: "ASK_USER",

          message: `${entity.name} — это ${person.name}?`,

          question: {

            type: "confirmAlias",

            title: `${entity.name} = ${person.name}?`,

            buttons: [

              {
                id: "yes",
                text: "✅ Да"
              },

              {
                id: "no",
                text: "❌ Нет"
              }

            ]
          }
        };
      }
    }
  }

  // ==========================================
  // проверяем проект
  // ==========================================

  if (!decision.project) {

    return {

      decision: "ASK_USER",

      message: "К какому проекту относится задача?",

      question: {

        type: "selectProject",

        title: "Выберите проект",

        buttons: [

          ...projects.map((p) => ({
            id: `project:${p.name}`,
            text: `📁 ${p.name}`
          })),

          {
            id: "project:new",
            text: "➕ Новый проект"
          }

        ]
      }
    };
  }

  // ==========================================
  // всё понятно
  // ==========================================

  return {

    decision: "USE_EXISTING_PROJECT",

    message: "Всё понятно. Сохраняю.",

    actions: [

      {
        type: "create_note"
      }

    ]
  };

}
