import type { JWTPayload } from "./types";
import { logger } from "./logger";

// ============================================
// Utility Functions
// ============================================

/**
 * Decodes JWT payload
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (e) {
    logger.error("Failed to decode JWT:", e);
    return null;
  }
}

/**
 * Hashes password with SHA-512
 */
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Escapes HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Removes ANSI escape codes from text
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Extracts timestamp from log message
 * Returns [timestamp, cleanMessage]
 */
export function extractTimestamp(message: string): [string, string] {
  const timestampMatch = message.match(/^\[(\d{2}:\d{2}:\d{2})\]/);

  if (timestampMatch) {
    const time = `[${timestampMatch[1]}]`;
    const cleanMessage = message.substring(timestampMatch[0].length).trim();
    return [time, cleanMessage];
  }

  return ["", message];
}

/**
 * Gets the value from an input element
 */
export function getInputValue(
  element: HTMLInputElement | HTMLSelectElement
): string {
  if (element.type === "checkbox") {
    return (element as HTMLInputElement).checked ? "1" : "0";
  }
  return element.value;
}
