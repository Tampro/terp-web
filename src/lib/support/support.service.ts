"use client"

import { request, withQuery, type IPage } from "@/lib/api"
import { crud, type Row } from "@/lib/hrm/hrm.service"

// Support & communication (manual §18). Spec: support-service :18096 (no gateway Swagger; read its /v3/api-docs):
// tickets (SUPPORT_TICKET_VIEW / MANAGE), knowledge base + FAQ (SUPPORT_KB_VIEW / MANAGE; CSV import headers
// `title,description,category,content` and `title,description`, SUP_021), contact messages (SUPPORT_CONTACT_VIEW / MANAGE),
// portal settings, pages, ticket categories and custom fields (SUPPORT_SETTINGS_MANAGE), messenger (MESSENGER_USE;
// one-to-one inside the company, by IAM user id). Public portal /v1/public/support/{slug}/** without auth. A closed
// ticket takes no replies (SUP_006). Every field optional.

const S = "/v1/support"
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })

export const TICKET_STATUSES = ["IN_PROGRESS", "ON_HOLD", "CLOSED"] as const
export const ACCOUNT_TYPES = ["CUSTOM", "STAFF", "CLIENT", "VENDOR"] as const
export const FIELD_TYPES = ["TEXT", "TEXTAREA", "EMAIL", "NUMBER", "DATE", "SELECT"] as const

export const SUP = {
  tickets: crud(`${S}/tickets`),
  categories: crud(`${S}/ticket-categories`),
  fields: crud(`${S}/ticket-fields`),
  pages: crud(`${S}/portal/pages`),
  kb: crud(`${S}/kb`),
  kbCategories: crud(`${S}/kb-categories`),
  faqs: crud(`${S}/faqs`),
  contacts: crud(`${S}/contacts`),
}

export interface TicketField {
  id?: string
  label?: string
  placeholder?: string | null
  type?: (typeof FIELD_TYPES)[number]
  options?: string[]
  required?: boolean
  width?: number
  order?: number
  active?: boolean
}
export interface Reply {
  id?: string
  senderType?: "STAFF" | "CUSTOMER"
  senderName?: string
  description?: string
  attachments?: { fileId?: string; name?: string }[]
  createdDate?: string
}
export interface TicketDetail {
  ticket?: Row & { ticketNumber?: string; subject?: string; status?: string; name?: string; email?: string; categoryName?: string; accountType?: string; fromPortal?: boolean; createdDate?: string }
  description?: string
  attachments?: { fileId?: string; name?: string }[]
  note?: string | null
  replies?: Reply[]
  customFields?: { fieldId?: string; label?: string; value?: string }[]
}
export interface PortalContent {
  titleSections?: Record<"createTicket" | "searchTicket" | "knowledgeBase" | "faq" | "contact", { title?: string; description?: string } | undefined>
  ctaSections?: Record<"knowledgeBase" | "faq", { title?: string; description?: string } | undefined>
  supportInformation?: { responseTime?: string; openingHours?: string; closingHours?: string; phoneSupport?: string; businessHours?: { day?: string; open?: boolean }[] }
  contactInformation?: { address?: string; phone?: string; email?: string; mapEmbedUrl?: string }
  quickLinks?: { title?: string; icon?: string; link?: string; order?: number }[]
}
export interface PortalSettings {
  slug?: string
  enabled?: boolean
  brandName?: string
  logoUrl?: string | null
  faviconUrl?: string | null
  content?: PortalContent | null
  publicPath?: string
}

/** GET /support/tickets/stats: all-time totals, first response, splits, KB / FAQ counts, monthly created / closed of `year` */
export interface TicketStats {
  scope?: string
  year?: number
  total?: number
  open?: number
  closed?: number
  today?: number
  averageFirstResponseMinutes?: number | null
  byStatus?: Record<string, number>
  byCategory?: { categoryId?: string | null; name?: string | null; count?: number }[]
  kbArticles?: number
  faqs?: number
  monthly?: { month?: number; created?: number; closed?: number }[]
}

