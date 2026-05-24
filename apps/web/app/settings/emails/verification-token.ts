import { createHash } from "node:crypto";

export function hashVerificationSecret(secret: string) {
  return createHash("sha256").update(secret).digest("base64url");
}

export function parseVerificationToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [id, secret, ...rest] = token.split(".");

  if (!id || !secret || rest.length > 0) {
    return null;
  }

  return {
    id,
    secret,
  };
}
