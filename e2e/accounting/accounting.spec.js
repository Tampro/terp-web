// @ts-check
/**
 * Accounting (manual §12). Spec sources: accounting-service CustomerController / VendorController (CustomerForm with
 * billing / shipping AddressForm), IncomeControllers (VoucherForm; Draft → Approved → Posted, ACC_029 / ACC_030),
 * BankControllers (BankAccountForm, TransferForm, ACC_025 same account, /process, /reconcile), PaymentControllers
 * (PaymentForm {partyId, bankAccountId, paymentDate, allocations[{invoiceId, amount}], appliedNotes[{noteId, amount}]};
 * ACC_054 / ACC_057 / ACC_058 / ACC_059; /clear PAYMENT_CLEAR), NoteControllers (NoteForm {returnId}), ReportController
 * (aging, tax summary, balances), CoaControllers (AccountForm code [A-Za-z0-9_.-]{1,20}).
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const ALL = [
  "CUSTOMER_VIEW", "CUSTOMER_MANAGE", "VENDOR_VIEW", "VENDOR_MANAGE", "REVENUE_VIEW", "REVENUE_MANAGE", "REVENUE_APPROVE",
  "EXPENSE_VIEW", "EXPENSE_MANAGE", "EXPENSE_APPROVE", "BANK_VIEW", "BANK_MANAGE", "PAYMENT_VIEW", "PAYMENT_MANAGE",
  "PAYMENT_CLEAR", "NOTE_VIEW", "NOTE_MANAGE", "NOTE_APPROVE", "ACCOUNTING_REPORT_VIEW", "COA_VIEW", "COA_MANAGE",
]
const BANKS = [
  { id: "11", holderName: "E2E Cash", bankName: "E2E Counter", accountNumber: "0001", balance: 5000000, openingBalance: 0, active: true, accountType: "CHECKING" },
  { id: "12", holderName: "E2E Bank", bankName: "E2E VCB", accountNumber: "0002", balance: 1000000, openingBalance: 1000000, active: true },
]
const ACCOUNTS = [
  { id: "209", code: "111", name: "Tiền mặt", accountTypeId: "33", normalBalance: "DEBIT", active: true, currentBalance: 0 },
  { id: "260", code: "711", name: "Thu nhập khác", accountTypeId: "40", normalBalance: "CREDIT", active: true, currentBalance: 0 },
]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/accounting/bank-accounts", { method: "GET", body: pageOf(BANKS) })
  await mockApi(page, "/v1/accounting/chart-of-accounts", { method: "GET", body: pageOf(ACCOUNTS) })
  await mockApi(page, "/v1/iam/users", { body: pageOf([{ id: "58", username: "e2e.client", fullName: "E2E Client", email: "client@example.com", roles: ["CLIENT"] }]) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("ACC-001 khách hàng: form 3 bước, email bắt buộc hợp lệ, giao hàng giống thanh toán, gửi CustomerForm @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/customers", { method: "GET", body: pageOf([{ id: "5", customerCode: "CUST-0001", companyName: "E2E Ánh Dương", contactPerson: "E2E A", email: "a@example.com" }]) })
  const save = await mockApi(page, "/v1/accounting/customers", { method: "POST", body: ok({ id: "9" }) })
  await page.goto("/accounting/customers")
  await expect(page.getByRole("row").filter({ hasText: "CUST-0001" })).toContainText("E2E Ánh Dương")
  await page.getByRole("button", { name: "Tạo khách hàng" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên công ty").fill("E2E New Co")
  await dialog.getByLabel("Email").fill("bad")
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Nhập email hợp lệ")).toBeVisible()
  await dialog.getByLabel("Người liên hệ").fill("E2E Bình")
  await dialog.getByLabel("Email").fill("binh@example.com")
  await dialog.getByRole("combobox", { name: "Tài khoản khách hàng (Client)" }).click()
  await page.getByRole("option", { name: /E2E Client/ }).click()
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByText("Bước 2/3: Địa chỉ thanh toán")).toBeVisible()
  await dialog.getByLabel("Thành phố").fill("Hà Nội")
  await dialog.getByRole("button", { name: "Tiếp" }).click()
  await expect(dialog.getByRole("checkbox", { name: "Địa chỉ giao hàng giống địa chỉ thanh toán" })).toBeChecked()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toMatchObject({
    companyName: "E2E New Co",
    contactPerson: "E2E Bình",
    email: "binh@example.com",
    userId: 58,
    shippingSameAsBilling: true,
    billing: { city: "Hà Nội", country: null },
  })
  expect(save[0]).not.toHaveProperty("shipping")
})

test("ACC-010 khoản thu: tạo gửi VoucherForm; Nháp → Duyệt → Ghi sổ qua xác nhận", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/revenue-categories", { method: "GET", body: pageOf([{ id: "15", code: "SVC", name: "E2E Service", glAccountId: "260", enabled: true }]) })
  const rows = [
    { id: "1", number: "REV-2026-11-001", date: "2026-11-22", categoryId: "15", bankAccountId: "11", amount: 1500000, status: "DRAFT" },
    { id: "2", number: "REV-2026-11-002", date: "2026-11-22", categoryId: "15", bankAccountId: "11", amount: 300000, status: "APPROVED" },
  ]
  await mockApi(page, "/v1/accounting/revenues", { method: "GET", body: pageOf(rows) })
  const create = await mockApi(page, "/v1/accounting/revenues", { method: "POST", body: ok(rows[0]) })
  const approve = await mockApi(page, "/v1/accounting/revenues/1/approve", { method: "POST", body: ok({}) })
  const post = await mockApi(page, "/v1/accounting/revenues/2/post", { method: "POST", body: ok({}) })
  await page.goto("/accounting/revenues")
  await expect(page.getByRole("row").filter({ hasText: "REV-2026-11-001" })).toContainText("E2E Service")
  await page.getByRole("button", { name: "Tạo khoản thu" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập số tiền lớn hơn 0")).toBeVisible()
  expect(create).toHaveLength(0)
  await dialog.getByRole("combobox", { name: "Danh mục" }).click()
  await page.getByRole("option", { name: "E2E Service" }).click()
  await dialog.getByRole("combobox", { name: "Tài khoản ngân hàng" }).click()
  await page.getByRole("option", { name: /E2E Counter/ }).click()
  await dialog.getByLabel("Số tiền").fill("1500000")
  await dialog.getByLabel("Ngày").fill("2026-11-22")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ date: "2026-11-22", categoryId: 15, bankAccountId: 11, accountId: null, amount: 1500000, reference: null, description: null })

  await menu(page, "REV-2026-11-001").click()
  await expect(page.getByRole("menuitem", { name: "Ghi sổ" })).toHaveCount(0) // a draft is approved first
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.length).toBe(1)
  await menu(page, "REV-2026-11-002").click()
  await expect(page.getByRole("menuitem", { name: "Sửa" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Ghi sổ" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Ghi sổ" }).click()
  await expect.poll(() => post.length).toBe(1)
})

test("ACC-020 ngân hàng: chuyển khoản cùng tài khoản bị chặn (ACC_025), gửi TransferForm; giao dịch đã thanh toán đối soát được", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/bank-transfers", { method: "GET", body: pageOf([]) })
  const create = await mockApi(page, "/v1/accounting/bank-transfers", { method: "POST", body: ok({}) })
  await mockApi(page, "/v1/accounting/bank-accounts/11/transactions", {
    body: pageOf([{ id: "77", type: "CREDIT", amount: 1500000, transactionDate: "2026-11-22", reference: "REV-2026-11-001", runningBalance: 5000000, status: "CLEARED" }]),
  })
  const reconcile = await mockApi(page, "/v1/accounting/bank-transactions/77/reconcile", { method: "POST", body: ok({}) })
  await page.goto("/accounting/banking")
  await expect(page.getByRole("row").filter({ hasText: "E2E Cash" })).toContainText("5.000.000")
  await menu(page, "0001").click()
  await page.getByRole("menuitem", { name: "Giao dịch" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Đối soát" }).click()
  await expect.poll(() => reconcile.length).toBe(1)
  await page.keyboard.press("Escape")

  await page.getByRole("tab", { name: "Chuyển khoản" }).click()
  await page.getByRole("button", { name: "Tạo chuyển khoản" }).click()
  const dialog = page.getByRole("dialog")
  for (const [label, option] of [["Từ tài khoản", /E2E Counter/], ["Đến tài khoản", /E2E Counter/]]) {
    await dialog.getByRole("combobox", { name: /** @type {string} */ (label) }).click()
    await page.getByRole("option", { name: option }).click()
  }
  await dialog.getByLabel("Số tiền").fill("200000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Tài khoản nguồn và đích phải khác nhau")).toBeVisible()
  await dialog.getByRole("combobox", { name: "Đến tài khoản" }).click()
  await page.getByRole("option", { name: /E2E VCB/ }).click()
  await dialog.getByLabel("Phí").fill("5000")
  await dialog.getByLabel("Ngày").fill("2026-11-22")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ date: "2026-11-22", fromAccountId: 11, toAccountId: 12, amount: 200000, charges: 5000, reference: null, description: null })
})

