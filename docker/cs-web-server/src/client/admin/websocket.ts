import { stripAnsiCodes } from "./utils";
import type { TokenData, WebSocketMessage, DOMElements } from "./types";
import type { UIManager } from "./ui";
import type { DOMManager } from "./dom";
import type { LoggerWrapper } from "./logger";
import type { I18nManager } from "./i18n";

// ============================================
// WebSocket event version constants
// ============================================
const EVENT_VERSION = "v1";
const EVENTS = {
  AUTH: `${EVENT_VERSION}:auth`,
  ERROR: `${EVENT_VERSION}:error`,
  HISTORY: `${EVENT_VERSION}:history`,
  LOG: `${EVENT_VERSION}:log`,
} as const;

// ============================================
// WebSocket Manager Options
// ============================================

export interface WebSocketManagerOptions {
  domManager: DOMManager;
  uiManager: UIManager;
  logger: LoggerWrapper;
  i18n: I18nManager;
}

// ============================================
// WebSocket Manager Class
// ============================================

export class WebSocketManager {
  private readonly domManager: DOMManager;
  private readonly uiManager: UIManager;
  private readonly logger: LoggerWrapper;
  private readonly i18n: I18nManager;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentTokenData: TokenData | null = null;
  private onLogoutCallback: (() => void) | null = null;
  private onSettingReceivedCallback: ((settingName: string) => void) | null =
    null;

