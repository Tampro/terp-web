"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// SaaS APIs (IAM: SaasAdminController, CouponController, SubscriptionController; SaasDtos / CouponDtos).
// Every field optional: the backend may return null.

export type EBillingCycle = "MONTHLY" | "YEARLY"
export type EOrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
export type EPaymentMethod = "BANK_TRANSFER" | "STRIPE" | "MANUAL"
export type ECouponType = "PERCENTAGE" | "FLAT"
export type ESubscriptionStatus = "NONE" | "TRIAL" | "ACTIVE" | "EXPIRED"

export interface PlanDto {
  id?: string
  code?: string
  name?: string
  description?: string | null
  monthlyPrice?: number | null
  /** null = no yearly price: yearly orders are refused (SAAS_003) */
  yearlyPrice?: number | null
  /** null = unlimited */
  maxUsers?: number | null
  maxEmployees?: number | null
  /** GB; null = unlimited */
  storageLimitGb?: number | null
  /** 0/null = no trial */
  trialDays?: number | null
  aiIntegration?: boolean
  defaultPlan?: boolean
  enabled?: boolean
  recommended?: boolean
  modules?: string[]
}

export interface PlanForm {
  code: string
  name: string
  description?: string | null
  monthlyPrice: number
  yearlyPrice?: number | null
  maxUsers?: number | null
  maxEmployees?: number | null
  storageLimitGb?: number | null
  trialDays?: number | null
  aiIntegration: boolean
  defaultPlan: boolean
  enabled: boolean
  recommended: boolean
  modules: string[]
}

export interface PlanModuleDto {
  code?: string
  name?: string
  available?: boolean
}

export interface BankTransferDto {
  bankName?: string | null
  accountNumber?: string | null
  accountName?: string | null
  transferContent?: string | null
}

export interface OrderDto {
  id?: string
  orderNumber?: string
  companyId?: string
  planId?: string
  billingCycle?: EBillingCycle
  couponCode?: string | null
  originalPrice?: number | null
  discountAmount?: number | null
  finalPrice?: number | null
  paymentMethod?: EPaymentMethod
  paymentReference?: string | null
  status?: EOrderStatus
  createdDate?: string
  processedAt?: string | null
  notes?: string | null
  bankTransfer?: BankTransferDto | null
  receiptFileId?: string | null
}

export interface AdminOrderDto {
  order?: OrderDto
  companyName?: string | null
  companyEmail?: string | null
  planName?: string | null
}

export interface PlanRequestDto {
  id?: string
  companyId?: string
  companyName?: string | null
  companyEmail?: string | null
  planId?: string
  planName?: string | null
  billingCycle?: EBillingCycle
  message?: string | null
  status?: EOrderStatus
  createdDate?: string
  processedAt?: string | null
  notes?: string | null
  orderId?: string | null
}

export interface StatusCounts {
  all?: number
  pending?: number
  approved?: number
  rejected?: number
  cancelled?: number
}

export interface CouponDto {
  id?: string
  code?: string
  codeGeneration?: "MANUAL" | "AUTO"
  name?: string
  type?: ECouponType
  discountValue?: number
  minimumSpend?: number | null
  maximumSpend?: number | null
  useLimitTotal?: number | null
  useLimitPerCompany?: number | null
  expiryDate?: string | null
  enabled?: boolean
  timesUsed?: number
  createdDate?: string
  description?: string | null
}

export interface CouponForm {
  name: string
  type: ECouponType
  discountValue: number
  codeGeneration: "MANUAL" | "AUTO"
  code?: string
  minimumSpend?: number | null
  maximumSpend?: number | null
  useLimitTotal?: number | null
  useLimitPerCompany?: number | null
  expiryDate?: string | null
  enabled: boolean
  description?: string | null
}

export interface CouponUsageDto {
  orderId?: string
  orderNumber?: string
  companyId?: string
  companyName?: string | null
  companyEmail?: string | null
  orderAmount?: number | null
  discountApplied?: number | null
  finalPrice?: number | null
  status?: EOrderStatus
  usedAt?: string
}

export interface SubscriptionDto {
  status?: ESubscriptionStatus
  plan?: PlanDto | null
  expiresAt?: string | null
  /** the paid/trial plan expired and the default plan applies */
  fallback?: boolean
  usedUsers?: number | null
}

export interface QuoteDto {
  originalPrice?: number
  discountAmount?: number
  finalPrice?: number
  couponCode?: string | null
}

export interface OrderForm {
  planId: number
  billingCycle: EBillingCycle
  couponCode?: string
  paymentMethod: EPaymentMethod
  paymentReference?: string
}

type Paging = { page?: number; size?: number }

// ---------------------------------------------------------------- Super Admin

export const AdminPlanService = {
  list: () => request<PlanDto[]>("/v1/saas/admin/plans"),
  create: (b: PlanForm) => request<PlanDto>("/v1/saas/admin/plans", { method: "POST", body: b }),
  update: (id: string, b: PlanForm) => request<PlanDto>(`/v1/saas/admin/plans/${id}`, { method: "PUT", body: b }),
  setEnabled: (id: string, enabled: boolean) =>
    request<PlanDto>(`/v1/saas/admin/plans/${id}/status`, { method: "PUT", body: { enabled } }),
  remove: (id: string) => request<void>(`/v1/saas/admin/plans/${id}`, { method: "DELETE" }),
}

