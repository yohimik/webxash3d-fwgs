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

export interface JWTPayload {
  username: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface WebSocketMessage {
  event: "v1:auth" | "v1:error" | "v1:history" | "v1:log";
  status?: string;
  error?: string;
  logs?: LogEntry[];
  timestamp?: string;
  message?: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

// ============================================
// Event Emitter Types
// ============================================

export type EventCallback<T = void> = (data: T) => void;

export interface AdminEvents {
  login: TokenData;
  logout: void;
  settingReceived: string;
  mapsListed: string[];
}

// ============================================
// DOM Elements Interface
// ============================================

export interface DOMElements {
  // Containers
  authContainer: HTMLElement;
  adminContainer: HTMLElement;
  logsContainer: HTMLElement;

  // Auth elements
  authForm: HTMLFormElement;
  authError: HTMLElement;
  usernameInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  loginBtn: HTMLButtonElement;

  // Admin elements
  disconnectBtn: HTMLElement;
  commandForm: HTMLFormElement;
  commandInput: HTMLInputElement;

  // Status elements
  connectionStatus: HTMLElement;
  connectionText: HTMLElement;
  tokenExpiry: HTMLElement;
  usernameDisplay: HTMLElement;

  // Settings form
  gameSettingsForm: HTMLFormElement;
  gameSettingsCurrent: HTMLButtonElement;
  gameSettingsApply: HTMLButtonElement;

  // Maps elements
  mapsSelect: HTMLSelectElement;
  changelevelBtn: HTMLButtonElement;

  // Settings status elements
  settingsStatus: HTMLElement;
  settingsStatusText: HTMLElement;
  settingsRefreshBtn: HTMLButtonElement;
}
