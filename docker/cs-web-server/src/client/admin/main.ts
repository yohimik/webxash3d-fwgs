import { storageManager } from "./storage";
import { AuthService } from "./auth";
import { WebSocketManager } from "./websocket";
import { CommandService } from "./commands";
import { uiManager } from "./ui";
import { ApiClient } from "./api";
import { logger } from "./logger";
import { i18n } from "./i18n";
import { domManager } from "./dom";
import type { TokenData } from "./types";

// ============================================
// Admin Application Class
// ============================================

class AdminApp {
  private tokenData: TokenData | null = null;
  private readonly apiClient: ApiClient;
  private readonly authService: AuthService;
  private readonly webSocketManager: WebSocketManager;
  private readonly commandService: CommandService;

  constructor() {
    // Create API client with logger
    this.apiClient = new ApiClient({ logger });

    // Create WebSocket manager with DI
    this.webSocketManager = new WebSocketManager({
      domManager,
      uiManager,
      logger,
      i18n,
    });

    // Create command service with DI
    this.commandService = new CommandService({
      domManager,
      uiManager,
      webSocketManager: this.webSocketManager,
      apiClient: this.apiClient,
      i18n,
      logger,
    });

    // Create auth service with DI
    this.authService = new AuthService({
      domManager,
      logger,
      apiClient: this.apiClient,
      storageManager,
      uiManager,
      i18n,
    });
  }

  /**
   * Handles logout
   */
  private handleLogout = (): void => {
    logger.info("User logged out");
    this.webSocketManager.disconnect();
    uiManager.clearLogs();
    uiManager.showAuthPanel();
    this.apiClient.config = { authToken: null };
    this.tokenData = null;
  };

  /**
   * Handles login
   */
  private handleLogin = (newTokenData: TokenData): void => {
    logger.info("User logged in:", newTokenData.username);
    this.tokenData = newTokenData;
    this.apiClient.config = { authToken: newTokenData.token };
    this.commandService.initialize(this.tokenData, this.handleLogout);
    this.webSocketManager.connect(this.tokenData, this.handleLogout);
  };

  /**
   * Initializes the application
   */
  async init(): Promise<void> {
    logger.info("Admin panel initializing...");

    // Initialize i18n first
    await i18n.init();

    // Prefetch salt (non-blocking)
    this.authService.prefetchSalt();

    // Setup UI
    uiManager.setupAutoScroll();
    uiManager.setupLanguageSelector();

    // Setup event handlers
    this.authService.setupAuthHandler(this.handleLogin);
    this.authService.setupDisconnectHandler(this.handleLogout);
    this.commandService.setupCommandHandler();
    this.commandService.setupQuickCommands();
    this.commandService.setupGameSettingsHandler();
    this.commandService.setupChangelevelHandler();

    // Check for existing session
    const storedTokenData = storageManager.loadTokenData();
    if (storedTokenData) {
      // Initialize logger with default level for restored sessions
      if (!logger.initialized) {
        logger.initialize("info");
      }
      logger.info("Restoring session for:", storedTokenData.username);
      this.tokenData = storedTokenData;
      this.apiClient.config = { authToken: storedTokenData.token };
      this.authService.initializeAdminPanel(this.tokenData);
      this.commandService.initialize(this.tokenData, this.handleLogout);
      this.webSocketManager.connect(this.tokenData, this.handleLogout);
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
