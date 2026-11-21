// @ts-check
/** Login page: locators + actions, no assertions. Labels are the vi texts (src/locales/vi.ts). */
export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Đăng nhập" })
    this.email = page.getByLabel("Email")
    this.password = page.getByLabel("Mật khẩu", { exact: true })
    this.remember = page.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" })
    this.submit = page.getByRole("button", { name: "Đăng nhập" })
    this.forgotLink = page.getByRole("link", { name: "Quên mật khẩu?" })
    this.registerLink = page.getByRole("link", { name: "Đăng ký" })
  }

  /**
   * Form alert with exactly this text. A bare getByRole("alert") also matches Next.js's hidden route announcer.
   * @param {string} text
   */
  alertWith(text) {
    return this.page.getByRole("alert").getByText(text, { exact: true })
  }

  /** @param {string} [query] */
  async goto(query = "") {
    await this.page.goto(`/login${query}`)
  }

  /** @param {string} email @param {string} password */
  async login(email, password) {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }
}
