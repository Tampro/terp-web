"use client"

import { request, withQuery, type IPage } from "@/lib/api"

import type { ECategory, ENormal } from "./accounting.service"

// Double entry (manual §13). Spec: accounting-service LedgerController (journal entries, LEDGER_VIEW / LEDGER_MANAGE),
// LedgerReportController (/ledger/*, LEDGER_REPORT_VIEW, each with a /pdf twin), BalanceSheetController and
// YearEndCloseController (LEDGER_CLOSE). The list of journal entries carries no lines (GET /{id} does). Only a draft
// manual entry can be edited, deleted or posted (ACC_067/068); debits must equal credits (ACC_018/066); closed years
// reject entries dated in them (ACC_070). Every field optional.

const A = "/v1/accounting"
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })
const pdf = (path: string, q: Record<string, string | number | boolean | undefined>) => request<Blob>(withQuery(`${path}/pdf`, q), { as: "blob" })
type Paging = { page?: number; size?: number }

export type EEntryType = "AUTOMATIC" | "MANUAL"
export type EEntryStatus = "DRAFT" | "POSTED" | "REVERSED"
export const REFERENCE_TYPES = ["GENERAL", "ADJUSTMENT", "ACCRUAL", "DEPRECIATION", "CORRECTION", "OPENING_BALANCE", "REVERSAL", "OTHER"] as const
export type EReferenceType = (typeof REFERENCE_TYPES)[number]

export interface JournalLineDto {
  id?: string
  accountId?: string
  accountCode?: string
  accountName?: string
  description?: string
  debit?: number
  credit?: number
}
export interface JournalEntryDto {
  id?: string
  number?: string
  date?: string
  type?: EEntryType
  reference?: string
  description?: string
  sourceType?: string
  sourceId?: string
  status?: EEntryStatus
  totalDebit?: number
  totalCredit?: number
  lines?: JournalLineDto[] | null
  referenceType?: EReferenceType | null
  reversalOfId?: string | null
  reversedById?: string | null
}
/** ManualForm: description 5..500, reference ≤100, line {accountId, description ≤500, debit, credit}; post = save and post at once. */
export interface ManualForm {
  date: string
  referenceType: EReferenceType
  reference?: string
  description: string
  lines: { accountId: number; description?: string; debit: number; credit: number }[]
  post?: boolean
}

export interface TrialBalanceRow {
  accountId?: string
  code?: string
  name?: string
  category?: ECategory
  openingDebit?: number
  openingCredit?: number
  periodDebit?: number
  periodCredit?: number
  closingDebit?: number
  closingCredit?: number
}
export interface TrialBalance {
  rows?: TrialBalanceRow[]
  totals?: TrialBalanceRow
  balanced?: boolean
  difference?: number
}
export interface AmountGroup {
  typeCode?: string
  typeName?: string
  lines?: { accountId?: string; code?: string; name?: string; amount?: number }[]
  total?: number
}
export interface ProfitLoss {
  revenue?: AmountGroup[]
  totalRevenue?: number
  expenses?: AmountGroup[]
  totalExpenses?: number
  netProfit?: number
}
export interface CashFlowSection {
  activity?: "OPERATING" | "INVESTING" | "FINANCING"
  lines?: { accountId?: string; code?: string; name?: string; inflow?: number; outflow?: number; net?: number }[]
  inflow?: number
  outflow?: number
  net?: number
}
export interface CashFlow {
  cashAccountCodes?: string[]
  openingCash?: number
  sections?: CashFlowSection[]
  netChange?: number
  closingCash?: number
}
export interface LedgerRow {
  entryId?: string
  number?: string
  date?: string
  reference?: string
  description?: string
  sourceType?: string
  debit?: number
  credit?: number
  balance?: number
  counterpartCodes?: string[]
}
export interface GeneralLedger {
  code?: string
  name?: string
  normalBalance?: ENormal
  openingBalance?: number
  totalDebit?: number
  totalCredit?: number
  closingBalance?: number
  lines?: LedgerRow[]
}
export interface AccountBalances {
  rows?: { accountId?: string; code?: string; name?: string; category?: ECategory; normalBalance?: ENormal; balance?: number }[]
}
export interface ExpenseReport {
  categories?: AmountGroup[]
  total?: number
}

