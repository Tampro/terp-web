"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Referral program (SaaS). Spec: iam-service ReferralController.
// Super admin /v1/saas/admin/referral/*: settings (PUT = full replacement; enabled, commissionPercentage 0..100,
// thresholdAmount ≥0, guidelines ≤10000 stored as given → shown as text; a new percentage applies to orders approved from
// now on), dashboard, referred companies (+ summary, commission history per row), payout requests (+ status counts,
// approve / reject only while PENDING: SAAS_031; approve = paid outside the system; reject returns the amount).
// Company /v1/saas/referral (SAAS_ORDER_VIEW): my code, rules and balance; payouts (SAAS_ORDER_CREATE to request:
// SAAS_032 program off, SAAS_029 a pending request exists, SAAS_027 below threshold, SAAS_028 above the balance).
// Amounts are in the platform's default currency. Every field optional.

export const PAYOUT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const

export interface ReferralSettings {
  enabled?: boolean
  commissionPercentage?: number
  thresholdAmount?: number
  guidelines?: string | null
  updatedDate?: string
}
export interface ReferralDashboard {
  totalReferredCompanies?: number
  pendingPayouts?: number
  totalCommissionPaid?: number
  activeReferredCompanies?: number
  topReferrers?: { companyId?: string; companyName?: string; companyEmail?: string; referrals?: number; commissionEarned?: number }[]
  referralSignupsThisYear?: number
  payoutsProcessedThisYear?: number
}
export interface ReferredCompany {
  companyId?: string
  companyName?: string
  companyEmail?: string
  registeredAt?: string
  referrerCompanyId?: string
  referrerName?: string
  planName?: string | null
  planMonthlyPrice?: number | null
  commission?: number
  commissionHistory?: { orderId?: string; orderAmount?: number; commissionPercentage?: number; amount?: number; createdDate?: string }[]
  [k: string]: unknown
}
export interface Payout {
  id?: string
  companyId?: string
  companyName?: string
  companyEmail?: string
  amount?: number
  status?: string
  notes?: string | null
  createdDate?: string
  processedAt?: string | null
  [k: string]: unknown
}
export interface MyReferral {
  referralCode?: string
  programEnabled?: boolean
  commissionPercentage?: number
  thresholdAmount?: number
  guidelines?: string | null
  referredCompanies?: number
  totalEarned?: number
  paidOut?: number
  pendingPayout?: number
  availableBalance?: number
}
type Q = Record<string, string | number | boolean | undefined>
const A = "/v1/saas/admin/referral"

export const ReferralAdminService = {
  settings: () => request<ReferralSettings>(`${A}/settings`),
  saveSettings: (b: { enabled: boolean; commissionPercentage: number; thresholdAmount: number; guidelines?: string }) =>
    request<ReferralSettings>(`${A}/settings`, { method: "PUT", body: b }),
  dashboard: () => request<ReferralDashboard>(`${A}/dashboard`),
  referred: (q: Q) => request<IPage<ReferredCompany>>(withQuery(`${A}/referred`, q)),
  referredSummary: () => request<{ totalReferred?: number; withPlans?: number; totalCommission?: number }>(`${A}/referred/summary`),
  payouts: (q: Q) => request<IPage<Payout>>(withQuery(`${A}/payouts`, q)),
  payoutCounts: (q: Q) => request<{ all?: number; pending?: number; approved?: number; rejected?: number }>(withQuery(`${A}/payouts/status-counts`, q)),
  approve: (id: string) => request<Payout>(`${A}/payouts/${id}/approve`, { method: "POST" }),
  reject: (id: string) => request<Payout>(`${A}/payouts/${id}/reject`, { method: "POST" }),
}

export const ReferralService = {
  mine: () => request<MyReferral>("/v1/saas/referral"),
  payouts: (q: Q) => request<IPage<Payout>>(withQuery("/v1/saas/referral/payouts", q)),
  requestPayout: (amount: number) => request<Payout>("/v1/saas/referral/payouts", { method: "POST", body: { amount } }),
}
