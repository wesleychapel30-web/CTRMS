import { expect, test } from "@playwright/test";
import {
  enterpriseUsers,
  extractReference,
  loginAs,
  logout,
  rowByText,
  waitForSuccessToast,
} from "./support/enterprise";

test.describe("Enterprise slice workflow", () => {
  test("runs the procurement to payment happy path", async ({ page }) => {
    test.slow();
    const suffix = Date.now().toString().slice(-6);
    const requestTitle = `E2E Happy Path ${suffix}`;
    const paymentReference = `E2E-PAY-${suffix}`;

    await loginAs(page, enterpriseUsers.procurement);
    await page.goto("/procurement");
    await page.getByTestId("procurement-new-draft").click();
    await page.getByLabel("Request title").fill(requestTitle);
    await page.getByLabel("Business justification").fill("Browser automation validation for the connected enterprise slice.");
    await page.getByLabel("Line 1 product").selectOption({ index: 1 });
    await page.getByLabel("Line 1 quantity").fill("2");
    await page.getByTestId("procurement-save-draft").click();
    await waitForSuccessToast(page, /draft procurement request created/i);
    await page.getByTestId("procurement-save-and-submit").click();
    await waitForSuccessToast(page, /submitted for approval/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.superAdmin);
    await page.goto("/approvals");
    await page.getByPlaceholder("Search record number, title, or requester").fill(requestTitle);
    const approvalsSection = page.getByTestId("approval-inbox-section");
    const firstApprovalRow = await rowByText(approvalsSection, requestTitle);
    await firstApprovalRow.getByRole("button", { name: /review/i }).click();
    await page.getByTestId("approval-item-action-approve").click();
    await waitForSuccessToast(page, /moved forward/i);
    await page.getByPlaceholder("Search record number, title, or requester").fill(requestTitle);
    const secondApprovalRow = await rowByText(approvalsSection, requestTitle);
    await secondApprovalRow.getByRole("button", { name: /review/i }).click();
    await page.getByTestId("approval-item-action-approve").click();
    await waitForSuccessToast(page, /moved forward/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.procurement);
    await page.goto("/procurement");
    const procurementRequestRow = await rowByText(page.getByTestId("procurement-requests-section"), requestTitle);
    await procurementRequestRow.getByRole("button", { name: /inspect/i }).click();
    await page.getByLabel("Conversion notes").fill("Converted during Playwright happy-path validation.");
    await page.getByTestId("procurement-request-action-convert_to_purchase_order").click();
    const convertToast = await waitForSuccessToast(page, /converted to/i);
    const poNumber = extractReference(convertToast, "PO");
    await page.getByTestId("purchase-order-action-issue").click();
    await waitForSuccessToast(page, new RegExp(`${poNumber} issued`, "i"));
    await logout(page);

    await loginAs(page, enterpriseUsers.inventory);
    await page.goto("/inventory");
    const receivableOrdersSection = page.getByTestId("inventory-receivable-orders-section");
    const inventoryOrderRow = await rowByText(receivableOrdersSection, poNumber);
    await inventoryOrderRow.getByRole("button", { name: /receive/i }).click();
    await page.getByLabel("Receiving notes").fill("Received in full during browser automation.");
    await page.getByTestId("inventory-order-action-record_goods_receipt").click();
    await waitForSuccessToast(page, /posted to inventory/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.finance);
    await page.goto("/finance");
    const invoicesSection = page.getByTestId("finance-invoices-section");
    const invoiceRow = await rowByText(invoicesSection, poNumber);
    await invoiceRow.getByRole("button", { name: /inspect/i }).click();
    await page.getByLabel("Invoice date").fill("2026-03-28");
    await page.getByTestId("finance-invoice-action-post").click();
    await waitForSuccessToast(page, /posted for approval/i);
    await page.getByTestId("finance-invoice-action-approve").click();
    await waitForSuccessToast(page, /approved/i);
    await page.getByTestId("finance-invoice-action-create_payment_request").click();
    const paymentToast = await waitForSuccessToast(page, /created/i);
    const paymentRequestNumber = extractReference(paymentToast, "PAY");
    await page.getByTestId("finance-payment-action-approve").click();
    await waitForSuccessToast(page, /approved/i);
    await page.getByLabel("Payment reference").fill(paymentReference);
    await page.getByTestId("finance-payment-action-mark_paid").click();
    await waitForSuccessToast(page, /marked as paid/i);
    await expect(page.getByTestId("finance-invoice-workbench")).toContainText(paymentRequestNumber);
  });

  test("supports rejecting a procurement request from the approval inbox", async ({ page }) => {
    test.slow();
    const suffix = Date.now().toString().slice(-6);
    const requestTitle = `E2E Reject Procurement ${suffix}`;

    await loginAs(page, enterpriseUsers.procurement);
    await page.goto("/procurement");
    await page.getByTestId("procurement-new-draft").click();
    await page.getByLabel("Request title").fill(requestTitle);
    await page.getByLabel("Business justification").fill("Validation of procurement rejection handling.");
    await page.getByLabel("Line 1 product").selectOption({ index: 1 });
    await page.getByLabel("Line 1 quantity").fill("1");
    await page.getByTestId("procurement-save-and-submit").click();
    await waitForSuccessToast(page, /submitted for approval/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.superAdmin);
    await page.goto("/approvals");
    await page.getByPlaceholder("Search record number, title, or requester").fill(requestTitle);
    const approvalRow = await rowByText(page.getByTestId("approval-inbox-section"), requestTitle);
    await approvalRow.getByRole("button", { name: /review/i }).click();
    await page.getByLabel("Rejection reason").fill("Rejected in browser automation to validate the send-back path.");
    await page.getByTestId("approval-item-action-reject").click();
    await waitForSuccessToast(page, /was rejected/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.procurement);
    await page.goto("/procurement");
    const requestRow = await rowByText(page.getByTestId("procurement-requests-section"), requestTitle);
    await expect(requestRow).toContainText(/rejected/i);
    await requestRow.getByRole("button", { name: /inspect/i }).click();
    await expect(page.getByTestId("procurement-request-action-convert_to_purchase_order")).toHaveCount(0);
  });

  test("supports rejecting a payment request before settlement", async ({ page }) => {
    test.slow();
    const suffix = Date.now().toString().slice(-6);
    const requestTitle = `E2E Reject Payment ${suffix}`;

    await loginAs(page, enterpriseUsers.procurement);
    await page.goto("/procurement");
    await page.getByTestId("procurement-new-draft").click();
    await page.getByLabel("Request title").fill(requestTitle);
    await page.getByLabel("Business justification").fill("Validation of payment-request rejection handling.");
    await page.getByLabel("Line 1 product").selectOption({ index: 1 });
    await page.getByLabel("Line 1 quantity").fill("1");
    await page.getByTestId("procurement-save-and-submit").click();
    await waitForSuccessToast(page, /submitted for approval/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.superAdmin);
    await page.goto("/approvals");
    await page.getByPlaceholder("Search record number, title, or requester").fill(requestTitle);
    let approvalRow = await rowByText(page.getByTestId("approval-inbox-section"), requestTitle);
    await approvalRow.getByRole("button", { name: /review/i }).click();
    await page.getByTestId("approval-item-action-approve").click();
    await waitForSuccessToast(page, /moved forward/i);
    await page.getByPlaceholder("Search record number, title, or requester").fill(requestTitle);
    approvalRow = await rowByText(page.getByTestId("approval-inbox-section"), requestTitle);
    await approvalRow.getByRole("button", { name: /review/i }).click();
    await page.getByTestId("approval-item-action-approve").click();
    await waitForSuccessToast(page, /moved forward/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.procurement);
    await page.goto("/procurement");
    const procurementRequestRow = await rowByText(page.getByTestId("procurement-requests-section"), requestTitle);
    await procurementRequestRow.getByRole("button", { name: /inspect/i }).click();
    await page.getByTestId("procurement-request-action-convert_to_purchase_order").click();
    const convertToast = await waitForSuccessToast(page, /converted to/i);
    const poNumber = extractReference(convertToast, "PO");
    await page.getByTestId("purchase-order-action-issue").click();
    await waitForSuccessToast(page, new RegExp(`${poNumber} issued`, "i"));
    await logout(page);

    await loginAs(page, enterpriseUsers.inventory);
    await page.goto("/inventory");
    const inventoryOrderRow = await rowByText(page.getByTestId("inventory-receivable-orders-section"), poNumber);
    await inventoryOrderRow.getByRole("button", { name: /receive/i }).click();
    await page.getByTestId("inventory-order-action-record_goods_receipt").click();
    await waitForSuccessToast(page, /posted to inventory/i);
    await logout(page);

    await loginAs(page, enterpriseUsers.finance);
    await page.goto("/finance");
    const invoiceRow = await rowByText(page.getByTestId("finance-invoices-section"), poNumber);
    await invoiceRow.getByRole("button", { name: /inspect/i }).click();
    await page.getByTestId("finance-invoice-action-post").click();
    await waitForSuccessToast(page, /posted for approval/i);
    await page.getByTestId("finance-invoice-action-approve").click();
    await waitForSuccessToast(page, /approved/i);
    await page.getByTestId("finance-invoice-action-create_payment_request").click();
    await waitForSuccessToast(page, /created/i);
    await page.getByLabel("Payment rejection reason").fill("Rejected during browser automation to validate finance controls.");
    await page.getByTestId("finance-payment-action-reject").click();
    await waitForSuccessToast(page, /rejected/i);
    await expect(page.getByTestId("finance-payment-action-mark_paid")).toHaveCount(0);
  });
});
