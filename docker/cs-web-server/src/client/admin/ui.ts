import { elements } from './dom';
import { escapeHtml, stripAnsiCodes, extractTimestamp } from './utils';
import type { ConnectionStatus, TokenData } from './types';

// ============================================
// UI Management
// ============================================

let isAutoScroll = true;

/**
 * Shows authentication error message
 */
export function showAuthError(message: string): void {
  elements.authError.textContent = message;
}

/**
 * Clears authentication error
 */
export function clearAuthError(): void {
  elements.authError.textContent = '';
}

/**
 * Shows the admin panel
 */
export function showAdminPanel(): void {
  elements.authContainer.style.display = 'none';
  elements.adminContainer.style.display = 'block';
}

/**
 * Shows the authentication panel
 */
export function showAuthPanel(): void {
  elements.authContainer.style.display = 'flex';
  elements.adminContainer.style.display = 'none';
}

/**
 * Updates username display
 */
export function updateUsernameDisplay(username: string): void {
  elements.usernameDisplay.textContent = `Logged in as: ${username}`;
}

/**
 * Updates token expiry display
 */
export function updateTokenExpiry(tokenData: TokenData | null): void {
  if (!tokenData) return;

  const now = Date.now();
  const remaining = tokenData.expiresAt - now;

  if (remaining <= 0) {
    elements.tokenExpiry.textContent = 'Token expired';
    elements.tokenExpiry.style.color = '#e74c3c';
    return;
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    elements.tokenExpiry.textContent = `Token expires in ${hours}h ${minutes}m`;
  } else {
    elements.tokenExpiry.textContent = `Token expires in ${minutes}m`;
  }

  // Warn if less than 5 minutes
  if (remaining < 5 * 60 * 1000) {
    elements.tokenExpiry.style.color = '#e74c3c';
  } else {
    elements.tokenExpiry.style.color = '#27ae60';
  }
}

/**
 * Updates WebSocket connection status display
 */
export function updateConnectionStatus(
  status: ConnectionStatus,
  text: string
): void {
  elements.connectionStatus.className = 'status-dot';
  elements.connectionStatus.classList.add(status);
  elements.connectionText.textContent = text;
}

/**
 * Adds a log entry to the logs container
 */
export function addLog(timestamp: string, message: string): void {
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';

  // Clean message
  let cleanMessage = stripAnsiCodes(message);

  // Extract timestamp
  let time: string;
  const [extractedTime, extractedMessage] = extractTimestamp(cleanMessage);

  if (extractedTime) {
    time = extractedTime;
    cleanMessage = extractedMessage;
  } else if (timestamp === 'System') {
    time = `[${new Date().toLocaleTimeString()}]`;
  } else {
    time = `[${new Date(timestamp).toLocaleTimeString()}]`;
  }

  logEntry.innerHTML = `
    <span class="log-timestamp">${time}</span>
    <span class="log-message">${escapeHtml(cleanMessage)}</span>
  `;

  elements.logsContainer.appendChild(logEntry);

  // Auto-scroll to bottom if enabled
  if (isAutoScroll) {
    elements.logsContainer.scrollTop = elements.logsContainer.scrollHeight;
  }
}

/**
 * Clears all logs
 */
export function clearLogs(): void {
  elements.logsContainer.innerHTML = '';
}

/**
 * Clears authentication form inputs
 */
export function clearAuthForm(): void {
  elements.usernameInput.value = '';
  elements.passwordInput.value = '';
}

/**
 * Sets up auto-scroll detection
 */
export function setupAutoScroll(): void {
  elements.logsContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = elements.logsContainer;
    isAutoScroll = scrollTop + clientHeight >= scrollHeight - 10;
  });
}

/**
 * Sets login button state
 */
export function setLoginButtonState(loading: boolean): void {
  elements.loginBtn.disabled = loading;
  elements.loginBtn.textContent = loading ? 'Logging in...' : 'Login';
}

/**
 * Updates the maps list select
 */
export function updateMapsList(maps: string[]): void {
  const mapsSelect = document.getElementById("maps-select") as HTMLSelectElement;
  const changelevelBtn = document.getElementById("changelevel-btn") as HTMLButtonElement;
  
  if (!mapsSelect) return;
  
  if (maps.length === 0) {
    mapsSelect.innerHTML = '<option disabled>No maps found. Run "maps *" to list.</option>';
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
