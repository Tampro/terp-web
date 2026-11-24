// @ts-check
/**
 * Sign-in (manual §2 "Sign-in & profile").
 * Spec sources: IAM Swagger POST /api/v1/auth/login (TokenDto; 400 AUTH_004, 401 AUTH_001, AUTH_016 per AuthController),
 * GET /api/v1/settings/public (system.userRegistration), LoginForm (username ≤100, password ≤128), src/locales/vi.ts.
 */
import { expect, test } from "../fixtures/index.js"
import { FAKE_ME, FAKE_PROFILE, FAKE_TOKENS, fail, mockApi, mockPublic, ok, publicSettings } from "../utils/mock-api.js"

const EMAIL = "e2e.tester@example.com"
const PASSWORD = "E2e-Passw0rd!"

/** @param {import('@playwright/test').Page} page */
async function mockAfterLogin(page) {
  await mockApi(page, "/v1/me", { body: ok(FAKE_ME) })
  await mockApi(page, "/v1/me/profile", { body: ok(FAKE_PROFILE), method: "GET" })
}

test("AUTH-001 đăng nhập đúng → vào /dashboard, gửi đúng payload, lưu token @smoke", async ({ page, loginPage }) => {
  const calls = await mockApi(page, "/v1/auth/login", { body: ok(FAKE_TOKENS) })
  await mockAfterLogin(page)

  await loginPage.goto()
  await loginPage.login(`  ${EMAIL} `, PASSWORD)

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Tester" })).toBeVisible()
  expect(calls).toEqual([{ username: EMAIL, password: PASSWORD }]) // email trimmed, password untouched
  // the browser's IANA time zone goes with the login (LoginHistoryService records it; the test browser runs in UTC or the host zone)
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(calls.requests[0].headers["x-client-timezone"]).toBe(tz)
  // "Ghi nhớ đăng nhập" is on by default → tokens persist in localStorage
  expect(await page.evaluate(() => localStorage.getItem("erp.refreshToken"))).toBe(FAKE_TOKENS.refreshToken)
})

test("AUTH-002 sai mật khẩu → hiện message của backend, không lưu token, vẫn ở /login", async ({ page, loginPage }) => {
  await mockApi(page, "/v1/auth/login", {
    status: 401,
    body: fail("AUTH_001", "Tên đăng nhập hoặc mật khẩu không đúng."),
  })

  await loginPage.goto()
  await loginPage.login(EMAIL, "wrong-password")

  await expect(loginPage.alertWith("Tên đăng nhập hoặc mật khẩu không đúng.")).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem("erp.token"))).toBeNull()
})

test("AUTH-003 bỏ trống → báo bắt buộc cho cả 2 ô và không gọi API", async ({ page, loginPage }) => {
  const calls = await mockApi(page, "/v1/auth/login", { body: ok(FAKE_TOKENS) })

  await loginPage.goto()
  await loginPage.submit.click()

  await expect(page.getByText("Trường này là bắt buộc")).toHaveCount(2)
  expect(calls).toHaveLength(0)
})

