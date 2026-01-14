import type { TokenData } from "./types";

// ============================================
// Storage Manager Class
// ============================================

class StorageManager {
  private readonly KEYS = {
    TOKEN: "adminToken",
    EXPIRY: "adminTokenExpiry",
    USERNAME: "adminUsername",
    LOCALE: "adminLocale",
  } as const;

  /**
   * Saves token data to localStorage
   */
  saveTokenData(tokenData: TokenData): void {
    localStorage.setItem(this.KEYS.TOKEN, tokenData.token);
    localStorage.setItem(this.KEYS.EXPIRY, tokenData.expiresAt.toString());
    localStorage.setItem(this.KEYS.USERNAME, tokenData.username);
  }

  /**
   * Loads token data from localStorage
   * Returns null if not found or expired
   */
  loadTokenData(): TokenData | null {
    const token = localStorage.getItem(this.KEYS.TOKEN);
    const expiry = localStorage.getItem(this.KEYS.EXPIRY);
    const username = localStorage.getItem(this.KEYS.USERNAME);

    if (!token || !expiry || !username) {
      return null;
    }

    const expiresAt = parseInt(expiry, 10);
    if (expiresAt <= Date.now()) {
      this.clearTokenData();
      return null;
    }

    return { token, expiresAt, username };
  }

  /**
   * Clears token data from localStorage
   */
  clearTokenData(): void {
    localStorage.removeItem(this.KEYS.TOKEN);
    localStorage.removeItem(this.KEYS.EXPIRY);
    localStorage.removeItem(this.KEYS.USERNAME);
  }

  /**
   * Gets saved locale
   */
  getLocale(): string | null {
    return localStorage.getItem(this.KEYS.LOCALE);
  }

  /**
   * Saves locale preference
   */
  setLocale(locale: string): void {
    localStorage.setItem(this.KEYS.LOCALE, locale);
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
