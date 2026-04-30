import { test, expect, type Page } from "@playwright/test";

/**
 * Golden path E2E — sprint-01 acceptance test.
 *
 *   signup as Owner
 *   -> invite PM
 *   -> simulate accept (read invite token via dev-only /api/test-only/last-invite)
 *   -> PM logs in
 *   -> Owner creates a project with budget
 *   -> PM creates a PO with one line item
 *   -> PM submits PO
 *   -> Owner approves PO
 *   -> Company Dashboard shows updated `% used` within 5s (polling cadence)
 *
 * Mobile viewport (iPhone 14): 390 x 844.
 *
 * NOTE: This spec depends on UI + APIs from issues #3–#6. Until those merge,
 * selectors here are best-effort against PLAN.md and will fail in CI. That is
 * expected and called out in the PR body.
 */

const VIEWPORT = { width: 390, height: 844 };
const TEST_SECRET = process.env.TEST_INVITE_SECRET ?? "test-invite-secret";

const stamp = Date.now();
const OWNER_EMAIL = `owner+${stamp}@e2e.purchaseer.dev`;
const PM_EMAIL = `pm+${stamp}@e2e.purchaseer.dev`;
const PASSWORD = "Test1234!Test1234!";
const WORKSPACE_NAME = `E2E Workspace ${stamp}`;
const PROJECT_NAME = `E2E Project ${stamp}`;
const PROJECT_BUDGET_PHP = 100_000; // ₱100,000

test.use({ viewport: VIEWPORT });

async function signupOwner(page: Page) {
  await page.goto("/signup");
  await page.getByLabel(/workspace/i).fill(WORKSPACE_NAME);
  await page.getByLabel(/email/i).fill(OWNER_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign ?up|create/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|app|projects)/i, { timeout: 15_000 });
}

async function invitePm(page: Page) {
  await page.goto("/app/team");
  await page.getByRole("button", { name: /invite/i }).click();
  await page.getByLabel(/email/i).fill(PM_EMAIL);
  await page.getByLabel(/role/i).selectOption("pm");
  await page.getByRole("button", { name: /send|invite/i }).click();
  await expect(page.getByText(/invited|pending/i)).toBeVisible({ timeout: 10_000 });
}

async function fetchLatestInviteToken(
  request: Page["request"],
  email: string,
): Promise<string> {
  const res = await request.get(
    `/api/test-only/last-invite?email=${encodeURIComponent(email)}`,
    { headers: { "x-test-secret": TEST_SECRET } },
  );
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // Endpoint may return either a raw `token` (dev-only) or a hash; we prefer raw.
  const token: string | undefined = body?.invite?.token;
  expect(token, "dev-only invite endpoint must return a raw token").toBeTruthy();
  return token!;
}

async function acceptInviteAsPm(page: Page, token: string) {
  await page.goto(`/accept-invite?token=${encodeURIComponent(token)}`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /accept|create/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|app|login)/i, { timeout: 15_000 });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log ?in|sign ?in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|app)/i, { timeout: 15_000 });
}

async function ownerCreatesProject(page: Page) {
  await page.goto("/app/projects/new");
  await page.getByLabel(/project name|name/i).fill(PROJECT_NAME);
  await page.getByLabel(/budget/i).fill(String(PROJECT_BUDGET_PHP));
  // PM dropdown should include the freshly-accepted PM by email.
  const pmField = page.getByLabel(/assigned pm|pm/i);
  if (await pmField.isVisible().catch(() => false)) {
    await pmField.selectOption({ label: PM_EMAIL });
  }
  await page.getByRole("button", { name: /create|save/i }).click();
  await expect(page.getByText(PROJECT_NAME)).toBeVisible({ timeout: 10_000 });
}

async function pmCreatesAndSubmitsPo(page: Page) {
  await page.goto("/app/pos/new");
  // Pick the project we just created.
  await page.getByLabel(/project/i).selectOption({ label: PROJECT_NAME });
  await page.getByLabel(/supplier/i).fill("Test Supplier");

  // Single line item: qty 10 @ ₱5,000 = ₱50,000 (50% of ₱100k budget).
  await page.getByRole("button", { name: /add line|add item/i }).click();
  await page.getByLabel(/description/i).fill("Test material");
  await page.getByLabel(/qty|quantity/i).fill("10");
  await page.getByLabel(/unit price|price/i).fill("5000");

  await page.getByRole("button", { name: /save draft|save/i }).click();
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 10_000 });
}

async function ownerApprovesPo(page: Page) {
  await page.goto("/app/approvals");
  await page.getByText(/Test Supplier/).first().click();
  await page.getByRole("button", { name: /approve/i }).click();
  await expect(page.getByText(/approved/i).first()).toBeVisible({
    timeout: 10_000,
  });
}

test("golden path: signup -> invite -> approve -> dashboard updates within 5s", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext({ viewport: VIEWPORT });
  const pmCtx = await browser.newContext({ viewport: VIEWPORT });
  const ownerPage = await ownerCtx.newPage();
  const pmPage = await pmCtx.newPage();

  try {
    await signupOwner(ownerPage);
    await invitePm(ownerPage);

    const token = await fetchLatestInviteToken(ownerPage.request, PM_EMAIL);
    await acceptInviteAsPm(pmPage, token);
    await login(pmPage, PM_EMAIL, PASSWORD);

    await ownerCreatesProject(ownerPage);
    await pmCreatesAndSubmitsPo(pmPage);
    await ownerApprovesPo(ownerPage);

    // Owner's Company Dashboard should reflect the new approved PO within 5s
    // (the polling cadence). Use toPass to retry the assertion through one
    // poll cycle without forcing a manual reload.
    await ownerPage.goto("/app/dashboard");
    await expect(async () => {
      const text = await ownerPage
        .getByTestId("project-row")
        .filter({ hasText: PROJECT_NAME })
        .first()
        .textContent();
      // ₱50,000 of ₱100,000 -> 50% used.
      expect(text ?? "").toMatch(/50\s*%/);
    }).toPass({ timeout: 5_500, intervals: [500, 1000, 2000] });
  } finally {
    await ownerCtx.close();
    await pmCtx.close();
  }
});
