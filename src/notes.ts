import { Decision } from './types';
import { putGitHubFile } from './github';

export async function createNote(decision: Decision, ceoDecision: any): Promise<string> {
  const title = decision.title || 'заметка';
  const folder = decision.folder || '12_Inbox';
  const fileName = title.replace(/[^a-zA-Zа-яА-Я0-9\s-]/g, '').trim().replace(/\s+/g, '_') + '.md';
  const filePath = `${folder}/${fileName}`;

  const now = new Date();
  const frontmatter = `---
title: ${title}
type: ${decision.type}
status: активна
entities:
${decision.entities.map(e => `  - ${e.id}`).join('\n')}
tags: [${(decision.tags || []).join(', ')}]
created: ${now.toISOString().slice(0, 10)}
source: telegram
---
${decision.note}`;

  await putGitHubFile(filePath, frontmatter, `Добавлено из Telegram: ${title}`);
  return filePath;
}
