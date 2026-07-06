import { analyzeMessage } from "./gemini";
import { callCEO } from "./ceo";
import { runCEORules } from "./ceoRules";
import { ConversationState } from "./types";
import { getProjects, getPeople, getAgents } from "./registry";
import { createNote } from "./notes";
import { normalizeText } from "./alias";

export async function handleMessage(
  text: string,
  chatId: number,
  state: ConversationState
): Promise<any> {
  switch (state.step) {
    case "idle": {
      const normalized = await normalizeText(text);

      const decision = await analyzeMessage(normalized);

      const registry = {
        projects: await getProjects(),
        people: await getPeople(),
        agents: await getAgents()
      };

      // Сначала быстрые правила
      const rule = runCEORules(decision, registry);

      if (rule) {
        return {
          type: "ask",
          message: rule.question,
          buttons: rule.buttons,
          nextState: {
            step: "waiting_ceo_answer",
            data: {
              decision,
              registry,
              ruleId: rule.id
            }
          }
        };
      }

      // Если правила не нашли неоднозначностей — CEO
      const ceoDecision = await callCEO(decision, registry);

      const notePath = await createNote(decision, ceoDecision);

      return {
        type: "confirm",
        decision,
        ceoDecision,
        message: ceoDecision.message,
        notePath,
        nextState: {
          step: "idle",
          data: {}
        }
      };
    }

    case "waiting_ceo_answer": {
      const { decision, registry } = state.data;

      const ceoDecision = await callCEO(
        decision,
        registry,
        text // сюда придет yes/no либо обычный текст
      );

      const notePath = await createNote(decision, ceoDecision);

      return {
        type: "confirm",
        decision,
        ceoDecision,
        message: ceoDecision.message,
        notePath,
        nextState: {
          step: "idle",
          data: {}
        }
      };
    }

    default:
      return {
        type: "response",
        message: "❌ Неизвестное состояние.",
        nextState: {
          step: "idle",
          data: {}
        }
      };
  }
}
