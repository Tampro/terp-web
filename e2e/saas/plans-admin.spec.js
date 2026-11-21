// @ts-check
/**
 * Super Admin › Plans (manual §4.1).
 * Spec sources: SaasAdminController GET/POST /saas/admin/plans, PUT /{id} (PlanForm, full replacement: omitted limit =
 * unlimited), PUT /{id}/status {enabled}, DELETE /{id} (SAAS_013 for the default plan); GET /saas/plan-modules.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"
import { MODULES, PLANS } from "./data.js"

/** @param {import('@playwright/test').Page} page */
async function openPlans(page) {
  await mockLoggedIn(page, { superAdmin: true })
  const list = await mockApi(page, "/v1/saas/admin/plans", { method: "GET", body: ok(PLANS) })
  await mockApi(page, "/v1/saas/plan-modules", { body: ok(MODULES) })
  await page.goto("/plans")
  await expect(page.getByText("E2E Pro", { exact: true })).toBeVisible()
  return { list }
}

test("PLAN-001 thẻ gói: giá theo chu kỳ, giới hạn, dùng thử, module ✓/✗ @smoke", async ({ page }) => {
  await openPlans(page)
  const pro = page.locator("[data-slot=card]").filter({ hasText: "E2E Pro" })
  await expect(pro.getByTestId("plan-price")).toHaveText("490.000")
  await expect(pro).toContainText("Phổ biến nhất")
  await expect(pro).toContainText("Dùng thử 14 ngày")
  await expect(pro.getByRole("list", { name: "Module" }).getByRole("listitem")).toHaveCount(3)
  const free = page.locator("[data-slot=card]").filter({ hasText: "E2E Free" })
  await expect(free.getByTestId("plan-price")).toHaveText("Miễn phí")
  await expect(free).toContainText("Không giới hạn") // maxUsers null

  await page.getByRole("radio", { name: "Theo năm" }).click()
  await expect(pro.getByTestId("plan-price")).toHaveText("4.900.000")
  await expect(free).toContainText("Không bán theo năm") // yearlyPrice null
})

test("PLAN-002 tạo gói: giới hạn trống gửi null, Chọn tất cả module, đúng payload", async ({ page }) => {
  await openPlans(page)
  const create = await mockApi(page, "/v1/saas/admin/plans", { method: "POST", body: ok({ id: "9" }) })
  await page.getByRole("button", { name: "Tạo gói" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog.getByText("Trường này là bắt buộc").first()).toBeVisible()
  expect(create).toHaveLength(0)

  await dialog.getByLabel("Tên gói").fill("E2E Business")
  await dialog.getByLabel("Mã", { exact: true }).fill("E2E_BIZ")
  await dialog.getByLabel("Giá theo tháng").fill("990000")
  await dialog.getByLabel("Số người dùng tối đa").fill("0") // < 1
  await expect(dialog.getByText("Nhập số nguyên ≥ 1")).toBeVisible()
  await dialog.getByLabel("Số người dùng tối đa").fill("250")
  await dialog.getByLabel("Số ngày dùng thử").fill("30")
  await dialog.getByRole("button", { name: "Chọn tất cả" }).click()
  await expect(dialog.getByText("Đã chọn 3 / 3")).toBeVisible()
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()

  await expect(dialog).toBeHidden()
  expect(create).toEqual([
    {
      code: "E2E_BIZ",
      name: "E2E Business",
      description: null,
      monthlyPrice: 990000,
      yearlyPrice: null,
      maxUsers: 250,
      maxEmployees: null,
      storageLimitGb: null,
      trialDays: 30,
      aiIntegration: false,
      defaultPlan: false,
      enabled: true,
      recommended: false,
      modules: ["HRM", "ACCOUNTING", "CRM"],
    },
  ])
})

test("PLAN-003 sửa gói giữ nguyên các giá trị cũ (PUT thay thế toàn bộ)", async ({ page }) => {
  await openPlans(page)
  const update = await mockApi(page, "/v1/saas/admin/plans/2", { method: "PUT", body: ok(PLANS[1]) })
  await page.getByRole("button", { name: "Thao tác cho gói E2E Pro" }).click()
  await page.getByRole("menuitem", { name: "Sửa" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Tên gói")).toHaveValue("E2E Pro")
  await dialog.getByLabel("Giá theo tháng").fill("500000")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog).toBeHidden()
  expect(update[0]).toMatchObject({
    code: "E2E_PRO",
    monthlyPrice: 500000,
    yearlyPrice: 4900000,
    maxUsers: 100,
    maxEmployees: 200,
    storageLimitGb: 10,
    trialDays: 14,
    recommended: true,
    modules: ["HRM", "ACCOUNTING"],
  })
})

test("PLAN-004 ngừng gói gửi enabled=false; gói mặc định không xóa được; xóa gói khác gọi DELETE", async ({ page }) => {
  await openPlans(page)
  const status = await mockApi(page, "/v1/saas/admin/plans/2/status", { body: ok({}) })
  const del = await mockApi(page, "/v1/saas/admin/plans/2", { method: "DELETE", body: ok(null) })

  await page.getByRole("button", { name: "Thao tác cho gói E2E Pro" }).click()
  await page.getByRole("menuitem", { name: "Ngừng hoạt động" }).click()
  await expect.poll(() => status.length).toBe(1)
  expect(status[0]).toEqual({ enabled: false })

  await page.getByRole("button", { name: "Thao tác cho gói E2E Free" }).click()
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toBeDisabled()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Thao tác cho gói E2E Pro" }).click()
  await page.getByRole("menuitem", { name: "Xóa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect(page.getByText("Đã xóa gói")).toBeVisible()
  expect(del.requests).toHaveLength(1)
})
