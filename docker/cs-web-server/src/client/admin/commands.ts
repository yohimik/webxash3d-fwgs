import { domManager } from "./dom";
import { uiManager } from "./ui";
import { webSocketManager } from "./websocket";
import { getInputValue } from "./utils";
import { apiClient } from "./api";
import { i18n } from "./i18n";
import type { TokenData, DOMElements } from "./types";

// ============================================
// Command Service Class
// ============================================

class CommandService {
  private currentTokenData: TokenData | null = null;
  private onLogoutCallback: (() => void) | null = null;
  private originalSettings: Map<string, string> = new Map();
  private receivedSettings: Set<string> = new Set();
  private settingsTimeout: ReturnType<typeof setTimeout> | null = null;
  private allSettingNames: string[] = [];

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return domManager.elements;
  }

  /**
   * Initializes command system
   */
  initialize(tokenData: TokenData, onLogout: () => void): void {
    this.currentTokenData = tokenData;
    this.onLogoutCallback = onLogout;

    // Set up callback for settings received via WebSocket
    webSocketManager.setSettingReceivedCallback((settingName) => {
      this.onSettingReceived(settingName);
    });
  }

  /**
   * Sends a command to the server
   */
  async sendCommand(command: string): Promise<void> {
    if (!this.currentTokenData) {
      uiManager.addLog("System", i18n.t("errors.notAuthenticated"));
      return;
    }

    uiManager.addLog("System", `> ${command}`);

    try {
      const response = await apiClient.post<void>("/rcon", { command });

      if (response.status === 401) {
        uiManager.addLog(
          "System",
          i18n.t("errors.authFailed")
        );
        setTimeout(() => {
          if (this.onLogoutCallback) {
            this.onLogoutCallback();
          }
        }, 1000);
        return;
      }

      if (response.status === 403) {
        uiManager.addLog("System", i18n.t("errors.insufficientPermissions"));
        return;
      }

      if (response.status === 429) {
        uiManager.addLog(
          "System",
          i18n.t("errors.rateLimitExceeded")
        );
        return;
      }

      if (!response.ok) {
        uiManager.addLog(
          "System",
          i18n.t("errors.commandFailed", { status: response.status })
        );
        return;
      }

      // Command sent successfully (204 No Content)
      // Output will appear in logs via WebSocket
    } catch (error) {
      uiManager.addLog("System", `ERROR: ${error}`);
    }
  }

  // ============================================
  // Settings Management
  // ============================================

  /**
   * Called when a setting is received from WebSocket
   */
  onSettingReceived(settingName: string): void {
    this.receivedSettings.add(settingName);
  }

  /**
   * Fetches game settings from server
   */
  async fetchGameSettings(): Promise<void> {
    const form = this.el.gameSettingsForm;
    const inputs = form.querySelectorAll("input, select");

    uiManager.showSettingsLoading();
    uiManager.showAllSettingRows();
    this.receivedSettings.clear();
    this.originalSettings.clear();

    this.allSettingNames = Array.from(inputs)
      .map((i) => (i as HTMLInputElement | HTMLSelectElement).name)
      .filter((name) => name);

    if (this.settingsTimeout) {
      clearTimeout(this.settingsTimeout);
    }

    this.settingsTimeout = setTimeout(() => {
      this.handleSettingsTimeout();
    }, 2000);

    try {
      const response = await apiClient.post<void>("/rcon", {
        command: this.allSettingNames,
      });

      if (response.status !== 204) {
        uiManager.addLog("System", i18n.t("errors.failedToGetSettings"));
        if (this.settingsTimeout) {
          clearTimeout(this.settingsTimeout);
        }
        uiManager.showSettingsRefreshButton();
        return;
      }

      setTimeout(() => {
        this.finalizeSettingsFetch();
      }, 500);
    } catch (error) {
      uiManager.addLog("System", `ERROR: ${error}`);
      if (this.settingsTimeout) {
        clearTimeout(this.settingsTimeout);
      }
      uiManager.showSettingsRefreshButton();
    }
  }

  /**
   * Handles settings timeout
   */
  private handleSettingsTimeout(): void {
    if (this.receivedSettings.size === 0) {
      uiManager.addLog("System", i18n.t("errors.settingsTimeout"));
      uiManager.showSettingsRefreshButton();
    } else {
      this.finalizeSettingsFetch();
    }
  }

  /**
   * Finalizes settings fetch
   */
  private finalizeSettingsFetch(): void {
    if (this.settingsTimeout) {
      clearTimeout(this.settingsTimeout);
      this.settingsTimeout = null;
    }

    if (this.receivedSettings.size === 0) {
      uiManager.showSettingsRefreshButton();
      return;
    }

    for (const fieldName of this.allSettingNames) {
      if (!this.receivedSettings.has(fieldName)) {
        uiManager.hideSettingRow(fieldName);
      }
    }

    for (const fieldName of this.receivedSettings) {
      const input = document.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`#game-settings [name="${fieldName}"]`);
      if (input) {
        this.originalSettings.set(fieldName, getInputValue(input));
      }
    }

    uiManager.showSettingsForm();
    uiManager.addLog(
      "System",
      i18n.t("settings.loaded", { count: this.receivedSettings.size })
    );
  }

  /**
   * Applies changed game settings
   */
  async applyGameSettings(): Promise<void> {
    const form = this.el.gameSettingsForm;
    const inputs = form.querySelectorAll("input, select");

    let changedCount = 0;

    for (const input of inputs) {
      const element = input as HTMLInputElement | HTMLSelectElement;
      if (!element.name) continue;

      const value = getInputValue(element);
      const originalValue = this.originalSettings.get(element.name);

      // Only send if we have original value and it changed
      if (originalValue !== undefined && originalValue !== value) {
        await this.sendCommand(`${element.name} "${value.replace(/"/g, " ")}"`);
        changedCount++;
      }
    }

    if (changedCount === 0) {
      uiManager.addLog("System", i18n.t("settings.noChanges"));
    } else {
      uiManager.addLog("System", i18n.t("settings.applied", { count: changedCount }));
    }
  }

  // ============================================
  // Event Handlers Setup
  // ============================================

  /**
   * Sets up command form handler
   */
  setupCommandHandler(): void {
    this.el.commandForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const command = this.el.commandInput.value.trim();

      if (!command) return;

      await this.sendCommand(command);
      this.el.commandInput.value = "";
    });
  }

  /**
   * Sets up quick command buttons
   */
  setupQuickCommands(): void {
    document.querySelectorAll(".quick-cmd").forEach((btn) => {
      btn.addEventListener("click", () => {
        const command = btn.getAttribute("data-cmd");
        if (command) {
          this.sendCommand(command);
        }
      });
    });
  }

  /**
   * Sets up game settings handlers
   */
  setupGameSettingsHandler(): void {
    this.el.gameSettingsCurrent.addEventListener("click", async () => {
      await this.fetchGameSettings();
    });

    this.el.settingsRefreshBtn.addEventListener("click", () => {
      window.location.reload();
    });

    this.el.gameSettingsApply.addEventListener("click", async () => {
      await this.applyGameSettings();
    });
  }

  /**
   * Sets up changelevel button handler
   */
  setupChangelevelHandler(): void {
    this.el.changelevelBtn.addEventListener("click", () => {
      const selectedMap = this.el.mapsSelect.value;
      if (selectedMap) {
        this.sendCommand(`changelevel ${selectedMap}`);
      }
    });

    // Enable/disable button based on select state
    this.el.mapsSelect.addEventListener("change", () => {
      this.el.changelevelBtn.disabled = !this.el.mapsSelect.value;
    });
  }
}

// Export singleton instance
export const commandService = new CommandService();
