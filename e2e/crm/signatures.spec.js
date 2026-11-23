// @ts-check
/**
 * §7 contract signatures and PDF. Spec: crm-service ContractSignatureController — POST /crm/contracts/{id}/signatures
 * {signatureDataUrl (PNG data URL), signerName?}, GET /signatures (SignatureDto: signerType, signerName, signedAt,
 * contentMatches…), GET /signatures/{COMPANY|CLIENT}/image (PNG), GET /pdf; PENDING only (CTR_017); after the first
 * signature no edit / delete (CTR_018).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"
import { CONTRACT_DETAIL, CONTRACTS, CRM_ALL, CUSTOMERS, TYPES } from "./data.js"

const PENDING = { ...CONTRACT_DETAIL, contract: { ...CONTRACTS[0], status: "PENDING" } }
const COMPANY_SIG = { signerType: "COMPANY", signerName: "E2E Ký thay công ty", signerEmail: "e2e.admin@example.com", signedAt: "2026-11-23T03:00:00Z", contentMatches: true }
const CLIENT_SIG = { signerType: "CLIENT", signerName: "E2E Khách hàng", signedAt: "2026-11-23T04:00:00Z", contentMatches: false }
// 1×1 transparent PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64")

/** @param {import('@playwright/test').Page} page @param {object} detail @param {object[]} signatures @param {string[]} [permissions] */
async function open(page, detail, signatures, permissions = CRM_ALL) {
  await mockLoggedIn(page, { permissions })
  await mockApi(page, "/v1/crm/contract-types", { method: "GET", body: ok(TYPES) })
  await mockApi(page, "/v1/accounting/customers", { body: pageOf(CUSTOMERS) })
  await mockApi(page, "/v1/crm/contracts/301", { method: "GET", body: ok(detail) })
  const list = await mockApi(page, "/v1/crm/contracts/301/signatures", { method: "GET", body: ok(signatures) })
  await page.route("**/api/v1/crm/contracts/301/signatures/*/image", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }))
  await page.goto("/crm/contracts/301")
  return list
}

test("SIG-001 chưa ký: vẽ chữ ký → POST data URL PNG + tên; nút Ký tắt khi chưa vẽ @smoke", async ({ page }) => {
  await open(page, PENDING, [])
  const sign = await mockApi(page, "/v1/crm/contracts/301/signatures", { method: "POST", body: ok([COMPANY_SIG]) })
  const card = page.getByTestId("contract-signatures")
  await expect(card.getByTestId("signature-COMPANY")).toContainText("Chưa ký")
  await expect(card.getByTestId("signature-CLIENT")).toContainText("Khách hàng ký trên cổng khách hàng")
  await expect(page.getByTestId("contract-locked")).toHaveCount(0)
  await card.getByRole("button", { name: "Ký" }).click()
  const dlg = page.getByRole("dialog")
  await expect(dlg.getByRole("button", { name: "Ký" })).toBeDisabled()
  const box = await dlg.getByTestId("signature-pad").boundingBox()
  if (!box) throw new Error("no pad")
  await page.mouse.move(box.x + 30, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + 30, { steps: 8 })
  await page.mouse.move(box.x + 400, box.y + 90, { steps: 8 })
  await page.mouse.up()
  await dlg.getByLabel("Tên in dưới chữ ký").fill("E2E Ký thay công ty")
  await dlg.getByRole("button", { name: "Ký" }).click()
  await expect.poll(() => sign.length).toBe(1)
  expect(String(sign[0].signatureDataUrl)).toMatch(/^data:image\/png;base64,/)
  expect(sign[0].signerName).toBe("E2E Ký thay công ty")
})

test("SIG-002 đã ký: ảnh, tên, cảnh báo nội dung đổi; khoá sửa (CTR_018), không còn nút Ký", async ({ page }) => {
  await open(page, PENDING, [COMPANY_SIG, CLIENT_SIG])
  const card = page.getByTestId("contract-signatures")
  await expect(card.getByTestId("signature-COMPANY")).toContainText("E2E Ký thay công ty")
  await expect(card.getByTestId("signature-COMPANY").getByRole("img")).toBeVisible()
  await expect(card.getByTestId("signature-CLIENT")).toContainText("Nội dung hợp đồng đã thay đổi sau khi ký")
  await expect(card.getByRole("button", { name: "Ký" })).toHaveCount(0)
  await expect(page.getByTestId("contract-locked")).toBeVisible()
  await expect(page.getByRole("button", { name: "Sửa" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Nội dung thỏa thuận" })).toHaveCount(0)
  await expect(page.getByText("E2E agreement text")).toBeVisible()
})

test("SIG-003 hợp đồng không ở trạng thái chờ (ACTIVE) hoặc chỉ xem: không có nút Ký; Tải PDF lưu tệp theo số hợp đồng", async ({ page }) => {
  await open(page, CONTRACT_DETAIL, [], ["CRM_CONTRACT_VIEW"])
  await page.route("**/api/v1/crm/contracts/301/pdf", (r) => r.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 e2e") }))
  await expect(page.getByTestId("signature-COMPANY")).toContainText("Chưa ký")
  await expect(page.getByTestId("contract-signatures").getByRole("button", { name: "Ký" })).toHaveCount(0)
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải PDF" }).click()])
  expect(dl.suggestedFilename()).toBe(`${CONTRACTS[0].number}.pdf`)
})
