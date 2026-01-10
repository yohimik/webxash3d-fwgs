// ============================================
// DOM Element References
// ============================================

export const elements = {
  // Containers
  authContainer: document.getElementById("auth-container")!,
  adminContainer: document.getElementById("admin-container")!,
  logsContainer: document.getElementById("logs-container")!,

  // Auth elements
  authForm: document.getElementById("auth-form") as HTMLFormElement,
  authError: document.getElementById("auth-error")!,
  usernameInput: document.getElementById("username") as HTMLInputElement,
  passwordInput: document.getElementById("password") as HTMLInputElement,
  loginBtn: document.getElementById("login-btn") as HTMLButtonElement,

  // Admin elements
  disconnectBtn: document.getElementById("disconnect-btn")!,
  commandForm: document.getElementById("command-form") as HTMLFormElement,
  commandInput: document.getElementById("command-input") as HTMLInputElement,

  // Status elements
  connectionStatus: document.getElementById("connection-status")!,
  connectionText: document.getElementById("connection-text")!,
  tokenExpiry: document.getElementById("token-expiry")!,
  usernameDisplay: document.getElementById("username-display")!,

  // Settings form
  gameSettingsForm: document.getElementById("game-settings") as HTMLFormElement,
  gameSettingsCurrent: document.getElementById("game-settings-current") as HTMLButtonElement,
  gameSettingsApply: document.getElementById("game-settings-apply") as HTMLButtonElement,

  // Maps elements
  mapsSelect: document.getElementById("maps-select") as HTMLSelectElement,
  changelevelBtn: document.getElementById("changelevel-btn") as HTMLButtonElement,
};