test("ACC-030 thu tiền khách hàng: tối đa số dư hóa đơn, note không vượt số phân bổ, gửi PaymentForm; xác nhận thanh toán", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/customers", { method: "GET", body: pageOf([{ id: "6", companyName: "E2E O'Brien" }]) })
  await mockApi(page, "/v1/accounting/customer-payments", {
    method: "GET",
    body: pageOf([{ id: "3", number: "CP-2026-11-001", paymentDate: "2026-11-22", partyName: "E2E O'Brien", bankAccountId: "11", allocatedTotal: 1000000, notesTotal: 0, amount: 1000000, status: "PENDING" }]),
  })
  await mockApi(page, "/v1/accounting/customer-payments/open-items", {
    body: ok({ invoices: [{ id: "31", number: "SI-2026-10-001", dueDate: "2026-11-12", total: 6270000, balance: 6270000 }], notes: [{ id: "41", number: "CN-2026-11-001", balance: 200000 }] }),
  })
  const create = await mockApi(page, "/v1/accounting/customer-payments", { method: "POST", body: ok({}) })
  const clear = await mockApi(page, "/v1/accounting/customer-payments/3/clear", { method: "POST", body: ok({}) })
  await page.goto("/accounting/customer-payments")
  await page.getByRole("button", { name: "Thu tiền" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Khách hàng" }).click()
  await page.getByRole("option", { name: "E2E O'Brien" }).click()
  await dialog.getByRole("combobox", { name: "Tài khoản ngân hàng" }).click()
  await page.getByRole("option", { name: /E2E Counter/ }).click()
  await dialog.getByLabel("Số tiền cho SI-2026-10-001").fill("9000000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Tối đa 6.270.000")).toBeVisible()
  await dialog.getByLabel("Số tiền cho SI-2026-10-001").fill("100000")
  await dialog.getByLabel("Dùng CN-2026-11-001").fill("150000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Tiền note cấn trừ không được vượt số đã phân bổ")).toBeVisible()
  expect(create).toHaveLength(0)
  await dialog.getByRole("button", { name: "Toàn bộ" }).click()
  await dialog.getByLabel("Ngày").fill("2026-11-22")
  await expect(dialog.getByTestId("payment-totals")).toContainText("6.120.000")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    partyId: 6,
    bankAccountId: 11,
    paymentDate: "2026-11-22",
    reference: null,
    notes: null,
    allocations: [{ invoiceId: 31, amount: 6270000 }],
    appliedNotes: [{ noteId: 41, amount: 150000 }],
  })

  await menu(page, "CP-2026-11-001").click()
  await page.getByRole("menuitem", { name: "Xác nhận đã thanh toán" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xác nhận đã thanh toán" }).click()
  await expect.poll(() => clear.length).toBe(1)
})

