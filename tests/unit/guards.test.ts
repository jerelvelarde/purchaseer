import { describe, it, expect } from "vitest";
import { roleSatisfies } from "@/lib/auth/guards";

describe("roleSatisfies", () => {
  it("owner satisfies any role", () => {
    expect(roleSatisfies("owner", "owner")).toBe(true);
    expect(roleSatisfies("owner", "pm")).toBe(true);
    expect(roleSatisfies("owner", "bookkeeper")).toBe(true);
  });

  it("pm satisfies pm and bookkeeper but not owner", () => {
    expect(roleSatisfies("pm", "owner")).toBe(false);
    expect(roleSatisfies("pm", "pm")).toBe(true);
    expect(roleSatisfies("pm", "bookkeeper")).toBe(true);
  });

  it("bookkeeper only satisfies bookkeeper", () => {
    expect(roleSatisfies("bookkeeper", "owner")).toBe(false);
    expect(roleSatisfies("bookkeeper", "pm")).toBe(false);
    expect(roleSatisfies("bookkeeper", "bookkeeper")).toBe(true);
  });
});
