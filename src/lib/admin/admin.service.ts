"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Super Admin APIs (IAM). Shapes from the backend records (CompanyDtos, AdminDashboardService, LoginHistoryService,
// ImpersonationService, SettingsDtos). Every field optional: the backend may return null.

export type ECompanyStatus = "ACTIVE" | "SUSPENDED"

export interface CompanyDto {
  id?: string
  code?: string
  name?: string
  email?: string
  status?: ECompanyStatus
  subscriptionStatus?: string
  planId?: string | null
  planCode?: string | null
  planName?: string | null
  planExpiresAt?: string | null
  createdDate?: string
  updatedDate?: string
  referralCode?: string | null
}

export interface UserDto {
  id?: string
  companyId?: string
  username?: string
  email?: string
  fullName?: string
  mobile?: string | null
  status?: string
  roles?: string[]
}

export interface CompanyInfoDto {
  company?: CompanyDto
  userCount?: number
  maxUsers?: number | null
  administrators?: UserDto[]
}

export interface CompanyCreatedDto {
  company?: CompanyDto
  admin?: { user?: UserDto; temporaryPassword?: string }
}

export interface StatusCountsDto {
  all?: number
  active?: number
  inactive?: number
}

export interface AdminDashboard {
  totalRevenue?: number
  totalCompanies?: number
  activeCompanies?: number
  activePlans?: number
  totalUsers?: number
  pendingRequests?: number
  monthlyGrowthPercent?: number | null
  recentCompanies?: { id?: string; name?: string; email?: string; createdDate?: string; status?: ECompanyStatus }[]
  topPlans?: { planId?: string; name?: string; subscribers?: number; revenue?: number }[]
  year?: number
  newCompaniesByMonth?: number[]
  revenueByMonth?: number[]
  /** Total Orders card (manual 3.1): APPROVED plan orders */
  totalOrders?: number
  /** Order Payments card: sum of the final price of APPROVED orders */
  orderPayments?: number
}

export type EUserType = "SUPER_ADMIN" | "COMPANY_USER"

export interface LoginDto {
  id?: string
  userId?: string
  companyId?: string | null
  username?: string
  userType?: EUserType
  ipAddress?: string
  browser?: string
  os?: string
  deviceType?: "DESKTOP" | "MOBILE" | "TABLET" | "BOT" | "UNKNOWN"
  language?: string | null
  /** X-Client-Timezone sent at login; null when the client did not send it */
  timezone?: string | null
  roleAtLogin?: string | null
  /** null until the backend has a GeoIP source */
  city?: string | null
  country?: string | null
  isp?: string | null
  userAgent?: string
  loginAt?: string
}

export interface ImpersonationStarted {
  sessionKey?: string
  sessionId?: string
  companyId?: string
  companyName?: string
  expiresAt?: string
}

export interface CompanyListParams {
  keyword?: string
  status?: ECompanyStatus
  createdFrom?: string
  createdTo?: string
  page?: number
  size?: number
}

export const AdminDashboardService = {
  get: (year?: number) => request<AdminDashboard>(withQuery("/v1/saas/admin/dashboard", { year })),
}

export const CompanyService = {
  list: (p: CompanyListParams) => request<IPage<CompanyDto>>(withQuery("/v1/iam/companies", { ...p })),
  statusCounts: (p: Pick<CompanyListParams, "keyword" | "createdFrom" | "createdTo">) =>
    request<StatusCountsDto>(withQuery("/v1/iam/companies/status-counts", { ...p })),
  info: (id: string) => request<CompanyInfoDto>(`/v1/iam/companies/${id}/info`),
  /**
   * Upgrade plan (CompanyController.upgradePlan): the company moves to the plan for one billing cycle from now (or the
   * running period of the same plan is extended); recorded as an APPROVED MANUAL order. SAAS_003 = no yearly price.
   */
  upgradePlan: (id: string, body: { planId: number; billingCycle: "MONTHLY" | "YEARLY" }) =>
    request<unknown>(`/v1/iam/companies/${id}/plan`, { method: "PUT", body }),
  create: (body: {
    code: string
    name: string
    email: string
    enableLogin: boolean
    admin: { username: string; email: string; fullName: string }
  }) => request<CompanyCreatedDto>("/v1/iam/companies", { method: "POST", body }),
  update: (id: string, body: { name: string; email: string }) =>
    request<CompanyDto>(`/v1/iam/companies/${id}`, { method: "PUT", body }),
  setStatus: (id: string, status: ECompanyStatus) =>
    request<CompanyDto>(`/v1/iam/companies/${id}/status`, { method: "PUT", body: { status } }),
  resetPassword: (id: string, newPassword: string, userId?: number) =>
    request<UserDto>(`/v1/iam/companies/${id}/reset-password`, { method: "POST", body: { userId, newPassword } }),
  remove: (id: string) => request<void>(`/v1/iam/companies/${id}`, { method: "DELETE" }),
  startImpersonation: (id: string) =>
    request<ImpersonationStarted>(`/v1/iam/companies/${id}/impersonation`, { method: "POST" }),
  endImpersonation: (sessionKey: string) =>
    request<void>("/v1/iam/impersonation/end", { method: "POST", body: { sessionKey } }),
}

