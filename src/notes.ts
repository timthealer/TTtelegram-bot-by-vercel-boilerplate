// src/notes.ts

import { Decision } from "./types";
import { putGitHubFile } from "./github";

function sanitize(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

function buildPath(decision: Decision): string {
  const folder = decision.folder?.trim() || "12_Inbox";

  const fileName =
    sanitize(decision.title || "Новая заметка") + ".md";

  return `${folder}/${fileName}`;
}

function buildMarkdown(decision: Decision): string {
  const entities =
    (decision.entities || [])
      .map((e) => `- ${e.type}: ${e.name}`)
      .join("\n") || "-";

  return `# ${decision.title}

## Тип

${decision.type}

## Описание

${decision.summary}

## Исходное сообщение

${decision.note}

## Сущности

${entities}
`;
}

export async function createNote(
  decision: Decision
): Promise<string> {

  const path = buildPath(decision);

  const content = buildMarkdown(decision);

  await putGitHubFile(
    path,
    content,
    `Create note: ${decision.title}`
  );

  return path;
}
