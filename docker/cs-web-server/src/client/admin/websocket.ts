import { uiManager } from "./ui";
import { domManager } from "./dom";
import { logger } from "./logger";
import { i18n } from "./i18n";
import type { TokenData, WebSocketMessage, DOMElements } from "./types";
import { stripAnsiCodes } from "./utils";

// ============================================
// WebSocket Manager Class
// ============================================

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private currentTokenData: TokenData | null = null;
  private onLogoutCallback: (() => void) | null = null;
  private onSettingReceivedCallback: ((settingName: string) => void) | null =
    null;

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return domManager.elements;
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
    logger.info("Connecting to WebSocket...");
    this.currentTokenData = tokenData;
    this.onLogoutCallback = onLogout;

    if (!tokenData) {
      uiManager.addLog("System", i18n.t("errors.noToken"));
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${
      window.location.host
    }/logs?token=${encodeURIComponent(tokenData.token)}`;

    uiManager.updateConnectionStatus("connecting", i18n.t("status.connecting"));

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
    logger.info("Disconnecting WebSocket...");

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
      `#game-settings input[name="${settingName}"], #game-settings select[name="${settingName}"]`
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

    logger.debug(`Updated setting ${settingName} to ${currentValue}`);
  }

  /**
   * Processes map list from log messages in DOM
   */
  private processMapList(message: string): void {
    const mapsListedRegex = /Directory: ".+\/maps" - Maps listed: ([\d]{1,})$/;
    const match = message.match(mapsListedRegex);

    if (!match) return;

    const mapCount = parseInt(match[1], 10);

    logger.debug(`Maps listed: ${mapCount}`);

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

    logger.debug("Detected maps:", maps);

    // Update map selection UI
    uiManager.updateMapsList(maps);
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handles WebSocket open event
   */
  private handleOpen(): void {
    logger.info("WebSocket connected");
    uiManager.updateConnectionStatus("connected", i18n.t("status.connected"));
    uiManager.addLog("System", i18n.t("logs.connectedToServer"));
  }

  /**
   * Handles WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);

      if (data.event === "history") {
        uiManager.clearLogs();
        uiManager.addLog(
          "System",
          i18n.t("logs.historyLoaded", { count: data.logs?.length || 0 })
        );

        data.logs?.forEach((log) => {
          uiManager.addLog(log.timestamp, log.message);
        });
      } else if (data.event === "log" && data.timestamp && data.message) {
        uiManager.addLog(data.timestamp, data.message);
        this.updateSettingFromMessage(stripAnsiCodes(data.message));
        this.processMapList(data.message);
      }
    } catch (error) {
      logger.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handles WebSocket error event
   */
  private handleError(error: Event): void {
    logger.error("WebSocket error:", error);
    uiManager.updateConnectionStatus("disconnected", i18n.t("status.error"));
  }

  /**
   * Handles WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    uiManager.updateConnectionStatus("disconnected", i18n.t("status.disconnected"));

    // Check if it was an auth error
    if (event.code === 1008 || event.code === 4401) {
      uiManager.addLog(
        "System",
        i18n.t("errors.authFailed")
      );
      setTimeout(() => {
        if (this.onLogoutCallback) {
          this.onLogoutCallback();
        }
      }, 2000);
      return;
    }

    uiManager.addLog("System", i18n.t("logs.disconnected"));

    // Auto-reconnect after 3 seconds
    this.reconnectTimer = setTimeout(() => {
      if (this.currentTokenData) {
        uiManager.addLog("System", i18n.t("logs.reconnecting"));
        this.connect(this.currentTokenData!, this.onLogoutCallback!);
      }
    }, 3000) as unknown as number;
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();
