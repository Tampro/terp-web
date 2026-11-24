// @ts-check
/**
 * Contracts and contract types (manual §7.5).
 * Spec sources: crm-service ContractController (/crm/contracts + /status-counts, /{id}/status|duplicate|renewals|notes|
 * comments|attachments; ContractForm, RenewalForm), ContractTypeController, ContractSettingController (prefix → CON0001);
 * CTR_006 (end before start), CTR_007 (inactive type); CRM_CONTRACT_VIEW / CRM_CONTRACT_MANAGE.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { CONTRACT_COUNTS, CONTRACT_DETAIL, CONTRACTS, CRM_ALL, CUSTOMERS, SETTING, TYPES } from "./data.js"

/** @param {import('@playwright/test').Page} page @param {string[]} [permissions] */
async function contracts(page, permissions = CRM_ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/crm/contract-types", { method: "GET", body: ok(TYPES) })
  await mockApi(page, "/v1/crm/contract-settings", { method: "GET", body: ok(SETTING) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/crm/contracts/status-counts", { body: ok(CONTRACT_COUNTS) })
  return mockApi(page, "/v1/crm/contracts", { method: "GET", body: pageOf(CONTRACTS) })
}

test("CTR-001 danh sách: thẻ số lượng lọc trạng thái, thời hạn có tiến độ và số ngày còn lại @smoke", async ({ page }) => {
  const list = await contracts(page)
  await page.goto("/crm/contracts")
  const row = page.getByRole("row").filter({ hasText: "CON0001" })
  await expect(row).toContainText("E2E Service")
  await expect(row).toContainText("60.000.000")
  await expect(row).toContainText("Còn 160 ngày")
  await expect(row.getByRole("progressbar")).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "CON0002" })).toContainText("Đã kết thúc")
  // owner column (ContractRow.ownerName); a contract created before the field existed shows "-"
  await expect(page.getByRole("columnheader", { name: "Người phụ trách" })).toBeVisible()
  await expect(row).toContainText("E2E Nguyễn Văn An")

  await page.getByRole("button", { name: /Đã đóng/ }).click()
  await expect.poll(() => list.requests.at(-1)?.url.searchParams.get("status")).toBe("CLOSED")
  await expect(page.getByRole("button", { name: /Đã đóng/ })).toHaveAttribute("aria-pressed", "true")
})

test("CTR-002 tạo hợp đồng: số tiếp theo, loại ngừng hoạt động bị ẩn, ngày kết thúc trước ngày bắt đầu bị chặn (CTR_006)", async ({ page }) => {
  await contracts(page)
  const create = await mockApi(page, "/v1/crm/contracts", { method: "POST", body: ok(CONTRACT_DETAIL) })
  await page.goto("/crm/contracts")
  await page.getByRole("button", { name: "Tạo hợp đồng" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Số tiếp theo: CON0003")).toBeVisible()
  await dialog.getByLabel("Chủ đề").fill("E2E New contract")
  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E 한빛 무역" }).click()
  await dialog.getByRole("combobox", { name: "Loại hợp đồng" }).click()
  await expect(page.getByRole("option", { name: "E2E Old type" })).toHaveCount(0)
  await page.getByRole("option", { name: "E2E Service" }).click()
  await dialog.getByLabel("Ngày bắt đầu").fill("2026-12-01")
  await dialog.getByLabel("Ngày kết thúc").fill("2026-11-01")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu")).toBeVisible()
  expect(create).toHaveLength(0)

  await dialog.getByLabel("Ngày kết thúc").fill("2027-11-30")
  await dialog.getByLabel("Giá trị").fill("12000000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    subject: "E2E New contract",
    customerId: 502,
    contractTypeId: 51,
    value: 12000000,
    startDate: "2026-12-01",
    endDate: "2027-11-30",
    status: "PENDING",
    description: null,
  })
})

test("CTR-003 chi tiết: lưu nội dung thỏa thuận là PUT thay thế toàn bộ; thêm gia hạn gửi RenewalForm", async ({ page }) => {
  await contracts(page)
  await mockApi(page, "/v1/crm/contracts/301", { method: "GET", body: ok(CONTRACT_DETAIL) })
  const update = await mockApi(page, "/v1/crm/contracts/301", { method: "PUT", body: ok(CONTRACT_DETAIL) })
  const renew = await mockApi(page, "/v1/crm/contracts/301/renewals", { method: "POST", body: ok({ id: "1" }) })
  await page.goto("/crm/contracts/301")
  await expect(page.getByRole("heading", { name: "E2E Annual support" })).toBeVisible()
  await expect(page.getByText("E2E signed")).toBeVisible()

  await page.getByRole("textbox", { name: "Nội dung thỏa thuận" }).fill("E2E new terms")
  await page.getByRole("button", { name: "Lưu" }).first().click()
  await expect.poll(() => update.length).toBe(1)
  expect(update[0]).toEqual({
    subject: "E2E Annual support",
    customerId: 501,
    contractTypeId: 51,
    value: 60000000,
    startDate: "2026-05-01",
    endDate: "2027-05-01",
    status: "ACTIVE",
    description: "E2E new terms",
  })

  await page.getByRole("button", { name: "Thêm gia hạn" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Ngày bắt đầu").fill("2027-05-02")
  await dialog.getByLabel("Ngày kết thúc").fill("2028-05-01")
  await dialog.getByLabel("Giá trị").fill("65000000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => renew.length).toBe(1)
  expect(renew[0]).toEqual({ startDate: "2027-05-02", endDate: "2028-05-01", value: 65000000, status: "PENDING", notes: null })
})

test("CTR-004 chỉ xem (CRM_CONTRACT_VIEW): không tạo, sửa hay xóa", async ({ page }) => {
  await contracts(page, ["CRM_CONTRACT_VIEW"])
  await mockApi(page, "/v1/crm/contracts/301", { method: "GET", body: ok(CONTRACT_DETAIL) })
  await page.goto("/crm/contracts")
  await expect(page.getByRole("row").filter({ hasText: "CON0001" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Tạo hợp đồng" })).toHaveCount(0)
  await page.getByRole("button", { name: "Thao tác cho CON0001" }).click()
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Xem" }).click()
  await expect(page).toHaveURL(/\/crm\/contracts\/301$/)
  await expect(page.getByText("E2E agreement text")).toBeVisible()
  await expect(page.getByRole("button", { name: "Thêm gia hạn" })).toHaveCount(0)
})

test("CTR-005 loại hợp đồng: tạo loại gửi TypeForm, lưu tiền tố gửi SettingForm", async ({ page }) => {
  await contracts(page)
  const save = await mockApi(page, "/v1/crm/contract-types", { method: "POST", body: ok({ id: "53" }) })
  const prefix = await mockApi(page, "/v1/crm/contract-settings", { method: "PUT", body: ok(SETTING) })
  await page.goto("/crm/contract-types")
  await expect(page.getByRole("row").filter({ hasText: "E2E Old type" })).toContainText("Ngừng hoạt động")
  await expect(page.getByRole("row").filter({ hasText: "E2E Service" }).getByRole("cell").nth(1)).toHaveText("3") // contractCount
  await expect(page.getByText("Số tiếp theo: CON0003")).toBeVisible()
  await page.getByRole("button", { name: "Tạo loại hợp đồng" }).click()
  await page.getByRole("dialog").getByLabel("Tên").fill("E2E Lease")
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ name: "E2E Lease", active: true })

  await page.getByLabel("Tiền tố").fill("HD")
  await page.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => prefix.length).toBe(1)
  expect(prefix[0]).toEqual({ prefix: "HD" })
})