test("ACC-040 credit note từ phiếu trả hàng bán đã hoàn tất, gửi NoteForm; duyệt nháp", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/credit-notes", {
    method: "GET",
    body: pageOf([{ id: "41", number: "CN-2026-11-001", returnNumber: "SR-2026-11-001", partyName: "E2E O'Brien", noteDate: "2026-11-22", total: 200000, balance: 200000, status: "DRAFT" }]),
  })
  const returns = await mockApi(page, "/v1/sales/returns", { body: pageOf([{ id: "71", number: "SR-2026-11-002", customerName: "E2E O'Brien", total: 330000, status: "COMPLETED" }]) })
  const create = await mockApi(page, "/v1/accounting/credit-notes", { method: "POST", body: ok({}) })
  const approve = await mockApi(page, "/v1/accounting/credit-notes/41/approve", { method: "POST", body: ok({}) })
  await page.goto("/accounting/credit-notes")
  await page.getByRole("button", { name: "Duyệt CN-2026-11-001" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approve.length).toBe(1)
  await page.getByRole("button", { name: "Tạo credit note" }).click()
  await expect.poll(() => returns.requests[0]?.url.searchParams.get("status")).toBe("COMPLETED")
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox", { name: "Phiếu trả hàng" }).click()
  await page.getByRole("option", { name: /SR-2026-11-002/ }).click()
  await dialog.getByLabel("Ngày").fill("2026-11-22")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ returnId: 71, noteDate: "2026-11-22", notes: null })
})

