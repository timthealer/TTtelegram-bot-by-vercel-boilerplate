// Типы для TOS Knowledge Engine

export interface Entity {
  id: string;           // уникальный ID, например "person-maxim"
  type: string;         // "person", "project", "technology", "company", "research"
  name: string;
  aliases?: string[];
  [key: string]: any;   // дополнительные поля (status, created, projects, files...)
}

export interface MessageContext {
  chatId: number;
  text: string;
}

export interface Decision {
  entities: Entity[];   // извлечённые сущности
  title: string;
  folder?: string;      // может быть пустым, если не определена
  type: string;         // идея, задача, решение...
  summary: string;
  confidence: number;
  needConfirmation: boolean;
  note: string;
}

export interface ConversationState {
  chatId: number;
  step: 'waiting_decision' | 'waiting_project' | 'waiting_person' | 'waiting_folder' | 'idle' | 'waiting_ceo_decision';
  data: any;            // временные данные (например, решение до подтверждения)
}

export interface CEODecision {
  decision: 'USE_EXISTING_PROJECT' | 'CREATE_NEW_PROJECT' | 'CREATE_NEW_ENTITY' | 'ASK_USER' | 'UPDATE_REGISTRY';
  project_id?: string;   // если используется существующий проект
  new_entities?: Entity[]; // если создаются новые сущности
  actions?: any[];       // действия для Архивариуса
  message: string;       // объяснение для пользователя
}