export const LoginHistoryService = {
  /** keyword = username or IP (contains); ipAddress = exact IP; companyId / userType for the super admin */
  list: (p: { companyId?: string; userType?: EUserType; keyword?: string; ipAddress?: string; page?: number; size?: number }) =>
    request<IPage<LoginDto>>(withQuery("/v1/iam/login-history", { ...p })),
  /** IP, browser, OS and the full User-Agent */
  get: (id: string) => request<LoginDto>(`/v1/iam/login-history/${id}`),
  remove: (id: string) => request<void>(`/v1/iam/login-history/${id}`, { method: "DELETE" }),
}

// ---------------------------------------------------------------- Platform settings (/settings/admin/*)

export interface SystemSettings {
  defaultLanguage?: string
  dateFormat?: string
  timeFormat?: string
  calendarStartDay?: string
  defaultTimezone?: string
  emailVerification?: boolean
  landingPage?: boolean
  userRegistration?: boolean
  termsUrl?: string | null
  ipRestriction?: boolean | null
}

export interface BrandSettings {
  logoDarkUrl?: string | null
  logoLightUrl?: string | null
  faviconUrl?: string | null
  titleText?: string | null
  footerText?: string | null
  themeColor?: string | null
  sidebarVariant?: "INSET" | "FLOATING" | "MINIMAL"
  sidebarStyle?: "PLAIN" | "COLORED" | "GRADIENT"
  layoutDirection?: "LTR" | "RTL"
  themeMode?: "LIGHT" | "DARK" | "SYSTEM"
  companyMobile?: string | null
  companyAddress?: string | null
}

export interface CurrencyFormat {
  decimalPlaces?: number
  symbolPosition?: "BEFORE" | "AFTER"
  decimalSeparator?: "DOT" | "COMMA"
  thousandsSeparator?: "DOT" | "COMMA"
  showDecimals?: boolean
  addSpace?: boolean
}
export interface CurrencySettingsView {
  format?: CurrencyFormat
  defaultCurrencyCode?: string
  defaultCurrencySymbol?: string
}

export interface SeoSettings {
  metaKeywords?: string | null
  metaDescription?: string | null
  metaImageUrl?: string | null
}

/** Cookie banner texts and consent logging (SettingsDtos.CookieSettings; PUT = full replacement). */
export interface CookieSettings {
  enableLogging?: boolean
  cookieTitle?: string | null
  cookieDescription?: string | null
  strictlyTitle?: string | null
  strictlyDescription?: string | null
  contactDescription?: string | null
  /** "" or http(s)://… (@Pattern) */
  contactUrl?: string | null
}

/** Bank Transfer details shown with pending plan orders (SettingsDtos.BankTransferSettings, full replacement). */
export interface BankTransferSettings {
  enabled?: boolean
  bankName?: string | null
  accountNumber?: string | null
  accountName?: string | null
  details?: string | null
}

