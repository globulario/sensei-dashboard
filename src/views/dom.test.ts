import { describe, it, expect } from "vitest";
import { externalSourceLink } from "./dom.js";

describe("externalSourceLink (ARCHITECT REVIEW finding #2 on PR #5)", () => {
  it("renders a valid https target as a clickable anchor with safe attributes, unchanged", () => {
    const el = externalSourceLink("View docs", "https://example.test/docs#section");
    expect(el.tagName).toBe("A");
    expect(el.getAttribute("href")).toBe("https://example.test/docs#section");
    expect(el.getAttribute("target")).toBe("_blank");
    expect(el.getAttribute("rel")).toContain("noopener");
  });

  it("renders a valid http target as a clickable anchor", () => {
    const el = externalSourceLink("View", "http://example.test/file");
    expect(el.tagName).toBe("A");
    expect(el.getAttribute("href")).toBe("http://example.test/file");
  });

  it("renders a safe relative target as a clickable anchor, unchanged", () => {
    const el = externalSourceLink("View source", "/docs/architecture.md");
    expect(el.tagName).toBe("A");
    expect(el.getAttribute("href")).toBe("/docs/architecture.md");
  });

  it("never renders a javascript: target as a clickable anchor", () => {
    const el = externalSourceLink("Click me", "javascript:alert(1)");
    expect(el.tagName).not.toBe("A");
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("not rendered");
  });

  it("never renders a data: target as a clickable anchor", () => {
    const el = externalSourceLink("Click me", "data:text/html,<script>alert(1)</script>");
    expect(el.tagName).not.toBe("A");
    expect(el.querySelector("a")).toBeNull();
  });

  it("never renders a malformed target as a clickable anchor", () => {
    const el = externalSourceLink("Broken", "https://[invalid");
    expect(el.tagName).not.toBe("A");
  });

  it("does not rewrite an unsafe target into a different URL — the diagnostic names the original text", () => {
    const target = "javascript:alert(document.cookie)";
    const el = externalSourceLink("Click me", target);
    expect(el.textContent).toContain(target);
  });
});
