import crypto from "crypto";

/**
 * Encryption class provides utility functions to encrypt and decrypt data securely using AES-256-CBC algorithm.
 * This class utilizes environment variables to manage the encryption key and initialization vector (IV),
 * which should be securely stored and managed outside of the application's source code.
 */
export default class Encryption {
  static encryptionKey = Buffer.from(
    process.env.ENCRYPTION_KEY || "",
    "base64"
  );
  static iv = Buffer.from(process.env.IV_STRING || "", "base64");

  /**
   * Encrypts a given data buffer using AES-256-CBC algorithm.
   * @param {Buffer} data - The data to encrypt.
   * @returns {Buffer} The encrypted data as a Buffer.
   */
  static encrypt(data: Buffer): Buffer {
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Encryption.encryptionKey,
      Encryption.iv
    );
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return encrypted;
  }

  /**
   * Decrypts a given encrypted data buffer using AES-256-CBC algorithm.
   * @param {Buffer} encrypted - The encrypted data to decrypt.
   * @returns {Buffer} The decrypted data as a Buffer.
   */
  static decrypt(encrypted: Buffer): Buffer {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Encryption.encryptionKey,
      Encryption.iv
    );
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted;
  }

  static generateTestKeys() {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
  }
}
