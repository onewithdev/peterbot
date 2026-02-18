import { describe, test, expect, beforeEach } from "bun:test";

// Simple mock for localStorage
const localStorageMock = {
  store: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  },
  removeItem(key: string): void {
    this.store.delete(key);
  },
  clear(): void {
    this.store.clear();
  },
};

// Set up global mocks
global.localStorage = localStorageMock as any;
global.window = { localStorage: localStorageMock } as any;

// Import after mocking
import {
  getPassword,
  setPassword,
  clearPassword,
  isAuthenticated,
  PASSWORD_KEY,
} from "../../../web/src/lib/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("getPassword", () => {
    test("returns null when no password is stored", () => {
      const result = getPassword();
      expect(result).toBeNull();
    });

    test("returns the stored password", () => {
      localStorageMock.setItem(PASSWORD_KEY, "my-secret-password");
      const result = getPassword();
      expect(result).toBe("my-secret-password");
    });
  });

  describe("setPassword", () => {
    test("stores password in localStorage", () => {
      setPassword("new-password");
      expect(localStorageMock.getItem(PASSWORD_KEY)).toBe("new-password");
    });
  });

  describe("clearPassword", () => {
    test("removes password from localStorage", () => {
      localStorageMock.setItem(PASSWORD_KEY, "some-password");
      clearPassword();
      expect(localStorageMock.getItem(PASSWORD_KEY)).toBeNull();
    });
  });

  describe("isAuthenticated", () => {
    test("returns false when no password is stored", () => {
      const result = isAuthenticated();
      expect(result).toBe(false);
    });

    test("returns true when password is stored", () => {
      localStorageMock.setItem(PASSWORD_KEY, "some-password");
      const result = isAuthenticated();
      expect(result).toBe(true);
    });
  });
});