export const SupportService = {
  /** SUPPORT_TICKET_VIEW (company) or SUPPORT_TICKET_VIEW_OWN (my tickets); tz = IANA zone of "today" and the months */
  stats: (year: number, tz?: string) => request<TicketStats>(withQuery(`${S}/tickets/stats`, { year, tz })),
  ticket: (id: string) => request<TicketDetail>(`${S}/tickets/${id}`),
  statusCounts: () => request<{ all?: number; inProgress?: number; onHold?: number; closed?: number }>(`${S}/tickets/status-counts`),
  setStatus: (id: string, status: string) => put<Row>(`${S}/tickets/${id}/status`, { status }),
  reply: (id: string, body: { description: string; attachmentFileIds?: number[] }) => post<Reply>(`${S}/tickets/${id}/replies`, body),
  categories: () => request<{ id?: string; name?: string; color?: string }[]>(`${S}/ticket-categories`),
  fields: () => request<TicketField[]>(`${S}/ticket-fields`),
  /** KB categories are {id, title} (Swagger shows the ticket CategoryForm {name, color}); `name` is added for selects */
  kbCategories: () => request<{ id?: string; title?: string }[]>(`${S}/kb-categories`).then((l) => l.map((c) => ({ ...c, name: c.title }))),
  importCsv: (kind: "kb" | "faqs", file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    return request<{ rows?: number; created?: number; errors?: { row?: number; message?: string }[] }>(`${S}/${kind}/import`, { method: "POST", body: fd })
  },
  settings: () => request<PortalSettings | null>(`${S}/portal/settings`),
  saveSettings: (body: PortalSettings) => put<PortalSettings>(`${S}/portal/settings`, body),
}

// ------------------------------------------------------------------ messenger

export interface Message {
  id?: string
  fromUserId?: string
  toUserId?: string
  body?: string | null
  attachmentFileId?: string | null
  attachmentName?: string | null
  mine?: boolean
  seen?: boolean
  createdDate?: string
}
export interface Conversation {
  userId?: string
  lastMessage?: Message | null
  unreadCount?: number
  favorite?: boolean
  /** personal pin: pinned conversations are listed first */
  pinned?: boolean
  /** true for 2 minutes after the user's last presence heartbeat */
  online?: boolean
  lastSeenAt?: string | null
}
const M = "/v1/messenger"
export const MessengerService = {
  conversations: () => request<IPage<Conversation>>(withQuery(`${M}/conversations`, { size: 100 })),
  messages: (userId: string) => request<IPage<Message>>(withQuery(`${M}/conversations/${userId}/messages`, { size: 100 })),
  send: (userId: string, body: { body?: string; attachmentFileId?: number }) => post<Message>(`${M}/conversations/${userId}/messages`, body),
  read: (userId: string) => post<{ marked?: number }>(`${M}/conversations/${userId}/read`),
  unread: () => request<{ total?: number }>(`${M}/unread-count`),
  favorites: () => request<{ userId?: string }[]>(`${M}/favorites`),
  favorite: (userId: string, on: boolean) => request<unknown>(`${M}/favorites/${userId}`, { method: on ? "PUT" : "DELETE" }),
  /** pin / unpin my conversation with this user (idempotent, personal) */
  pin: (userId: string, on: boolean) => request<unknown>(`${M}/conversations/${userId}/pin`, { method: on ? "PUT" : "DELETE" }),
  /** heartbeat "I am active in the messenger": about every 60 s while it is open */
  presence: () => request<unknown>(`${M}/presence`, { method: "PUT" }),
  /** colleagues: IAM accounts of the company (IAM_USER_VIEW) */
  users: () => request<IPage<{ id?: string; fullName?: string | null; username?: string; email?: string; status?: string }>>(withQuery("/v1/iam/users", { size: 200 })),
}

// ------------------------------------------------------------------ public support portal (no sign-in)

