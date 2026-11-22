// @ts-check
/**
 * Manual §20 cross-cutting rule "dependent selects: branch → department → designation" in the HRM / recruitment forms
 * (transfer, promotion, trainer, offer conversion). Options come from /org/departments/options (branchId) and
 * /org/designations/options (departmentId); changing a parent clears its dependants.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ["LIFECYCLE_VIEW", "LIFECYCLE_MANAGE", "EMPLOYEE_VIEW", "ORG_VIEW"] })
  await mockApi(page, "/v1/employees", { method: "GET", body: pageOf([{ id: "35", employeeNo: "EMP000001", fullName: "E2E An" }]) })
  await mockApi(page, "/v1/org/branches/options", { body: ok([{ id: "1", name: "E2E HCM" }, { id: "2", name: "E2E Hanoi" }]) })
  await mockApi(page, "/v1/org/departments/options", { body: ok([{ id: "10", name: "E2E Accounting", branchId: "1" }, { id: "20", name: "E2E Sales", branchId: "2" }]) })
  await mockApi(page, "/v1/org/designations/options", { body: ok([{ id: "100", name: "E2E Accountant", departmentId: "10" }, { id: "200", name: "E2E Sales rep", departmentId: "20" }]) })
}

test("X-001 điều chuyển: phòng ban lọc theo chi nhánh, chức danh theo phòng ban; đổi chi nhánh xóa lựa chọn con @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/lifecycle/transfers", { method: "GET", body: pageOf([]) })
  const save = await mockApi(page, "/v1/lifecycle/transfers", { method: "POST", body: ok({ id: "1" }) })
  await page.goto("/hrm/career")
  await page.getByRole("button", { name: "Thêm điều chuyển" }).click()
  const d = page.getByRole("dialog")
  const pick = async (/** @type {string} */ label, /** @type {string} */ option) => {
    await d.getByRole("combobox", { name: label }).click()
    await page.getByRole("option", { name: option }).click()
  }
  await pick("Chi nhánh mới", "E2E HCM")
  await d.getByRole("combobox", { name: "Phòng ban mới" }).click()
  await expect(page.getByRole("option", { name: "E2E Sales" })).toHaveCount(0)
  await page.getByRole("option", { name: "E2E Accounting" }).click()
  await d.getByRole("combobox", { name: "Chức danh mới" }).click()
  await expect(page.getByRole("option", { name: "E2E Sales rep" })).toHaveCount(0)
  await page.getByRole("option", { name: "E2E Accountant" }).click()

  await pick("Chi nhánh mới", "E2E Hanoi")
  await expect(d.getByRole("combobox", { name: "Phòng ban mới" })).toHaveText("Không chọn")
  await expect(d.getByRole("combobox", { name: "Chức danh mới" })).toHaveText("Không chọn")
  await pick("Phòng ban mới", "E2E Sales")
  await pick("Chức danh mới", "E2E Sales rep")
  await pick("Nhân viên", "E2E An (EMP000001)")
  await d.getByLabel("Ngày điều chuyển *").fill("2026-12-01")
  await d.getByLabel("Ngày hiệu lực *").fill("2026-12-15")
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toMatchObject({ employeeId: 35, toBranchId: 2, toDepartmentId: 20, toDesignationId: 200 })
})
