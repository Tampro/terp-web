"use client"

import { request, tokenStore, type TokenPair } from "@/lib/api"

// Models follow the IAM Swagger (/docs/iam/v3/api-docs). Every field optional: the backend may return null.
export interface MeDto {
  userId?: string
  username?: string
  companyId?: string
  superAdmin?: boolean
  roles?: string[]
  permissions?: string[]
}

export interface ProfileDto {
  username?: string
  fullName?: string
  email?: string
  mobile?: string | null
  avatarFileId?: string | null
  avatarUrl?: string | null
  superAdmin?: boolean
}

export interface LanguageDto {
  id?: string
  code?: string
  name?: string
  countryCode?: string
  enabled?: boolean
  isDefault?: boolean
}

export interface PublicSettings {
  system?: { defaultLanguage?: string; userRegistration?: boolean; emailVerification?: boolean; termsUrl?: string | null }
  brand?: { logoLightUrl?: string | null; logoDarkUrl?: string | null; titleText?: string; footerText?: string | null }
  recaptcha?: { enabled?: boolean; version?: "V2" | "V3"; siteKey?: string | null }
  currency?: {
    format?: import("@/lib/format").MoneyFormat
    defaultCurrencyCode?: string | null
    defaultCurrencySymbol?: string | null
  }
  payments?: { bankTransfer?: boolean; stripe?: boolean; stripePublishableKey?: string | null }
}

export interface MediaFileDto {
  id?: string
  viewUrl?: string
}

const pub = { auth: false } as const

export const AuthService = {
  async login(body: { username: string; password: string }, remember: boolean) {
    const t = await request<TokenPair>("/v1/auth/login", { method: "POST", body, ...pub })
    tokenStore.set(t, remember)
    return t
  },
  async initialPassword(body: { username: string; currentPassword: string; newPassword: string }, remember: boolean) {
    const t = await request<TokenPair>("/v1/auth/initial-password", { method: "POST", body, ...pub })
    tokenStore.set(t, remember)
    return t
  },
  register: (body: { name: string; email: string; password: string; confirmPassword: string; companyName?: string }) =>
    request<unknown>("/v1/auth/register", { method: "POST", body, ...pub }),
  forgotPassword: (email: string) => request<void>("/v1/auth/forgot-password", { method: "POST", body: { email }, ...pub }),
  resetPassword: (token: string, newPassword: string) =>
    request<void>("/v1/auth/reset-password", { method: "POST", body: { token, newPassword }, ...pub }),
  verifyEmail: (token: string) => request<void>("/v1/auth/verify-email", { method: "POST", body: { token }, ...pub }),
  resendVerification: (email: string) =>
    request<void>("/v1/auth/resend-verification", { method: "POST", body: { email }, ...pub }),
  async logout() {
    const refreshToken = tokenStore.refresh
    try {
      if (refreshToken) await request<void>("/v1/auth/logout", { method: "POST", body: { refreshToken }, ...pub })
    } finally {
      tokenStore.clear() // logout is always 200; clear locally regardless
    }
  },
  me: () => request<MeDto>("/v1/me"),
  getProfile: () => request<ProfileDto>("/v1/me/profile"),
  updateProfile: (body: { fullName: string; email: string; mobile?: string | null; avatarFileId?: number | null }) =>
    request<ProfileDto>("/v1/me/profile", { method: "PUT", body }),
  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<void>("/v1/me/password", { method: "PUT", body }),
  publicSettings: () => request<PublicSettings>("/v1/settings/public", pub),
  languages: () => request<LanguageDto[]>("/v1/languages", pub),
  async uploadImage(file: File) {
    const fd = new FormData()
    fd.append("files", file)
    const files = await request<MediaFileDto[]>("/v1/media/files", { method: "POST", body: fd })
    return files?.[0]
  },
}
