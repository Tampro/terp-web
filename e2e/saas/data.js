// @ts-check
/** Fake SaaS data (plans, orders, coupons). Field names follow SaasDtos / CouponDtos. */

export const SAAS_PERMISSIONS = ["SAAS_SUBSCRIPTION_VIEW", "SAAS_ORDER_VIEW", "SAAS_ORDER_CREATE"]

export const MODULES = [
  { code: "HRM", name: "HRM", available: true },
  { code: "ACCOUNTING", name: "Accounting", available: true },
  { code: "CRM", name: "CRM", available: true },
]

export const PLANS = [
  {
    id: "1",
    code: "E2E_FREE",
    name: "E2E Free",
    monthlyPrice: 0,
    yearlyPrice: null,
    maxUsers: null,
    maxEmployees: null,
    storageLimitGb: 15,
    trialDays: 0,
    defaultPlan: true,
    enabled: true,
    recommended: false,
    modules: ["HRM"],
  },
  {
    id: "2",
    code: "E2E_PRO",
    name: "E2E Pro",
    description: "Gói O'Brien thử nghiệm",
    monthlyPrice: 490000,
    yearlyPrice: 4900000,
    maxUsers: 100,
    maxEmployees: 200,
    storageLimitGb: 10,
    trialDays: 14,
    defaultPlan: false,
    enabled: true,
    recommended: true,
    modules: ["HRM", "ACCOUNTING"],
  },
]

export const SUBSCRIPTION = { status: "ACTIVE", plan: PLANS[0], expiresAt: null, fallback: false, usedUsers: 3 }

export const ORDER_PENDING = {
  id: "71",
  orderNumber: "ORD-E2E-0071",
  companyId: "77",
  planId: "2",
  billingCycle: "MONTHLY",
  couponCode: "E2E10",
  originalPrice: 490000,
  discountAmount: 49000,
  finalPrice: 441000,
  paymentMethod: "BANK_TRANSFER",
  status: "PENDING",
  createdDate: "2026-11-20T03:00:00Z",
  bankTransfer: { bankName: "E2E Bank", accountNumber: "0123456789", accountName: "CONG TY E2E", transferContent: "ORD-E2E-0071" },
  receiptFileId: "900",
}

export const ORDER_APPROVED = {
  ...ORDER_PENDING,
  id: "70",
  orderNumber: "ORD-E2E-0070",
  couponCode: null,
  discountAmount: 0,
  finalPrice: 490000,
  status: "APPROVED",
  receiptFileId: null,
}

export const ADMIN_ORDERS = [
  { order: ORDER_PENDING, companyName: "E2E Acme Co., Ltd", companyEmail: "contact@acme.example", planName: "E2E Pro" },
  { order: ORDER_APPROVED, companyName: "E2E Acme Co., Ltd", companyEmail: "contact@acme.example", planName: "E2E Pro" },
]

export const ORDER_COUNTS = { all: 2, pending: 1, approved: 1, rejected: 0, cancelled: 0 }

export const COUPONS = [
  {
    id: "5",
    code: "E2E10",
    codeGeneration: "MANUAL",
    name: "E2E 10%",
    type: "PERCENTAGE",
    discountValue: 10,
    minimumSpend: null,
    maximumSpend: null,
    useLimitTotal: 100,
    useLimitPerCompany: 1,
    expiryDate: null,
    enabled: true,
    timesUsed: 1,
  },
]

export const PLAN_REQUESTS = [
  {
    id: "31",
    companyId: "77",
    companyName: "E2E Acme Co., Ltd",
    companyEmail: "contact@acme.example",
    planId: "2",
    planName: "E2E Pro",
    billingCycle: "YEARLY",
    message: "Xin nâng cấp",
    status: "PENDING",
    createdDate: "2026-11-21T03:00:00Z",
  },
]
