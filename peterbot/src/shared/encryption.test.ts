import { describe, it, expect, beforeAll } from "bun:test";
import { encrypt, decrypt, maskKey } from "./encryption.js";

// Set up test encryption key
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test_encryption_key_that_is_32_chars_long!";
});

describe("encryption", () => {
  describe("encrypt / decrypt", () => {
    it("should encrypt and decrypt a string correctly", () => {
      const original = "sk-ant-api03-secret-key-12345";
      const { ciphertext, iv } = encrypt(original);
      const decrypted = decrypt(ciphertext, iv);

      expect(decrypted).toBe(original);
    });

    it("should produce different ciphertexts for the same input (due to random IV)", () => {
      const original = "same-input-text";
      const result1 = encrypt(original);
      const result2 = encrypt(original);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it("should handle empty strings", () => {
      const original = "";
      const { ciphertext, iv } = encrypt(original);
      const decrypted = decrypt(ciphertext, iv);

      expect(decrypted).toBe(original);
    });

    it("should handle long strings", () => {
      const original = "a".repeat(1000);
      const { ciphertext, iv } = encrypt(original);
      const decrypted = decrypt(ciphertext, iv);

      expect(decrypted).toBe(original);
    });

    it("should handle special characters", () => {
      const original = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
      const { ciphertext, iv } = encrypt(original);
      const decrypted = decrypt(ciphertext, iv);

      expect(decrypted).toBe(original);
    });

    it("should throw on tampered ciphertext", () => {
      const original = "secret-data";
      const { ciphertext, iv } = encrypt(original);

      // Tamper with the ciphertext
      const tampered = ciphertext.slice(0, -4) + "abcd";

      expect(() => decrypt(tampered, iv)).toThrow();
    });

    it("should throw on wrong IV", () => {
      const original = "secret-data";
      const { ciphertext } = encrypt(original);
      const wrongIv = Buffer.from("wrong-iv-12").toString("base64");

      expect(() => decrypt(ciphertext, wrongIv)).toThrow();
    });
  });

  describe("maskKey", () => {
    it("should mask a standard API key", () => {
      const key = "sk-ant-api03-AbCdXyZz";
      const masked = maskKey(key);

      expect(masked).toBe("sk-ant-...XyZz");
    });

    it("should mask a short key with minimal exposure", () => {
      const key = "short";
      const masked = maskKey(key);

      expect(masked).toBe("sho...t");
    });

    it("should handle very short keys", () => {
      const key = "ab";
      const masked = maskKey(key);

      expect(masked).toBe("****");
    });

    it("should handle keys at boundary length", () => {
      const key = "exactly-10";
      const masked = maskKey(key);

      expect(masked).toBe("exa...0");
    });

    it("should mask Google API keys", () => {
      const key = "AIzaSyBfwXwI8b1f02oKtGhzYir8v1ffeESkTxg";
      const masked = maskKey(key);

      expect(masked).toBe("AIzaSyB...kTxg");
    });

    it("should mask Moonshot API keys", () => {
      const key = "sk-moonshot-abc123xyz789";
      const masked = maskKey(key);

      expect(masked).toBe("sk-moon...z789");
    });
  });
});
