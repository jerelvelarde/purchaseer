import { describe, it, expect } from "vitest";
import { canEditProject, canViewProject } from "@/lib/projects/access";

describe("canEditProject", () => {
  it("owner can edit active projects", () => {
    expect(canEditProject("owner", { assigned_pm_id: null, status: "active" })).toBe(true);
  });

  it("owner cannot edit archived projects", () => {
    expect(canEditProject("owner", { assigned_pm_id: null, status: "archived" })).toBe(false);
  });

  it("pm cannot edit even when assigned", () => {
    expect(canEditProject("pm", { assigned_pm_id: "u1", status: "active" })).toBe(false);
  });

  it("bookkeeper cannot edit", () => {
    expect(canEditProject("bookkeeper", { assigned_pm_id: null, status: "active" })).toBe(false);
  });
});

describe("canViewProject", () => {
  it("owner sees any project", () => {
    expect(canViewProject("owner", "u1", { assigned_pm_id: null })).toBe(true);
  });

  it("bookkeeper sees any project", () => {
    expect(canViewProject("bookkeeper", "u1", { assigned_pm_id: null })).toBe(true);
  });

  it("pm sees only assigned project", () => {
    expect(canViewProject("pm", "u1", { assigned_pm_id: "u1" })).toBe(true);
    expect(canViewProject("pm", "u1", { assigned_pm_id: "u2" })).toBe(false);
    expect(canViewProject("pm", "u1", { assigned_pm_id: null })).toBe(false);
  });
});
