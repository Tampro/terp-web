// @ts-check
/**
 * Forgot / reset password, email verification, registration (manual §2).
 * Spec sources: IAM Swagger POST /auth/forgot-password (always 200, link valid 30 min),
 * /auth/reset-password (AuthForms.ResetPasswordForm {token, newPassword ≥10}; 400 AUTH_014),
 * /auth/verify-email (one-time; 400 AUTH_014), /auth/register (RegisterForm; only when userRegistration), src/locales/vi.ts.
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockPublic, ok } from "../utils/mock-api.js"

test("PWD-001 quên mật khẩu → gửi email, hiện thông báo 30 phút", async ({ page, loginPage }) => {
  const calls = await mockApi(page, "/v1/auth/forgot-password", { body: ok(null) })

  await loginPage.goto()
  await loginPage.forgotLink.click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await page.getByLabel("Email").fill("e2e.tester@example.com")
  await page.getByRole("button", { name: "Gửi liên kết đặt lại mật khẩu" }).click()

  await expect(page.getByText(/Liên kết có hiệu lực 30 phút\./)).toBeVisible()
  expect(calls).toEqual([{ email: "e2e.tester@example.com" }])
})

test("PWD-002 quên mật khẩu với email sai định dạng → báo lỗi, không gọi API", async ({ page }) => {
  const calls = await mockApi(page, "/v1/auth/forgot-password", { body: ok(null) })

  await page.goto("/forgot-password")
  await page.getByLabel("Email").fill("not-an-email")
  await page.getByRole("button", { name: "Gửi liên kết đặt lại mật khẩu" }).click()

  await expect(page.getByText("Nhập địa chỉ email hợp lệ")).toBeVisible()
  expect(calls).toHaveLength(0)
})

test("PWD-003 reset không có token → báo link thiếu, không có form", async ({ page }) => {
  await page.goto("/reset-password")
  await expect(page.getByText(/Liên kết đặt lại bị thiếu hoặc không đầy đủ/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Đặt lại mật khẩu" })).toHaveCount(0)
})

test("PWD-004 reset: 9 ký tự bị chặn, 10 ký tự gửi {token,newPassword} và báo thành công", async ({ page }) => {
  const calls = await mockApi(page, "/v1/auth/reset-password", { body: ok(null) })
  await page.goto("/reset-password?token=e2e-sentinel-token")

  const pwd = page.getByLabel("Mật khẩu mới", { exact: true })
  const confirm = page.getByLabel("Xác nhận mật khẩu", { exact: true })
  const submit = page.getByRole("button", { name: "Đặt lại mật khẩu" })

  await pwd.fill("Abcdefg1!") // 9
  await confirm.fill("Abcdefg1!")
  await submit.click()
  await expect(page.getByText("Tối thiểu 10 ký tự")).toBeVisible()
  expect(calls).toHaveLength(0)

  await pwd.fill("Abcdefgh1!") // 10
  await confirm.fill("Abcdefgh1!")
  await submit.click()
  await expect(page.getByText("Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.")).toBeVisible()
  expect(calls).toEqual([{ token: "e2e-sentinel-token", newPassword: "Abcdefgh1!" }])
})

test("PWD-005 reset: xác nhận không khớp → báo lỗi", async ({ page }) => {
  await page.goto("/reset-password?token=e2e-sentinel-token")
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("Abcdefgh1!")
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("Abcdefgh2!")
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click()
  await expect(page.getByText("Mật khẩu không khớp")).toBeVisible()
})

test("PWD-006 reset: link hết hạn (AUTH_014) → hiện message backend", async ({ page }) => {
  await mockApi(page, "/v1/auth/reset-password", { status: 400, body: fail("AUTH_014", "Liên kết không hợp lệ hoặc đã hết hạn.") })
  await page.goto("/reset-password?token=e2e-expired")
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("Abcdefgh1!")
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("Abcdefgh1!")
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click()
  await expect(page.getByRole("alert").getByText("Liên kết không hợp lệ hoặc đã hết hạn.", { exact: true })).toBeVisible()
})

test("VERIFY-001 xác minh email gọi API đúng 1 lần với token và báo thành công", async ({ page }) => {
  const calls = await mockApi(page, "/v1/auth/verify-email", { body: ok(null) })
  await page.goto("/verify-email?token=e2e-sentinel-token")
  await expect(page.getByText("Email đã được xác minh. Bạn có thể đăng nhập.")).toBeVisible()
  expect(calls).toEqual([{ token: "e2e-sentinel-token" }]) // one-time token: never sent twice
})

test("VERIFY-002 token không hợp lệ → hiện message backend", async ({ page }) => {
  await mockApi(page, "/v1/auth/verify-email", { status: 400, body: fail("AUTH_014", "Liên kết không hợp lệ hoặc đã hết hạn.") })
  await page.goto("/verify-email?token=bogus")
  await expect(page.getByRole("alert").getByText("Liên kết không hợp lệ hoặc đã hết hạn.", { exact: true })).toBeVisible()
})

test("REG-001 đăng ký khi tắt User Registration → chỉ hiện thông báo", async ({ page }) => {
  await page.goto("/register")
  await expect(page.getByText("Chức năng đăng ký đang tắt. Vui lòng liên hệ quản trị viên.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Đăng ký" })).toHaveCount(0)
})

test("REG-002 đăng ký khi bật + xác minh email → gửi payload, nhắc mở email", async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" })
  await mockPublic(page, { userRegistration: true, emailVerification: true })
  const calls = await mockApi(page, "/v1/auth/register", { body: ok(null) })

  await page.goto("/register")
  await page.getByLabel("Họ tên").fill("E2E O'Brien")
  await page.getByLabel("Email").fill("e2e.owner@example.com")
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Abcdefg1!")
  await page.getByLabel("Xác nhận mật khẩu").fill("Abcdefg1!")
  await page.getByRole("button", { name: "Đăng ký" }).click()

  await expect(page.getByText(/Chúng tôi đã gửi liên kết xác minh tới e2e\.owner@example\.com/)).toBeVisible()
  // companyName left blank → omitted (backend then uses the person's name)
  expect(calls).toEqual([
    { name: "E2E O'Brien", email: "e2e.owner@example.com", password: "Abcdefg1!", confirmPassword: "Abcdefg1!" },
  ])
})
