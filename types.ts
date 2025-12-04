export enum CodeType {
  EXPERT_ADVISOR = 'Expert Advisor',
  INDICATOR = 'Indicator',
  SCRIPT = 'Script',
  LIBRARY = 'Library'
}

export interface GeneratedCode {
  content: string;
  explanation: string;
  timestamp: number;
}

export interface GenerationHistoryItem {
  id: string;
  prompt: string;
  type: CodeType;
  code: string;
  timestamp: number;
}

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  hasCodeUpdate?: boolean; // Visual indicator if this message updated the code
  timestamp: number;
}