import { Entity } from './types';
import { getGitHubFile, putGitHubFile } from './github';
import * as yaml from 'js-yaml';

export async function readRegistryFile(fileName: string): Promise<any[]> {
  const content = await getGitHubFile(`Registry/${fileName}`);
  if (!content) return [];
  const blocks = content.split('---').filter(b => b.trim());
  return blocks.map(block => yaml.load(block) as any);
}

export async function writeRegistryFile(fileName: string, entries: any[], commitMsg: string) {
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
