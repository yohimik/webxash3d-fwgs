import { decodeJWT, hashPassword } from "./utils";
import type { LogLevelString, LoggerWrapper } from "./logger";
import type { ApiClient } from "./api";
import type { I18nManager } from "./i18n";
import type { TokenData, DOMElements } from "./types";
import type { DOMManager } from "./dom";
import type { StorageManager } from "./storage";
import type { UIManager } from "./ui";

// ============================================
// Response Types
// ============================================

interface SaltResponse {
  salt: string;
}

interface LoginResponse {
  token: string;
  expiresIn: number;
  logLevel: string;
}

// ============================================
// Auth Service Options
// ============================================

export interface AuthServiceOptions {
  domManager: DOMManager;
  logger: LoggerWrapper;
  apiClient: ApiClient;
  storageManager: StorageManager;
  uiManager: UIManager;
  i18n: I18nManager;
}

// ============================================
// Auth Service Class
// ============================================

export class AuthService {
  private passwordSalt: string | null = null;
  private tokenExpiryTimer: ReturnType<typeof setInterval> | null = null;

  private readonly domManager: DOMManager;
  private readonly logger: LoggerWrapper;
  private readonly apiClient: ApiClient;
  private readonly storageManager: StorageManager;
  private readonly uiManager: UIManager;
  private readonly i18n: I18nManager;

  constructor(options: AuthServiceOptions) {
    this.domManager = options.domManager;
    this.logger = options.logger;
    this.apiClient = options.apiClient;
    this.storageManager = options.storageManager;
    this.uiManager = options.uiManager;
    this.i18n = options.i18n;
  }

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return this.domManager.elements;
  }

  // ============================================
  // Salt Management
  // ============================================

  /**
   * Fetches password salt from server
   */
  async fetchSalt(): Promise<string> {
    const response = await this.apiClient.request<SaltResponse>("GET", "/v1/auth", { includeAuth: false });

    if (response.status === 503) {
      throw new Error(this.i18n.t("errors.adminDisabled"));
    }

    if (!response.ok || !response.data) {
      throw new Error(this.i18n.t("errors.failedToFetchSalt"));
    }

    return response.data.salt;
  }

  /**
   * Prefetches salt on initialization
   */
  async prefetchSalt(): Promise<void> {
    try {
      this.passwordSalt = await this.fetchSalt();
    } catch (err) {
      this.logger.warn("Failed to prefetch salt:", err);
    }
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Performs login
   */
  async login(username: string, password: string): Promise<TokenData> {
    this.uiManager.setLoginButtonState(true);

    try {
      // Fetch salt if not cached
      if (!this.passwordSalt) {
        this.passwordSalt = await this.fetchSalt();
      }

      // Hash password with salt
      const passwordHash = await hashPassword(password, this.passwordSalt);

      const response = await this.apiClient.request<LoginResponse>(
        "POST",
        "/v1/auth",
        { body: { username, passwordHash }, includeAuth: false }
      );

      if (response.status === 401) {
        throw new Error(this.i18n.t("errors.invalidCredentials"));
      }

      if (response.status === 429) {
        throw new Error(this.i18n.t("errors.tooManyAttempts"));
      }

      if (response.status === 503) {
        throw new Error(this.i18n.t("errors.adminDisabled"));
      }

      if (!response.ok || !response.data) {
        throw new Error(this.i18n.t("errors.loginFailed"));
      }

      // Decode token to extract username
      const payload = decodeJWT(response.data.token);
      if (!payload || !payload.username) {
        throw new Error(this.i18n.t("errors.invalidToken"));
      }

      // Initialize logger with server-provided log level
      const logLevel = response.data.logLevel as LogLevelString;
      if (!this.logger.initialized) {
        this.logger.initialize(logLevel);
      } else {
        this.logger.setLevel(logLevel);
      }

      // Create token data
      const expiresAt = Date.now() + response.data.expiresIn * 1000;
      const tokenData: TokenData = {
        token: response.data.token,
        expiresAt,
        username: payload.username,
      };

      // Save to storage and set token for API client
      this.storageManager.saveTokenData(tokenData);
      this.apiClient.config = { authToken: tokenData.token };

      this.logger.info("Login successful for:", tokenData.username);

      // Clear form and errors
      this.uiManager.clearAuthError();
      this.uiManager.clearAuthForm();

      return tokenData;
    } finally {
      this.uiManager.setLoginButtonState(false);
    }
  }

  /**
   * Performs logout
   */
  logout(onLogout: () => void): void {
    if (this.tokenExpiryTimer) {
      clearInterval(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }

    this.storageManager.clearTokenData();
    this.apiClient.config = { authToken: null };
    this.uiManager.clearAuthForm();

    onLogout();
  }

  // ============================================
  // Admin Panel
  // ============================================

  /**
   * Initializes admin panel with token data
   */
  initializeAdminPanel(tokenData: TokenData): void {
    this.uiManager.showAdminPanel();
    this.uiManager.updateUsernameDisplay(tokenData.username);
    this.uiManager.updateTokenExpiry(tokenData);
    this.startTokenExpiryCheck(tokenData);
  }

  /**
   * Starts token expiry check timer
   */
  private startTokenExpiryCheck(tokenData: TokenData): void {
    if (this.tokenExpiryTimer) {
      clearInterval(this.tokenExpiryTimer);
    }

    // Update every minute
    this.tokenExpiryTimer = setInterval(() => {
      this.uiManager.updateTokenExpiry(tokenData);

      // Auto-logout if expired
      if (tokenData.expiresAt <= Date.now()) {
        clearInterval(this.tokenExpiryTimer!);
        this.tokenExpiryTimer = null;
      }
    }, 60 * 1000);
  }

  // ============================================
  // Event Handlers Setup
  // ============================================

  /**
   * Sets up authentication form handler
   */
  setupAuthHandler(onLogin: (tokenData: TokenData) => void): void {
    this.el.authForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = this.el.usernameInput.value.trim();
      const password = this.el.passwordInput.value.trim();

      if (!username) {
        this.uiManager.showAuthError(this.i18n.t("errors.usernameRequired"));
        return;
      }

      if (!password) {
        this.uiManager.showAuthError(this.i18n.t("errors.passwordRequired"));
        return;
      }

      try {
        const tokenData = await this.login(username, password);
        this.initializeAdminPanel(tokenData);
        onLogin(tokenData);
      } catch (error) {
        this.uiManager.showAuthError(
          error instanceof Error ? error.message : "Login failed"
        );
      }
    });
  }

  /**
   * Sets up disconnect handler
   */
  setupDisconnectHandler(onDisconnect: () => void): void {
    this.el.disconnectBtn.addEventListener("click", () => {
      this.logout(onDisconnect);
    });
  }
}
