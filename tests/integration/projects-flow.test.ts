import { describe, it } from "vitest";

// TODO(issue-3): wire up `supabase start` integration tests for projects:
//   - owner creates project, edits budget, archive
//   - audit row inserted on every budget change
//   - PM sees only assigned project, cannot mutate
// Skipping until Docker/local Supabase is reliably available, consistent
// with the approach in tests/integration/invite-flow.test.ts.
describe.skip("projects flow (integration)", () => {
  it("owner create -> edit -> archive with audit history", () => {
    // placeholder
  });
});
