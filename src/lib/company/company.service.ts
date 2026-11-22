"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Company system settings (manual §19). Spec: iam-service — roles (IAM_ROLE_*; GET /iam/roles is an array), permissions
// (IAM_PERMISSION_VIEW), users (IAM_USER_VIEW / CREATE / UPDATE), login history (company users see their company),
// /settings/company/{profile,system,brand,currency,email} (IAM_SETTINGS_MANAGE; each PUT a full replacement; an empty
// value falls back to the platform setting), /settings/email-notifications (NOTIFICATION_SETTINGS_UPDATE),
// /settings/integrations (slack, telegram, twilio, ai-assistant, google-calendar; secrets are write-only: omitted =
// keep), /settings/webhooks (+ /events, /{id}/test). Every field optional.

const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })

export interface RoleDto {
  id?: string
  code?: string
  name?: string
  description?: string | null
  systemRole?: boolean
  permissions?: string[]
}
export interface PermissionDto {
  code?: string
  module?: string
  description?: string
}
export interface UserDto {
  id?: string
  username?: string
  email?: string
  fullName?: string | null
  mobile?: string | null
  status?: "ACTIVE" | "LOCKED"
  roles?: string[]
  createdDate?: string
}
export interface LoginDto {
  id?: string
  username?: string
  ipAddress?: string
  browser?: string
  os?: string
  loginAt?: string
}

export const AccessService = {
  roles: () => request<RoleDto[]>(withQuery("/v1/iam/roles", { size: 200 })),
  saveRole: (id: string | undefined, body: { code: string; name: string; description?: string; permissions: string[] }) =>
    id ? put<RoleDto>(`/v1/iam/roles/${id}`, body) : post<RoleDto>("/v1/iam/roles", body),
  removeRole: (id: string) => del(`/v1/iam/roles/${id}`),
  permissions: () => request<PermissionDto[]>("/v1/iam/permissions"),
  users: (q: { keyword?: string; roleId?: string; page?: number; size?: number }) => request<IPage<UserDto>>(withQuery("/v1/iam/users", q)),
  createUser: (body: { username: string; email: string; fullName: string; roleIds: number[]; password?: string }) => post<UserDto>("/v1/iam/users", body),
  updateUser: (id: string, body: { fullName: string; email: string }) => put<UserDto>(`/v1/iam/users/${id}`, body),
  userStatus: (id: string, status: "ACTIVE" | "LOCKED") => put<UserDto>(`/v1/iam/users/${id}/status`, { status }),
  userRoles: (id: string, roleIds: number[]) => put<UserDto>(`/v1/iam/users/${id}/roles`, { roleIds }),
  userPassword: (id: string, newPassword: string) => put<unknown>(`/v1/iam/users/${id}/password`, { newPassword }),
  removeUser: (id: string) => del(`/v1/iam/users/${id}`),
  logins: (q: { keyword?: string; page?: number; size?: number }) => request<IPage<LoginDto>>(withQuery("/v1/iam/login-history", q)),
  removeLogin: (id: string) => del(`/v1/iam/login-history/${id}`),
}

