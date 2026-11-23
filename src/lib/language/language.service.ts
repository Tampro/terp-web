"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Language management (manual §3.7 System → default language). Spec: iam-service LanguageController
// /v1/settings/admin/languages (super admin) and PublicLanguageController /v1/languages (no token).
// vi / en / ko are system languages (never deleted, IAM_028); the default language can't be disabled or deleted
// (IAM_029). A new language starts as a copy of the default language's labels. Labels: GET = every key of the default
// language with this language's own text (translated=false: the default text is shown); PUT = {key: text} of existing
// keys ("" removes the own text); import = {key: text}, 1..10000 keys, adds new keys (IAM_030 for a bad key/text).
// The app's own texts live in src/locales (vi/en/ko); other languages are loaded at runtime from
// GET /v1/languages/{code}/labels (see lib/i18n.ts). Every field optional.

export const SYSTEM_LANGS = ["vi", "en", "ko"]

export interface LanguageDto {
  id?: string
  code?: string
  name?: string
  countryCode?: string | null
  enabled?: boolean
  system?: boolean
  isDefault?: boolean
}
export interface LabelRow {
  key?: string
  value?: string | null
  defaultValue?: string | null
  translated?: boolean
}
const A = "/v1/settings/admin/languages"

export const LanguageService = {
  all: () => request<LanguageDto[]>(A),
  create: (body: { code: string; name: string; countryCode?: string }) => request<LanguageDto>(A, { method: "POST", body }),
  update: (code: string, body: { name: string; countryCode?: string; enabled: boolean }) =>
    request<LanguageDto>(`${A}/${code}`, { method: "PUT", body }),
  remove: (code: string) => request<void>(`${A}/${code}`, { method: "DELETE" }),
  labels: (code: string, q: { keyword?: string; page?: number; size?: number }) => request<IPage<LabelRow>>(withQuery(`${A}/${code}/labels`, q)),
  saveLabels: (code: string, changes: Record<string, string>) =>
    request<{ added?: number; updated?: number }>(`${A}/${code}/labels`, { method: "PUT", body: changes }),
  importLabels: (code: string, file: Record<string, string>) =>
    request<{ added?: number; updated?: number }>(`${A}/${code}/labels/import`, { method: "POST", body: file }),
  /** public: every key of the default language, in this language where translated */
  published: (code: string) => request<Record<string, string>>(`/v1/languages/${encodeURIComponent(code)}/labels`, { auth: false }),
}

/** flag emoji of an ISO country code (regional indicator letters) */
export function flag(countryCode?: string | null) {
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return ""
  return String.fromCodePoint(...[...countryCode].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}