export interface PortalInfo {
  slug?: string
  brandName?: string
  logoUrl?: string | null
  content?: PortalContent | null
  pages?: { id?: string; title?: string; slug?: string; description?: string; showInFooter?: boolean }[]
  ticketCategories?: { id?: string; name?: string; color?: string }[]
  kbCategories?: { id?: string; title?: string }[]
  ticketFields?: TicketField[]
}
export interface PublicTicket {
  ticketNumber?: string
  name?: string
  subject?: string
  categoryName?: string
  status?: string
  description?: string
  createdDate?: string
  replies?: { senderType?: string; senderName?: string; description?: string; createdDate?: string }[]
  customFields?: { label?: string; value?: string }[]
}
const P = (slug: string) => `/v1/public/support/${encodeURIComponent(slug)}`
const pub = { auth: false } as const
export const SupportPortal = {
  info: (slug: string) => request<PortalInfo>(P(slug), pub),
  page: (slug: string, pageSlug: string) => request<{ page?: { title?: string }; contents?: string }>(`${P(slug)}/pages/${encodeURIComponent(pageSlug)}`, pub),
  kb: (slug: string, q: { keyword?: string; categoryId?: string }) => request<IPage<{ id?: string; title?: string; description?: string; categoryTitle?: string }>>(withQuery(`${P(slug)}/kb`, { ...q, size: 50 }), pub),
  article: (slug: string, id: string) => request<{ article?: { title?: string; description?: string; categoryTitle?: string }; content?: string }>(`${P(slug)}/kb/${id}`, pub),
  faqs: (slug: string, keyword?: string) => request<IPage<{ id?: string; title?: string; description?: string }>>(withQuery(`${P(slug)}/faqs`, { keyword, size: 100 }), pub),
  create: (slug: string, body: unknown) => request<{ ticketNumber?: string; trackingToken?: string; status?: string }>(`${P(slug)}/tickets`, { method: "POST", body, ...pub }),
  track: (slug: string, body: { ticketNumber?: string; email?: string; trackingToken?: string }) => request<PublicTicket>(`${P(slug)}/tickets/track`, { method: "POST", body, ...pub }),
  reply: (slug: string, body: { ticketNumber?: string; email?: string; trackingToken?: string; description: string }) => request<PublicTicket>(`${P(slug)}/tickets/reply`, { method: "POST", body, ...pub }),
  contact: (slug: string, body: { name: string; email: string; subject: string; message: string }) => request<void>(`${P(slug)}/contact`, { method: "POST", body, ...pub }),
}

/** Text of a backend-sanitized HTML fragment (tags dropped, common entities decoded), keeping paragraph breaks. */
export function htmlToText(html?: string | null) {
  return String(html ?? "")
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()
}

// ------------------------------------------------------------------ client portal tickets (PORTAL_CLIENT)

export interface PortalTicketRow {
  id?: string
  ticketNumber?: string
  subject?: string
  categoryName?: string | null
  status?: string
  createdDate?: string
  updatedDate?: string
}
export interface PortalTicket {
  ticket?: PortalTicketRow
  description?: string | null
  attachmentNames?: string[]
  replies?: { senderType?: "STAFF" | "CUSTOMER"; senderName?: string | null; description?: string | null; attachmentNames?: string[]; createdDate?: string }[]
}
const PC = "/v1/portal/client/tickets"
/** tickets I raised (here or on the public portal with my account's email); new ones are account type CLIENT, IN_PROGRESS */
export const PortalTicketService = {
  list: (q: { status?: string; page?: number; size?: number }) => request<IPage<PortalTicketRow>>(withQuery(PC, { ...q })),
  get: (id: string) => request<PortalTicket>(`${PC}/${id}`),
  categories: () => request<{ id?: string; name?: string }[]>(`${PC}/categories`),
  /** active custom ticket fields of my company in display order (same FieldDto as the public portal's ticketFields) */
  fields: () => request<TicketField[]>(`${PC}/fields`),
  /** PortalTicketForm {categoryId, subject ≤255, description (HTML, sanitized), customFields}; name and email are the account's */
  create: (body: { categoryId: number; subject: string; description: string; customFields?: { fieldId: number; value: string }[] }) => post<PortalTicket>(PC, body),
  reply: (id: string, description: string) => post<unknown>(`${PC}/${id}/replies`, { description }),
}
