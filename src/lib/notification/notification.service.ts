"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Notification delivery log. Spec: notification-service DeliveryController /v1/notifications/deliveries
// (NOTIFICATION_LOG_VIEW): list newest first, filters companyId (super admin only, required for them: NTF_001), status,
// channel, eventType, from (inclusive) / to (exclusive) ISO instants; GET /{id} (NTF_002 outside the caller's company);
// POST /{id}/retry (NOTIFICATION_LOG_MANAGE, FAILED only: NTF_003) answers the outcome. Every field optional.

export const DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const
export const DELIVERY_CHANNELS = ["EMAIL", "SLACK", "TELEGRAM", "WEBHOOK", "SMS"] as const

export interface Delivery {
  id?: string
  companyId?: string
  eventId?: string
  eventType?: string
  channel?: string
  target?: string | null
  status?: string
  attempts?: number
  /** last failure or skip reason: SMTP_ERROR, HTTP_500, URL_REFUSED, EMAIL_DISABLED, NO_RECIPIENT… */
  lastErrorCode?: string | null
  nextAttemptAt?: string | null
  sentAt?: string | null
  createdDate?: string
  updatedDate?: string | null
  [k: string]: unknown
}
const B = "/v1/notifications/deliveries"

export const NotificationLogService = {
  list: (q: Record<string, string | number | boolean | undefined>) => request<IPage<Delivery>>(withQuery(B, q)),
  get: (id: string) => request<Delivery>(`${B}/${id}`),
  retry: (id: string) => request<Delivery>(`${B}/${id}/retry`, { method: "POST" }),
}

/** a local calendar day → the instant it starts (from inclusive) or the next day starts (to exclusive) */
export function dayStart(day: string, next = false) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d + (next ? 1 : 0)).toISOString()
}