export type StripeMode = "TEST" | "LIVE"
/** Stripe settings as read: secrets are never returned, only whether they are stored. */
export interface StripeSettingsView {
  enabled?: boolean
  mode?: StripeMode
  publishableKey?: string | null
  secretKeySet?: boolean
  webhookSecretSet?: boolean
}
/** secretKey / webhookSecret: omitted = keep the stored one, "" = remove it (write-only). */
export interface StripeSettingsForm {
  enabled: boolean
  mode: StripeMode
  publishableKey: string
  secretKey?: string
  webhookSecret?: string
}

/** Platform email notifications (PlatformEmailNotificationSettings; PUT = full replacement, at most 10 addresses). */
export interface PlatformEmailNotifications {
  /** welcome email with the temporary password (USER_CREATE) for every company */
  newUser?: boolean
  helpdeskTicketCreated?: boolean
  helpdeskTicketReply?: boolean
  /** platform team addresses that receive the helpdesk emails */
  helpdeskNotifyEmails?: string[]
}

export interface EmailSettingsView {
  host?: string | null
  port?: number | null
  username?: string | null
  passwordSet?: boolean
  encryption?: "NONE" | "SSL" | "TLS"
  fromAddress?: string | null
  fromName?: string | null
}

export interface RecaptchaSettingsView {
  enabled?: boolean
  version?: "V2" | "V3"
  siteKey?: string | null
  secretSet?: boolean
}

export interface StorageSettings {
  allowedFileTypes?: string[]
  maxUploadSizeKb?: number
}

const admin = (s: string) => `/v1/settings/admin/${s}`
const put = <T>(s: string, body: unknown) => request<T>(admin(s), { method: "PUT", body })

export const PlatformSettingsService = {
  system: () => request<SystemSettings>(admin("system")),
  saveSystem: (b: SystemSettings) => put<SystemSettings>("system", b),
  brand: () => request<BrandSettings>(admin("brand")),
  saveBrand: (b: BrandSettings) => put<BrandSettings>("brand", b),
  currency: () => request<CurrencySettingsView>(admin("currency")),
  saveCurrency: (b: CurrencyFormat) => put<CurrencySettingsView>("currency", b),
  seo: () => request<SeoSettings>(admin("seo")),
  saveSeo: (b: SeoSettings) => put<SeoSettings>("seo", b),
  cookie: () => request<CookieSettings>(admin("cookie")),
  saveCookie: (b: CookieSettings) => put<CookieSettings>("cookie", b),
  /** Accepted cookies CSV (SiteAdminController): UTC dates, both included, at most 366 days (SITE_007). */
  cookieConsentsCsv: (from: string, to: string) =>
    request<Blob>(withQuery(admin("site/cookie-consents/export"), { from, to }), { as: "blob" }),
  bankTransfer: () => request<BankTransferSettings>(admin("payment/bank-transfer")),
  saveBankTransfer: (b: BankTransferSettings) => put<BankTransferSettings>("payment/bank-transfer", b),
  stripe: () => request<StripeSettingsView>(admin("payment/stripe")),
  /** SETTINGS_010 enabled without all keys, SETTINGS_011 keys not of the mode, SETTINGS_002 no encryption key */
  saveStripe: (b: StripeSettingsForm) => put<StripeSettingsView>("payment/stripe", b),
  email: () => request<EmailSettingsView>(admin("email")),
  /** password: omitted = keep the stored one; "" = remove it (write-only). */
  saveEmail: (b: Omit<EmailSettingsView, "passwordSet"> & { password?: string }) => put<EmailSettingsView>("email", b),
  emailNotifications: () => request<PlatformEmailNotifications>(admin("email-notifications")),
  saveEmailNotifications: (b: Required<PlatformEmailNotifications>) => put<PlatformEmailNotifications>("email-notifications", b),
  testEmail: (to: string) => request<void>(admin("email/test"), { method: "POST", body: { to } }),
  recaptcha: () => request<RecaptchaSettingsView>(admin("recaptcha")),
  /** secret: omitted = keep the stored one (write-only). */
  saveRecaptcha: (b: { enabled: boolean; version: "V2" | "V3"; siteKey?: string; secret?: string }) =>
    put<RecaptchaSettingsView>("recaptcha", b),
  storage: () => request<StorageSettings>(admin("storage")),
  saveStorage: (b: Required<StorageSettings>) => put<StorageSettings>("storage", b),
}
