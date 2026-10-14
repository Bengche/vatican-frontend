// The PIN that unlocks a counter or scanner phone. It protects the screen and, through secure.ts,
// the data stored on the phone: the PIN unwraps the key that encrypts it.
import { deleteMeta, getMeta, setMeta } from "./db";
import { createKeys, cryptoSupported, runUnlockHooks, unlockKeys } from "./secure";
import type { WrappedKeys } from "./secure";

const LEGACY_ITERATIONS = 150_000;
const encoder = new TextEncoder();

export const pinSupported = cryptoSupported;

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

// Older versions kept only a hash of the PIN. It is still accepted once, then replaced by wrapped keys.
async function legacyHash(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: LEGACY_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(bits);
}

interface LegacyPin {
  salt: string;
  hash: string;
}

export async function hasPin() {
  return Boolean((await getMeta<WrappedKeys>("pinKeys")) || (await getMeta<LegacyPin>("pin")));
}

/** Chooses the PIN: makes the encryption keys, stores them wrapped and leaves the device unlocked. */
export async function savePin(pin: string) {
  await setMeta("pinKeys", await createKeys(pin));
  await deleteMeta("pin");
  await runUnlockHooks();
}

export async function checkPin(pin: string) {
  const wrapped = await getMeta<WrappedKeys>("pinKeys");
  if (wrapped) {
    const ok = await unlockKeys(pin, wrapped);
    if (ok) await runUnlockHooks();
    return ok;
  }

  const legacy = await getMeta<LegacyPin>("pin");
  if (!legacy) return false;
  const salt = Uint8Array.from(atob(legacy.salt), (c) => c.charCodeAt(0));
  if ((await legacyHash(pin, salt)) !== legacy.hash) return false;
  await savePin(pin);
  return true;
}
