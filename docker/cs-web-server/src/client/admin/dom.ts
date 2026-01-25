import type { DOMElements } from "./types";

// ============================================
// DOM Manager Class
// ============================================

class DOMManager {
  private _elements: DOMElements | null = null;

  /**
   * Gets all DOM elements (lazy initialization)
   */
  get elements(): DOMElements {
    if (!this._elements) {
      this._elements = this.initializeElements();
    }
    return this._elements;
  }

  /**
   * Initializes all DOM element references
   */
  private initializeElements(): DOMElements {
    return {
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
      commandInput: document.getElementById(
        "command-input"
      ) as HTMLInputElement,

      // Status elements
      connectionStatus: document.getElementById("connection-status")!,
      connectionText: document.getElementById("connection-text")!,
      tokenExpiry: document.getElementById("token-expiry")!,
      usernameDisplay: document.getElementById("username-display")!,

      // Settings form
      gameSettingsForm: document.getElementById(
        "game-settings"
      ) as HTMLFormElement,
      gameSettingsCurrent: document.getElementById(
        "game-settings-current"
      ) as HTMLButtonElement,
      gameSettingsApply: document.getElementById(
        "game-settings-apply"
      ) as HTMLButtonElement,

      // Maps elements
      mapsSelect: document.getElementById("maps-select") as HTMLSelectElement,
      changelevelBtn: document.getElementById(
        "changelevel-btn"
      ) as HTMLButtonElement,

      // Settings status elements
      settingsStatus: document.getElementById("settings-status")!,
      settingsStatusText: document.getElementById("settings-status-text")!,
      settingsRefreshBtn: document.getElementById(
        "settings-refresh-btn"
      ) as HTMLButtonElement,
    };
  }

  /**
   * Resets cached elements (useful for testing)
   */
  reset(): void {
    this._elements = null;
  }
}

// Export singleton instance
export const domManager = new DOMManager();

// Export class for type usage
export { DOMManager };
