import { createHash, randomBytes } from "node:crypto";

const tokenPrefix = "mcp_";

export function createMcpToken() {
  return `${tokenPrefix}${randomBytes(32).toString("base64url")}`;
}

export function createMcpTokenHash(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function createMcpTokenDisplayPrefix(token: string) {
  return token.slice(0, tokenPrefix.length + 8);
}

export function isMcpToken(value: string) {
  return value.startsWith(tokenPrefix) && value.length > tokenPrefix.length;
}
