import { appendFileSync } from "fs";

const LOG_FILE = "/tmp/villageshare-debug.log";

export function debugLog(tag: string, message: string) {
  const line = `[${new Date().toISOString()}] [${tag}] ${message}\n`;
  try {
    appendFileSync(LOG_FILE, line);
  } catch {
    // Edge runtime fallback
  }
  // Always also console.log so it shows in dev terminal
  console.log(`[${tag}] ${message}`);
}
