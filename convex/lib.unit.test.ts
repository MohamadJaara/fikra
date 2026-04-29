/// <reference types="vite/client" />
import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";

describe("sanitizeText", () => {
  let sanitizeText: (text: string) => string;

  beforeEach(async () => {
    const mod = await import("./lib");
    sanitizeText = mod.sanitizeText;
  });

  test("strips leading and trailing whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  test("strips tabs and newlines", () => {
    expect(sanitizeText("\t\nhello\n\t")).toBe("hello");
  });

  test("preserves internal spaces", () => {
    expect(sanitizeText("hello world")).toBe("hello world");
  });

  test("returns empty string for whitespace-only input", () => {
    expect(sanitizeText("   ")).toBe("");
  });
});

describe("validateStringLength", () => {
  let validateStringLength: (
    value: string,
    min: number,
    max: number,
    fieldName: string,
  ) => string;

  beforeEach(async () => {
    const mod = await import("./lib");
    validateStringLength = mod.validateStringLength;
  });

  test("returns trimmed value within bounds", () => {
    expect(validateStringLength("  hello  ", 1, 100, "Field")).toBe("hello");
  });

  test("throws when value is too short", () => {
    expect(() => validateStringLength("", 1, 100, "Title")).toThrow(
      "Title must be at least 1 characters",
    );
  });

  test("throws when value is too long", () => {
    expect(() => validateStringLength("a".repeat(101), 1, 100, "Title")).toThrow(
      "Title must be at most 100 characters",
    );
  });

  test("accepts value at exact min boundary", () => {
    expect(validateStringLength("a", 1, 100, "Field")).toBe("a");
  });

  test("accepts value at exact max boundary", () => {
    const val = "a".repeat(100);
    expect(validateStringLength(val, 1, 100, "Field")).toBe(val);
  });

  test("trims before checking length", () => {
    expect(() => validateStringLength("  ", 1, 100, "Field")).toThrow(
      "Field must be at least 1 characters",
    );
  });
});

describe("slugifyName", () => {
  let slugifyName: (name: string) => string;

  beforeEach(async () => {
    const mod = await import("./lib");
    slugifyName = mod.slugifyName;
  });

  test("lowercases and hyphenates", () => {
    expect(slugifyName("Hello World")).toBe("hello-world");
  });

  test("replaces non-alphanumeric with hyphens", () => {
    expect(slugifyName("foo@bar!baz")).toBe("foo-bar-baz");
  });

  test("strips leading and trailing hyphens", () => {
    expect(slugifyName("---hello---")).toBe("hello");
  });

  test("collapses consecutive hyphens", () => {
    expect(slugifyName("hello   world")).toBe("hello-world");
  });
});

describe("isEmailAllowed — domain checks", () => {
  let isEmailAllowed: (email: string) => boolean;
  let originalDomain: string | undefined;
  let originalEmails: string | undefined;

  beforeEach(() => {
    originalDomain = process.env.ALLOWED_DOMAIN;
    originalEmails = process.env.ALLOWED_EMAILS;
  });

  afterEach(() => {
    process.env.ALLOWED_DOMAIN = originalDomain;
    process.env.ALLOWED_EMAILS = originalEmails;
  });

  test("allows email matching ALLOWED_DOMAIN (read from process.env directly)", async () => {
    process.env.ALLOWED_DOMAIN = "example.com";
    process.env.ALLOWED_EMAILS = "";
    vi.resetModules();
    const mod = await import("./lib");
    isEmailAllowed = mod.isEmailAllowed;
    expect(isEmailAllowed("user@example.com")).toBe(true);
  });

  test("rejects email from wrong domain", async () => {
    process.env.ALLOWED_DOMAIN = "example.com";
    process.env.ALLOWED_EMAILS = "";
    vi.resetModules();
    const mod = await import("./lib");
    isEmailAllowed = mod.isEmailAllowed;
    expect(isEmailAllowed("user@evil.com")).toBe(false);
  });

  test("rejects subdomain spoofing attempt", async () => {
    process.env.ALLOWED_DOMAIN = "example.com";
    process.env.ALLOWED_EMAILS = "";
    vi.resetModules();
    const mod = await import("./lib");
    isEmailAllowed = mod.isEmailAllowed;
    expect(isEmailAllowed("user@evil.example.com")).toBe(false);
  });

  test("rejects partial domain match", async () => {
    process.env.ALLOWED_DOMAIN = "example.com";
    process.env.ALLOWED_EMAILS = "";
    vi.resetModules();
    const mod = await import("./lib");
    isEmailAllowed = mod.isEmailAllowed;
    expect(isEmailAllowed("user@notexample.com")).toBe(false);
  });
});

describe("isEmailAllowed — ALLOWED_EMAILS whitelist", () => {
  let isEmailAllowed: (email: string) => boolean;
  let originalDomain: string | undefined;
  let originalEmails: string | undefined;

  beforeEach(async () => {
    originalDomain = process.env.ALLOWED_DOMAIN;
    originalEmails = process.env.ALLOWED_EMAILS;
    process.env.ALLOWED_DOMAIN = "example.com";
    const mod = await import("./lib");
    isEmailAllowed = mod.isEmailAllowed;
  });

  afterEach(() => {
    process.env.ALLOWED_DOMAIN = originalDomain;
    process.env.ALLOWED_EMAILS = originalEmails;
  });

  test("allows email in ALLOWED_EMAILS whitelist", () => {
    process.env.ALLOWED_EMAILS = "special@gmail.com,other@outlook.com";
    expect(isEmailAllowed("special@gmail.com")).toBe(true);
    expect(isEmailAllowed("other@outlook.com")).toBe(true);
  });

  test("is case-insensitive for whitelist matching", () => {
    process.env.ALLOWED_EMAILS = "Special@Gmail.com";
    expect(isEmailAllowed("special@gmail.com")).toBe(true);
  });

  test("rejects email not in domain or whitelist", () => {
    process.env.ALLOWED_EMAILS = "special@gmail.com";
    expect(isEmailAllowed("random@attacker.com")).toBe(false);
  });
});

describe("normalizeOptionalStringArray", () => {
  let normalizeOptionalStringArray: (
    values: string[] | undefined,
  ) => string[] | undefined;

  beforeEach(async () => {
    const mod = await import("./lib");
    normalizeOptionalStringArray = mod.normalizeOptionalStringArray;
  });

  test("returns undefined for undefined input", () => {
    expect(normalizeOptionalStringArray(undefined)).toBe(undefined);
  });

  test("returns undefined for empty array", () => {
    expect(normalizeOptionalStringArray([])).toBe(undefined);
  });

  test("trims values and removes duplicates", () => {
    expect(
      normalizeOptionalStringArray(["  a  ", "b", "  a", ""]),
    ).toEqual(["a", "b"]);
  });

  test("removes empty strings after trimming", () => {
    expect(normalizeOptionalStringArray(["  ", "a", ""])).toEqual(["a"]);
  });
});
