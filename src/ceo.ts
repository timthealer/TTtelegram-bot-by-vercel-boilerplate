// src/ceo.ts

import { Decision, CEODecision } from "./types";
import { runCEORules } from "./ceoRules";

export interface CEOSession {
  question: string;
  decision: Decision;
}

export async function callCEO(
  decision: Decision,
  registryData: any,
  userAnswer?: string
): Promise<CEODecision> {
  return runCEORules(
    decision,
    registryData.projects || [],
    registryData.people || [],
    registryData.agents || [],
    userAnswer
  );
}
