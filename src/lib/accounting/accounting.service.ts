"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Accounting (manual §12). Spec: accounting-service CustomerController, VendorController, IncomeControllers (revenues,
// expenses, categories), BankControllers (accounts, transactions, transfers), PaymentControllers (customer / vendor
// payments, open items), NoteControllers (credit / debit notes), ReportController, CoaControllers (accounts, types).
// Swagger shows the budget AllocationForm for payments: a payment allocation is {invoiceId, amount}, a note use
// {noteId, amount} (PaymentService). Errors ACC_*. Every field optional.

export type EPartyKind = "customers" | "vendors"
export type EVoucherKind = "revenues" | "expenses"
export type EPaymentKind = "customer-payments" | "vendor-payments"
export type ENoteKind = "credit-notes" | "debit-notes"
export type EVoucherStatus = "DRAFT" | "APPROVED" | "POSTED"
export type EPaymentStatus = "PENDING" | "CLEARED" | "CANCELLED"
export type ENoteStatus = "DRAFT" | "APPROVED" | "PARTIAL" | "APPLIED"
export type EBankAccountType = "CHECKING" | "SAVINGS" | "CREDIT" | "LOAN"
export type ECategory = "ASSETS" | "LIABILITIES" | "EQUITY" | "REVENUE" | "EXPENSES"
export type ENormal = "DEBIT" | "CREDIT"

export interface AddressDto {
  name?: string | null
  address?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zip?: string | null
}
export interface PartyDto {
  id?: string
  /** CUST-0001 / VEN-0001 */
  customerCode?: string
  vendorCode?: string
  companyName?: string
  contactPerson?: string
  email?: string
  mobile?: string | null
  taxNumber?: string | null
  paymentTerms?: string | null
  /** linked Client / Vendor role user (ACC_003 / ACC_005 when taken) */
  userId?: string | null
  billing?: AddressDto | null
  shippingSameAsBilling?: boolean
  shipping?: AddressDto | null
  notes?: string | null
}
export interface PartyForm {
  companyName: string
  contactPerson: string
  email: string
  mobile?: string | null
  taxNumber?: string | null
  paymentTerms?: string | null
  userId?: number | null
  billing?: AddressDto
  shippingSameAsBilling: boolean
  shipping?: AddressDto
  notes?: string | null
}
export interface DocLine {
  id?: string
  number?: string
  date?: string
  amount?: number
  status?: string
}
export interface PartyReport {
  code?: string
  name?: string
  from?: string
  to?: string
  invoiced?: number
  returns?: number
  notes?: number
  payments?: number
  balance?: number
  invoices?: DocLine[]
  returnDocs?: DocLine[]
  noteDocs?: DocLine[]
  paymentDocs?: DocLine[]
}

export interface VoucherDto {
  id?: string
  /** REV-/EXP-YYYY-MM-NNN */
  number?: string
  date?: string
  categoryId?: string
  bankAccountId?: string
  accountId?: string | null
  amount?: number
  reference?: string | null
  description?: string | null
  status?: EVoucherStatus
  approvedBy?: string | null
}
export interface VoucherForm {
  date?: string | null
  categoryId: number
  bankAccountId: number
  /** omit = the category's GL account */
  accountId?: number | null
  amount: number
  reference?: string | null
  description?: string | null
}
export interface CategoryDto {
  id?: string
  code?: string
  name?: string
  glAccountId?: string
  description?: string | null
  enabled?: boolean
}
export interface CategoryForm {
  name: string
  code: string
  glAccountId: number
  description?: string | null
  enabled: boolean
}

