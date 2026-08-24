export const SESSION_COOKIE = "qh_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;
export const PASSWORD_ITERATIONS = 100_000;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function normalizeUsername(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("zh-CN");
}

export function validateUsername(value: string) {
  const normalized = value.trim().normalize("NFKC");
  if (normalized.length < 3 || normalized.length > 20) {
    return "用户名需要 3–20 个字符";
  }
  if (!/^[\p{L}\p{N}_]+$/u.test(normalized)) {
    return "用户名只能包含中文、字母、数字和下划线";
  }
  return null;
}

export function validatePassword(value: string) {
  if (value.length < 8) return "密码至少需要 8 位";
  if (value.length > 72) return "密码最多 72 位";
  return null;
}

export async function hashPassword(
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
  iterations = PASSWORD_ITERATIONS,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return {
    hash: bytesToBase64Url(new Uint8Array(bits)),
    salt: bytesToBase64Url(salt),
    iterations,
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
  iterations: number,
) {
  const calculated = await hashPassword(
    password,
    base64UrlToBytes(salt),
    iterations,
  );
  const left = base64UrlToBytes(calculated.hash);
  const right = base64UrlToBytes(expectedHash);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

export function createSessionToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
