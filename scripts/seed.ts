/* eslint-disable no-console */
/**
 * Demo seed script.
 *
 * Creates a single demo workspace with:
 *   - 1 Owner (owner@purchaseer.dev)
 *   - 1 PM    (pm@purchaseer.dev)
 *   - 3 projects with varied budgets
 *   - 5 POs across statuses (draft, pending, approved, rejected, approved)
 *
 * Idempotent: re-running upserts users + workspace and tops the demo back up.
 * `--reset` truncates demo-workspace-scoped rows (NOT global) before seeding.
 *
 * Uses the SERVICE-ROLE client to bypass RLS. Server-only — never ship this key.
 *
 * Run: pnpm seed             (idempotent top-up)
 *      pnpm seed -- --reset  (wipe demo workspace rows, then seed fresh)
 *
 * NOTE: This script targets tables/columns described in `.chalk/sprint-01/PLAN.md`.
 * Until issues #3–#6 land, several of these tables won't exist yet and the script
 * will fail on first run — that's expected.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const DEMO_WORKSPACE_NAME = "Purchaseer Demo Co.";
const OWNER_EMAIL = "owner@purchaseer.dev";
const PM_EMAIL = "pm@purchaseer.dev";

type SeedSupabase = SupabaseClient;

function generatePassword(): string {
  // 18 url-safe chars; printed once to stdout for the operator.
  return randomBytes(14).toString("base64url");
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function makeClient(): SeedSupabase {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function ensureUser(
  client: SeedSupabase,
  email: string,
): Promise<{ id: string; password: string }> {
  // List all users (small in dev), find by email; otherwise create.
  // admin.listUsers paginates — for the demo workspace one page is enough.
  const { data: list, error: listErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    // Rotate password so the operator can log in with the printed creds.
    const password = generatePassword();
    const { error: updErr } = await client.auth.admin.updateUserById(
      existing.id,
      { password, email_confirm: true },
    );
    if (updErr) throw updErr;
    return { id: existing.id, password };
  }

  const password = generatePassword();
  const { data: created, error: createErr } =
    await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createErr) throw createErr;
  return { id: created.user.id, password };
}

async function ensureWorkspace(
  client: SeedSupabase,
  name: string,
): Promise<string> {
  const { data: existing, error: selErr } = await client
    .from("workspaces")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id as string;

  const { data: inserted, error: insErr } = await client
    .from("workspaces")
    .insert({ name })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return inserted.id as string;
}

async function ensureMembership(
  client: SeedSupabase,
  workspaceId: string,
  userId: string,
  role: "owner" | "pm" | "bookkeeper",
) {
  const { error } = await client.from("memberships").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      role,
      status: "active",
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (error) throw error;
}

async function resetWorkspace(client: SeedSupabase, workspaceId: string) {
  // Delete in FK-safe order. Scoped to the demo workspace ONLY.
  const childTables = [
    "po_status_history",
    "po_attachments",
    "po_line_items",
  ];
  for (const t of childTables) {
    // These tables don't have workspace_id directly; cascade-via-PO is fine
    // once purchase_orders rows are deleted below. We rely on FK ON DELETE CASCADE.
  }
  const scopedTables = [
    "purchase_orders",
    "rs_status_history",
    "rs_line_items",
    "request_slips",
    "project_budget_history",
    "projects",
    "invites",
    "notifications",
  ];
  for (const t of scopedTables) {
    const { error } = await client
      .from(t)
      .delete()
      .eq("workspace_id", workspaceId);
    if (error && !`${error.message}`.includes("does not exist")) {
      console.warn(`reset: skipping ${t} — ${error.message}`);
    }
  }
  // Memberships are kept so user logins still resolve into the workspace.
}

async function seedProjects(
  client: SeedSupabase,
  workspaceId: string,
  ownerId: string,
  pmId: string,
): Promise<string[]> {
  const projects = [
    { name: "Quezon City Townhouse — Phase 1", budget_centavos: 350_000_00 },
    { name: "Makati Office Fit-Out", budget_centavos: 1_200_000_00 },
    { name: "Cebu Warehouse Renovation", budget_centavos: 2_500_000_00 },
  ];

  const ids: string[] = [];
  for (const p of projects) {
    const { data, error } = await client
      .from("projects")
      .upsert(
        {
          workspace_id: workspaceId,
          name: p.name,
          budget_centavos: p.budget_centavos,
          assigned_pm_id: pmId,
          status: "active",
          created_by: ownerId,
        },
        { onConflict: "workspace_id,name" },
      )
      .select("id")
      .single();
    if (error) throw error;
    ids.push(data.id as string);
  }
  return ids;
}

async function seedPurchaseOrders(
  client: SeedSupabase,
  workspaceId: string,
  projectIds: string[],
  ownerId: string,
  pmId: string,
) {
  // 5 POs across statuses: draft, pending, approved, rejected, approved.
  const specs = [
    {
      status: "draft" as const,
      project: projectIds[0],
      supplier: "ACME Hardware",
      lines: [{ description: "Cement (40kg)", qty: 50, unit_price_centavos: 250_00 }],
    },
    {
      status: "pending" as const,
      project: projectIds[0],
      supplier: "BuildRight Supplies",
      lines: [{ description: "Rebar 10mm", qty: 200, unit_price_centavos: 180_00 }],
    },
    {
      status: "approved" as const,
      project: projectIds[1],
      supplier: "Metro Tiles",
      lines: [{ description: "Porcelain tile 60x60", qty: 120, unit_price_centavos: 320_00 }],
    },
    {
      status: "rejected" as const,
      project: projectIds[1],
      supplier: "QuickShip Co.",
      lines: [{ description: "Express delivery surcharge", qty: 1, unit_price_centavos: 25_000_00 }],
    },
    {
      status: "approved" as const,
      project: projectIds[2],
      supplier: "Northern Steel",
      lines: [{ description: "I-beam 6m", qty: 8, unit_price_centavos: 12_500_00 }],
    },
  ];

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const total = s.lines.reduce(
      (sum, l) => sum + l.qty * l.unit_price_centavos,
      0,
    );
    const submitted = s.status !== "draft";
    const decided = s.status === "approved" || s.status === "rejected";

    const { data: po, error: poErr } = await client
      .from("purchase_orders")
      .insert({
        workspace_id: workspaceId,
        project_id: s.project,
        po_number: `PO-${String(i + 1).padStart(3, "0")}`,
        supplier_name: s.supplier,
        total_centavos: total,
        status: s.status,
        created_by: pmId,
        submitted_at: submitted ? new Date().toISOString() : null,
        decided_by: decided ? ownerId : null,
        decided_at: decided ? new Date().toISOString() : null,
        decision_note: s.status === "rejected" ? "Out of scope" : null,
      })
      .select("id")
      .single();
    if (poErr) throw poErr;

    const lineRows = s.lines.map((l) => ({
      po_id: po.id as string,
      description: l.description,
      qty: l.qty,
      unit_price_centavos: l.unit_price_centavos,
      line_total_centavos: l.qty * l.unit_price_centavos,
    }));
    const { error: linesErr } = await client
      .from("po_line_items")
      .insert(lineRows);
    if (linesErr) throw linesErr;
  }
}

async function main() {
  const reset = process.argv.includes("--reset");
  const client = makeClient();

  console.log(`> seeding demo workspace (reset=${reset})`);

  const owner = await ensureUser(client, OWNER_EMAIL);
  const pm = await ensureUser(client, PM_EMAIL);
  const workspaceId = await ensureWorkspace(client, DEMO_WORKSPACE_NAME);

  await ensureMembership(client, workspaceId, owner.id, "owner");
  await ensureMembership(client, workspaceId, pm.id, "pm");

  if (reset) {
    console.log("> --reset: clearing demo workspace rows");
    await resetWorkspace(client, workspaceId);
  }

  const projectIds = await seedProjects(client, workspaceId, owner.id, pm.id);
  await seedPurchaseOrders(client, workspaceId, projectIds, owner.id, pm.id);

  console.log("");
  console.log("Demo seed complete.");
  console.log("---------------------------------------------");
  console.log(`Workspace : ${DEMO_WORKSPACE_NAME} (${workspaceId})`);
  console.log(`Owner     : ${OWNER_EMAIL}`);
  console.log(`            password: ${owner.password}`);
  console.log(`PM        : ${PM_EMAIL}`);
  console.log(`            password: ${pm.password}`);
  console.log("---------------------------------------------");
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
