// src/registry.ts

import { getGitHubFile, putGitHubFile } from './github';
import * as yaml from 'js-yaml';

function safeParseYaml(content: string): any[] {
  if (!content) return [];

  const result: any[] = [];

  const blocks = content
    .split('---')
    .map(b => b.trim())
    .filter(b => b.length > 0);

  for (const block of blocks) {
    try {
      const obj = yaml.load(block);

      if (obj && typeof obj === 'object') {
        result.push(obj);
      }

    } catch (err) {
      console.warn('YAML block skipped:', err);
    }
  }

  return result;
}

export async function readRegistryFile(fileName: string): Promise<any[]> {
  try {
    const content = await getGitHubFile(`Registry/${fileName}`);

    if (!content) {
      return [];
    }

    return safeParseYaml(content);

  } catch (err) {
    console.warn(`Registry/${fileName} not found`);
    return [];
  }
}

export async function writeRegistryFile(
  fileName: string,
  entries: any[],
  commitMessage: string
): Promise<void> {

  let content = '';

  for (const entry of entries) {
    content +=
`---
${yaml.dump(entry)}
`;
  }

  if (content.trim() === '') {
    content = '# empty';
  }

  await putGitHubFile(
    `Registry/${fileName}`,
    content,
    commitMessage
  );
}

export async function getProjects() {
  return await readRegistryFile('Projects.md');
}

export async function getPeople() {
  return await readRegistryFile('People.md');
}

export async function getAgents() {
  return await readRegistryFile('Agents.md');
}

export async function addProject(project: any) {
  const projects = await getProjects();

  projects.push(project);

  await writeRegistryFile(
    'Projects.md',
    projects,
    `Add project: ${project.name}`
  );
}

export async function addPerson(person: any) {
  const people = await getPeople();

  people.push(person);

  await writeRegistryFile(
    'People.md',
    people,
    `Add person: ${person.name}`
  );
}

export async function addAgent(agent: any) {
  const agents = await getAgents();

  agents.push(agent);

  await writeRegistryFile(
    'Agents.md',
    agents,
    `Add agent: ${agent.name}`
  );
}
