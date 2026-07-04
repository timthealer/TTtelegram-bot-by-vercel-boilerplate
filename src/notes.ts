// src/notes.ts
import { Decision } from './types';
import { putGitHubFile } from './github';
import { updateDocumentIndex } from './indexes';

export async function createNote(decision: Decision, ceoDecision: any): Promise<string> {
  const title = decision.title || 'заметка';
  const folder = decision.folder || '12_Inbox';
  const fileName = title.replace(/[^a-zA-Zа-яА-Я0-9\s-]/g, '').trim().replace(/\s+/g, '_') + '.md';
  const filePath = `${folder}/${fileName}`;

  const now = new Date();
  const entities = decision.entities?.map(e => `  - ${e.id}`).join('\n') ?? '';
  const tags = (decision.tags || []).join(', ');

  const frontmatter = `---
title: ${title}
type: ${decision.type || 'заметка'}
status: активна
entities:
${entities}
tags: [${tags}]
created: ${now.toISOString().slice(0, 10)}
source: telegram
---
${decision.note || ''}`;

  await putGitHubFile(filePath, frontmatter, `Добавлено из Telegram: ${title}`);

  // Обновляем Document_Index
  await updateDocumentIndex(filePath, decision);

  return filePath;
}
