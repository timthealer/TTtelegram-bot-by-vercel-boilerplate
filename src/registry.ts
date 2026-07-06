// src/registry.ts
import { Entity } from './types';
import { getGitHubFile, putGitHubFile } from './github';
import * as yaml from 'js-yaml';

/**
 * Безопасный парсер YAML-блоков из файла Registry
 * Возвращает всегда массив, даже если файл пуст или повреждён
 */
function safeParseYaml(content: string | null): any[] {
  if (!content || content.trim() === '') return [];

  try {
    const blocks = content.split('---').filter(b => b.trim());

    return blocks
      .map(block => {
        try {
          // Проверяем, есть ли в блоке хотя бы одно поле (ключ: значение)
          // Если блок содержит только комментарии или пуст — пропускаем
          if (!block.includes(':') && !block.includes('id:')) {
            return null;
          }
          return yaml.load(block) as any;
        } catch (e) {
          // Ошибка парсинга одного блока — игнорируем
          return null;
        }
      })
      .filter(item => item !== null); // убираем null
  } catch (e) {
    console.warn('Ошибка парсинга Registry:', e);
    return [];
  }
}

export async function readRegistryFile(fileName: string): Promise<any[]> {
  const content = await getGitHubFile(`Registry/${fileName}`);
  return safeParseYaml(content);
}

export async function writeRegistryFile(
  fileName: string,
  entries: any[],
  commitMsg: string
) {
  if (!entries || entries.length === 0) {
    await putGitHubFile(`Registry/${fileName}`, '# Пустой реестр\n', commitMsg);
    return;
  }
  const content = entries.map(e => `---\n${yaml.dump(e)}---`).join('\n');
  await putGitHubFile(`Registry/${fileName}`, content, commitMsg);
}

export async function getProjects(): Promise<any[]> {
  return await readRegistryFile('Projects.md');
}

export async function getAgents(): Promise<any[]> {
  return await readRegistryFile('Agents.md');
}

export async function getPeople(): Promise<any[]> {
  return await readRegistryFile('People.md');
}

export async function addProject(project: any) {
  const projects = await getProjects();
  projects.push(project);
  await writeRegistryFile('Projects.md', projects, `Add project: ${project.name}`);
}

export async function addPerson(person: any) {
  const people = await getPeople();
  people.push(person);
  await writeRegistryFile('People.md', people, `Add person: ${person.name}`);
}