test("ACC-050 báo cáo: tuổi nợ theo nhóm ngày có tổng, thuế phải nộp, số dư hiện 0 khi bật", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/reports/invoice-aging", {
    body: ok({ rows: [{ partyId: "6", partyName: "E2E O'Brien", current: 0, days1To30: 5270000, days31To60: 0, days61To90: 0, over90: 0, total: 5270000 }], totals: { current: 0, days1To30: 5270000, days31To60: 0, days61To90: 0, over90: 0, total: 5270000 } }),
  })
  await mockApi(page, "/v1/accounting/reports/tax-summary", { body: ok({ outputTax: 570000, creditNoteTax: 0, netOutputTax: 570000, inputTax: 2170000, debitNoteTax: 0, netInputTax: 2170000, netTaxLiability: -1600000 }) })
  const balances = await mockApi(page, "/v1/accounting/reports/customer-balances", { body: ok([{ partyId: "6", code: "CUST-0002", name: "E2E O'Brien", openInvoices: 5270000, unappliedNotes: 0, balance: 5270000 }]) })
  await page.goto("/accounting/reports")
  await expect(page.getByRole("row").filter({ hasText: "E2E O'Brien" })).toContainText("5.270.000")
  await page.getByRole("tab", { name: "Tổng hợp thuế" }).click()
  await expect(page.getByTestId("tax-net")).toContainText("-1.600.000")
  await page.getByRole("tab", { name: "Số dư khách hàng" }).click()
  await expect(page.getByRole("row").filter({ hasText: "CUST-0002" })).toBeVisible()
  await page.getByRole("switch", { name: "Hiện số dư bằng 0" }).click()
  await expect.poll(() => balances.requests.at(-1)?.url.searchParams.get("showZero")).toBe("true")
})

