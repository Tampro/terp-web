"use client"

import { request, withQuery } from "@/lib/api"

// Timesheets (manual §11.5). Spec: attendance-service TimesheetController / TimesheetDtos (EntryForm, EntryDto, Month,
// MonthRow, DayCell). An entry is hours (0..24) + minutes (0..59), 15 minutes to 24 hours in all (ATT_053, ATT_031);
// only pending or rejected entries are edited. ATTENDANCE_VIEW / ATTENDANCE_MANAGE.

export type ETimeEntryType = "CLOCK_IN_OUT" | "PROJECT" | "MANUAL"
export type EEntryStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface DayCell {
  date?: string
  hours?: number
  entries?: number
  status?: EEntryStatus | null
}
export interface MonthRow {
  employeeId?: string
  fullName?: string
  designation?: string | null
  days?: DayCell[]
  total?: number
}
export interface TimesheetMonth {
  year?: number
  month?: number
  from?: string
  to?: string
  rows?: MonthRow[]
  dayTotals?: number[]
  total?: number
  counts?: { all?: number; pending?: number; approved?: number; rejected?: number }
  page?: number
  size?: number
  totalElements?: number
}
export interface TimeEntryDto {
  id?: string
  employeeId?: string
  date?: string
  hours?: number
  type?: ETimeEntryType
  project?: string | null
  description?: string
  status?: EEntryStatus
  managerComments?: string | null
}
export interface TimeEntryForm {
  employeeId: number
  date: string
  hours: number
  minutes?: number
  type: ETimeEntryType
  project?: string | null
  description: string
}

export const TimesheetService = {
  month: (f: { year: number; month: number; employeeId?: string; keyword?: string; status?: string; page?: number; size?: number }) =>
    request<TimesheetMonth>(withQuery("/v1/attendance/timesheets/month", { ...f })),
  /** every entry of one employee's day */
  entries: (employeeId: string, date: string) => request<TimeEntryDto[]>(withQuery("/v1/attendance/timesheets/entries", { employeeId, date })),
  create: (body: TimeEntryForm) => request<TimeEntryDto>("/v1/attendance/timesheets/entries", { method: "POST", body }),
  update: (id: string, body: TimeEntryForm) => request<TimeEntryDto>(`/v1/attendance/timesheets/entries/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/attendance/timesheets/entries/${id}`, { method: "DELETE" }),
  approve: (id: string, comments?: string) => request<TimeEntryDto>(`/v1/attendance/timesheets/entries/${id}/approve`, { method: "PUT", body: { comments } }),
  reject: (id: string, comments?: string) => request<TimeEntryDto>(`/v1/attendance/timesheets/entries/${id}/reject`, { method: "PUT", body: { comments } }),
}
