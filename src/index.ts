// src/indexes.ts
import { getGitHubFile, putGitHubFile } from './github';
import * as yaml from 'js-yaml';

export interface DocumentIndexEntry {
  title: string;
  folder: string;
  file: string;
  tags: string[];
  type: string;
  created: string;
  updated: string;
  status: string;
}

export async function readDocumentIndex(): Promise<DocumentIndexEntry[]> {
  const content = await getGitHubFile('Indexes/Document_Index.md');
  if (!content || content.trim() === '') return [];
  const blocks = content.split('---').filter(b => b.trim());
  return blocks.map(block => yaml.load(block) as DocumentIndexEntry);
}

export async function writeDocumentIndex(entries: DocumentIndexEntry[]) {
  if (!entries || entries.length === 0) {
    await putGitHubFile('Indexes/Document_Index.md', '# Пустой индекс\n', 'Обновлён Document_Index');
    return;
  }
  const content = entries.map(e => `---\n${yaml.dump(e)}---`).join('\n');
  await putGitHubFile('Indexes/Document_Index.md', content, 'Обновлён Document_Index');
}

export async function updateDocumentIndex(notePath: string, decision: any) {
  const entries = await readDocumentIndex();
  const now = new Date().toISOString().slice(0, 10);
  const entry: DocumentIndexEntry = {
    title: decision.title || 'Без названия',
    folder: decision.folder || '12_Inbox',
    file: notePath,
    tags: decision.tags || [],
    type: decision.type || 'заметка',
    created: now,
    updated: now,
    status: 'активна'
  };

  // Проверяем, есть ли уже запись с таким файлом
  const existing = entries.find(e => e.file === notePath);
  if (existing) {
    existing.updated = now;
    existing.title = entry.title;
    existing.tags = entry.tags;
    existing.type = entry.type;
    existing.folder = entry.folder;
    existing.status = entry.status;
  } else {
    entries.push(entry);
  }

  await writeDocumentIndex(entries);
}