type OrderFilter = { keyword?: string; dateFrom?: string; dateTo?: string }

export const AdminOrderService = {
  list: (p: OrderFilter & Paging & { status?: EOrderStatus }) =>
    request<IPage<AdminOrderDto>>(withQuery("/v1/saas/admin/orders", { ...p, sort: "id,desc" })),
  counts: (p: OrderFilter) => request<StatusCounts>(withQuery("/v1/saas/admin/orders/status-counts", { ...p })),
  approve: (id: string, notes?: string) =>
    request<OrderDto>(`/v1/saas/admin/orders/${id}/approve`, { method: "POST", body: { notes: notes || undefined } }),
  reject: (id: string, notes?: string) =>
    request<OrderDto>(`/v1/saas/admin/orders/${id}/reject`, { method: "POST", body: { notes: notes || undefined } }),
}

export const AdminPlanRequestService = {
  list: (p: { keyword?: string; status?: EOrderStatus } & Paging) =>
    request<IPage<PlanRequestDto>>(withQuery("/v1/saas/admin/plan-requests", { ...p, sort: "id,desc" })),
  counts: (p: { keyword?: string }) =>
    request<StatusCounts>(withQuery("/v1/saas/admin/plan-requests/status-counts", { ...p })),
  approve: (id: string, notes?: string) =>
    request<PlanRequestDto>(`/v1/saas/admin/plan-requests/${id}/approve`, { method: "POST", body: { notes: notes || undefined } }),
  reject: (id: string, notes?: string) =>
    request<PlanRequestDto>(`/v1/saas/admin/plan-requests/${id}/reject`, { method: "POST", body: { notes: notes || undefined } }),
}

export const CouponService = {
  list: (p: { keyword?: string; type?: ECouponType; active?: boolean } & Paging) =>
    request<IPage<CouponDto>>(withQuery("/v1/saas/admin/coupons", { ...p, sort: "id,desc" })),
  counts: (p: { keyword?: string; type?: ECouponType }) =>
    request<{ all?: number; active?: number; inactive?: number }>(withQuery("/v1/saas/admin/coupons/status-counts", { ...p })),
  detail: (id: string) =>
    request<{ coupon?: CouponDto; usageHistory?: CouponUsageDto[] }>(`/v1/saas/admin/coupons/${id}`),
  create: (b: CouponForm) => request<CouponDto>("/v1/saas/admin/coupons", { method: "POST", body: b }),
  update: (id: string, b: CouponForm) => request<CouponDto>(`/v1/saas/admin/coupons/${id}`, { method: "PUT", body: b }),
  setEnabled: (id: string, enabled: boolean) =>
    request<CouponDto>(`/v1/saas/admin/coupons/${id}/status`, { method: "PUT", body: { enabled } }),
  remove: (id: string) => request<void>(`/v1/saas/admin/coupons/${id}`, { method: "DELETE" }),
}

// ---------------------------------------------------------------- Company

export const SubscriptionService = {
  modules: () => request<PlanModuleDto[]>("/v1/saas/plan-modules"),
  plans: () => request<PlanDto[]>("/v1/saas/plans"),
  current: () => request<SubscriptionDto>("/v1/saas/subscription"),
  startTrial: (planId: string) => request<SubscriptionDto>(`/v1/saas/plans/${planId}/trial`, { method: "POST" }),
  quote: (b: OrderForm) => request<QuoteDto>("/v1/saas/orders/quote", { method: "POST", body: b }),
  order: (b: OrderForm) => request<OrderDto>("/v1/saas/orders", { method: "POST", body: b }),
  orders: (p: Paging) => request<IPage<OrderDto>>(withQuery("/v1/saas/orders", { ...p, sort: "id,desc" })),
  cancelOrder: (id: string) => request<OrderDto>(`/v1/saas/orders/${id}/cancel`, { method: "POST" }),
  /** fileId of a PDF/JPG/PNG (≤5 MB) in the company's media library; null removes it. */
  attachReceipt: (id: string, fileId: number | null) =>
    request<OrderDto>(`/v1/saas/orders/${id}/receipt`, { method: "PUT", body: { fileId } }),
  stripeCheckout: (id: string) =>
    request<{ sessionId?: string; url?: string }>(`/v1/saas/orders/${id}/stripe-checkout`, { method: "POST" }),
  requestPlan: (b: { planId: number; billingCycle: EBillingCycle; message?: string }) =>
    request<PlanRequestDto>("/v1/saas/plan-requests", { method: "POST", body: b }),
  requests: (p: Paging) => request<IPage<PlanRequestDto>>(withQuery("/v1/saas/plan-requests", { ...p, sort: "id,desc" })),
  cancelRequest: (id: string) => request<PlanRequestDto>(`/v1/saas/plan-requests/${id}/cancel`, { method: "POST" }),
}
