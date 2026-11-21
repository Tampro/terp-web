// @ts-check
/**
 * Contract checks against the running ERP gateway (no credentials needed: only public and error paths).
 * Spec sources: IAM Swagger /docs/iam/v3/api-docs — ApiMessageDto envelope, POST /auth/login 401 AUTH_001,
 * GET /settings/public, GET /languages, GET /me without a token → 401, POST /auth/forgot-password always 200.
 * Skips when the gateway is down.
 */
import { expect, test } from "@playwright/test"

test.beforeAll(async ({ request }) => {
  const up = await request.get("settings/public").then((r) => r.ok()).catch(() => false)
  test.skip(!up, "ERP gateway not reachable (start the terp-be ERP stack)")
})

test("AUTH-API-001 login sai mật khẩu → 401 + envelope AUTH_001, message theo Accept-Language", async ({ request }) => {
  const res = await request.post("auth/login", {
    data: { username: "e2e.nobody@example.com", password: "wrong-password" },
    headers: { "Accept-Language": "en" },
  })
  expect(res.status()).toBe(401)
  expect(res.headers()["content-type"]).toContain("application/json")
  const body = await res.json()
  expect(body).toMatchObject({ result: false, code: "AUTH_001" })
  expect(typeof body.message).toBe("string")
  expect(typeof body.traceId).toBe("string")
})

test("AUTH-API-002 settings/public không cần token và có các khối FE dùng", async ({ request }) => {
  const res = await request.get("settings/public")
  expect(res.status()).toBe(200)
  const { result, data } = await res.json()
  expect(result).toBe(true)
  expect(typeof data.system.userRegistration).toBe("boolean")
  expect(typeof data.system.emailVerification).toBe("boolean")
  expect(data).toHaveProperty("brand")
  expect(data).toHaveProperty("recaptcha")
})

test("AUTH-API-003 languages không cần token, có vi/en/ko", async ({ request }) => {
  const res = await request.get("languages")
  expect(res.status()).toBe(200)
  const codes = (await res.json()).data.map((/** @type {{code: string}} */ l) => l.code)
  expect(codes).toEqual(expect.arrayContaining(["vi", "en", "ko"]))
})

test("AUTH-API-004 /me không có token → 401", async ({ request }) => {
  const res = await request.get("me")
  expect(res.status()).toBe(401)
})

test("AUTH-API-005 forgot-password với email không tồn tại vẫn 200 (không lộ tài khoản)", async ({ request }) => {
  const res = await request.post("auth/forgot-password", { data: { email: "e2e.nobody@example.com" } })
  expect(res.status()).toBe(200)
  expect((await res.json()).result).toBe(true)
})
