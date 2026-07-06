// src/archivist.ts

import { analyzeMessage } from "./gemini";
import { callCEO } from "./ceo";
import {
  ConversationState,
  CEOSession,
} from "./types";

import {
  getProjects,
  getPeople,
  getAgents,
} from "./registry";

import { createNote } from "./notes";
import { normalizeText } from "./alias";

export async function handleMessage(
  text: string,
  chatId: number,
  state: ConversationState
): Promise<any> {

  switch (state.step) {

    //---------------------------------------
    // ОЖИДАЕМ ОТВЕТ CEO
    //---------------------------------------

    case "waiting_ceo_answer": {

      const session: CEOSession = state.data.session;

      if (!session) {
        return {
          type: "error",
          message: "Контекст потерян.",
          nextState: {
            step: "idle",
            data: {},
          },
        };
      }

      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      const ceo = await callCEO(
        session.decision,
        {
          projects,
          people,
          agents,
        },
        text
      );

      if (ceo.decision === "ASK_USER") {

        return {
          type: "ask",
          message: ceo.message,
          question: ceo.question,

          nextState: {
            step: "waiting_ceo_answer",
            data: {
              session: {
                decision: session.decision,
                question: ceo.question,
              },
            },
          },
        };
      }

      let notePath = "";

      if (ceo.actions?.length) {

        notePath = await createNote(
          session.decision,
          ceo
        );
      }

      return {

        type: "confirm",

        message: ceo.message,

        decision: session.decision,

        ceoDecision: ceo,

        notePath,

        nextState: {

          step: "idle",

          data: {},
        },
      };
    }

    //---------------------------------------
    // НОВОЕ СООБЩЕНИЕ
    //---------------------------------------

    default: {

      const normalized = await normalizeText(text);

      const decision = await analyzeMessage(
        normalized
      );

      const projects = await getProjects();
      const people = await getPeople();
      const agents = await getAgents();

      const ceo = await callCEO(
        decision,
        {
          projects,
          people,
          agents,
        }
      );

      if (ceo.decision === "ASK_USER") {

        return {

          type: "ask",

          message: ceo.message,

          question: ceo.question,

          nextState: {

            step: "waiting_ceo_answer",

            data: {

              session: {

                decision,

                question: ceo.question,
              },
            },
          },
        };
      }

      let notePath = "";

      if (ceo.actions?.length) {

        notePath = await createNote(
          decision,
          ceo
        );
      }

      return {

        type: "confirm",

        message: ceo.message,

        decision,

        ceoDecision: ceo,

        notePath,

        nextState: {

          step: "idle",

          data: {},
        },
      };
    }
  }
}
