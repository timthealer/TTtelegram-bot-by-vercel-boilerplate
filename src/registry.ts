import { Entity } from './types';
import { getGitHubFile, putGitHubFile } from './github';
import * as yaml from 'js-yaml';

export async function readRegistryFile(fileName: string): Promise<any[]> {
  const content = await getGitHubFile(`Registry/${fileName}`);
  if (!content || content.trim() === '') {
    return []; // Файл пуст — возвращаем пустой массив
  }
  // Разбиваем на блоки, разделённые '---'
  const blocks = content.split('---').filter(b => b.trim());
  if (blocks.length === 0) {
    return []; // Нет блоков — пустой массив
  }
  return blocks.map(block => {
    try {
      return yaml.load(block) as any;
    } catch (e) {
      console.error(`Ошибка парсинга YAML в ${fileName}:`, e);
      return null;
    }
  }).filter(item => item !== null);
}

export async function writeRegistryFile(fileName: string, entries: any[], commitMsg: string) {
  if (!entries || entries.length === 0) {
    // Если записей нет — записываем пустой файл с комментарием
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
export async function getProjects(): Promise<any[]> {
  return await readRegistryFile('Projects.md');
}

export async function getAgents(): Promise<any[]> {
  return await readRegistryFile('Agents.md');
}

export async function getPeople(): Promise<any[]> {
  const content = await getGitHubFile('Registry/People.md');
  if (!content) return [];
  const blocks = content.split('---').filter(b => b.trim());
  return blocks.map(block => yaml.load(block) as any);
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
