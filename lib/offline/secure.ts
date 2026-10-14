// Encryption of the data kept on a counter or scanner phone.
//
// A random master key is made when the PIN is chosen. It is stored only in a form wrapped by a key
// derived from the PIN (PBKDF2), and held in memory while the device is unlocked. Personal data
// (names, ID numbers, ticket codes, the device's signing key) is written to the local database as AES-GCM
// ciphertext, and lookups use a keyed hash of the ticket code, so reading the stored files without the
// PIN reveals nothing useful. A short numeric PIN can still be guessed by someone who copies the files
// and has time, so this protects against casual access and lost phones, not a determined attacker.
// The number of PBKDF2 rounds is kept modest so that unlocking stays quick on inexpensive phones.

const ITERATIONS = 250_000;
const encoder = new TextEncoder();

export class LockedError extends Error {
  constructor() {
    super("The device is locked.");
  }
}

export interface WrappedKeys {
  v: 2;
  salt: string;
  iv: string;
  ct: string;
  /** PBKDF2 rounds used for this PIN; older records did not store it and used 600000. */
  iter?: number;
}

export interface Sealed {
  __enc: 2;
  iv: string;
  ct: string;
}

let session: { aes: CryptoKey; mac: CryptoKey } | null = null;
const unlockHooks: (() => Promise<void>)[] = [];

export const cryptoSupported = () => typeof crypto !== "undefined" && Boolean(crypto.subtle);
export const isUnlocked = () => session !== null;
export const forgetKeys = () => {
  session = null;
};

/** Code that must run whenever the keys become available (for example re-sealing older plain data). */
export const onUnlock = (hook: () => Promise<void>) => {
  unlockHooks.push(hook);
};
export const runUnlockHooks = async () => {
  for (const hook of unlockHooks) await hook().catch(() => {});
};

const toBase64 = (bytes: ArrayBuffer | Uint8Array) => {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary);
};
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function wrapKey(pin: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function importMaster(master: Uint8Array) {
  const aes = await crypto.subtle.importKey("raw", master.slice(0, 32) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
  const mac = await crypto.subtle.importKey("raw", master.slice(32) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  session = { aes, mac };
}

/** Makes a new master key, wraps it with the PIN and leaves the device unlocked. */
export async function createKeys(pin: string): Promise<WrappedKeys> {
  const master = crypto.getRandomValues(new Uint8Array(64));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await wrapKey(pin, salt, ITERATIONS), master);
  await importMaster(master);
  return { v: 2, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct), iter: ITERATIONS };
}

/** Tries the PIN against the wrapped keys. A wrong PIN fails the authentication check. */
export async function unlockKeys(pin: string, wrapped: WrappedKeys) {
  try {
    const master = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(wrapped.iv) as BufferSource },
      await wrapKey(pin, fromBase64(wrapped.salt), wrapped.iter ?? 600_000),
      fromBase64(wrapped.ct) as BufferSource,
    );
    await importMaster(new Uint8Array(master));
    return true;
  } catch {
    return false;
  }
}

/** Encrypts a value. Without keys (no PIN yet, or an insecure page) the value is kept as it is. */
export async function seal<T>(value: T): Promise<Sealed | T> {
  if (!session) return value;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, session.aes, encoder.encode(JSON.stringify(value)));
  return { __enc: 2, iv: toBase64(iv), ct: toBase64(ct) };
}

const isSealed = (value: unknown): value is Sealed =>
  typeof value === "object" && value !== null && (value as Sealed).__enc === 2;

/** Reads a value written by seal(), or an older plain one. */
export async function unseal<T>(stored: Sealed | T): Promise<T> {
  if (!isSealed(stored)) return stored as T;
  if (!session) throw new LockedError();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(stored.iv) as BufferSource },
    session.aes,
    fromBase64(stored.ct) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export const wasSealed = isSealed;

/** A keyed hash used to look records up without storing the ticket code itself. */
export async function blind(text: string) {
  if (!session) return text;
  const digest = await crypto.subtle.sign("HMAC", session.mac, encoder.encode(text));
  return toBase64(digest).replace(/[+/=]/g, "").slice(0, 32);
}
