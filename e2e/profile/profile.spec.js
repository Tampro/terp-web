// @ts-check
/**
 * Profile & change password (manual §2 "Profile: name, email, mobile, photo. Change password: current, new, confirm").
 * Spec sources: IAM Swagger GET/PUT /api/v1/me/profile (ProfileForm: fullName, email, mobile pattern, avatarFileId;
 * full replacement), PUT /api/v1/me/password (PasswordForm; ends every session; 400 AUTH_017), POST /auth/logout.
 */
import { expect, test } from "../fixtures/index.js"
import { FAKE_PROFILE, fail, mockApi, mockLoggedIn, ok } from "../utils/mock-api.js"

test.beforeEach(async ({ page }) => {
  await mockLoggedIn(page)
})

test("PROF-001 hiển thị hồ sơ hiện tại; username chỉ đọc", async ({ page }) => {
  await page.goto("/profile")
  await expect(page.getByLabel("Họ tên")).toHaveValue("E2E Tester")
  await expect(page.getByLabel("Email")).toHaveValue("e2e.tester@example.com")
  await expect(page.getByLabel("Số điện thoại")).toHaveValue("+84 90 000 0000")
  await expect(page.getByLabel("Tên đăng nhập")).toBeDisabled()
  await expect(page.getByRole("button", { name: "Lưu thay đổi" }).first()).toBeDisabled() // nothing changed yet
})

test("PROF-002 lưu hồ sơ gửi đủ các trường (full replacement) và báo thành công @smoke", async ({ page }) => {
  const calls = await mockApi(page, "/v1/me/profile", {
    method: "PUT",
    body: ok({ ...FAKE_PROFILE, fullName: "Nguyễn Thị Ánh Nguyệt" }),
  })
  await page.goto("/profile")
  await page.getByLabel("Họ tên").fill("Nguyễn Thị Ánh Nguyệt")
  // Two "Lưu thay đổi" buttons on the page (profile card, password card): the first belongs to the profile card.
  await page.getByRole("button", { name: "Lưu thay đổi" }).first().click()

  await expect(page.getByText("Đã cập nhật hồ sơ")).toBeVisible()
  expect(calls).toEqual([
    { fullName: "Nguyễn Thị Ánh Nguyệt", email: "e2e.tester@example.com", mobile: "+84 90 000 0000", avatarFileId: null },
  ])
})

test("PROF-003 số điện thoại sai ký tự → báo lỗi, không gọi API", async ({ page }) => {
  const calls = await mockApi(page, "/v1/me/profile", { method: "PUT", body: ok(FAKE_PROFILE) })
  await page.goto("/profile")
  await page.getByLabel("Số điện thoại").fill("090-abc")
  await page.getByRole("button", { name: "Lưu thay đổi" }).first().click()

  await expect(page.getByText("Chỉ dùng chữ số, khoảng trắng và + ( ) - .")).toBeVisible()
  expect(calls).toHaveLength(0)
})

test("PROF-004 email đã dùng (IAM_017) → toast lỗi backend, giữ nguyên trang", async ({ page }) => {
  await mockApi(page, "/v1/me/profile", { method: "PUT", status: 400, body: fail("IAM_017", "Email đã được tài khoản khác sử dụng.") })
  await page.goto("/profile")
  await page.getByLabel("Email").fill("taken@example.com")
  await page.getByRole("button", { name: "Lưu thay đổi" }).first().click()

  await expect(page.getByText("Email đã được tài khoản khác sử dụng.")).toBeVisible()
  await expect(page).toHaveURL(/\/profile$/)
})

test("PROF-005 đổi mật khẩu → gửi đúng payload, xoá token, về /login", async ({ page }) => {
  const calls = await mockApi(page, "/v1/me/password", { body: ok(null) })
  await page.goto("/profile")
  await page.getByLabel("Mật khẩu hiện tại").fill("Old-Passw0rd")
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("New-Passw0rd")
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("New-Passw0rd")
  await page.getByRole("button", { name: "Lưu thay đổi" }).last().click()

  // Requirement: log in again. The guard may keep ?redirect=%2Fprofile, which is fine.
  await expect(page).toHaveURL(/\/login(\?redirect=%2Fprofile)?$/)
  expect(calls).toEqual([{ currentPassword: "Old-Passw0rd", newPassword: "New-Passw0rd", confirmPassword: "New-Passw0rd" }])
  expect(await page.evaluate(() => localStorage.getItem("erp.token"))).toBeNull()
})

test("PROF-006 mật khẩu hiện tại sai (AUTH_017) → toast lỗi, vẫn đăng nhập", async ({ page }) => {
  await mockApi(page, "/v1/me/password", { status: 400, body: fail("AUTH_017", "Mật khẩu hiện tại không đúng.") })
  await page.goto("/profile")
  await page.getByLabel("Mật khẩu hiện tại").fill("Wrong-pass1")
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("New-Passw0rd")
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("New-Passw0rd")
  await page.getByRole("button", { name: "Lưu thay đổi" }).last().click()

  await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible()
  await expect(page).toHaveURL(/\/profile$/)
  expect(await page.evaluate(() => localStorage.getItem("erp.token"))).not.toBeNull()
})

test("PROF-007 đăng xuất từ menu người dùng → gọi logout với refresh token, về /login", async ({ page }) => {
  const calls = await mockApi(page, "/v1/auth/logout", { body: ok(null) })
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "E2E Tester", exact: true }).click() // header avatar (aria-label = name)
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click()

  await expect(page).toHaveURL(/\/login$/)
  expect(calls).toEqual([{ refreshToken: "e2e-refresh" }])
})
