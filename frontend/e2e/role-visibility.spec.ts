import { expect, test } from "@playwright/test";
import { enterpriseUsers, loginAs } from "./support/enterprise";

const roleCases = [
  {
    name: "procurement user",
    username: enterpriseUsers.procurement,
    workspacePath: "/procurement",
    workspaceBanner: "Procurement view is focused on creating, refining, converting, and issuing purchase requests safely.",
    visibleNav: ["Dashboard", "Procurement", "Inventory", "Documents"],
    hiddenNav: ["Approvals", "Finance", "Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/finance",
  },
  {
    name: "inventory user",
    username: enterpriseUsers.inventory,
    workspacePath: "/inventory",
    workspaceBanner: "Operations view prioritizes receiving and stock movement controls.",
    visibleNav: ["Dashboard", "Procurement", "Inventory", "Documents"],
    hiddenNav: ["Approvals", "Finance", "Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/finance",
  },
  {
    name: "finance user",
    username: enterpriseUsers.finance,
    workspacePath: "/finance",
    workspaceBanner: "Finance view prioritizes invoice control, payment approvals, and settlement evidence.",
    visibleNav: ["Dashboard", "Approvals", "Procurement", "Inventory", "Finance", "Reports", "Documents"],
    hiddenNav: ["Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/activity",
  },
  {
    name: "manager",
    username: enterpriseUsers.manager,
    workspacePath: "/procurement",
    workspaceBanner: "Manager view is centered on approvals and draft visibility for department workflows.",
    visibleNav: ["Dashboard", "Approvals", "Procurement", "Inventory", "Finance", "Reports", "Documents"],
    hiddenNav: ["Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/activity",
  },
  {
    name: "super admin",
    username: enterpriseUsers.superAdmin,
    workspacePath: "/procurement",
    workspaceBanner: "You have full cross-slice authority here, including approvals, conversion, and order issuance.",
    visibleNav: ["Dashboard", "Organization", "Approvals", "Procurement", "Inventory", "Finance", "Reports", "Documents", "Activity Logs", "Administration Panel", "System Settings"],
    hiddenNav: [],
    blockedPath: null,
  },
] as const;

test.describe("Role-aware visibility", () => {
  for (const roleCase of roleCases) {
    test(`shows the correct navigation and workspace cues for the ${roleCase.name}`, async ({ page }) => {
      await loginAs(page, roleCase.username);
      for (const label of roleCase.visibleNav) {
        await expect(page.getByRole("link", { name: label })).toBeVisible();
      }
      for (const label of roleCase.hiddenNav) {
        await expect(page.getByRole("link", { name: label })).toHaveCount(0);
      }

      await page.goto(roleCase.workspacePath);
      await expect(page.getByText(roleCase.workspaceBanner)).toBeVisible();

      if (roleCase.blockedPath) {
        await page.goto(roleCase.blockedPath);
        await expect(page).not.toHaveURL(new RegExp(`${roleCase.blockedPath}$`));
      }
    });
  }
});
