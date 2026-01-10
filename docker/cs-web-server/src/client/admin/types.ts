// ============================================
// Type Definitions
// ============================================

export interface TokenData {
  token: string;
  expiresAt: number;
  username: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface WebSocketMessage {
  event: 'history' | 'log';
  logs?: LogEntry[];
  timestamp?: string;
  message?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
