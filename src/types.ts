// Типы для TOS Knowledge Engine

export interface Entity {
  id: string;
  type: string;
  name: string;
  aliases?: string[];
  [key: string]: any;
}

export interface MessageContext {
  chatId: number;
  text: string;
}

export interface Decision {
  entities: Entity[];          // всегда массив, даже пустой
  title: string;
  folder?: string;             // может быть пустым
  type: string;                // идея, задача, решение...
  summary: string;
  confidence: number;
  needConfirmation: boolean;
  note: string;
  tags?: string[];             // добавлено
  project?: string;            // добавлено
  people?: string;             // добавлено
}

export interface ConversationState {
  chatId: number;
  step: 'waiting_decision' | 'waiting_project' | 'waiting_person' | 'waiting_folder' | 'idle' | 'waiting_ceo_decision';
  data: any;
}

export interface CEODecision {
  decision: 'USE_EXISTING_PROJECT' | 'CREATE_NEW_PROJECT' | 'CREATE_NEW_ENTITY' | 'ASK_USER' | 'UPDATE_REGISTRY';
  project_id?: string;
  new_entities?: Entity[];
  actions?: any[];
  message: string;
}
