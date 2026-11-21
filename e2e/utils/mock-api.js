// @ts-check
/** Helpers to mock the ERP gateway behind /api in UI tests. Data is fake. */

/** @param {unknown} data */
export const ok = (data) => ({ result: true, data })

/** @param {string} code @param {string} message */
export const fail = (code, message) => ({ result: false, code, message, traceId: "e2e-trace" })

export const FAKE_TOKENS = { accessToken: "e2e-access", refreshToken: "e2e-refresh", expiresIn: 900, refreshExpiresIn: 1800 }

export const FAKE_ME = {
  userId: "9001",
  username: "e2e.tester@example.com",
  companyId: "77",
  superAdmin: false,
  roles: ["COMPANY_ADMIN"],
  permissions: [],
}

export const FAKE_PROFILE = {
  username: "e2e.tester@example.com",
  fullName: "E2E Tester",
  email: "e2e.tester@example.com",
  mobile: "+84 90 000 0000",
  avatarFileId: null,
  avatarUrl: null,
  superAdmin: false,
}

/** @param {{ userRegistration?: boolean, emailVerification?: boolean }} [system] */
export const publicSettings = (system = {}) =>
  ok({
    system: { defaultLanguage: "vi", userRegistration: false, emailVerification: false, ...system },
    brand: { titleText: "ERP", footerText: null, logoLightUrl: null },
    recaptcha: { enabled: false },
  })

export const LANGUAGES = ok([
  { code: "vi", name: "Tiếng Việt", enabled: true },
  { code: "en", name: "English", enabled: true },
  { code: "ko", name: "한국어", enabled: true },
])

/**
 * Mock one endpoint. `path` is after /api, e.g. "/v1/auth/login". Returns the list of request bodies seen.
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 * @param {{ status?: number, body: unknown, method?: string }} res
 */
export async function mockApi(page, path, { status = 200, body, method }) {
  /** @type {unknown[]} */
  const calls = []
  await page.route(`**/api${path}`, async (route) => {
    const req = route.request()
    if (method && req.method() !== method) return route.fallback()
    calls.push(req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
  })
  return calls
}

/**
 * Baseline for every page: public settings, languages, and a catch-all that fails loudly
 * so an unexpected backend call shows up instead of hitting a real server.
 * @param {import('@playwright/test').Page} page
 * @param {{ userRegistration?: boolean, emailVerification?: boolean }} [system]
 */
export async function mockPublic(page, system) {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 599, contentType: "application/json", body: JSON.stringify(fail("E2E_UNMOCKED", route.request().url())) })
  )
  await mockApi(page, "/v1/settings/public", { body: publicSettings(system) })
  await mockApi(page, "/v1/languages", { body: LANGUAGES })
}

/**
 * Logged-in state: fake tokens in localStorage + /me and /me/profile mocked.
 * @param {import('@playwright/test').Page} page
 */
export async function mockLoggedIn(page) {
  await page.addInitScript((t) => {
    localStorage.setItem("erp.token", t.accessToken)
    localStorage.setItem("erp.refreshToken", t.refreshToken)
  }, FAKE_TOKENS)
  await mockApi(page, "/v1/me", { body: ok(FAKE_ME) })
  await mockApi(page, "/v1/me/profile", { body: ok(FAKE_PROFILE), method: "GET" })
}
