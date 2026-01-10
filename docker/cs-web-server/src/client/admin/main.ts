import { loadTokenData } from "./storage";
import {
  prefetchSalt,
  setupAuthHandler,
  setupDisconnectHandler,
  initializeAdminPanel,
  logout,
} from "./auth";
import { connectWebSocket, disconnectWebSocket } from "./websocket";
import {
  setupCommandHandler,
  setupQuickCommands,
  initializeCommands,
  setupGameSettingsHandler,
  setupChangelevelHandler,
} from "./commands";
import { setupAutoScroll, clearLogs, showAuthPanel } from "./ui";
import type { TokenData } from "./types";

// ============================================
// Application State
// ============================================

let tokenData: TokenData | null = null;

// ============================================
// Event Handlers
// ============================================

function handleLogout(): void {
  disconnectWebSocket();
  clearLogs();
  showAuthPanel();
  tokenData = null;
}

function handleLogin(newTokenData: TokenData): void {
  tokenData = newTokenData;
  initializeCommands(tokenData, handleLogout);
  connectWebSocket(tokenData, handleLogout);
}

// ============================================
// Initialization
// ============================================

async function init(): Promise<void> {
  // Prefetch salt (non-blocking)
  prefetchSalt();

  // Setup UI
  setupAutoScroll();

  // Setup event handlers
  setupAuthHandler(handleLogin);
  setupDisconnectHandler(handleLogout);
  setupCommandHandler();
  setupQuickCommands();
  setupGameSettingsHandler();
  setupChangelevelHandler();

  // Check for existing session
  const storedTokenData = loadTokenData();
  if (storedTokenData) {
    tokenData = storedTokenData;
    initializeAdminPanel(tokenData);
    initializeCommands(tokenData, handleLogout);
    connectWebSocket(tokenData, handleLogout);
  }
}

// Start application
window.addEventListener("DOMContentLoaded", init);
