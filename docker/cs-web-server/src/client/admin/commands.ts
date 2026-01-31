import { getInputValue } from "./utils";
import type { ApiClient } from "./api";
import type { I18nManager } from "./i18n";
import type { LoggerWrapper } from "./logger";
import type { TokenData, DOMElements } from "./types";
import type { DOMManager } from "./dom";
import type { UIManager } from "./ui";
import type { WebSocketManager } from "./websocket";

// ============================================
// Command Service Options
// ============================================

export interface CommandServiceOptions {
  domManager: DOMManager;
  uiManager: UIManager;
  webSocketManager: WebSocketManager;
  apiClient: ApiClient;
  i18n: I18nManager;
  logger: LoggerWrapper;
}

// ============================================
// Command Service Class
// ============================================

export class CommandService {
  private currentTokenData: TokenData | null = null;
  private onLogoutCallback: (() => void) | null = null;
  private originalSettings: Map<string, string> = new Map();
  private receivedSettings: Set<string> = new Set();
  private settingsTimeout: ReturnType<typeof setTimeout> | null = null;
  private allSettingNames: string[] = [];

  private readonly domManager: DOMManager;
  private readonly uiManager: UIManager;
  private readonly webSocketManager: WebSocketManager;
  private readonly apiClient: ApiClient;
  private readonly i18n: I18nManager;
  private readonly logger: LoggerWrapper;

  constructor(options: CommandServiceOptions) {
    this.domManager = options.domManager;
    this.uiManager = options.uiManager;
    this.webSocketManager = options.webSocketManager;
    this.apiClient = options.apiClient;
    this.i18n = options.i18n;
    this.logger = options.logger;
  }

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return this.domManager.elements;
  }

  /**
   * Initializes command system
   */
  initialize(tokenData: TokenData, onLogout: () => void): void {
    this.currentTokenData = tokenData;
    this.onLogoutCallback = onLogout;
    this.apiClient.config = { authToken: tokenData.token };

    // Set up callback for settings received via WebSocket
    this.webSocketManager.setSettingReceivedCallback((settingName) => {
      this.onSettingReceived(settingName);
    });
  }

  /**
   * Sends a command to the server
   */
  async sendCommand(command: string): Promise<void> {
    if (!this.currentTokenData) {
      this.uiManager.addLog("System", this.i18n.t("errors.notAuthenticated"));
      return;
    }

    this.uiManager.addLog("System", `> ${command}`);

    try {
      const response = await this.apiClient.request<void>("POST", "/v1/rcon", { body: { command } });

      if (response.status === 401) {
        this.uiManager.addLog(
          "System",
          this.i18n.t("errors.authFailed")
        );
        setTimeout(() => {
          if (this.onLogoutCallback) {
            this.onLogoutCallback();
          }
        }, 1000);
        return;
      }

      if (response.status === 403) {
        this.uiManager.addLog("System", this.i18n.t("errors.insufficientPermissions"));
        return;
      }

      if (response.status === 429) {
        this.uiManager.addLog(
          "System",
          this.i18n.t("errors.rateLimitExceeded")
        );
        return;
      }

      if (!response.ok) {
        this.uiManager.addLog(
          "System",
          this.i18n.t("errors.commandFailed", { status: response.status })
        );
        return;
      }

      // Command sent successfully (204 No Content)
      // Output will appear in logs via WebSocket
    } catch (error) {
      this.uiManager.addLog("System", `ERROR: ${error}`);
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

    this.uiManager.showSettingsLoading();
    this.uiManager.showAllSettingRows();
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
      const response = await this.apiClient.request<void>("POST", "/v1/rcon", {
        body: { command: this.allSettingNames },
      });

      if (response.status !== 204) {
        this.uiManager.addLog("System", this.i18n.t("errors.failedToGetSettings"));
        if (this.settingsTimeout) {
          clearTimeout(this.settingsTimeout);
        }
        this.uiManager.showSettingsRefreshButton();
        return;
      }

      setTimeout(() => {
        this.finalizeSettingsFetch();
      }, 500);
    } catch (error) {
      this.uiManager.addLog("System", `ERROR: ${error}`);
      if (this.settingsTimeout) {
        clearTimeout(this.settingsTimeout);
      }
      this.uiManager.showSettingsRefreshButton();
    }
  }

  /**
   * Handles settings timeout
   */
  private handleSettingsTimeout(): void {
    if (this.receivedSettings.size === 0) {
      this.uiManager.addLog("System", this.i18n.t("errors.settingsTimeout"));
      this.uiManager.showSettingsRefreshButton();
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
      this.uiManager.showSettingsRefreshButton();
      return;
    }

    for (const fieldName of this.allSettingNames) {
      if (!this.receivedSettings.has(fieldName)) {
        this.uiManager.hideSettingRow(fieldName);
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

    this.uiManager.showSettingsForm();
    this.uiManager.addLog(
      "System",
      this.i18n.t("settings.loaded", { count: this.receivedSettings.size })
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
      this.uiManager.addLog("System", this.i18n.t("settings.noChanges"));
    } else {
      this.uiManager.addLog("System", this.i18n.t("settings.applied", { count: changedCount }));
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