test("AUTH-004 mật khẩu tạm (AUTH_004) → /initial-password, đặt mật khẩu mới rồi vào app", async ({ page, loginPage }) => {
  await mockApi(page, "/v1/auth/login", {
    status: 400,
    body: fail("AUTH_004", "Bạn cần đổi mật khẩu tạm trước."),
  })
  const initial = await mockApi(page, "/v1/auth/initial-password", { body: ok(FAKE_TOKENS) })
  await mockAfterLogin(page)

  await loginPage.goto()
  await loginPage.login(EMAIL, "Temp-1234")
  await expect(page).toHaveURL(/\/initial-password$/)
  await expect(page.getByRole("heading", { name: "Đặt mật khẩu mới" })).toBeVisible()

  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("short")
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("short")
  await page.getByRole("button", { name: "Đặt mật khẩu và đăng nhập" }).click()
  await expect(page.getByText("Tối thiểu 8 ký tự")).toBeVisible() // InitialPasswordForm newPassword ≥ 8
  expect(initial).toHaveLength(0)

  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(PASSWORD)
  await page.getByRole("button", { name: "Đặt mật khẩu và đăng nhập" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(initial).toEqual([{ username: EMAIL, currentPassword: "Temp-1234", newPassword: PASSWORD }])
})

test("AUTH-005 /initial-password mở trực tiếp (không có login dở) → về /login", async ({ page }) => {
  await page.goto("/initial-password")
  await expect(page).toHaveURL(/\/login$/)
})

test("AUTH-006 email chưa xác minh (AUTH_016) → có nút gửi lại, gọi resend-verification với email", async ({ page, loginPage }) => {
  await mockApi(page, "/v1/auth/login", { status: 401, body: fail("AUTH_016", "Email chưa được xác minh.") })
  const resend = await mockApi(page, "/v1/auth/resend-verification", { body: ok(null) })

  await loginPage.goto()
  await loginPage.login(EMAIL, PASSWORD)
  await page.getByRole("button", { name: "Gửi lại email xác minh" }).click()

  await expect(page.getByText("Nếu tài khoản tồn tại, liên kết xác minh mới đã được gửi.")).toBeVisible()
  expect(resend).toEqual([{ email: EMAIL }])
})

test("AUTH-007 trang cần đăng nhập → /login?redirect=, đăng nhập xong quay lại đúng trang", async ({ page, loginPage }) => {
  await mockApi(page, "/v1/auth/login", { body: ok(FAKE_TOKENS) })
  await mockAfterLogin(page)

  await page.goto("/profile")
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile$/)

  await loginPage.login(EMAIL, PASSWORD)
  await expect(page).toHaveURL(/\/profile$/)
})

test("AUTH-008 redirect ra ngoài site (//evil.example) bị bỏ qua → về trang chủ app", async ({ page, loginPage }) => {
  await mockApi(page, "/v1/auth/login", { body: ok(FAKE_TOKENS) })
  await mockAfterLogin(page)

  await loginPage.goto("?redirect=//evil.example/x")
  await loginPage.login(EMAIL, PASSWORD)

  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/dashboard$/)
})

test("AUTH-009 link Đăng ký chỉ hiện khi bật User Registration", async ({ page, loginPage }) => {
  await loginPage.goto()
  await expect(loginPage.heading).toBeVisible()
  await expect(loginPage.registerLink).toHaveCount(0)

  await page.unrouteAll({ behavior: "ignoreErrors" })
  await mockPublic(page, { userRegistration: true })
  await loginPage.goto()
  await expect(loginPage.registerLink).toBeVisible()
})

test("AUTH-010 đổi ngôn ngữ sang English → giao diện và Accept-Language đổi theo", async ({ page, loginPage }) => {
  const sent = /** @type {string[]} */ ([])
  await page.route("**/api/v1/auth/login", async (route) => {
    sent.push(route.request().headers()["accept-language"])
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify(fail("AUTH_001", "Invalid username or password.")) })
  })

  await loginPage.goto()
  await page.getByRole("button", { name: "Ngôn ngữ" }).click()
  await page.getByRole("menuitem", { name: "English" }).click()

  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible()
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByRole("button", { name: "Login" }).click()
  await expect(loginPage.alertWith("Invalid username or password.")).toBeVisible()
  expect(sent).toEqual(["en"])
})

// As on the reference sign-in pages: guests get the cookie consent banner (GET /settings/public → cookie; choice sent to
// POST /public/site/cookie-consent and kept in localStorage erp.cookieConsent)
test("AUTH-020 trang đăng nhập hiện banner cookie khi có cấu hình; chọn xong thì ẩn và gửi lựa chọn", async ({ page }) => {
  await mockPublic(page)
  const settings = publicSettings()
  await mockApi(page, "/v1/settings/public", { body: ok({ ...settings.data, cookie: { cookieTitle: "E2E Cookie Consent", cookieDescription: "E2E dùng cookie", enableLogging: true } }) })
  const consent = await mockApi(page, "/v1/public/site/cookie-consent", { method: "POST", body: ok({}) })
  await page.goto("/login")
  const banner = page.getByRole("dialog", { name: "E2E Cookie Consent" })
  await expect(banner).toBeVisible()
  await banner.getByRole("button", { name: "Chỉ cookie bắt buộc" }).click()
  await expect(banner).toHaveCount(0)
  await expect.poll(() => consent.length).toBe(1)
  expect(consent[0]).toMatchObject({ choice: "NECESSARY_ONLY" })
  await page.reload()
  await expect(page.getByRole("dialog", { name: "E2E Cookie Consent" })).toHaveCount(0)
})
