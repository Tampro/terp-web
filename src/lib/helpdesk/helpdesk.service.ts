"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Platform helpdesk, companies → platform (manual §3.3). Spec: iam-service HelpdeskController under /v1/helpdesk.
// Company users: HELPDESK_VIEW (their company's tickets, active categories) and HELPDESK_CREATE (open, reply); a new
// company ticket is OPEN / MEDIUM and must not carry a priority (HDK_009). The super admin sees every company, opens a
// ticket for a company (companyId, HDK_008), edits (full replacement: title, description, categoryId, status, priority),
// deletes tickets and messages, posts internal replies (company users get HDK_005), manages categories and reads /stats.
// Replying to a CLOSED ticket fails HDK_004. Attachments are ≤5 media file ids of the ticket's company (HDK_007).
// Title / description / message are stored as given (no sanitising, HelpdeskService), so the UI sends escaped
// paragraphs and shows them as text. Every field optional.

export const HD_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
export const HD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

export interface HdCategory {
  id?: string
  name?: string
  description?: string | null
  color?: string
  active?: boolean
  [k: string]: unknown
}
export interface HdTicketRow {
  id?: string
  ticketNumber?: string
  title?: string
  companyId?: string
  companyName?: string
  categoryId?: string | null
  categoryName?: string | null
  categoryColor?: string | null
  status?: string
  priority?: string
  createdDate?: string
  updatedDate?: string
  resolvedAt?: string | null
  [k: string]: unknown
}
export interface HdReply {
  id?: string
  message?: string
  internal?: boolean
  fromPlatform?: boolean
  authorName?: string
  attachmentFileIds?: string[]
  createdDate?: string
}
export interface HdTicketDetail {
  ticket?: HdTicketRow
  description?: string
  replies?: HdReply[]
}
export interface HdStats {
  year?: number
  months?: { month?: number; created?: number; resolved?: number }[]
  byStatus?: Record<string, number>
  total?: number
}

const B = "/v1/helpdesk"
type Q = Record<string, string | number | boolean | undefined>

export const HelpdeskService = {
  tickets: (q: Q = {}) => request<IPage<HdTicketRow>>(withQuery(`${B}/tickets`, q)),
  statusCounts: () => request<Record<string, number>>(`${B}/tickets/status-counts`),
  ticket: (id: string) => request<HdTicketDetail>(`${B}/tickets/${id}`),
  create: (body: unknown) => request<HdTicketDetail>(`${B}/tickets`, { method: "POST", body }),
  update: (id: string, body: unknown) => request<HdTicketDetail>(`${B}/tickets/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`${B}/tickets/${id}`, { method: "DELETE" }),
  reply: (id: string, body: { message: string; attachmentFileIds?: number[]; internal?: boolean }) => request<HdReply>(`${B}/tickets/${id}/replies`, { method: "POST", body }),
  removeReply: (id: string, replyId: string) => request<void>(`${B}/tickets/${id}/replies/${replyId}`, { method: "DELETE" }),
  categories: () => request<HdCategory[]>(`${B}/categories`),
  saveCategory: (id: string | undefined, body: unknown) => request<HdCategory>(id ? `${B}/categories/${id}` : `${B}/categories`, { method: id ? "PUT" : "POST", body }),
  removeCategory: (id: string) => request<void>(`${B}/categories/${id}`, { method: "DELETE" }),
  stats: (year?: number) => request<HdStats>(withQuery(`${B}/stats`, { year })),
}

/** Plain text → HTML paragraphs with every special character escaped (the backend keeps HTML as given). */
export function textToHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
  return text
    .trim()
    .split(/\n/)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("")
}
