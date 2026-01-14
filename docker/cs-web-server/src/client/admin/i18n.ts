import { storageManager } from "./storage";
import { logger } from "./logger";

// ============================================
// Types
// ============================================

type TranslationValue = string | TranslationObject;
interface TranslationObject {
  [key: string]: TranslationValue;
}

export type Locale = "en" | "pt-BR" | "ru";

export interface I18nConfig {
  defaultLocale: Locale;
  fallbackLocale: Locale;
  availableLocales: Locale[];
}

// ============================================
// I18n Class
// ============================================

class I18n {
  private translations: Map<Locale, TranslationObject> = new Map();
  private currentLocale: Locale = "en";
  private fallbackLocale: Locale = "en";
  private initialized: boolean = false;

  /**
   * Available locales
   */
  readonly availableLocales: readonly Locale[] = ["en", "pt-BR", "ru"];

  /**
   * Locale display names
   */
  readonly localeNames: Record<Locale, string> = {
    en: "English",
    "pt-BR": "Português (Brasil)",
    ru: "Русский",
  };

  /**
   * Initializes i18n system
   */
  async init(config?: Partial<I18nConfig>): Promise<void> {
    if (this.initialized) return;

    this.fallbackLocale = config?.fallbackLocale ?? "en";

    // Try to load saved locale, or detect from browser
    const savedLocale = storageManager.getLocale() as Locale | null;
    const detectedLocale = this.detectBrowserLocale();
    const initialLocale: Locale =
      savedLocale ?? config?.defaultLocale ?? detectedLocale ?? "en";

    // Load fallback locale first
    await this.loadLocale(this.fallbackLocale);

    // Load initial locale if different from fallback
    if (initialLocale !== this.fallbackLocale) {
      await this.loadLocale(initialLocale);
    }

    this.currentLocale = initialLocale;
    this.initialized = true;

    logger.info(`I18n initialized with locale: ${this.currentLocale}`);
    
    // Update DOM with loaded translations
    this.updateDOM();
  }

  /**
   * Detects browser locale
   */
  private detectBrowserLocale(): Locale | null {
    const browserLang = navigator.language || navigator.languages?.[0];

    if (!browserLang) return null;

    // Check exact match first
    if (this.availableLocales.includes(browserLang as Locale)) {
      return browserLang as Locale;
    }

    // Check language code only (e.g., "pt" from "pt-PT")
    const langCode = browserLang.split("-")[0];
    for (const locale of this.availableLocales) {
      if (locale.startsWith(langCode)) {
        return locale;
      }
    }

    return null;
  }

  /**
   * Loads a locale's translations
   */
  private async loadLocale(locale: Locale): Promise<void> {
    if (this.translations.has(locale)) return;

    try {
      const response = await fetch(`/admin/locales/${locale}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const translations = await response.json();
      this.translations.set(locale, translations);
      logger.debug(`Loaded locale: ${locale}`);
    } catch (error) {
      logger.error(`Failed to load locale ${locale}:`, error);
    }
  }

  /**
   * Gets current locale
   */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Sets current locale
   */
  async setLocale(locale: Locale): Promise<void> {
    if (!this.availableLocales.includes(locale)) {
      logger.warn(`Invalid locale: ${locale}`);
      return;
    }

    await this.loadLocale(locale);
    this.currentLocale = locale;
    storageManager.setLocale(locale);

    // Update all translated elements
    this.updateDOM();

    logger.info(`Locale changed to: ${locale}`);
  }

  /**
   * Gets a translation by key
   * @param key - Dot-separated key (e.g., "auth.login")
   * @param params - Optional parameters for interpolation
   */
  t(key: string, params?: Record<string, string | number>): string {
    const value = this.getValue(key, this.currentLocale);

    if (value === null) {
      // Try fallback locale
      const fallbackValue = this.getValue(key, this.fallbackLocale);
      if (fallbackValue === null) {
        logger.warn(`Missing translation: ${key}`);
        return key;
      }
      return this.interpolate(fallbackValue, params);
    }

    return this.interpolate(value, params);
  }

  /**
   * Gets a value from translations by dot-separated key
   */
  private getValue(key: string, locale: Locale): string | null {
    const translations = this.translations.get(locale);
    if (!translations) return null;

    const keys = key.split(".");
    let current: TranslationValue = translations;

    for (const k of keys) {
      if (typeof current !== "object" || current === null) return null;
      current = (current as TranslationObject)[k];
      if (current === undefined) return null;
    }

    return typeof current === "string" ? current : null;
  }

  /**
   * Interpolates parameters into a string
   */
  private interpolate(
    text: string,
    params?: Record<string, string | number>
  ): string {
    if (!params) return text;

    return text.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key]?.toString() ?? `{${key}}`;
    });
  }

  /**
   * Updates all DOM elements with data-i18n attributes
   */
  updateDOM(): void {
    // Update text content
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // Update placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key && el instanceof HTMLInputElement) {
        el.placeholder = this.t(key);
      }
    });

    // Update titles
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key && el instanceof HTMLElement) {
        el.title = this.t(key);
      }
    });

    // Update document title
    document.title = this.t("app.title");

    // Update html lang attribute
    document.documentElement.lang = this.currentLocale;
  }
}

// Export singleton instance
export const i18n = new I18n();
