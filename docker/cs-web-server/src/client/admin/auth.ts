import { domManager } from "./dom";
import { decodeJWT, hashPassword } from "./utils";
import { storageManager } from "./storage";
import { uiManager } from "./ui";
import { logger } from "./logger";
import { apiClient } from "./api";
import { i18n } from "./i18n";
import type { TokenData, DOMElements } from "./types";

// ============================================
// Response Types
// ============================================

interface SaltResponse {
  salt: string;
}

interface LoginResponse {
  token: string;
  expiresIn: number;
}

// ============================================
// Auth Service Class
// ============================================

class AuthService {
  private passwordSalt: string | null = null;
  private tokenExpiryTimer: NodeJS.Timeout | null = null;

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return domManager.elements;
  }

  // ============================================
  // Salt Management
  // ============================================

  /**
   * Fetches password salt from server
   */
  async fetchSalt(): Promise<string> {
    const response = await apiClient.get<SaltResponse>("/auth/salt", false);

    if (response.status === 503) {
      throw new Error(i18n.t("errors.adminDisabled"));
    }

    if (!response.ok || !response.data) {
      throw new Error(i18n.t("errors.failedToFetchSalt"));
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
      logger.warn("Failed to prefetch salt:", err);
    }
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Performs login
   */
  async login(username: string, password: string): Promise<TokenData> {
    uiManager.setLoginButtonState(true);

    try {
      // Fetch salt if not cached
      if (!this.passwordSalt) {
        this.passwordSalt = await this.fetchSalt();
      }

      // Hash password with salt
      const passwordHash = await hashPassword(password, this.passwordSalt);

      const response = await apiClient.post<LoginResponse>(
        "/login",
        { username, passwordHash },
        false
      );

      if (response.status === 401) {
        throw new Error(i18n.t("errors.invalidCredentials"));
      }

      if (response.status === 429) {
        throw new Error(i18n.t("errors.tooManyAttempts"));
      }

      if (response.status === 503) {
        throw new Error(i18n.t("errors.adminDisabled"));
      }

      if (!response.ok || !response.data) {
        throw new Error(i18n.t("errors.loginFailed"));
      }

      // Decode token to extract username
      const payload = decodeJWT(response.data.token);
      if (!payload || !payload.username) {
        throw new Error(i18n.t("errors.invalidToken"));
      }

      // Create token data
      const expiresAt = Date.now() + response.data.expiresIn * 1000;
      const tokenData: TokenData = {
        token: response.data.token,
        expiresAt,
        username: payload.username,
      };

      // Save to storage and set token for API client
      storageManager.saveTokenData(tokenData);
      apiClient.setAuthToken(tokenData.token);

      logger.info("Login successful for:", tokenData.username);

      // Clear form and errors
      uiManager.clearAuthError();
      uiManager.clearAuthForm();

      return tokenData;
    } finally {
      uiManager.setLoginButtonState(false);
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

    storageManager.clearTokenData();
    apiClient.setAuthToken(null);
    uiManager.clearAuthForm();

    onLogout();
  }

  // ============================================
  // Admin Panel
  // ============================================

  /**
   * Initializes admin panel with token data
   */
  initializeAdminPanel(tokenData: TokenData): void {
    uiManager.showAdminPanel();
    uiManager.updateUsernameDisplay(tokenData.username);
    uiManager.updateTokenExpiry(tokenData);
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
      uiManager.updateTokenExpiry(tokenData);

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
        uiManager.showAuthError("Username is required");
        return;
      }

      if (!password) {
        uiManager.showAuthError("Password is required");
        return;
      }

      try {
        const tokenData = await this.login(username, password);
        this.initializeAdminPanel(tokenData);
        onLogin(tokenData);
      } catch (error) {
        uiManager.showAuthError(
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

// Export singleton instance
export const authService = new AuthService();
