// @ts-check
import { test as base, expect } from "@playwright/test"

import { LoginPage } from "../auth/login.page.js"
import { mockPublic } from "../utils/mock-api.js"

/**
 * `page` already has the public endpoints mocked and every other /api call answering 599,
 * so a test never reaches a real backend by accident.
 * @type {import('@playwright/test').TestType<{ loginPage: LoginPage }, {}>}
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await mockPublic(page)
    await use(page)
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },
})

export { expect }
