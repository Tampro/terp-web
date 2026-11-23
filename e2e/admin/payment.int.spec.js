// @ts-check
/** §3.7 payment settings against the REAL backend, read-only: the forms show the stored values. */
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { SUPERADMIN_STATE } from "../../playwright.config.js"

test.skip(!fs.existsSync(SUPERADMIN_STATE), "no superadmin session")
test.use({ storageState: SUPERADMIN_STATE })

test("INT-PAY-001 tab thanh toán hiện cài đặt chuyển khoản và Stripe đã lưu", async ({ page }) => {
  await page.goto("/settings?tab=payment")
  const get = (/** @type {string} */ p) =>
    page.evaluate(async (path) => {
      const token = localStorage.getItem("erp.token") ?? sessionStorage.getItem("erp.token")
      return (await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    }, p)
  const bank = await get("/v1/settings/admin/payment/bank-transfer")
  const stripe = await get("/v1/settings/admin/payment/stripe")
  await expect(page.getByLabel("Tên ngân hàng")).toHaveValue(bank.data.bankName ?? "")
  await expect(page.getByLabel("Publishable key")).toHaveValue(stripe.data.publishableKey ?? "")
  await expect(page.getByRole("switch", { name: "Cho phép thanh toán Stripe khi mua gói" })).toHaveAttribute("aria-checked", String(!!stripe.data.enabled))
})
