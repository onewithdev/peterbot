import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock localStorage before importing auth module
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(global, "window", {
  value: { localStorage: localStorageMock },
  writable: true,
});

// Import after mocking
import {
  getPassword,
  setPassword,
  clearPassword,
  isAuthenticated,
  PASSWORD_KEY,
} from "./auth";

describe("auth utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getPassword", () => {
    test("returns null when no password is stored", () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = getPassword();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(PASSWORD_KEY);
      expect(result).toBeNull();
    });

    test("returns the stored password", () => {
      localStorageMock.getItem.mockReturnValue("my-secret-password");
      const result = getPassword();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(PASSWORD_KEY);
      expect(result).toBe("my-secret-password");
    });
  });

  describe("setPassword", () => {
    test("stores password in localStorage", () => {
      setPassword("new-password");
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        PASSWORD_KEY,
        "new-password"
      );
    });
  });

  describe("clearPassword", () => {
    test("removes password from localStorage", () => {
      clearPassword();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(PASSWORD_KEY);
    });
  });

  describe("isAuthenticated", () => {
    test("returns false when no password is stored", () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = isAuthenticated();
      expect(result).toBe(false);
    });

    test("returns true when password is stored", () => {
      localStorageMock.getItem.mockReturnValue("some-password");
      const result = isAuthenticated();
      expect(result).toBe(true);
    });
  });
});