export interface BankAccountDto {
  id?: string
  holderName?: string
  bankName?: string
  accountNumber?: string
  openingBalance?: number
  balance?: number
  active?: boolean
  branch?: string | null
  accountType?: EBankAccountType | null
  glAccountId?: string | null
  paymentGateway?: string | null
  iban?: string | null
  swift?: string | null
  routingNumber?: string | null
}
export interface BankAccountForm {
  holderName: string
  bankName: string
  accountNumber: string
  openingBalance?: number
  active: boolean
  branch?: string | null
  accountType?: EBankAccountType | null
  glAccountId?: number | null
  paymentGateway?: string | null
  iban?: string | null
  swift?: string | null
  routingNumber?: string | null
}
export interface BankTransactionDto {
  id?: string
  bankAccountId?: string
  type?: "CREDIT" | "DEBIT"
  amount?: number
  transactionDate?: string
  sourceType?: string | null
  reference?: string | null
  runningBalance?: number
  status?: "PENDING" | "CLEARED" | "RECONCILED"
  description?: string | null
}
export interface TransferDto {
  id?: string
  number?: string
  date?: string
  fromAccountId?: string
  toAccountId?: string
  amount?: number
  charges?: number | null
  reference?: string | null
  description?: string | null
  status?: "PENDING" | "COMPLETED"
}
export interface TransferForm {
  date?: string | null
  fromAccountId: number
  toAccountId: number
  amount: number
  charges?: number | null
  reference?: string | null
  description?: string | null
}

export interface OpenInvoice {
  id?: string
  number?: string
  date?: string
  dueDate?: string
  total?: number
  balance?: number
  status?: string
}
export interface NoteDto {
  id?: string
  /** CN-/DN- */
  number?: string
  returnId?: string
  returnNumber?: string
  partyId?: string
  partyName?: string
  noteDate?: string
  total?: number
  taxAmount?: number
  balance?: number
  status?: ENoteStatus
  approvedBy?: string | null
  notes?: string | null
}
export interface PaymentDto {
  id?: string
  /** CP-/VP- */
  number?: string
  paymentDate?: string
  partyId?: string
  partyName?: string
  bankAccountId?: string
  reference?: string | null
  notes?: string | null
  allocatedTotal?: number
  notesTotal?: number
  amount?: number
  status?: EPaymentStatus
  allocations?: { invoiceId?: string; invoiceNumber?: string; amount?: number }[]
  appliedNotes?: { noteId?: string; amount?: number }[]
}
export interface PaymentForm {
  partyId: number
  bankAccountId: number
  paymentDate: string
  reference?: string | null
  notes?: string | null
  /** 1..100; each at most the invoice balance (ACC_054) */
  allocations: { invoiceId: number; amount: number }[]
  /** notes ≤ allocated total (ACC_058) */
  appliedNotes?: { noteId: number; amount: number }[]
}

export interface AccountDto {
  id?: string
  accountTypeId?: string
  code?: string
  name?: string
  normalBalance?: ENormal
  openingBalance?: number
  currentBalance?: number
  active?: boolean
  parentId?: string | null
  description?: string | null
}
export interface AccountForm {
  accountTypeId: number
  code: string
  name: string
  normalBalance?: ENormal
  openingBalance?: number
  active: boolean
  parentId?: number | null
  description?: string | null
}
export interface AccountTypeDto {
  id?: string
  category?: ECategory
  code?: string
  name?: string
  normalBalance?: ENormal
  active?: boolean
}

export interface AgingRow {
  partyId?: string
  partyName?: string
  current?: number
  days1To30?: number
  days31To60?: number
  days61To90?: number
  over90?: number
  total?: number
}
export interface AgingReport {
  asOf?: string
  rows?: AgingRow[]
  totals?: AgingRow
}
export interface TaxSummary {
  outputTax?: number
  creditNoteTax?: number
  netOutputTax?: number
  inputTax?: number
  debitNoteTax?: number
  netInputTax?: number
  netTaxLiability?: number
  salesInvoices?: number
  purchaseInvoices?: number
}
export interface BalanceRow {
  partyId?: string
  code?: string
  name?: string
  openInvoices?: number
  unappliedNotes?: number
  balance?: number
}

const A = "/v1/accounting"
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })
type Paging = { page?: number; size?: number }

export const partyService = (kind: EPartyKind) => ({
  list: (f: { keyword?: string } & Paging) => request<IPage<PartyDto>>(withQuery(`${A}/${kind}`, { ...f })),
  get: (id: string) => request<PartyDto>(`${A}/${kind}/${id}`),
  save: (id: string | undefined, body: PartyForm) => (id ? put<PartyDto>(`${A}/${kind}/${id}`, body) : post<PartyDto>(`${A}/${kind}`, body)),
  remove: (id: string) => del(`${A}/${kind}/${id}`),
  report: (id: string, from: string, to: string) =>
    request<PartyReport>(withQuery(`${A}/reports/${kind}/${id}`, { from, to })),
  reportPdf: (id: string, from: string, to: string) =>
    request<Blob>(withQuery(`${A}/reports/${kind}/${id}/pdf`, { from, to }), { as: "blob" }),
})

