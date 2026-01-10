import { elements } from "./dom";
import {
  addLog,
  showSettingsLoading,
  showSettingsForm,
  showSettingsRefreshButton,
  hideSettingRow,
  showAllSettingRows
} from "./ui";
import type { TokenData } from "./types";
import { getInputValue } from "./utils";

// ============================================
// Command Management
// ============================================

let currentTokenData: TokenData | null = null;
let onLogoutCallback: (() => void) | null = null;
let originalSettings: Map<string, string> = new Map();
let receivedSettings: Set<string> = new Set();
let settingsTimeout: any = null;
let allSettingNames: string[] = [];

/**
 * Initializes command system
 */
export function initializeCommands(
  tokenData: TokenData,
  onLogout: () => void
): void {
  currentTokenData = tokenData;
  onLogoutCallback = onLogout;
}

/**
 * Sends a command to the server
 */
export async function sendCommand(command: string): Promise<void> {
  if (!currentTokenData) {
    addLog("System", "ERROR: Not authenticated");
    return;
  }

  addLog("System", `> ${command}`);

  try {
    const response = await fetch("/rcon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentTokenData.token}`,
      },
      body: JSON.stringify({ command }),
    });

    if (response.status === 401) {
      addLog("System", "ERROR: Authentication failed - token expired");
      setTimeout(() => {
        if (onLogoutCallback) {
          onLogoutCallback();
        }
      }, 1000);
      return;
    }

    if (response.status === 403) {
      addLog("System", "ERROR: Insufficient permissions");
      return;
    }

    if (response.status === 429) {
      addLog("System", "ERROR: Rate limit exceeded - please slow down");
      return;
    }

    if (!response.ok) {
      addLog("System", `ERROR: Failed to execute command (${response.status})`);
      return;
    }

    // Command sent successfully (204 No Content)
    // Output will appear in logs via WebSocket
  } catch (error) {
    addLog("System", `ERROR: ${error}`);
  }
}

/**
 * Sets up command form handler
 */
export function setupCommandHandler(): void {
  elements.commandForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const command = elements.commandInput.value.trim();

    if (!command) return;

    await sendCommand(command);
    elements.commandInput.value = "";
  });
}

/**
 * Sets up quick command buttons
 */
export function setupQuickCommands(): void {
  document.querySelectorAll(".quick-cmd").forEach((btn) => {
    btn.addEventListener("click", () => {
      const command = btn.getAttribute("data-cmd");
      if (command) {
        sendCommand(command);
      }
    });
  });
}

export function setupGameSettingsHandler(): void {
  elements.gameSettingsCurrent.addEventListener("click", async (e) => {
    await fetchGameSettings();
  });

  elements.settingsRefreshBtn.addEventListener("click", () => {
    window.location.reload();
  });

  elements.gameSettingsApply.addEventListener("click", async (e) => {
    const form = elements.gameSettingsForm;
    const inputs = form.querySelectorAll("input, select");

    let changedCount = 0;

    for (const input of inputs) {
      const element = input as HTMLInputElement | HTMLSelectElement;
      if (!element.name) continue;

      const value = getInputValue(element);
      const originalValue = originalSettings.get(element.name);

      // Only send if value changed or if we don't have original value
      if (originalValue === undefined || originalValue !== value) {
        await sendCommand(`${element.name} "${value.replace(/"/g, " ")}"`);
        changedCount++;
      }
    }

    if (changedCount === 0) {
      addLog("System", "No settings changed");
    } else {
      addLog("System", `Applied ${changedCount} setting(s)`);
    }
  });
}

async function fetchGameSettings(): Promise<void> {
  const form = elements.gameSettingsForm;
  const inputs = form.querySelectorAll("input, select");

  showSettingsLoading();
  showAllSettingRows();
  receivedSettings.clear();
  originalSettings.clear();

  allSettingNames = Array.from(inputs).map(
    (i) => (i as HTMLInputElement | HTMLSelectElement).name
  ).filter(name => name);

  if (settingsTimeout) {
    clearTimeout(settingsTimeout);
  }
  settingsTimeout = setTimeout(() => {
    handleSettingsTimeout();
  }, 2000) as any;

  try {
    const response = await fetch("/rcon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentTokenData!.token}`,
      },
      body: JSON.stringify({
        command: allSettingNames,
      }),
    });

    if (response.status !== 204) {
      addLog("System", "Failed to get current settings");
      clearTimeout(settingsTimeout);
      showSettingsRefreshButton();
      return;
    }

    setTimeout(() => {
      finalizeSettingsFetch();
    }, 500);

  } catch (error) {
    addLog("System", `ERROR: ${error}`);
    clearTimeout(settingsTimeout);
    showSettingsRefreshButton();
  }
}

function handleSettingsTimeout(): void {
  if (receivedSettings.size === 0) {
    addLog("System", "Timeout: No settings received from server");
    showSettingsRefreshButton();
  } else {
    finalizeSettingsFetch();
  }
}

function finalizeSettingsFetch(): void {
  if (settingsTimeout) {
    clearTimeout(settingsTimeout);
    settingsTimeout = null;
  }

  if (receivedSettings.size === 0) {
    showSettingsRefreshButton();
    return;
  }

  for (const fieldName of allSettingNames) {
    if (!receivedSettings.has(fieldName)) {
      hideSettingRow(fieldName);
    }
  }

  for (const fieldName of receivedSettings) {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#game-settings [name="${fieldName}"]`
    );
    if (input) {
      originalSettings.set(fieldName, getInputValue(input));
    }
  }

  showSettingsForm();
  addLog("System", `Loaded ${receivedSettings.size} setting(s)`);
}

/**
 * Called by WebSocket when a setting is received
 */
export function onSettingReceived(settingName: string): void {
  receivedSettings.add(settingName);
}

/**
 * Sets up changelevel button handler
 */
export function setupChangelevelHandler(): void {
  elements.changelevelBtn.addEventListener("click", () => {
    const selectedMap = elements.mapsSelect.value;
    if (selectedMap) {
      sendCommand(`changelevel ${selectedMap}`);
    }
  });

  // Enable/disable button based on select state
  elements.mapsSelect.addEventListener("change", () => {
    elements.changelevelBtn.disabled = !elements.mapsSelect.value;
  });
}