export type ESheetSection = "ASSETS" | "LIABILITIES" | "EQUITY"
export interface SheetDto {
  id?: string
  date?: string
  financialYear?: number
  status?: "DRAFT" | "FINALISED"
  notes?: string | null
  totalAssets?: number
  totalLiabilities?: number
  totalEquity?: number
  difference?: number
  balanced?: boolean
  sections?: { section?: ESheetSection; total?: number; groups?: { group?: string; total?: number; lines?: { accountId?: string; accountCode?: string; accountName?: string; amount?: number }[] }[] }[]
  finalisedAt?: string | null
  createdDate?: string
}
export interface CompareLine {
  section?: ESheetSection
  group?: string
  accountCode?: string
  accountName?: string
  first?: number
  second?: number
  change?: number
}
export interface CompareDto {
  first?: SheetDto
  second?: SheetDto
  lines?: CompareLine[]
  totalAssets?: CompareLine
  totalLiabilities?: CompareLine
  totalEquity?: CompareLine
}
export interface CloseDto {
  id?: string
  financialYear?: number
  closingDate?: string
  entryId?: string
  entryNumber?: string
  closedBy?: string
  closedAt?: string
}

export const JournalService = {
  list: (f: { type?: string; status?: string; sourceType?: string; from?: string; to?: string } & Paging) =>
    request<IPage<JournalEntryDto>>(withQuery(`${A}/journal-entries`, { ...f })),
  get: (id: string) => request<JournalEntryDto>(`${A}/journal-entries/${id}`),
  save: (id: string | undefined, body: ManualForm) =>
    id ? put<JournalEntryDto>(`${A}/journal-entries/${id}`, body) : post<JournalEntryDto>(`${A}/journal-entries`, body),
  remove: (id: string) => del(`${A}/journal-entries/${id}`),
  post: (id: string) => post<JournalEntryDto>(`${A}/journal-entries/${id}/post`),
  reverse: (id: string, body: { date?: string; description?: string }) => post<JournalEntryDto>(`${A}/journal-entries/${id}/reverse`, body),
}

const L = `${A}/ledger`
export type ELedgerReport = "trial-balance" | "profit-loss" | "cash-flow" | "general-ledger" | "account-statement" | "account-balances" | "expense-report"
export const LedgerReportService = {
  trialBalance: (from: string, to: string) => request<TrialBalance>(withQuery(`${L}/trial-balance`, { from, to })),
  profitLoss: (from: string, to: string) => request<ProfitLoss>(withQuery(`${L}/profit-loss`, { from, to })),
  cashFlow: (from: string, to: string) => request<CashFlow>(withQuery(`${L}/cash-flow`, { from, to })),
  generalLedger: (accountId: string, from: string, to: string) => request<GeneralLedger>(withQuery(`${L}/general-ledger`, { accountId, from, to })),
  accountStatement: (accountId: string, from: string, to: string) => request<GeneralLedger>(withQuery(`${L}/account-statement`, { accountId, from, to })),
  accountBalances: (asOf: string, hideZero: boolean) => request<AccountBalances>(withQuery(`${L}/account-balances`, { asOf, hideZero })),
  expenseReport: (from: string, to: string) => request<ExpenseReport>(withQuery(`${L}/expense-report`, { from, to })),
  pdf: (report: ELedgerReport, q: { from?: string; to?: string; accountId?: string; asOf?: string; hideZero?: boolean }) => pdf(`${L}/${report}`, q),
}

export const BalanceSheetService = {
  list: (f: { financialYear?: number; status?: string } & Paging) => request<IPage<SheetDto>>(withQuery(`${A}/balance-sheets`, { ...f })),
  get: (id: string) => request<SheetDto>(`${A}/balance-sheets/${id}`),
  generate: (body: { date: string; financialYear: number; notes?: string }) => post<SheetDto>(`${A}/balance-sheets`, body),
  regenerate: (id: string) => post<SheetDto>(`${A}/balance-sheets/${id}/regenerate`),
  notes: (id: string, notes: string) => put<SheetDto>(`${A}/balance-sheets/${id}/notes`, { notes }),
  finalise: (id: string) => post<SheetDto>(`${A}/balance-sheets/${id}/finalise`),
  remove: (id: string) => del(`${A}/balance-sheets/${id}`),
  pdf: (id: string) => request<Blob>(`${A}/balance-sheets/${id}/pdf`, { as: "blob" }),
  compare: (firstId: string, secondId: string) => request<CompareDto>(withQuery(`${A}/balance-sheets/compare`, { firstId, secondId })),
}

export const YearEndService = {
  list: (f: Paging) => request<IPage<CloseDto>>(withQuery(`${A}/year-end-closes`, { ...f })),
  close: (body: { financialYear: number; closingDate: string }) => post<CloseDto>(`${A}/year-end-closes`, body),
}
