import { expect, type Locator, type Page } from "@playwright/test";

export const e2ePassword = "E2E-Enterprise-123!";

export const enterpriseUsers = {
  superAdmin: "e2e.superadmin",
  procurement: "e2e.procurement",
  inventory: "e2e.inventory",
  finance: "e2e.finance",
  manager: "e2e.manager",
} as const;

export async function loginAs(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill(e2ePassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function waitForSuccessToast(page: Page, text: string | RegExp) {
  const toast = page.getByTestId("toast-success").filter({ hasText: text }).last();
  await expect(toast).toBeVisible();
  return (await toast.textContent()) ?? "";
}

export async function waitForErrorToast(page: Page, text: string | RegExp) {
  const toast = page.getByTestId("toast-error").filter({ hasText: text }).last();
  await expect(toast).toBeVisible();
  return (await toast.textContent()) ?? "";
}

export function extractReference(text: string, prefix: string) {
  const match = text.match(new RegExp(`(${prefix}-[A-Z0-9-]+)`));
  if (!match) {
    throw new Error(`Unable to find ${prefix} reference in: ${text}`);
  }
  return match[1];
}

export async function rowByText(section: Locator, text: string | RegExp) {
  const row = section.getByRole("row").filter({ hasText: text }).first();
  await expect(row).toBeVisible();
  return row;
}
