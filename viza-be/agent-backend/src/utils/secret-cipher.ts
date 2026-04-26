import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetric encryption for sensitive payload fields (UK portal password,
 * future per-country secrets). AES-256-GCM with per-row salt + IV; the
 * shared key is scrypt-derived from `SUBMISSION_RESULT_SECRET_KEY`.
 *
 * Cipher format (single string for JSONB friendliness):
 *   `${saltHex}:${ivHex}:${ciphertextHex}:${authTagHex}`
 *
 * MIRROR OF viza-be/submission-service/src/secret-cipher.ts. Keep these
 * byte-equivalent below the file-header comment.
 */

const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN);
}

function getPassphrase(): string {
  const k = process.env.SUBMISSION_RESULT_SECRET_KEY;
  if (!k || k.length < 16) {
    throw new Error(
      "SUBMISSION_RESULT_SECRET_KEY must be set (>=16 chars) to encrypt/decrypt submission results",
    );
  }
  return k;
}

export function encryptSecret(plaintext: string): string {
  const passphrase = getPassphrase();
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [salt.toString("hex"), iv.toString("hex"), enc.toString("hex"), tag.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed cipher payload: expected salt:iv:ct:tag");
  }
  const [saltHex, ivHex, ctHex, tagHex] = parts;
  const passphrase = getPassphrase();
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}
