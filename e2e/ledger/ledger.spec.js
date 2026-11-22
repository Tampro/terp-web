// @ts-check
/**
 * Double entry (manual §13). Spec sources: accounting-service LedgerController (journal entries; ManualForm {date,
 * referenceType, reference ≤100, description 5..500, lines[{accountId, description, debit, credit}], post}; ReverseForm
 * {date, description}; ACC_018 / ACC_066 unbalanced, ACC_067 only drafts), LedgerReportController (/ledger/*),
 * BalanceSheetController (GenerateForm, /finalise, /compare), YearEndCloseController (CloseForm {financialYear,
 * closingDate}).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = ["LEDGER_VIEW", "LEDGER_MANAGE", "LEDGER_REPORT_VIEW", "LEDGER_CLOSE", "COA_VIEW"]
const ACCOUNTS = [
  { id: "209", code: "111", name: "Tiền mặt", normalBalance: "DEBIT", active: true },
  { id: "210", code: "112", name: "Tiền gửi ngân hàng", normalBalance: "DEBIT", active: true },
  { id: "252", code: "711", name: "Thu nhập khác", normalBalance: "CREDIT", active: true },
]
const ENTRIES = [
  { id: "95", number: "JE-2026-004", date: "2026-11-22", type: "MANUAL", status: "DRAFT", description: "E2E draft entry", totalDebit: 200000, totalCredit: 200000, lines: null },
  { id: "94", number: "JE-2026-003", date: "2026-11-22", type: "AUTOMATIC", sourceType: "CUSTOMER_PAYMENT", reference: "CP-2026-11-001", status: "POSTED", totalDebit: 1000000, totalCredit: 1000000, lines: null },
]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/accounting/bank-accounts", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/accounting/chart-of-accounts", { method: "GET", body: pageOf(ACCOUNTS) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("LE-001 sổ nhật ký: tự động/thủ công, nguồn, mở dòng tải chi tiết bút toán @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/journal-entries", { method: "GET", body: pageOf(ENTRIES) })
  const detail = await mockApi(page, "/v1/accounting/journal-entries/94", {
    method: "GET",
    body: ok({
      ...ENTRIES[1],
      lines: [
        { id: "1", accountCode: "112", accountName: "Tiền gửi ngân hàng", debit: 1000000, credit: 0 },
        { id: "2", accountCode: "131", accountName: "Phải thu của khách hàng", debit: 0, credit: 1000000 },
      ],
    }),
  })
  await page.goto("/accounting/journal-entries")
  const row = page.getByRole("row").filter({ hasText: "JE-2026-003" })
  await expect(row).toContainText("Tự động")
  await expect(row).toContainText("Thu tiền khách hàng")
  await expect(row).toContainText("Đã ghi sổ")
  // an automatic entry has no edit/delete; a posted one can be reversed
  await menu(page, "JE-2026-003").click()
  await expect(page.getByRole("menuitem", { name: "Đảo bút toán" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Xem dòng của JE-2026-003" }).click()
  await expect.poll(() => detail.length).toBe(1)
  await expect(page.getByRole("row", { name: "131 Phải thu của khách hàng - 1.000.000", exact: true })).toBeVisible()
})

test("LE-010 bút toán thủ công: nút Tạo khóa đến khi Nợ = Có, mô tả ≥5 ký tự, gửi ManualForm (post=true)", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/journal-entries", { method: "GET", body: pageOf([]) })
  const create = await mockApi(page, "/v1/accounting/journal-entries", { method: "POST", body: ok({ id: "96" }) })
  await page.goto("/accounting/journal-entries")
  await page.getByRole("button", { name: "Bút toán thủ công" }).click()
  const dialog = page.getByRole("dialog")
  const createBtn = dialog.getByRole("button", { name: "Tạo", exact: true })
  await dialog.getByRole("combobox", { name: "Loại tham chiếu" }).click()
  await page.getByRole("option", { name: "Điều chỉnh" }).click()
  await dialog.getByLabel("Tham chiếu", { exact: true }).fill("E2E-REF")
  await dialog.getByLabel("Diễn giải", { exact: true }).fill("abc")
  await dialog.getByRole("combobox", { name: "Tài khoản dòng 1" }).click()
  await page.getByRole("option", { name: "112 · Tiền gửi ngân hàng" }).click()
  await dialog.getByLabel("Nợ dòng 1").fill("300000")
  await dialog.getByRole("combobox", { name: "Tài khoản dòng 2" }).click()
  await page.getByRole("option", { name: "711 · Thu nhập khác" }).click()
  await dialog.getByLabel("Có dòng 2").fill("250000")
  await expect(dialog.getByRole("status")).toContainText("Lệch 50.000")
  await expect(createBtn).toBeDisabled()
  await dialog.getByLabel("Có dòng 2").fill("300000")
  await expect(dialog.getByRole("status")).toContainText("Cân bằng")
  // still disabled: the description is shorter than 5 characters
  await expect(dialog.getByText("Tối thiểu 5 ký tự")).toBeVisible()
  await expect(createBtn).toBeDisabled()
  await dialog.getByLabel("Diễn giải", { exact: true }).fill("E2E adjustment")
  // a third line left empty is ignored
  await dialog.getByRole("button", { name: "Thêm dòng" }).click()
  await expect(createBtn).toBeEnabled()
  await createBtn.click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    referenceType: "ADJUSTMENT",
    reference: "E2E-REF",
    description: "E2E adjustment",
    lines: [
      { accountId: 210, debit: 300000, credit: 0 },
      { accountId: 252, debit: 0, credit: 300000 },
    ],
    post: true,
  })
})

test("LE-011 nháp thủ công: Ghi sổ qua xác nhận; bút toán đã ghi sổ Đảo gửi ReverseForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/journal-entries", { method: "GET", body: pageOf(ENTRIES) })
  const post = await mockApi(page, "/v1/accounting/journal-entries/95/post", { method: "POST", body: ok({}) })
  const reverse = await mockApi(page, "/v1/accounting/journal-entries/94/reverse", { method: "POST", body: ok({}) })
  await page.goto("/accounting/journal-entries")
  await menu(page, "JE-2026-004").click()
  await page.getByRole("menuitem", { name: "Ghi sổ" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Ghi sổ JE-2026-004?")
  await page.getByRole("alertdialog").getByRole("button", { name: "Ghi sổ" }).click()
  await expect.poll(() => post.requests.length).toBe(1)
  await menu(page, "JE-2026-003").click()
  await page.getByRole("menuitem", { name: "Đảo bút toán" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Ngày").fill("2026-11-23")
  await dialog.getByLabel("Diễn giải").fill("E2E reversal")
  await dialog.getByRole("button", { name: "Đảo bút toán" }).click()
  await expect.poll(() => reverse.length).toBe(1)
  expect(reverse[0]).toEqual({ date: "2026-11-23", description: "E2E reversal" })
})

test("LE-020 báo cáo sổ cái: bảng cân đối thử có tổng và Cân bằng; sổ cái cần chọn tài khoản", async ({ page }) => {
  await base(page)
  const tb = await mockApi(page, "/v1/accounting/ledger/trial-balance", {
    body: ok({
      rows: [
        { accountId: "210", code: "112", name: "Tiền gửi ngân hàng", periodDebit: 500000, closingDebit: 500000 },
        { accountId: "252", code: "711", name: "Thu nhập khác", periodCredit: 500000, closingCredit: 500000 },
      ],
      totals: { periodDebit: 500000, periodCredit: 500000, closingDebit: 500000, closingCredit: 500000 },
      balanced: true,
      difference: 0,
    }),
  })
  const gl = await mockApi(page, "/v1/accounting/ledger/general-ledger", {
    body: ok({ code: "112", name: "Tiền gửi ngân hàng", openingBalance: 0, closingBalance: 500000, totalDebit: 500000, totalCredit: 0, lines: [{ entryId: "1", number: "JE-2026-001", date: "2026-11-22", debit: 500000, credit: 0, balance: 500000, counterpartCodes: ["711"] }] }),
  })
  await page.goto("/accounting/ledger?from=2026-01-01&to=2026-12-31")
  await expect(page.getByTestId("tb-balanced")).toHaveText("Cân bằng")
  await expect(page.getByRole("row").filter({ hasText: "Tổng cộng" })).toContainText("500.000")
  expect(tb.requests[0].url.searchParams.get("from")).toBe("2026-01-01")
  await page.getByRole("tab", { name: "Sổ cái" }).click()
  await expect(page.getByText("Chọn tài khoản để xem phát sinh.")).toBeVisible()
  expect(gl.length).toBe(0)
  await page.getByRole("combobox", { name: "Tài khoản" }).click()
  await page.getByRole("option", { name: "112 · Tiền gửi ngân hàng" }).click()
  await expect(page.getByTestId("closing-balance")).toHaveText(/500\.000/)
  expect(gl.requests[0].url.searchParams.get("accountId")).toBe("210")
  await expect(page.getByRole("row").filter({ hasText: "JE-2026-001" })).toContainText("711")
})

test("LE-030 bảng cân đối: lập gửi GenerateForm, xem A = L + E, chốt qua xác nhận", async ({ page }) => {
  await base(page)
  const sheet = {
    id: "7",
    date: "2026-11-22",
    financialYear: 2026,
    status: "DRAFT",
    totalAssets: 500000,
    totalLiabilities: 0,
    totalEquity: 500000,
    difference: 0,
    balanced: true,
    sections: [{ section: "ASSETS", total: 500000, groups: [{ group: "CURRENT_ASSETS", total: 500000, lines: [{ accountId: "210", accountCode: "112", accountName: "Tiền gửi ngân hàng", amount: 500000 }] }] }],
  }
  await mockApi(page, "/v1/accounting/balance-sheets", { method: "GET", body: pageOf([sheet]) })
  const generate = await mockApi(page, "/v1/accounting/balance-sheets", { method: "POST", body: ok(sheet) })
  await mockApi(page, "/v1/accounting/balance-sheets/7", { method: "GET", body: ok(sheet) })
  const finalise = await mockApi(page, "/v1/accounting/balance-sheets/7/finalise", { method: "POST", body: ok({ ...sheet, status: "FINALISED" }) })
  await page.goto("/accounting/balance-sheets")
  await expect(page.getByRole("row").filter({ hasText: "2026" }).first()).toContainText("Cân bằng")
  await page.getByRole("button", { name: "Lập bảng cân đối" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Ngày").fill("2026-11-22")
  await dialog.getByLabel("Năm tài chính").fill("2026")
  await dialog.getByLabel("Ghi chú").fill("E2E notes")
  await dialog.getByRole("button", { name: "Lập bảng cân đối" }).click()
  await expect.poll(() => generate.length).toBe(1)
  expect(generate[0]).toEqual({ date: "2026-11-22", financialYear: 2026, notes: "E2E notes" })
  // the new sheet opens
  await expect(page.getByTestId("sheet-check")).toContainText("Cân bằng")
  await expect(page.getByRole("dialog")).toContainText("112 Tiền gửi ngân hàng")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Thao tác cho bảng cân đối 2026-11-22" }).click()
  await page.getByRole("menuitem", { name: "Chốt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Chốt" }).click()
  await expect.poll(() => finalise.requests.length).toBe(1)
})

test("LE-040 khóa sổ cuối năm: xác nhận không hoàn tác, gửi CloseForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/balance-sheets", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/accounting/year-end-closes", { method: "GET", body: pageOf([{ id: "1", financialYear: 2024, closingDate: "2024-12-31", entryNumber: "JE-2024-099", closedAt: "2025-01-05T03:00:00Z" }]) })
  const close = await mockApi(page, "/v1/accounting/year-end-closes", { method: "POST", body: ok({ id: "2" }) })
  await page.goto("/accounting/balance-sheets?tab=year-end")
  await expect(page.getByRole("row").filter({ hasText: "2024" })).toContainText("JE-2024-099")
  await page.getByLabel("Năm tài chính").fill("2025")
  await page.getByLabel("Ngày khóa sổ").fill("2025-12-31")
  await page.getByRole("button", { name: "Khóa sổ năm" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Không thể hoàn tác")
  await page.getByRole("alertdialog").getByRole("button", { name: "Khóa sổ năm" }).click()
  await expect.poll(() => close.length).toBe(1)
  expect(close[0]).toEqual({ financialYear: 2025, closingDate: "2025-12-31" })
})
