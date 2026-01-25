import type { LoggerWrapper } from "./logger";

// ============================================
// API Client Types
// ============================================

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText?: string;
  data?: T;
  error?: string;
}

export interface ApiClientOptions {
  authToken?: string | null;
  baseUrl?: string;
  logger?: LoggerWrapper;
  timeout?: number;
}

export interface RequestOptions {
  body?: unknown;
  includeAuth?: boolean;
  timeout?: number;
}

// Default timeout in milliseconds
const DEFAULT_TIMEOUT = 5000;

// ============================================
// API Client Class
// ============================================

export class ApiClient {
  private options: ApiClientOptions;

  constructor(options: ApiClientOptions = {}) {
    this.options = { ...options };
  }

  /**
   * Sets/updates the client options
   */
  set config(options: Partial<ApiClientOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Prepares headers for HTTP requests
   */
  private prepareRequestHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (includeAuth && this.options.authToken) {
      headers["Authorization"] = `Bearer ${this.options.authToken}`;
    }

    return headers;
  }

  /**
   * Performs HTTP request with timeout
   */
  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { body, includeAuth = true, timeout } = options;
    const requestTimeout = timeout ?? this.options.timeout ?? DEFAULT_TIMEOUT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const fullUrl = this.options.baseUrl ? `${this.options.baseUrl}${url}` : url;

      const response = await fetch(fullUrl, {
        method,
        headers: this.prepareRequestHeaders(includeAuth),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return this.handleError(new Error("Request timeout"));
      }
      return this.handleError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles the response from fetch
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const result: ApiResponse<T> = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };

    // Handle no content response
    if (response.status === 204) {
      return result;
    }

    // Try to parse JSON response
    try {
      const text = await response.text();
      if (text) {
        result.data = JSON.parse(text) as T;
      }
    } catch {
      // Response is not JSON, that's ok
    }

    // Add error message for non-ok responses
    if (!response.ok) {
      result.error = response.statusText || `Request failed (${response.status})`;
      this.options.logger?.warn(`API error: ${response.status} - ${result.error}`);
    }

    return result;
  }

  /**
   * Handles fetch errors
   */
  private handleError<T>(error: unknown): ApiResponse<T> {
    const message = error instanceof Error ? error.message : "Network error";
    this.options.logger?.error("API request failed:", error);

    return {
      ok: false,
      status: 0,
      error: message,
    };
  }
}
