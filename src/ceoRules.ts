// src/ceoRules.ts
import { Decision, CEODecision, Entity } from './types';

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findMatchingProject(
  name: string,
  projects: any[]
): { exact: any | null; similar: any[] } {
  const normalized = normalize(name);
  const exact = projects.find(p => normalize(p.name) === normalized) || null;
  const similar = projects.filter(p =>
    !exact && (
      normalize(p.name).includes(normalized) ||
      normalized.includes(normalize(p.name)) ||
      (p.aliases && p.aliases.some((a: string) => normalize(a) === normalized))
    )
  );
  return { exact, similar };
}

function findMatchingPerson(
  name: string,
  people: any[]
): { exact: any | null; similar: any[] } {
  const normalized = normalize(name);
  const exact = people.find(p => normalize(p.name) === normalized) || null;
  const similar = people.filter(p =>
    !exact && (
      normalize(p.name).includes(normalized) ||
      normalized.includes(normalize(p.name)) ||
      (p.aliases && p.aliases.some((a: string) => normalize(a) === normalized))
    )
  );
  return { exact, similar };
}

export function runCEORules(
  decision: Decision,
  registry: { projects: any[]; people: any[]; agents: any[] }
): CEODecision {
  const { projects, people } = registry;

  // Извлекаем сущности проекта и человека из decision.entities
  const projectEntity = decision.entities.find(e => e.type === 'project');
  const personEntity = decision.entities.find(e => e.type === 'person');

  // --- Обработка проекта ---
  let projectResult: { exact: any | null; similar: any[] } | null = null;
  let projectName = projectEntity?.name || '';
  if (projectName) {
    projectResult = findMatchingProject(projectName, projects);
  }

  // --- Обработка человека ---
  let personResult: { exact: any | null; similar: any[] } | null = null;
  let personName = personEntity?.name || '';
  if (personName) {
    personResult = findMatchingPerson(personName, people);
  }

  // --- Случай: есть и проект, и человек, и оба точные совпадения ---
  if (projectResult?.exact && personResult?.exact) {
    return {
      decision: 'USE_EXISTING_PROJECT',
      project_id: projectResult.exact.id,
      actions: [
        { type: 'set_project', project: projectResult.exact.folder || '12_Inbox' },
        { type: 'link_person', person_id: personResult.exact.id }
      ],
      message: `✅ Использую существующий проект "${projectResult.exact.name}" и человека "${personResult.exact.name}".`
    };
  }

  // --- Случай: есть проект, но неоднозначность или отсутствие ---
  if (projectEntity) {
    if (projectResult?.exact) {
      // Точное совпадение — используем проект
      const project = projectResult.exact;
      // Проверяем человека
      if (personEntity) {
        if (personResult?.exact) {
          return {
            decision: 'USE_EXISTING_PROJECT',
            project_id: project.id,
            actions: [
              { type: 'set_project', project: project.folder || '12_Inbox' },
              { type: 'link_person', person_id: personResult.exact.id }
            ],
            message: `✅ Использую проект "${project.name}" и человека "${personResult.exact.name}".`
          };
        } else if (personResult?.similar.length > 0) {
          // Есть похожие люди — спрашиваем
          const buttons = personResult.similar.map(p => ({
            text: `${p.name} (существующий)`,
            value: `person_existing_${p.id}`
          }));
          buttons.push({ text: '➕ Новый человек', value: 'person_new' });
          buttons.push({ text: '❌ Отмена', value: 'cancel' });
          return {
            decision: 'ASK_USER',
            message: `👤 Найдены похожие люди для "${personName}":\n${personResult.similar.map(p => `- ${p.name}`).join('\n')}\n\nВыберите:`,
            actions: [],
            buttons
          };
        } else {
          // Человек не найден — предлагаем создать
          const buttons = [
            { text: '➕ Создать нового человека', value: 'person_create' },
            { text: '❌ Пропустить', value: 'person_skip' }
          ];
          return {
            decision: 'ASK_USER',
            message: `👤 Человек "${personName}" не найден. Создать нового?`,
            actions: [{ type: 'set_project', project: project.folder || '12_Inbox' }],
            buttons
          };
        }
      } else {
        // Только проект, человека нет
        return {
          decision: 'USE_EXISTING_PROJECT',
          project_id: project.id,
          actions: [{ type: 'set_project', project: project.folder || '12_Inbox' }],
          message: `✅ Использую проект "${project.name}". Сохранить заметку?`
        };
      }
    } else if (projectResult?.similar.length > 0) {
      // Есть похожие проекты — спрашиваем
      const buttons = projectResult.similar.map(p => ({
        text: `${p.name} (существующий)`,
        value: `project_existing_${p.id}`
      }));
      buttons.push({ text: '➕ Новый проект', value: 'project_new' });
      buttons.push({ text: '❌ Отмена', value: 'cancel' });
      return {
        decision: 'ASK_USER',
        message: `📁 Найдены похожие проекты для "${projectName}":\n${projectResult.similar.map(p => `- ${p.name}`).join('\n')}\n\nВыберите:`,
        actions: [],
        buttons
      };
    } else {
      // Проект не найден — предлагаем создать
      const buttons = [
        { text: '➕ Создать новый проект', value: 'project_create' },
        { text: '❌ Отмена', value: 'cancel' }
      ];
      return {
        decision: 'ASK_USER',
        message: `📁 Проект "${projectName}" не найден. Создать новый?`,
        actions: [],
        buttons
      };
    }
  }

  // --- Случай: есть только человек, без проекта ---
  if (personEntity) {
    if (personResult?.exact) {
      return {
        decision: 'USE_EXISTING_PROJECT', // но проекта нет, используем дефолтную папку
        actions: [
          { type: 'set_project', project: '12_Inbox' },
          { type: 'link_person', person_id: personResult.exact.id }
        ],
        message: `✅ Использую существующего человека "${personResult.exact.name}". Сохранить в Inbox?`
      };
    } else if (personResult?.similar.length > 0) {
      const buttons = personResult.similar.map(p => ({
        text: `${p.name} (существующий)`,
        value: `person_existing_${p.id}`
      }));
      buttons.push({ text: '➕ Новый человек', value: 'person_new' });
      buttons.push({ text: '❌ Отмена', value: 'cancel' });
      return {
        decision: 'ASK_USER',
        message: `👤 Найдены похожие люди для "${personName}":\n${personResult.similar.map(p => `- ${p.name}`).join('\n')}\n\nВыберите:`,
        actions: [],
        buttons
      };
    } else {
      const buttons = [
        { text: '➕ Создать нового человека', value: 'person_create' },
        { text: '❌ Пропустить', value: 'person_skip' }
      ];
      return {
        decision: 'ASK_USER',
        message: `👤 Человек "${personName}" не найден. Создать нового?`,
        actions: [],
        buttons
      };
    }
  }

  // --- Ничего не найдено — просто сохраняем в Inbox ---
  return {
    decision: 'USE_EXISTING_PROJECT', // используем Inbox как проект по умолчанию
    actions: [{ type: 'set_project', project: '12_Inbox' }],
    message: '📥 Сохраню в Inbox. Если нужно в другой проект — уточните.'
  };
}
