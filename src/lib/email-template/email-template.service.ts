"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Email templates (manual §3.5), super admin only. Spec: iam-service EmailTemplateController
// /v1/settings/admin/email-templates: list (keyword = name or From Name), GET /{id} (template, contents per language —
// missing languages absent —, variables), PUT /{id}/settings {fromName ≤100}, PUT /{id}/content/{lang} {subject ≤255,
// content ≤60000 HTML} for vi/en/ko (EMAIL_002 otherwise), GET /{id}/preview/{lang} = stored text rendered with
// [variable] sample values (EMAIL_002 when that language has no text). No create / delete. Placeholders are {name};
// values are HTML-escaped by the backend when sent. The body HTML is stored as given (admin-authored), so the preview
// is shown in a sandboxed iframe without scripts. Every field optional.

export const TEMPLATE_LANGS = ["vi", "en", "ko"] as const

export interface EmailTemplateRow {
  id?: string
  code?: string
  name?: string
  fromName?: string
  createdDate?: string
  updatedDate?: string | null
  [k: string]: unknown
}
export interface TemplateContent {
  lang?: string
  subject?: string
  content?: string
  updatedDate?: string | null
}
export interface EmailTemplateDetail {
  template?: EmailTemplateRow
  contents?: TemplateContent[]
  variables?: string[]
  toggleableByCompany?: boolean
}
export interface RenderedEmail {
  fromName?: string
  subject?: string
  html?: string
}
const B = "/v1/settings/admin/email-templates"

export const EmailTemplateService = {
  list: (q: Record<string, string | number | boolean | undefined>) => request<IPage<EmailTemplateRow>>(withQuery(B, q)),
  get: (id: string) => request<EmailTemplateDetail>(`${B}/${id}`),
  saveFromName: (id: string, fromName: string) => request<EmailTemplateDetail>(`${B}/${id}/settings`, { method: "PUT", body: { fromName } }),
  saveContent: (id: string, lang: string, body: { subject: string; content: string }) =>
    request<EmailTemplateDetail>(`${B}/${id}/content/${lang}`, { method: "PUT", body }),
  preview: (id: string, lang: string) => request<RenderedEmail>(`${B}/${id}/preview/${lang}`),
}