export const voucherService = (kind: EVoucherKind) => ({
  list: (f: { categoryId?: string; status?: string; bankAccountId?: string; from?: string; to?: string } & Paging) =>
    request<IPage<VoucherDto>>(withQuery(`${A}/${kind}`, { ...f })),
  save: (id: string | undefined, body: VoucherForm) => (id ? put<VoucherDto>(`${A}/${kind}/${id}`, body) : post<VoucherDto>(`${A}/${kind}`, body)),
  remove: (id: string) => del(`${A}/${kind}/${id}`),
  /** DRAFT → APPROVED (REVENUE_APPROVE / EXPENSE_APPROVE) */
  approve: (id: string) => post<VoucherDto>(`${A}/${kind}/${id}/approve`),
  /** APPROVED → POSTED: journal entry + bank transaction */
  post: (id: string) => post<VoucherDto>(`${A}/${kind}/${id}/post`),
})

export const categoryService = (kind: EVoucherKind) => {
  const base = kind === "revenues" ? `${A}/revenue-categories` : `${A}/expense-categories`
  return {
    list: (f: { enabled?: boolean } & Paging) => request<IPage<CategoryDto>>(withQuery(base, { ...f })),
    save: (id: string | undefined, body: CategoryForm) => (id ? put<CategoryDto>(`${base}/${id}`, body) : post<CategoryDto>(base, body)),
    remove: (id: string) => del(`${base}/${id}`),
  }
}

export const BankService = {
  accounts: (f: { active?: boolean; keyword?: string } & Paging) => request<IPage<BankAccountDto>>(withQuery(`${A}/bank-accounts`, { ...f })),
  saveAccount: (id: string | undefined, body: BankAccountForm) =>
    id ? put<BankAccountDto>(`${A}/bank-accounts/${id}`, body) : post<BankAccountDto>(`${A}/bank-accounts`, body),
  removeAccount: (id: string) => del(`${A}/bank-accounts/${id}`),
  transactions: (id: string, f: Paging) => request<IPage<BankTransactionDto>>(withQuery(`${A}/bank-accounts/${id}/transactions`, { ...f })),
  /** CLEARED → RECONCILED (ACC_023) */
  reconcile: (txId: string) => post<BankTransactionDto>(`${A}/bank-transactions/${txId}/reconcile`),
  transfers: (f: { status?: string; bankAccountId?: string; from?: string; to?: string } & Paging) =>
    request<IPage<TransferDto>>(withQuery(`${A}/bank-transfers`, { ...f })),
  saveTransfer: (id: string | undefined, body: TransferForm) =>
    id ? put<TransferDto>(`${A}/bank-transfers/${id}`, body) : post<TransferDto>(`${A}/bank-transfers`, body),
  removeTransfer: (id: string) => del(`${A}/bank-transfers/${id}`),
  /** PENDING → COMPLETED */
  process: (id: string) => post<TransferDto>(`${A}/bank-transfers/${id}/process`),
}

export const paymentService = (kind: EPaymentKind) => ({
  list: (f: { partyId?: string; status?: string; bankAccountId?: string; from?: string; to?: string } & Paging) =>
    request<IPage<PaymentDto>>(withQuery(`${A}/${kind}`, { ...f })),
  get: (id: string) => request<PaymentDto>(`${A}/${kind}/${id}`),
  /** posted / partly paid invoices with a balance, and approved notes with a balance, of one party */
  openItems: (partyId: string) => request<{ invoices?: OpenInvoice[]; notes?: NoteDto[] }>(withQuery(`${A}/${kind}/open-items`, { partyId })),
  create: (body: PaymentForm) => post<PaymentDto>(`${A}/${kind}`, body),
  remove: (id: string) => del(`${A}/${kind}/${id}`),
  /** PENDING → CLEARED: invoice balances, journal, bank (PAYMENT_CLEAR) */
  clear: (id: string) => post<PaymentDto>(`${A}/${kind}/${id}/clear`),
  cancel: (id: string) => post<PaymentDto>(`${A}/${kind}/${id}/cancel`),
})

