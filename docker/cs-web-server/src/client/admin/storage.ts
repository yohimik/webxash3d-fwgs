import type { TokenData } from './types';

// ============================================
// Local Storage Management
// ============================================

const KEYS = {
  TOKEN: 'adminToken',
  EXPIRY: 'adminTokenExpiry',
  USERNAME: 'adminUsername',
} as const;

/**
 * Saves token data to localStorage
 */
export function saveTokenData(tokenData: TokenData): void {
  localStorage.setItem(KEYS.TOKEN, tokenData.token);
  localStorage.setItem(KEYS.EXPIRY, tokenData.expiresAt.toString());
  localStorage.setItem(KEYS.USERNAME, tokenData.username);
}

/**
 * Loads token data from localStorage
 * Returns null if not found or expired
 */
export function loadTokenData(): TokenData | null {
  const token = localStorage.getItem(KEYS.TOKEN);
  const expiry = localStorage.getItem(KEYS.EXPIRY);
  const username = localStorage.getItem(KEYS.USERNAME);

  if (!token || !expiry || !username) {
    return null;
  }

  const expiresAt = parseInt(expiry, 10);
  if (expiresAt <= Date.now()) {
    clearTokenData();
    return null;
  }

  return { token, expiresAt, username };
}

/**
 * Clears token data from localStorage
 */
export function clearTokenData(): void {
  localStorage.removeItem(KEYS.TOKEN);
  localStorage.removeItem(KEYS.EXPIRY);
  localStorage.removeItem(KEYS.USERNAME);
}
