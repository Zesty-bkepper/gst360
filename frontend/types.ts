
export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ResearchTopic {
  id: string;
  title: string;
  summary: string;
  keyInsights: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
