// @ts-check
/**
 * Accounting journal status of purchase invoices / returns (and sales returns). Spec: commerce-service rows
 * journalStatus PENDING | POSTED | FAILED + journalErrorCode (written asynchronously after posting / completion);
 * GET /purchase/invoices?journalStatus=; POST /{id}/journal/retry (*_POST, FAILED only: PUR_017 / SAL_025).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { COUNTS, INVOICES, ITEMS, PURCHASE_ALL, RETURNS, VENDORS, WAREHOUSES } from "./data.js"

const JOURNAL_INVOICES = [
  { ...INVOICES[0], id: "911", number: "PI-2026-11-011", status: "POSTED", journalStatus: "FAILED", journalErrorCode: "ACC_070" },
  { ...INVOICES[0], id: "912", number: "PI-2026-11-012", status: "POSTED", journalStatus: "PENDING" },
  { ...INVOICES[0], id: "913", number: "PI-2026-11-013", status: "POSTED", journalStatus: "POSTED" },
]

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function lookups(page, permissions = PURCHASE_ALL) {
  await mockLoggedIn(page, { permissions: [...permissions, "SALES_VIEW", "SALES_POST"] })
  await mockApi(page, "/v1/accounting/vendors", { body: pageOf(VENDORS) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf([]) })
  await mockApi(page, "/v1/inventory/items", { body: pageOf(ITEMS) })
  await mockApi(page, "/v1/inventory/warehouses", { body: pageOf(WAREHOUSES) })
}

test("JRN-001 hoá đơn mua: nhãn Ghi sổ lỗi kèm mã, Đang ghi sổ; Đã ghi sổ không nhãn; Ghi lại bút toán gọi retry @smoke", async ({ page }) => {
  await lookups(page)
  const list = await mockApi(page, "/v1/purchase/invoices", { method: "GET", body: pageOf(JOURNAL_INVOICES) })
  await mockApi(page, "/v1/purchase/invoices/status-counts", { body: ok(COUNTS) })
  const retry = await mockApi(page, "/v1/purchase/invoices/911/journal/retry", { method: "POST", body: ok({ invoice: { ...JOURNAL_INVOICES[0], journalStatus: "PENDING" } }) })
  await page.goto("/purchase/invoices")
  await expect(page.getByRole("row").filter({ hasText: "PI-2026-11-011" }).getByTestId("journal-badge")).toHaveText("Ghi sổ lỗi · ACC_070")
  await expect(page.getByRole("row").filter({ hasText: "PI-2026-11-012" }).getByTestId("journal-badge")).toHaveText("Đang ghi sổ")
  await expect(page.getByRole("row").filter({ hasText: "PI-2026-11-013" }).getByTestId("journal-badge")).toHaveCount(0)

  await page.getByRole("button", { name: "Thao tác cho PI-2026-11-012" }).click()
  await expect(page.getByRole("menuitem", { name: "Ghi lại bút toán" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  const before = list.length
  await page.getByRole("button", { name: "Thao tác cho PI-2026-11-011" }).click()
  await page.getByRole("menuitem", { name: "Ghi lại bút toán" }).click()
  await expect.poll(() => retry.length).toBe(1)
  await expect(page.getByText("Đã gửi ghi lại bút toán")).toBeVisible()
  await expect.poll(() => list.length).toBeGreaterThan(before) // reloaded
})

test("JRN-002 lọc theo bút toán: gửi journalStatus và giữ trên URL; không có PURCHASE_POST thì không có Ghi lại", async ({ page }) => {
  await lookups(page, ["PURCHASE_VIEW"])
  const list = await mockApi(page, "/v1/purchase/invoices", { method: "GET", body: pageOf(JOURNAL_INVOICES) })
  await mockApi(page, "/v1/purchase/invoices/status-counts", { body: ok(COUNTS) })
  await page.goto("/purchase/invoices")
  await page.getByRole("combobox", { name: "Bút toán" }).click()
  await page.getByRole("option", { name: "Ghi sổ lỗi" }).click()
  await expect(page).toHaveURL(/journalStatus=FAILED/)
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("journalStatus")).toBe("FAILED")
  await page.getByRole("button", { name: "Thao tác cho PI-2026-11-011" }).click()
  await expect(page.getByRole("menuitem", { name: "Ghi lại bút toán" })).toHaveCount(0)
})

test("JRN-003 phiếu trả hàng mua và bán: nhãn lỗi và Ghi lại bút toán", async ({ page }) => {
  await lookups(page)
  await mockApi(page, "/v1/purchase/invoices", { method: "GET", body: pageOf(INVOICES) })
  await mockApi(page, "/v1/purchase/returns", { method: "GET", body: pageOf([{ ...RETURNS[0], status: "COMPLETED", journalStatus: "FAILED", journalErrorCode: "ACC_017" }]) })
  const pr = await mockApi(page, `/v1/purchase/returns/${RETURNS[0].id}/journal/retry`, { method: "POST", body: ok({}) })
  await page.goto("/purchase/returns")
  const row = page.getByRole("row").filter({ hasText: RETURNS[0].number })
  await expect(row.getByTestId("journal-badge")).toHaveText("Ghi sổ lỗi · ACC_017")
  await page.getByRole("button", { name: `Thao tác cho ${RETURNS[0].number}` }).click()
  await page.getByRole("menuitem", { name: "Ghi lại bút toán" }).click()
  await expect.poll(() => pr.length).toBe(1)

  await mockApi(page, "/v1/sales/invoices", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/sales/returns", { method: "GET", body: pageOf([{ id: "50", number: "SR-2026-11-001", invoiceId: "301", customerName: "E2E O'Brien", returnDate: "2026-11-21", total: 110000, items: 1, status: "COMPLETED", journalStatus: "PENDING" }]) })
  await page.goto("/sales/returns")
  await expect(page.getByRole("row").filter({ hasText: "SR-2026-11-001" }).getByTestId("journal-badge")).toHaveText("Đang ghi sổ")
})