  constructor(options: WebSocketManagerOptions) {
    this.domManager = options.domManager;
    this.uiManager = options.uiManager;
    this.logger = options.logger;
    this.i18n = options.i18n;
  }

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return this.domManager.elements;
  }

  /**
   * Sets the callback for when a setting is received
   */
  setSettingReceivedCallback(callback: (settingName: string) => void): void {
    this.onSettingReceivedCallback = callback;
  }

  /**
   * Connects to WebSocket
   */
  connect(tokenData: TokenData, onLogout: () => void): void {
    this.logger.info("Connecting to WebSocket...");
    this.currentTokenData = tokenData;
    this.onLogoutCallback = onLogout;

    if (!tokenData) {
      this.uiManager.addLog("System", this.i18n.t("errors.noToken"));
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/websocket/logs`;

    this.uiManager.updateConnectionStatus(
      "connecting",
      this.i18n.t("status.connecting"),
    );

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
  }

  /**
   * Disconnects WebSocket
   */
  disconnect(): void {
    this.logger.info("Disconnecting WebSocket...");

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentTokenData = null;
    this.onLogoutCallback = null;
  }

  // ============================================
  // Message Processing
  // ============================================

  /**
   * Updates a setting input from log message
   */
  private updateSettingFromMessage(message: string): void {
    const checkRegex = /.+"([A-Za-z_]+)" is "(.+?|)"( \( "(.+|)" \)|)$/;
    if (!checkRegex.test(message)) return;

    const match = message.match(checkRegex);
    if (!match || match.length < 3) return;

    const settingName = match[1];
    const currentValue = match[2];

    const inputElement = document.querySelector<
      HTMLInputElement | HTMLSelectElement
    >(
      `#game-settings input[name="${settingName}"], #game-settings select[name="${settingName}"]`,
    );

    if (!inputElement) return;

    if (inputElement instanceof HTMLInputElement) {
      if (inputElement.type === "checkbox") {
        inputElement.checked = currentValue === "1";
      } else {
        inputElement.value = currentValue;
      }
    } else if (inputElement instanceof HTMLSelectElement) {
      inputElement.value = currentValue;
    }

    // Notify that this setting was received
    if (this.onSettingReceivedCallback) {
      this.onSettingReceivedCallback(settingName);
    }

    this.logger.debug(`Updated setting ${settingName} to ${currentValue}`);
  }

  /**
   * Processes map list from log messages in DOM
   */
  private processMapList(message: string): void {
    const mapsListedRegex = /Directory: ".+\/maps" - Maps listed: ([\d]{1,})$/;
    const match = message.match(mapsListedRegex);

    if (!match) return;

    const mapCount = parseInt(match[1], 10);

    this.logger.debug(`Maps listed: ${mapCount}`);

    // Get log entries from DOM
    const logEntries = this.el.logsContainer.querySelectorAll(".log-entry");
    const totalLogs = logEntries.length;

    // Get the last mapCount messages (excluding the current "Maps listed" message)
    const startIndex = Math.max(0, totalLogs - mapCount - 2);
    const endIndex = totalLogs - 1;

    const maps: string[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const logMessage =
        logEntries[i].querySelector(".log-message")?.textContent || "";

      const mapMatch = logMessage.match(/(.+)\s+\(Half-Life\)/);

      if (mapMatch && mapMatch[1]) {
        // Ignore Half-Life single player maps like c1a1, t0a5b, etc.
        if (!/^\b[ct]\d+a\d+(?:[a-z]\d*)?\b$/.test(mapMatch[1])) {
          maps.push(mapMatch[1]);
        }
      }
    }

    this.logger.debug("Detected maps:", maps);

    // Update map selection UI
    this.uiManager.updateMapsList(maps);
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handles WebSocket open event - sends auth message
   */
  private handleOpen(): void {
    this.logger.info("WebSocket connected, sending auth...");

    if (!this.ws || !this.currentTokenData) {
      return;
    }

    // Send auth message with token
    this.ws.send(
      JSON.stringify({
        event: EVENTS.AUTH,
        token: this.currentTokenData.token,
      }),
    );
  }

  /**
   * Handles WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);

      // Handle auth response
      if (data.event === EVENTS.AUTH && data.status === "ok") {
        this.logger.info("WebSocket authenticated");
        this.uiManager.updateConnectionStatus(
          "connected",
          this.i18n.t("status.connected"),
        );
        this.uiManager.addLog("System", this.i18n.t("logs.connectedToServer"));
        return;
      }

      // Handle error
      if (data.event === EVENTS.ERROR) {
        this.logger.error("WebSocket error:", data.error);
        this.uiManager.addLog("System", `ERROR: ${data.error}`);
        return;
      }

      if (data.event === EVENTS.HISTORY) {
        this.uiManager.clearLogs();
        this.uiManager.addLog(
          "System",
          this.i18n.t("logs.historyLoaded", { count: data.logs?.length || 0 }),
        );

        data.logs?.forEach((log) => {
          this.uiManager.addLog(log.timestamp, log.message);
        });
      } else if (data.event === EVENTS.LOG && data.timestamp && data.message) {
        this.uiManager.addLog(data.timestamp, data.message);
        this.updateSettingFromMessage(stripAnsiCodes(data.message));
        this.processMapList(data.message);
      }
    } catch (error) {
      this.logger.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handles WebSocket error event
   */
  private handleError(error: Event): void {
    this.logger.error("WebSocket error:", error);
    this.uiManager.updateConnectionStatus(
      "disconnected",
      this.i18n.t("status.error"),
    );
  }

  /**
   * Handles WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.uiManager.updateConnectionStatus(
      "disconnected",
      this.i18n.t("status.disconnected"),
    );

    // Check if it was an auth error
    if (event.code === 1008 || event.code === 4401) {
      this.uiManager.addLog("System", this.i18n.t("errors.authFailed"));
      setTimeout(() => {
        if (this.onLogoutCallback) {
          this.onLogoutCallback();
        }
      }, 2000);
      return;
    }

    this.uiManager.addLog("System", this.i18n.t("logs.disconnected"));

    // Auto-reconnect after 3 seconds
    this.reconnectTimer = setTimeout(() => {
      if (this.currentTokenData) {
        this.uiManager.addLog("System", this.i18n.t("logs.reconnecting"));
        this.connect(this.currentTokenData!, this.onLogoutCallback!);
      }
    }, 3000);
  }
}
