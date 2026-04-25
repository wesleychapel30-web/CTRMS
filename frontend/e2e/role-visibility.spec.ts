import { expect, test } from "@playwright/test";
import { enterpriseUsers, loginAs } from "./support/enterprise";

const roleCases = [
  {
    name: "procurement user",
    username: enterpriseUsers.procurement,
    workspacePath: "/procurement",
    workspaceHeading: "Procurement",
    visibleNav: ["Dashboard", "Procurement", "Inventory", "Documents"],
    hiddenNav: ["Approvals", "Finance", "Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/finance",
  },
  {
    name: "inventory user",
    username: enterpriseUsers.inventory,
    workspacePath: "/inventory",
    workspaceHeading: "Inventory",
    visibleNav: ["Dashboard", "Procurement", "Inventory", "Documents"],
    hiddenNav: ["Approvals", "Finance", "Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/finance",
  },
  {
    name: "finance user",
    username: enterpriseUsers.finance,
    workspacePath: "/finance",
    workspaceHeading: "Finance",
    visibleNav: ["Dashboard", "Approvals", "Procurement", "Inventory", "Finance", "Reports", "Documents"],
    hiddenNav: ["Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/activity",
  },
  {
    name: "manager",
    username: enterpriseUsers.manager,
    workspacePath: "/procurement",
    workspaceHeading: "Procurement",
    visibleNav: ["Dashboard", "Approvals", "Procurement", "Inventory", "Finance", "Reports", "Documents"],
    hiddenNav: ["Activity Logs", "Administration Panel", "Organization"],
    blockedPath: "/activity",
  },
  {
    name: "super admin",
    username: enterpriseUsers.superAdmin,
    workspacePath: "/procurement",
    workspaceHeading: "Procurement",
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
      await expect(page.getByRole("heading", { name: roleCase.workspaceHeading })).toBeVisible();

      if (roleCase.blockedPath) {
        await page.goto(roleCase.blockedPath);
        await expect(page).not.toHaveURL(new RegExp(`${roleCase.blockedPath}$`));
      }
    });
  }
});
