import { domManager } from "./dom";
import { escapeHtml, stripAnsiCodes, extractTimestamp } from "./utils";
import { i18n, type Locale } from "./i18n";
import type { ConnectionStatus, TokenData, DOMElements } from "./types";

// ============================================
// UI Manager Class
// ============================================

class UIManager {
  private isAutoScroll = true;

  /**
   * Gets DOM elements
   */
  private get el(): DOMElements {
    return domManager.elements;
  }

  // ============================================
  // Authentication UI
  // ============================================

  /**
   * Shows authentication error message
   */
  showAuthError(message: string): void {
    this.el.authError.textContent = message;
  }

  /**
   * Clears authentication error
   */
  clearAuthError(): void {
    this.el.authError.textContent = "";
  }

  /**
   * Shows the admin panel
   */
  showAdminPanel(): void {
    this.el.authContainer.style.display = "none";
    this.el.adminContainer.style.display = "block";
  }

  /**
   * Shows the authentication panel
   */
  showAuthPanel(): void {
    this.el.authContainer.style.display = "flex";
    this.el.adminContainer.style.display = "none";
  }

  /**
   * Clears authentication form inputs
   */
  clearAuthForm(): void {
    this.el.usernameInput.value = "";
    this.el.passwordInput.value = "";
  }

  /**
   * Sets login button state
   */
  setLoginButtonState(loading: boolean): void {
    this.el.loginBtn.disabled = loading;
    this.el.loginBtn.textContent = loading
      ? i18n.t("auth.loggingIn")
      : i18n.t("auth.login");
  }

  // ============================================
  // User Display
  // ============================================

  /**
   * Updates username display
   */
  updateUsernameDisplay(username: string): void {
    this.el.usernameDisplay.textContent = `Logged in as: ${username}`;
  }

  /**
   * Updates token expiry display
   */
  updateTokenExpiry(tokenData: TokenData | null): void {
    if (!tokenData) return;

    const now = Date.now();
    const remaining = tokenData.expiresAt - now;

    if (remaining <= 0) {
      this.el.tokenExpiry.textContent = "Token expired";
      this.el.tokenExpiry.style.color = "var(--token-expiring)";
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      this.el.tokenExpiry.textContent = `Token expires in ${hours}h ${minutes}m`;
    } else {
      this.el.tokenExpiry.textContent = `Token expires in ${minutes}m`;
    }

    // Warn if less than 5 minutes
    if (remaining < 5 * 60 * 1000) {
      this.el.tokenExpiry.style.color = "var(--token-expiring)";
    } else {
      this.el.tokenExpiry.style.color = "var(--token-valid)";
    }
  }

  // ============================================
  // Connection Status
  // ============================================

  /**
   * Updates WebSocket connection status display
   */
  updateConnectionStatus(status: ConnectionStatus, text: string): void {
    this.el.connectionStatus.className = "status-dot";
    this.el.connectionStatus.classList.add(status);
    this.el.connectionText.textContent = text;
  }

  // ============================================
  // Logs
  // ============================================

  /**
   * Adds a log entry to the logs container
   */
  addLog(timestamp: string, message: string): void {
    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";

    // Clean message
    let cleanMessage = stripAnsiCodes(message);

    // Extract timestamp
    let time: string;
    const [extractedTime, extractedMessage] = extractTimestamp(cleanMessage);

    if (extractedTime) {
      time = extractedTime;
      cleanMessage = extractedMessage;
    } else if (timestamp === "System") {
      time = `[${new Date().toLocaleTimeString()}]`;
    } else {
      time = `[${new Date(timestamp).toLocaleTimeString()}]`;
    }

    logEntry.innerHTML = `
      <span class="log-timestamp">${time}</span>
      <span class="log-message">${escapeHtml(cleanMessage)}</span>
    `;

    this.el.logsContainer.appendChild(logEntry);

    // Auto-scroll to bottom if enabled
    if (this.isAutoScroll) {
      this.el.logsContainer.scrollTop = this.el.logsContainer.scrollHeight;
    }
  }

