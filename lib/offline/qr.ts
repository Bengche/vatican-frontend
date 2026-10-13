import nacl from "tweetnacl";
import type { TicketKey } from "./db";

export interface ParsedScan {
  hash: string | null;
  ref: string | null;
  tripId: string | null;
  keyId: string | null;
  signature: string | null;
}

const HASH_PATTERN = /[a-f0-9]{64}/i;

/** Reads a scanned QR link, a pasted link, a bare ticket code or a typed booking reference. */
export function parseScan(raw: string): ParsedScan {
  const text = raw.trim();
  const empty: ParsedScan = {
    hash: null,
    ref: null,
    tripId: null,
    keyId: null,
    signature: null,
  };
  if (!text) return empty;

  const hash = text.match(HASH_PATTERN)?.[0].toLowerCase() ?? null;
  if (!hash) return { ...empty, ref: text.slice(0, 40).toUpperCase() };

  try {
    const params = new URL(text).searchParams;
    return {
      hash,
      ref: params.get("r"),
      tripId: params.get("t"),
      keyId: params.get("k"),
      signature: params.get("s"),
    };
  } catch {
    return { ...empty, hash };
  }
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export type SignatureCheck = "valid" | "invalid" | "unknown-key" | "missing";

/** Checks the ticket's signature against the downloaded public keys. Needs no network. */
export function checkSignature(
  scan: ParsedScan,
  keys: TicketKey[],
): SignatureCheck {
  if (!scan.hash || !scan.ref || !scan.tripId || !scan.keyId || !scan.signature)
    return "missing";

  const key = keys.find((k) => k.keyId === scan.keyId);
  if (!key) return "unknown-key";

  try {
    const message = new TextEncoder().encode(
      ["v1", scan.hash, scan.ref, scan.tripId].join("|"),
    );
    return nacl.sign.detached.verify(
      message,
      fromBase64Url(scan.signature),
      fromBase64Url(key.publicKey),
    )
      ? "valid"
      : "invalid";
  } catch {
    return "invalid";
  }
}