export interface CompanyProfile {
  accountName?: string
  name?: string | null
  registrationNumber?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  phone?: string | null
  email?: string | null
  senderName?: string | null
  taxNumberEnabled?: boolean
  taxType?: "VAT" | "GST"
  taxNumber?: string | null
}
export interface CompanySystem {
  defaultLanguage?: string | null
  dateFormat?: string | null
  timeFormat?: string | null
  calendarStartDay?: string | null
  defaultTimezone?: string | null
}
export interface CompanyBrand {
  logoDarkUrl?: string | null
  logoLightUrl?: string | null
  faviconUrl?: string | null
  titleText?: string | null
  footerText?: string | null
  themeColor?: string | null
  sidebarVariant?: string | null
  sidebarStyle?: string | null
  layoutDirection?: string | null
  themeMode?: string | null
  companyMobile?: string | null
  companyAddress?: string | null
}
export interface CompanyCurrency {
  currencyCode?: string | null
  decimalPlaces?: number | null
  symbolPosition?: string | null
  decimalSeparator?: string | null
  thousandsSeparator?: string | null
  showDecimals?: boolean | null
  addSpace?: boolean | null
}
export interface CompanyEmail {
  configured?: boolean
  enabled?: boolean
  host?: string | null
  port?: number | null
  username?: string | null
  passwordSet?: boolean
  encryption?: "NONE" | "SSL" | "TLS"
  fromAddress?: string | null
  fromName?: string | null
  usingPlatform?: boolean
}
export interface NotificationGroup {
  module?: string
  notifications?: { code?: string; name?: string; enabled?: boolean; dispatched?: boolean }[]
}
export interface Integrations {
  slack?: { configured?: boolean; enabled?: boolean; hasWebhookUrl?: boolean }
  telegram?: { configured?: boolean; enabled?: boolean; chatId?: string | null; hasBotToken?: boolean }
  twilio?: { configured?: boolean; enabled?: boolean; accountSid?: string | null; fromNumber?: string | null; hasAuthToken?: boolean }
  aiAssistant?: { configured?: boolean; enabled?: boolean; provider?: string | null; model?: string | null; hasApiKey?: boolean }
  googleCalendar?: { configured?: boolean; enabled?: boolean; calendarId?: string | null; serviceAccountEmail?: string | null; hasServiceAccountJson?: boolean }
}
export type EIntegration = "slack" | "telegram" | "twilio" | "ai-assistant" | "google-calendar"
export interface WebhookDto {
  id?: string
  eventCode?: string
  eventName?: string
  module?: string
  url?: string
  method?: "POST"
  active?: boolean
  hasSecret?: boolean
}

const C = "/v1/settings/company"
export const CompanySettingsService = {
  profile: () => request<CompanyProfile>(`${C}/profile`),
  saveProfile: (b: CompanyProfile) => put<CompanyProfile>(`${C}/profile`, b),
  system: () => request<CompanySystem>(`${C}/system`),
  saveSystem: (b: CompanySystem) => put<CompanySystem>(`${C}/system`, b),
  brand: () => request<CompanyBrand>(`${C}/brand`),
  saveBrand: (b: CompanyBrand) => put<CompanyBrand>(`${C}/brand`, b),
  currency: () => request<CompanyCurrency>(`${C}/currency`),
  saveCurrency: (b: CompanyCurrency) => put<CompanyCurrency>(`${C}/currency`, b),
  email: () => request<CompanyEmail>(`${C}/email`),
  saveEmail: (b: unknown) => put<CompanyEmail>(`${C}/email`, b),
  /** back to the platform SMTP */
  resetEmail: () => del(`${C}/email`),
  testEmail: (to: string) => post<unknown>(`${C}/email/test`, { to }),
  notifications: () => request<NotificationGroup[]>("/v1/settings/email-notifications"),
  toggleNotification: (code: string, enabled: boolean) => put<unknown>(`/v1/settings/email-notifications/${code}`, { enabled }),
  integrations: () => request<Integrations>("/v1/settings/integrations"),
  saveIntegration: (type: EIntegration, body: unknown) => put<unknown>(`/v1/settings/integrations/${type}`, body),
  removeIntegration: (type: EIntegration) => del(`/v1/settings/integrations/${type}`),
  testIntegration: (type: "slack" | "telegram") => post<unknown>(`/v1/settings/integrations/${type}/test`),
  webhooks: (q: { page?: number; size?: number; eventCode?: string }) => request<IPage<WebhookDto>>(withQuery("/v1/settings/webhooks", q)),
  saveWebhook: (id: string | undefined, body: unknown) => (id ? put<WebhookDto>(`/v1/settings/webhooks/${id}`, body) : post<WebhookDto>("/v1/settings/webhooks", body)),
  removeWebhook: (id: string) => del(`/v1/settings/webhooks/${id}`),
  testWebhook: (id: string) => post<unknown>(`/v1/settings/webhooks/${id}/test`),
  events: () => request<{ module?: string; events?: { code?: string; name?: string }[] }[]>("/v1/settings/webhooks/events"),
}
