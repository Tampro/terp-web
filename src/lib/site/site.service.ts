"use client"

import { request, withQuery, type IPage } from "@/lib/api"
import type { PlanDto } from "@/lib/saas/saas.service"

// Public website CMS (manual §3.4). Spec: iam-service SiteAdminController /v1/settings/admin/site (super admin) and
// PublicSiteController /v1/public/site (no token).
// Landing: GET /landing → {key: JSON | null} for SECTION_KEYS; PUT /landing/{key} = full replacement of one section's
// JSON object (≤64 KB, SITE_002; unknown key SITE_001). The backend does not define the sections' shape ("the FE's JSON
// document"): the shapes below are this app's Proposal. order = {items:[{key, enabled}]}; general/order/advanced are
// settings, not displayed blocks. advanced.customJs is published only when the operator sets ERP_LANDING_CUSTOM_JS.
// Public /landing is 404 SITE_003 while System Settings → Landing Page is off.
// Pages: slug is derived from the title by the backend (not editable; a new title gives a new slug), content HTML is
// sanitized server side (jsoup relaxed), `published` false = draft, deletion is permanent (no protected pages).
// Inquiries: statuses below, reply = plain-text email via the platform SMTP (SETTINGS_003 / SITE_008), NEW → CONTACTED.
// Newsletter: email + subscribed date + unsubscribe link only (no IP / location / device in the backend).

export const SECTION_KEYS = ["general", "order", "advanced", "header", "hero", "footer", "features", "screenshots", "whyUs", "about", "team", "reviews", "plans", "faq", "newsletter", "contact"] as const
export type SectionKey = (typeof SECTION_KEYS)[number]
/** the blocks a visitor sees, in this app's default order (footer last; the backend's own default lists it third) */
export const DISPLAY_KEYS = [...SECTION_KEYS.filter((k) => k !== "general" && k !== "order" && k !== "advanced" && k !== "footer"), "footer" as const]
export const INQUIRY_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"] as const

export type SectionContent = Record<string, unknown>
export type Landing = Partial<Record<SectionKey, SectionContent | null>>

export interface PublicLanding {
  order?: string[]
  sections?: Landing
  plans?: PlanDto[]
  pages?: { title?: string; slug?: string; sortOrder?: number }[]
}
export interface SitePage {
  id?: string
  title?: string
  slug?: string
  content?: string
  preview?: string
  metaTitle?: string | null
  metaDescription?: string | null
  sortOrder?: number
  published?: boolean
  createdDate?: string
  updatedDate?: string
  [k: string]: unknown
}
export interface Inquiry {
  id?: string
  name?: string
  email?: string
  phone?: string | null
  subject?: string
  message?: string
  status?: string
  createdDate?: string
  lastRepliedAt?: string | null
  [k: string]: unknown
}
export interface Subscriber {
  id?: string
  email?: string
  subscribedDate?: string
  unsubscribeUrl?: string
  [k: string]: unknown
}
type Q = Record<string, string | number | boolean | undefined>
const A = "/v1/settings/admin/site"

export const SiteService = {
  landing: () => request<Landing>(`${A}/landing`),
  saveSection: (key: SectionKey, content: SectionContent) => request<SectionContent>(`${A}/landing/${key}`, { method: "PUT", body: content }),
  pages: (q: Q) => request<IPage<SitePage>>(withQuery(`${A}/pages`, q)),
  page: (id: string) => request<SitePage>(`${A}/pages/${id}`),
  savePage: (id: string | undefined, body: Record<string, unknown>) =>
    request<SitePage>(id ? `${A}/pages/${id}` : `${A}/pages`, { method: id ? "PUT" : "POST", body }),
  removePage: (id: string) => request<void>(`${A}/pages/${id}`, { method: "DELETE" }),
  inquiries: (q: Q) => request<IPage<Inquiry>>(withQuery(`${A}/inquiries`, q)),
  setInquiryStatus: (id: string, status: string) => request<Inquiry>(`${A}/inquiries/${id}/status`, { method: "PUT", body: { status } }),
  replyInquiry: (id: string, body: { subject: string; message: string }) => request<Inquiry>(`${A}/inquiries/${id}/reply`, { method: "POST", body }),
  removeInquiry: (id: string) => request<void>(`${A}/inquiries/${id}`, { method: "DELETE" }),
  subscribers: (q: Q) => request<IPage<Subscriber>>(withQuery(`${A}/newsletter`, q)),
  removeSubscriber: (id: string) => request<void>(`${A}/newsletter/${id}`, { method: "DELETE" }),
  /** every subscriber (pages of 200) for the CSV export */
  async allSubscribers() {
    const all: Subscriber[] = []
    for (let page = 0; page < 100; page++) {
      const p = await SiteService.subscribers({ page, size: 200 })
      all.push(...(p.content ?? []))
      if (p.last !== false) break
    }
    return all
  },
  // public, no token
  publicLanding: () => request<PublicLanding>("/v1/public/site/landing", { auth: false }),
  publicPage: (slug: string) => request<SitePage>(`/v1/public/site/pages/${encodeURIComponent(slug)}`, { auth: false }),
  subscribe: (email: string) => request<void>("/v1/public/site/newsletter", { method: "POST", body: { email }, auth: false }),
  contact: (body: { name: string; email: string; phone?: string; subject: string; message: string }) =>
    request<void>("/v1/public/site/contact", { method: "POST", body, auth: false }),
}

/** the display order saved in the order section, completed with blocks it does not list (enabled) */
export function orderItems(order?: SectionContent | null): { key: string; enabled: boolean }[] {
  const saved = Array.isArray(order?.items) ? (order.items as { key?: string; enabled?: boolean }[]) : []
  const known = saved.filter((i) => typeof i.key === "string" && (DISPLAY_KEYS as string[]).includes(i.key)).map((i) => ({ key: i.key as string, enabled: i.enabled !== false }))
  return [...known, ...DISPLAY_KEYS.filter((k) => !known.some((i) => i.key === k)).map((key) => ({ key, enabled: true }))]
}

/** CSV cell: quoted, and a leading = + - @ neutralised (spreadsheet formula injection) */
export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