test("ACC-060 hệ thống tài khoản: mã tài khoản theo mẫu, gửi AccountForm; tab danh mục thu", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/account-types", { body: pageOf([{ id: "33", category: "ASSETS", code: "CA", name: "E2E Current assets", normalBalance: "DEBIT", active: true }]) })
  const save = await mockApi(page, "/v1/accounting/chart-of-accounts", { method: "POST", body: ok({}) })
  await mockApi(page, "/v1/accounting/revenue-categories", { method: "GET", body: pageOf([{ id: "15", code: "SVC", name: "E2E Service", glAccountId: "260", enabled: true }]) })
  await page.goto("/accounting/chart-of-accounts")
  await expect(page.getByRole("row").filter({ hasText: "Tiền mặt" })).toContainText("E2E Current assets")
  await page.getByRole("button", { name: "Tạo tài khoản" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Mã").fill("1121 bad")
  await dialog.getByLabel("Tên").fill("E2E VCB")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Tối đa 20 ký tự")).toBeVisible()
  await dialog.getByLabel("Mã").fill("1121")
  await dialog.getByRole("combobox", { name: "Loại tài khoản" }).click()
  await page.getByRole("option", { name: /E2E Current assets/ }).click()
  await dialog.getByRole("combobox", { name: "Tài khoản cha" }).click()
  await page.getByRole("option", { name: "111 · Tiền mặt" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ accountTypeId: 33, code: "1121", name: "E2E VCB", normalBalance: "DEBIT", openingBalance: 0, active: true, parentId: 209, description: null })
  await page.getByRole("tab", { name: "Danh mục thu" }).click()
  await expect(page.getByRole("row").filter({ hasText: "E2E Service" })).toContainText("711 · Thu nhập khác")
})

// §12.6 "PDF export" for every report: /reports/{tax-summary,customer-balances,vendor-balances}/pdf
test("ACC-051 báo cáo: PDF thuế (from/to) và số dư (showZero) gọi đúng endpoint", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/reports/tax-summary", { body: ok({ outputTax: 0, netTaxLiability: 0 }) })
  await mockApi(page, "/v1/accounting/reports/vendor-balances", { body: ok([]) })
  /** @type {URL[]} */
  const pdfs = []
  await page.route("**/api/v1/accounting/reports/*/pdf**", (r) => {
    pdfs.push(new URL(r.request().url()))
    return r.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 e2e") })
  })
  await page.goto("/accounting/reports?tab=tax&from=2026-01-01&to=2026-06-30")
  const [tax] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải PDF" }).click()])
  expect(tax.suggestedFilename()).toBe("tax-2026-01-01_2026-06-30.pdf")
  expect(pdfs[0].pathname).toBe("/api/v1/accounting/reports/tax-summary/pdf")
  expect(pdfs[0].searchParams.get("from")).toBe("2026-01-01")
  expect(pdfs[0].searchParams.get("to")).toBe("2026-06-30")
  await page.goto("/accounting/reports?tab=vendor-balances&zero=1")
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tải PDF" }).click()])
  expect(pdfs[1].pathname).toBe("/api/v1/accounting/reports/vendor-balances/pdf")
  expect(pdfs[1].searchParams.get("showZero")).toBe("true")
})

// LedgerController GET / PUT /accounting/account-mapping: full replacement {accounts: {KEY: accountId}}
const MAPPING = [
  { key: "BANK", accountId: "210", accountCode: "112", accountName: "Tiền gửi ngân hàng" },
  { key: "CASH", accountId: "209", accountCode: "111", accountName: "Tiền mặt" },
]
test("ACC-061 ánh xạ hệ thống: đổi tài khoản của một khóa, PUT gửi đủ mọi khóa; lỗi ACC_017 hiện message", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/accounting/account-mapping", { method: "GET", body: ok(MAPPING) })
  const put = await mockApi(page, "/v1/accounting/account-mapping", { method: "PUT", status: 400, body: fail("ACC_017", "E2E Khóa CASH chưa ánh xạ tài khoản hợp lệ.") })
  await page.goto("/accounting/chart-of-accounts?tab=mapping")
  const table = page.getByTestId("account-mapping")
  await expect(table.locator("tbody tr")).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Tạo tài khoản" })).toHaveCount(0)
  const save = page.getByRole("button", { name: "Lưu" })
  await expect(save).toBeDisabled()
  await page.getByRole("combobox", { name: "Tiền mặt" }).click()
  await page.getByRole("option", { name: "711 · Thu nhập khác" }).click()
  await save.click()
  await expect.poll(() => put.length).toBe(1)
  expect(put[0]).toEqual({ accounts: { BANK: 210, CASH: 260 } })
  await expect(page.getByText("E2E Khóa CASH chưa ánh xạ tài khoản hợp lệ.")).toBeVisible()
})

