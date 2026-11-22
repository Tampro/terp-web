"use client"

import { request, withQuery } from "@/lib/api"

// Unified calendar (manual §11.3). Spec: report-service ReportController GET /reports/calendar?from&to&kinds (≤ 62 days,
// REP_001; to ≥ from, REP_002), CalendarService.Event / CalendarView. Each kind is read with the caller's token; kinds
// the caller may not see come back in `unavailable`.

export const CALENDAR_KINDS = [
  "SALES_INVOICE",
  "PURCHASE_INVOICE",
  "EVENT",
  "HOLIDAY",
  "LEAVE",
  "DEAL_TASK",
  "LEAD_TASK",
  "CONTRACT_END",
  "PROJECT_TASK",
  "ZOOM_MEETING",
  "MEETING",
  "INTERVIEW",
  "BIRTHDAY",
] as const
export type EKind = (typeof CALENDAR_KINDS)[number]

export interface CalendarEntry {
  kind?: EKind
  id?: string
  title?: string
  start?: string
  end?: string
  startTime?: string | null
  endTime?: string | null
  allDay?: boolean
  status?: string | null
}
export interface UnifiedCalendar {
  from?: string
  to?: string
  today?: string
  events?: CalendarEntry[]
  unavailable?: Partial<Record<EKind, string>>
  counts?: Partial<Record<EKind, number>>
  total?: number
}

export const CalendarService = {
  /** kinds empty = every kind */
  get: (from: string, to: string, kinds: EKind[]) =>
    request<UnifiedCalendar>(withQuery("/v1/reports/calendar", { from, to, kinds: kinds.length ? kinds.join(",") : undefined })),
}
