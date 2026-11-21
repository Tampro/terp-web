"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Company dashboard APIs (manual §5). Spec: report-service ReportController GET /reports/dashboard, /reports/calendar;
// the parts mirror EmployeeDashboard, AttendanceDashboard, LeaveDashboardView (attendance-service),
// RecruitmentDashboard, CandidateRow (recruitment-service), PayrollDashboard, AnnouncementDto (employee-service).
// Every field optional: the backend may return null.

/** One card of the aggregated dashboard: data, or data = null with error (COMMON_004 = no permission, UNAVAILABLE). */
export interface Part<T> {
  data?: T | null
  error?: string | null
}

export interface EmployeeRef {
  id?: string
  fullName?: string
  profileImageUrl?: string | null
}

export interface EmployeeDashboard {
  totalEmployees?: number
  activeEmployees?: number
  newThisMonth?: number
  newLastMonth?: number
  branches?: number
  departments?: number
  promotions?: number
  terminations?: number
  year?: number
  /** 12 monthly counts of dateOfJoining */
  hiringTrend?: number[]
  byDepartment?: { departmentId?: string | null; name?: string | null; employees?: number }[]
  birthdaysToday?: { employeeId?: string; fullName?: string; designation?: string | null; date?: string }[]
}

export interface AttendanceDashboard {
  today?: string
  presentToday?: number
  activeEmployees?: number
  /** % or null without data */
  attendanceRateThisMonth?: number | null
  absentToday?: number
  onLeaveToday?: number
  /** employees without a record today; null when the headcount is unknown */
  notMarkedToday?: number | null
  last7Days?: { date?: string; present?: number; onLeave?: number; absent?: number }[]
}

export interface LeaveDashboard {
  today?: string
  pending?: number
  todayLeaves?: { applicationId?: string; employee?: EmployeeRef; leaveType?: string; startDate?: string; endDate?: string }[]
  month?: { year?: number; month?: number; approved?: number; pending?: number; rejected?: number; total?: number }
}

export type ELeaveStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface LeaveApplicationRow {
  id?: string
  employee?: EmployeeRef
  leaveType?: { id?: string; name?: string; color?: string | null }
  startDate?: string
  endDate?: string
  days?: number
  status?: ELeaveStatus
  appliedOn?: string
}

export interface PayrollDashboard {
  currency?: string
  thisMonthNet?: number | null
  lastMonthNet?: number | null
}

export type ECandidateStatus = "NEW" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED"

export interface RecruitmentDashboard {
  activeJobs?: number
  openPositions?: number
  /** null when the career page is off */
  careerSlug?: string | null
  pipeline?: Partial<Record<ECandidateStatus, number>>
  totalCandidates?: number
  scheduledInterviews?: number
  completedOnboardings?: number
  funnel?: { stage?: ECandidateStatus; reached?: number; percentOfTotal?: number }[]
}

export interface CandidateRow {
  id?: string
  fullName?: string
  job?: { id?: string; jobCode?: string; title?: string }
  status?: ECandidateStatus
  applicationDate?: string
}

export interface AnnouncementRow {
  id?: string
  title?: string
  shortDescription?: string | null
  category?: { name?: string; color?: string | null }
  startDate?: string
  endDate?: string | null
  highPriority?: boolean
  featured?: boolean
}

export interface CompanyDashboard {
  today?: string
  year?: number
  employees?: Part<EmployeeDashboard>
  attendance?: Part<AttendanceDashboard>
  leave?: Part<LeaveDashboard>
  recentLeaves?: Part<LeaveApplicationRow[]>
  payroll?: Part<PayrollDashboard>
  recruitment?: Part<RecruitmentDashboard>
  recentCandidates?: Part<CandidateRow[]>
  announcements?: Part<AnnouncementRow[]>
}

export type ECalendarKind = "MEETING" | "HOLIDAY" | "LEAVE" | "BIRTHDAY"

export interface CalendarEvent {
  kind?: ECalendarKind
  id?: string
  title?: string
  start?: string
  end?: string
  startTime?: string | null
  allDay?: boolean
}

export interface CalendarView {
  from?: string
  to?: string
  /** from today on, at most 10 */
  upcoming?: CalendarEvent[]
  /** kinds left out, with the reason */
  unavailable?: Partial<Record<ECalendarKind, string>>
}

export const DashboardService = {
  /** One call, every card read with the caller's token; a card you may not see comes back with error. */
  company: (year: number) => request<CompanyDashboard>(withQuery("/v1/reports/dashboard", { year })),
  /** At most 62 days. Kinds you may not see are listed in unavailable. */
  calendar: (from: string, to: string) => request<CalendarView>(withQuery("/v1/reports/calendar", { from, to })),
  /** Active announcements reaching my branch/department or the whole company; no permission needed. */
  myAnnouncements: () => request<IPage<AnnouncementRow>>(withQuery("/v1/org/announcements/my", { tab: "ALL", size: 5 })),
}
