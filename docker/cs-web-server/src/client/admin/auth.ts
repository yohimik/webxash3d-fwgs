import { elements } from "./dom";
import { decodeJWT, hashPassword } from "./utils";
import { saveTokenData, clearTokenData } from "./storage";
import {
  showAuthError,
  clearAuthError,
  showAdminPanel,
  clearAuthForm,
  setLoginButtonState,
  updateUsernameDisplay,
  updateTokenExpiry,
} from "./ui";
import type { TokenData } from "./types";

// ============================================
// Authentication
// ============================================

let passwordSalt: string | null = null;
let tokenExpiryTimer: number | null = null;

/**
 * Fetches password salt from server
 */
export async function fetchSalt(): Promise<string> {
  try {
    const response = await fetch("/auth/salt");

    if (response.status === 503) {
      throw new Error("Admin panel is disabled");
    }

    if (!response.ok) {
      throw new Error("Failed to fetch salt");
    }

    const data = await response.json();
    return data.salt;
  } catch (error) {
    throw new Error(`Cannot fetch salt: ${error}`);
  }
}

/**
 * Prefetches salt on initialization
 */
export async function prefetchSalt(): Promise<void> {
  try {
    passwordSalt = await fetchSalt();
  } catch (err) {
    console.warn("Failed to prefetch salt:", err);
  }
}

/**
 * Performs login
 */
export async function login(
  username: string,
  password: string
): Promise<TokenData> {
  setLoginButtonState(true);

  try {
    // Fetch salt if not cached
    if (!passwordSalt) {
      passwordSalt = await fetchSalt();
    }

    // Hash password with salt
    const passwordHash = await hashPassword(password, passwordSalt);

    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, passwordHash }),
    });

    if (response.status === 401) {
      throw new Error("Invalid username or password");
    }

    if (response.status === 429) {
      throw new Error("Too many attempts. Please try again later.");
    }

    if (response.status === 503) {
      throw new Error("Admin panel is disabled on server");
    }

    if (!response.ok) {
      throw new Error("Login failed. Please try again.");
    }

    const data = await response.json();

    // Decode token to extract username
    const payload = decodeJWT(data.token);
    if (!payload || !payload.username) {
      throw new Error("Invalid token received");
    }

    // Create token data
    const expiresAt = Date.now() + data.expiresIn * 1000;
    const tokenData: TokenData = {
      token: data.token,
      expiresAt,
      username: payload.username,
    };

    // Save to storage
    saveTokenData(tokenData);

    // Clear form and errors
    clearAuthError();
    clearAuthForm();

    return tokenData;
  } finally {
    setLoginButtonState(false);
  }
}

/**
 * Performs logout
 */
export function logout(onLogout: () => void): void {
  if (tokenExpiryTimer) {
    clearInterval(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }

  clearTokenData();
  clearAuthForm();

  onLogout();
}

/**
 * Initializes admin panel with token data
 */
export function initializeAdminPanel(tokenData: TokenData): void {
  showAdminPanel();
  updateUsernameDisplay(tokenData.username);
  updateTokenExpiry(tokenData);
  startTokenExpiryCheck(tokenData);
}

/**
 * Starts token expiry check timer
 */
function startTokenExpiryCheck(tokenData: TokenData): void {
  if (tokenExpiryTimer) {
    clearInterval(tokenExpiryTimer);
  }

  // Update every minute
  tokenExpiryTimer = setInterval(() => {
    updateTokenExpiry(tokenData);

    // Auto-logout if expired
    if (tokenData.expiresAt <= Date.now()) {
      clearInterval(tokenExpiryTimer!);
      tokenExpiryTimer = null;
    }
  }, 60 * 1000) as any;
}

/**
 * Sets up authentication form handler
 */
export function setupAuthHandler(
  onLogin: (tokenData: TokenData) => void
): void {
  elements.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value.trim();

    if (!username) {
      showAuthError("Username is required");
      return;
    }

    if (!password) {
      showAuthError("Password is required");
      return;
    }

    try {
      const tokenData = await login(username, password);
      initializeAdminPanel(tokenData);
      onLogin(tokenData);
    } catch (error) {
      showAuthError(error instanceof Error ? error.message : "Login failed");
    }
  });
}

/**
 * Sets up disconnect handler
 */
export function setupDisconnectHandler(onDisconnect: () => void): void {
  elements.disconnectBtn.addEventListener("click", () => {
    logout(onDisconnect);
  });
}