  /**
   * Clears all logs
   */
  clearLogs(): void {
    this.el.logsContainer.innerHTML = "";
  }

  /**
   * Sets up auto-scroll detection
   */
  setupAutoScroll(): void {
    this.el.logsContainer.addEventListener("scroll", () => {
      const { scrollTop, scrollHeight, clientHeight } = this.el.logsContainer;
      this.isAutoScroll = scrollTop + clientHeight >= scrollHeight - 10;
    });
  }

  // ============================================
  // Maps
  // ============================================

  /**
   * Updates the maps list select
   */
  updateMapsList(maps: string[]): void {
    const mapsSelect = this.el.mapsSelect;
    const changelevelBtn = this.el.changelevelBtn;

    if (!mapsSelect) return;

    if (maps.length === 0) {
      mapsSelect.innerHTML =
        '<option disabled>No maps found. Run "maps *" to list.</option>';
      mapsSelect.disabled = true;
      if (changelevelBtn) changelevelBtn.disabled = true;
      return;
    }

    mapsSelect.innerHTML = maps
      .map((map) => `<option value="${map}">${map}</option>`)
      .join("");
    mapsSelect.disabled = false;
    if (changelevelBtn) changelevelBtn.disabled = false;
  }

  // ============================================
  // Settings
  // ============================================

  /**
   * Shows the settings loading state
   */
  showSettingsLoading(): void {
    this.el.settingsStatus.style.display = "flex";
    this.el.settingsStatusText.textContent = "Fetching settings...";
    this.el.settingsStatusText.style.display = "block";
    this.el.settingsRefreshBtn.style.display = "none";
    this.el.gameSettingsForm.style.display = "none";
  }

  /**
   * Shows the settings form
   */
  showSettingsForm(): void {
    this.el.settingsStatus.style.display = "none";
    this.el.gameSettingsForm.style.display = "block";
  }

  /**
   * Shows the refresh button after timeout
   */
  showSettingsRefreshButton(): void {
    this.el.settingsStatusText.textContent = "Failed to load settings";
    this.el.settingsRefreshBtn.style.display = "block";
  }

  /**
   * Hides a settings row by field name
   */
  hideSettingRow(fieldName: string): void {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#game-settings [name="${fieldName}"]`
    );
    if (input) {
      const row = input.closest(".row");
      if (row) {
        row.classList.add("hidden");
      }
    }
  }

  /**
   * Shows all settings rows (removes hidden class)
   */
  showAllSettingRows(): void {
    const rows = document.querySelectorAll("#game-settings .row");
    rows.forEach((row) => row.classList.remove("hidden"));
  }

  // ============================================
  // Language Selector
  // ============================================

  /**
   * Sets up language selector
   */
  setupLanguageSelector(): void {
    const selectorAuth = document.getElementById(
      "language-selector-auth"
    ) as HTMLSelectElement | null;
    const selectorAdmin = document.getElementById(
      "language-selector-admin"
    ) as HTMLSelectElement | null;

    const selectors = [selectorAuth, selectorAdmin].filter(
      (s) => s !== null
    ) as HTMLSelectElement[];

    if (selectors.length === 0) return;

    // Generate options HTML
    const optionsHTML = i18n.availableLocales
      .map(
        (locale) =>
          `<option value="${locale}" ${locale === i18n.getLocale() ? "selected" : ""}>${i18n.localeNames[locale]}</option>`
      )
      .join("");

    // Populate all selectors
    selectors.forEach((selector) => {
      selector.innerHTML = optionsHTML;

      // Handle change
      selector.addEventListener("change", async () => {
        await i18n.setLocale(selector.value as Locale);
        
        // Sync all selectors
        selectors.forEach((s) => {
          if (s !== selector) {
            s.value = selector.value;
          }
        });
      });
    });
  }
}

// Export singleton instance
export const uiManager = new UIManager();

// Export class for type usage
export { UIManager };