export const noteService = (kind: ENoteKind) => ({
  list: (f: { partyId?: string; status?: string; from?: string; to?: string } & Paging) => request<IPage<NoteDto>>(withQuery(`${A}/${kind}`, { ...f })),
  /** from a completed return, once (ACC_063, ACC_064) */
  create: (body: { returnId: number; noteDate?: string | null; notes?: string | null }) => post<NoteDto>(`${A}/${kind}`, body),
  remove: (id: string) => del(`${A}/${kind}/${id}`),
  approve: (id: string) => post<NoteDto>(`${A}/${kind}/${id}/approve`),
})

/** GET /accounting/account-mapping: one row per system key (ESystemAccount) with the account playing it */
export interface MappingDto {
  key?: string
  accountId?: string | null
  accountCode?: string | null
  accountName?: string | null
}

export const CoaService = {
  mapping: () => request<MappingDto[]>(`${A}/account-mapping`),
  /** full replacement: every key → an active account id (ACC_017 otherwise); applies to later postings */
  saveMapping: (accounts: Record<string, number>) => put<MappingDto[]>(`${A}/account-mapping`, { accounts }),
  accounts: (f: { accountTypeId?: string; normalBalance?: string; active?: boolean; keyword?: string } & Paging) =>
    request<IPage<AccountDto>>(withQuery(`${A}/chart-of-accounts`, { ...f })),
  saveAccount: (id: string | undefined, body: AccountForm) =>
    id ? put<AccountDto>(`${A}/chart-of-accounts/${id}`, body) : post<AccountDto>(`${A}/chart-of-accounts`, body),
  /** ACC_013 while in use */
  removeAccount: (id: string) => del(`${A}/chart-of-accounts/${id}`),
  types: (f: { category?: string; active?: boolean } & Paging) => request<IPage<AccountTypeDto>>(withQuery(`${A}/account-types`, { ...f })),
  saveType: (id: string | undefined, body: { category: ECategory; code: string; name: string; normalBalance: ENormal; active: boolean }) =>
    id ? put<AccountTypeDto>(`${A}/account-types/${id}`, body) : post<AccountTypeDto>(`${A}/account-types`, body),
  removeType: (id: string) => del(`${A}/account-types/${id}`),
}

export const AccountingReportService = {
  invoiceAging: (asOf: string) => request<AgingReport>(withQuery(`${A}/reports/invoice-aging`, { asOf })),
  invoiceAgingPdf: (asOf: string) => request<Blob>(withQuery(`${A}/reports/invoice-aging/pdf`, { asOf }), { as: "blob" }),
  billAging: (asOf: string) => request<AgingReport>(withQuery(`${A}/reports/bill-aging`, { asOf })),
  billAgingPdf: (asOf: string) => request<Blob>(withQuery(`${A}/reports/bill-aging/pdf`, { asOf }), { as: "blob" }),
  taxSummary: (from: string, to: string) => request<TaxSummary>(withQuery(`${A}/reports/tax-summary`, { from, to })),
  taxSummaryPdf: (from: string, to: string) => request<Blob>(withQuery(`${A}/reports/tax-summary/pdf`, { from, to }), { as: "blob" }),
  customerBalances: (showZero: boolean) => request<BalanceRow[]>(withQuery(`${A}/reports/customer-balances`, { showZero })),
  vendorBalances: (showZero: boolean) => request<BalanceRow[]>(withQuery(`${A}/reports/vendor-balances`, { showZero })),
  customerBalancesPdf: (showZero: boolean) => request<Blob>(withQuery(`${A}/reports/customer-balances/pdf`, { showZero }), { as: "blob" }),
  vendorBalancesPdf: (showZero: boolean) => request<Blob>(withQuery(`${A}/reports/vendor-balances/pdf`, { showZero }), { as: "blob" }),
}
