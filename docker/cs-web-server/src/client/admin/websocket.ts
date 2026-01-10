import { updateConnectionStatus, addLog, clearLogs, updateMapsList } from "./ui";
import type { TokenData, WebSocketMessage } from "./types";
import { fetchSalt } from "./auth";
import { stripAnsiCodes } from "./utils";
import { elements } from "./dom";

// ============================================
// WebSocket Management
// ============================================

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let currentTokenData: TokenData | null = null;
let onLogoutCallback: (() => void) | null = null;

/**
 * Connects to WebSocket
 */
export function connectWebSocket(
  tokenData: TokenData,
  onLogout: () => void
): void {
  currentTokenData = tokenData;
  onLogoutCallback = onLogout;

  if (!tokenData) {
    addLog("System", "ERROR: No authentication token available");
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${
    window.location.host
  }/logs?token=${encodeURIComponent(tokenData.token)}`;

  updateConnectionStatus("connecting", "Connecting...");

  ws = new WebSocket(wsUrl);

  ws.onopen = handleOpen;
  ws.onmessage = handleMessage;
  ws.onerror = handleError;
  ws.onclose = handleClose;
}

/**
 * Disconnects WebSocket
 */
export function disconnectWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  currentTokenData = null;
  onLogoutCallback = null;
}

/**
 * Updates a setting input from log message
 */
function updateSettingFromMessage(message: string): void {
  const checkRegex = /.+"([A-Za-z_]+)" is "(.+?|)"(.+|)$/;
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

  console.log(`Updated setting ${settingName} to ${currentValue}`);
}

/**
 * Processes map list from log messages in DOM
 */
function processMapList(message: string): void {
  const mapsListedRegex = /Directory: ".+\/maps" - Maps listed: ([\d]{1,})$/;
  const match = message.match(mapsListedRegex);

  if (!match) return;

  const mapCount = parseInt(match[1], 10);

  console.log(`Maps listed: ${mapCount}`);

  // Get log entries from DOM
  const logEntries = elements.logsContainer.querySelectorAll(".log-entry");
  const totalLogs = logEntries.length;

  // Get the last mapCount messages (excluding the current "Maps listed" message)
  const startIndex = Math.max(0, totalLogs - mapCount - 2);
  const endIndex = totalLogs - 1;

  const maps: string[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const logMessage =
      logEntries[i].querySelector(".log-message")?.textContent || "";

    const match = logMessage.match(/(.+)\s+\(Half-Life\)/);

    if (match && match[1]) {
      maps.push(match[1]);
    }
  }

  console.log("Detected maps:", maps);
  
  // Update map selection UI
  updateMapsList(maps);
}

/**
 * Handles WebSocket open event
 */
function handleOpen(): void {
  updateConnectionStatus("connected", "Connected");
  addLog("System", "Connected to server logs");
}

/**
 * Handles WebSocket message event
 */
function handleMessage(event: MessageEvent): void {
  try {
    const data: WebSocketMessage = JSON.parse(event.data);

    if (data.event === "history") {
      clearLogs();
      addLog("System", `Loaded ${data.logs?.length || 0} historical entries`);

      data.logs?.forEach((log) => {
        addLog(log.timestamp, log.message);
      });
    } else if (data.event === "log" && data.timestamp && data.message) {
      addLog(data.timestamp, data.message);
      updateSettingFromMessage(data.message);
      processMapList(data.message);
    }
  } catch (error) {
    console.error("Failed to parse WebSocket message:", error);
  }
}

/**
 * Handles WebSocket error event
 */
function handleError(error: Event): void {
  console.error("WebSocket error:", error);
  updateConnectionStatus("disconnected", "Error");
}

/**
 * Handles WebSocket close event
 */
function handleClose(event: CloseEvent): void {
  updateConnectionStatus("disconnected", "Disconnected");

  // Check if it was an auth error
  if (event.code === 1008 || event.code === 4401) {
    addLog("System", "Authentication failed - token may be expired");
    setTimeout(() => {
      if (onLogoutCallback) {
        onLogoutCallback();
      }
    }, 2000);
    return;
  }

  addLog("System", "Disconnected from server");

  // Auto-reconnect after 3 seconds
  reconnectTimer = setTimeout(() => {
    if (currentTokenData) {
      addLog("System", "Reconnecting...");
      fetchSalt().then(() => {
        connectWebSocket(currentTokenData!, onLogoutCallback!);
      });
    }
  }, 3000) as any;
}
