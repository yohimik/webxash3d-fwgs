import { storageManager } from "./storage";
import { authService } from "./auth";
import { webSocketManager } from "./websocket";
import { commandService } from "./commands";
import { uiManager } from "./ui";
import { apiClient } from "./api";
import { logger } from "./logger";
import { i18n } from "./i18n";
import type { TokenData } from "./types";

// ============================================
// Admin Application Class
// ============================================

class AdminApp {
  private tokenData: TokenData | null = null;

  /**
   * Handles logout
   */
  private handleLogout = (): void => {
    logger.info("User logged out");
    webSocketManager.disconnect();
    uiManager.clearLogs();
    uiManager.showAuthPanel();
    apiClient.setAuthToken(null);
    this.tokenData = null;
  };

  /**
   * Handles login
   */
  private handleLogin = (newTokenData: TokenData): void => {
    logger.info("User logged in:", newTokenData.username);
    this.tokenData = newTokenData;
    apiClient.setAuthToken(newTokenData.token);
    commandService.initialize(this.tokenData, this.handleLogout);
    webSocketManager.connect(this.tokenData, this.handleLogout);
  };

  /**
   * Initializes the application
   */
  async init(): Promise<void> {
    logger.info("Admin panel initializing...");

    // Initialize i18n first
    await i18n.init();

    // Prefetch salt (non-blocking)
    authService.prefetchSalt();

    // Setup UI
    uiManager.setupAutoScroll();
    uiManager.setupLanguageSelector();

    // Setup event handlers
    authService.setupAuthHandler(this.handleLogin);
    authService.setupDisconnectHandler(this.handleLogout);
    commandService.setupCommandHandler();
    commandService.setupQuickCommands();
    commandService.setupGameSettingsHandler();
    commandService.setupChangelevelHandler();

    // Check for existing session
    const storedTokenData = storageManager.loadTokenData();
    if (storedTokenData) {
      logger.info("Restoring session for:", storedTokenData.username);
      this.tokenData = storedTokenData;
      apiClient.setAuthToken(storedTokenData.token);
      authService.initializeAdminPanel(this.tokenData);
      commandService.initialize(this.tokenData, this.handleLogout);
      webSocketManager.connect(this.tokenData, this.handleLogout);
    } else {
      logger.info("No stored session found");
    }

    logger.info("Admin panel ready");
  }
}

// ============================================
// Application Entry Point
// ============================================

const app = new AdminApp();

// Start application when DOM is ready
window.addEventListener("DOMContentLoaded", () => app.init());
