// A short PIN that guards the scanner screen on a shared or lost phone. It stops casual use;
// it does not encrypt the data stored on the device.
import { getMeta, setMeta } from "./db";

const ITERATIONS = 150_000;
const encoder = new TextEncoder();

export const pinSupported = () =>
  typeof crypto !== "undefined" && Boolean(crypto.subtle);

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

async function derive(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(bits);
}

interface StoredPin {
  salt: string;
  hash: string;
}

export async function hasPin() {
  return Boolean(await getMeta<StoredPin>("pin"));
}

export async function savePin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await setMeta("pin", { salt: toBase64(salt), hash: await derive(pin, salt) });
}

export async function checkPin(pin: string) {
  const stored = await getMeta<StoredPin>("pin");
  if (!stored) return false;
  const salt = Uint8Array.from(atob(stored.salt), (c) => c.charCodeAt(0));
  return (await derive(pin, salt)) === stored.hash;
}