test("ACC-062 ánh xạ hệ thống chỉ xem (COA_VIEW): hiện mã · tên, không có ô chọn và nút Lưu", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["COA_VIEW"] })
  await mockApi(page, "/v1/accounting/chart-of-accounts", { method: "GET", body: pageOf(ACCOUNTS) })
  await mockApi(page, "/v1/accounting/account-mapping", { method: "GET", body: ok(MAPPING) })
  await page.goto("/accounting/chart-of-accounts?tab=mapping")
  await expect(page.getByTestId("account-mapping")).toContainText("112 · Tiền gửi ngân hàng")
  await expect(page.getByTestId("account-mapping").getByRole("combobox")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Lưu" })).toHaveCount(0)
})

test("ACC-070 cột như màn tham chiếu: MST + người dùng liên kết, người duyệt, tài khoản cha + lọc Nợ/Có, tìm tài khoản ngân hàng", async ({ page }) => {
  await mockLoggedIn(page, { permissions: [...ALL, "IAM_USER_VIEW"] })
  await mockApi(page, "/v1/iam/users", { body: pageOf([{ id: "58", username: "e2e.client", fullName: "E2E Client", roles: ["CLIENT"] }, { id: "7", username: "e2e.boss", fullName: "E2E Kế toán trưởng" }]) })
  const banks = await mockApi(page, "/v1/accounting/bank-accounts", { method: "GET", body: pageOf(BANKS) })
  const coa = await mockApi(page, "/v1/accounting/chart-of-accounts", {
    method: "GET",
    body: pageOf([...ACCOUNTS, { id: "210", code: "1111", name: "E2E Tiền mặt VND", accountTypeId: "33", normalBalance: "DEBIT", active: true, parentId: "209" }]),
  })
  await mockApi(page, "/v1/accounting/account-types", { body: pageOf([{ id: "33", category: "ASSETS", code: "CA", name: "E2E Current assets", normalBalance: "DEBIT", active: true }]) })
  await mockApi(page, "/v1/accounting/customers", {
    method: "GET",
    body: pageOf([{ id: "5", customerCode: "CUST-0001", companyName: "E2E Ánh Dương", contactPerson: "E2E A", email: "a@example.com", taxNumber: "0312345678", userId: "58" }]),
  })
  await mockApi(page, "/v1/accounting/revenue-categories", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/accounting/revenues", { method: "GET", body: pageOf([{ id: "1", number: "REV-2026-11-001", date: "2026-11-20", bankAccountId: "11", amount: 100000, status: "APPROVED", approvedBy: "7" }]) })

  await page.goto("/accounting/customers")
  const row = page.getByRole("row", { name: /E2E Ánh Dương/ })
  await expect(row).toContainText("0312345678")
  await expect(row).toContainText("E2E Client")

  await page.goto("/accounting/revenues")
  await expect(page.getByRole("columnheader", { name: "Người duyệt" })).toBeVisible()
  await expect(page.getByRole("row", { name: /REV-2026-11-001/ })).toContainText("E2E Kế toán trưởng")

  await page.goto("/accounting/chart-of-accounts")
  await expect(page.getByRole("row", { name: /E2E Tiền mặt VND/ })).toContainText("111")
  await page.getByRole("combobox", { name: "Số dư thông thường" }).click()
  await page.getByRole("option", { name: "Có" }).click()
  await expect.poll(() => coa.requests.at(-1)?.url.searchParams.get("normalBalance")).toBe("CREDIT")
  await expect(page).toHaveURL(/normal=CREDIT/)

  await page.goto("/accounting/banking")
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill("VCB")
  await page.getByRole("button", { name: "Tìm kiếm" }).click()
  await expect.poll(() => banks.requests.at(-1)?.url.searchParams.get("keyword")).toBe("VCB")
})
