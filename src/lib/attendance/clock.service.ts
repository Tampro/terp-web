"use client"

import { request } from "@/lib/api"

// Self-service clock in / out (manual §5 Staff view: "own attendance with Clock In — once per day, missing clock-out is
// closed at shift end"). Spec: attendance-service ClockController / ClockService (ATTENDANCE_SELF):
// GET /attendance/me/today → TodayDto {date, record, shift, canClockIn, canClockOut}; POST /clock-in, /clock-out with
// ClockForm {notes ≤500} (clock-out notes replace the clock-in ones). Late / early departure / overtime are computed by the
// backend from my shift and attendance policy, at the company's current time. Errors: ATT_054 IP not allowed, ATT_055
// already clocked in, ATT_056 no open clock-in, ATT_060 / EMP_001 no employee profile linked to the account.
// Every field optional.

export interface ClockShift {
  id?: string
  name?: string
  startTime?: string
  endTime?: string
  gracePeriodMinutes?: number
  nightShift?: boolean
}
export interface ClockRecord {
  id?: string
  date?: string
  clockIn?: string | null
  clockOut?: string | null
  status?: string
  late?: boolean
  earlyDeparture?: boolean
  totalHours?: number | null
  overtimeHours?: number | null
  notes?: string | null
  autoClockedOut?: boolean
}
export interface ClockToday {
  date?: string
  record?: ClockRecord | null
  shift?: ClockShift | null
  canClockIn?: boolean
  canClockOut?: boolean
}

export const ClockService = {
  /** the company time zone: clock times are recorded at the company's current time, not the browser's */
  timeZone: () => request<{ system?: { defaultTimezone?: string | null } }>("/v1/settings/company/effective").then((e) => e.system?.defaultTimezone ?? undefined),
  today: () => request<ClockToday>("/v1/attendance/me/today"),
  clockIn: (notes?: string) => request<ClockRecord>("/v1/attendance/me/clock-in", { method: "POST", body: { notes } }),
  clockOut: (notes?: string) => request<ClockRecord>("/v1/attendance/me/clock-out", { method: "POST", body: { notes } }),
}
