"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// HRM (manual §15). Spec: employee-service (EmployeeController EMPLOYEE_*; org/* ORG_VIEW / ORG_MANAGE; announcements
// ANNOUNCEMENT_*; lifecycle/* LIFECYCLE_VIEW / LIFECYCLE_MANAGE), attendance-service (records, shifts, settings
// ATTENDANCE_*; leave/* LEAVE_*), payroll-service (PAYROLL_VIEW / PAYROLL_MANAGE, pay = PAYROLL_PAY), document-service
// (DOCUMENT_VIEW / DOCUMENT_MANAGE). Swagger merges same-named records across services; checked against the code:
// - every lifecycle StatusForm is {status} with its own enum: warnings / promotions APPROVED|REJECTED, complaints
//   IN_REVIEW|IN_PROGRESS, resignations ACCEPTED|REJECTED and terminations APPROVED|REJECTED (+ exit interview fields);
// - lifecycle catalogs live at /lifecycle/catalogs/{slug} (warning-types, warning-severities, termination-types,
//   complaint-types, resolution-types, expense-types);
// - the attendance calendar DayCell is {date, status PRESENT|ABSENT|HALF_DAY|ON_LEAVE|HOLIDAY|DAY_OFF|FUTURE|NOT_ADDED,
//   weekend, late, earlyDeparture, overtime, clockIn, clockOut, notes, recordId} (RecordDtos), not the timesheet one.
// Holiday / announcement categories return a plain array. Every field optional.

const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })
type Q = Record<string, string | number | boolean | undefined>

/** A loosely typed row for the configuration-driven lists; read fields with `pick(row, "a.b")`. */
export type Row = { id?: string; status?: string } & Record<string, unknown>
export interface Option {
  id?: string
  name?: string
  [k: string]: unknown
}

/** Plain CRUD on `base`: list (page or array), save (POST or PUT /{id}), remove. */
export function crud(base: string) {
  return {
    list: (q: Q = {}) => request<IPage<Row> | Row[]>(withQuery(base, q)),
    get: (id: string) => request<Row>(`${base}/${id}`),
    save: (id: string | undefined, body: unknown) => (id ? put<Row>(`${base}/${id}`, body) : post<Row>(base, body)),
    remove: (id: string) => del(`${base}/${id}`),
    put: (id: string, action: string, body?: unknown) => put<Row>(`${base}/${id}/${action}`, body),
    post: (id: string, action: string, body?: unknown) => post<Row>(`${base}/${id}/${action}`, body),
  }
}

export const HR = {
  employees: crud("/v1/employees"),
  branches: crud("/v1/org/branches"),
  departments: crud("/v1/org/departments"),
  designations: crud("/v1/org/designations"),
  documentTypes: crud("/v1/org/document-types"),
  awardTypes: crud("/v1/org/award-types"),
  holidays: crud("/v1/org/holidays"),
  holidayCategories: crud("/v1/org/holiday-categories"),
  announcements: crud("/v1/org/announcements"),
  announcementCategories: crud("/v1/org/announcement-categories"),
  catalog: (slug: string) => crud(`/v1/lifecycle/catalogs/${slug}`),
  awards: crud("/v1/lifecycle/awards"),
  promotions: crud("/v1/lifecycle/promotions"),
  complaints: crud("/v1/lifecycle/complaints"),
  warnings: crud("/v1/lifecycle/warnings"),
  transfers: crud("/v1/lifecycle/transfers"),
  resignations: crud("/v1/lifecycle/resignations"),
  terminations: crud("/v1/lifecycle/terminations"),
  records: crud("/v1/attendance/records"),
  shifts: crud("/v1/attendance/shifts"),
  leaveTypes: crud("/v1/attendance/leave/types"),
  leavePolicies: crud("/v1/attendance/leave/policies"),
  leaveApplications: crud("/v1/attendance/leave/applications"),
  payrollTypes: crud("/v1/payroll/types"),
  components: crud("/v1/payroll/components"),
  salaries: crud("/v1/payroll/salaries"),
  runs: crud("/v1/payroll/runs"),
  payslips: crud("/v1/payroll/payslips"),
  documents: crud("/v1/document/documents"),
  documentCategories: crud("/v1/document/categories"),
  acknowledgments: crud("/v1/document/acknowledgments"),
}

/** Lookups for selects; `options` endpoints return arrays. */
export const HrOptions = {
  employees: () => request<IPage<EmployeeListItem>>(withQuery("/v1/employees", { size: 200 })).then((p) => (p.content ?? []).map((e) => ({ id: e.id, name: `${e.fullName ?? ""}${e.employeeNo ? ` (${e.employeeNo})` : ""}` }))),
  branches: () => request<Option[]>("/v1/org/branches/options"),
  departments: (branchId?: string) => request<Option[]>(withQuery("/v1/org/departments/options", { branchId })),
  designations: (departmentId?: string) => request<Option[]>(withQuery("/v1/org/designations/options", { departmentId })),
  documentTypes: () => request<Option[]>("/v1/org/document-types/options"),
  awardTypes: () => request<Option[]>("/v1/org/award-types/options"),
  holidayCategories: () => request<Option[]>("/v1/org/holiday-categories"),
  announcementCategories: () => request<Option[]>("/v1/org/announcement-categories"),
  catalog: (slug: string) => request<Option[]>(`/v1/lifecycle/catalogs/${slug}/options`),
  shifts: () => request<Option[]>("/v1/attendance/shifts/options"),
  leaveTypes: () => request<Option[]>("/v1/attendance/leave/types/options"),
  components: () => request<Option[]>("/v1/payroll/components/options"),
  loanTypes: () => request<IPage<Option>>(withQuery("/v1/payroll/types", { kind: "LOAN", active: true, size: 200 })).then((p) => p.content ?? []),
  documentCategories: () => request<Option[]>("/v1/document/categories/options"),
  documents: () => request<Option[]>("/v1/document/documents/options").then((l) => l.map((d) => ({ ...d, name: (d.title as string) ?? d.name }))),
}

// ------------------------------------------------------------------ employees

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"] as const
export const EMPLOYEE_STATUSES = ["ACTIVE", "PROBATION", "INACTIVE", "TERMINATED"] as const
export interface Ref {
  id?: string
  name?: string
}
export interface EmployeeListItem {
  id?: string
  employeeNo?: string
  employeeCode?: string
  fullName?: string
  email?: string
  branch?: Ref | null
  department?: Ref | null
  designation?: Ref | null
  status?: string
  employmentType?: string
  dateOfJoining?: string
  loginEnabled?: boolean
}
export interface BankingForm {
  bankName?: string
  accountHolderName?: string
  accountNumber?: string
  bankIdentifierCode?: string
  bankBranch?: string
  taxPayerId?: string
  baseSalary?: number
  hoursPerDay?: number
  daysPerWeek?: number
  ratePerHour?: number
}
/** ProfileForm (PUT /employees/{id} is a full replacement). */
export interface ProfileForm {
  fullName: string
  employeeCode?: string
  phone?: string
  dateOfBirth?: string
  gender?: "MALE" | "FEMALE" | "OTHER"
  branchId?: number
  departmentId?: number
  designationId?: number
  dateOfJoining: string
  employmentType: string
  status: string
  shiftId?: number
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  emergencyName?: string
  emergencyRelationship?: string
  emergencyPhone?: string
  banking?: BankingForm
}
export interface EmployeeDocument {
  id?: string
  documentType?: Ref
  fileName?: string
  downloadUrl?: string
  expiryDate?: string | null
  expired?: boolean
  verified?: boolean
}
export interface EmployeeDetail extends EmployeeListItem {
  phone?: string
  dateOfBirth?: string
  gender?: "MALE" | "FEMALE" | "OTHER"
  shiftId?: string | null
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  emergencyName?: string
  emergencyRelationship?: string
  emergencyPhone?: string
  banking?: BankingForm | null
  documents?: EmployeeDocument[]
  missingRequiredDocuments?: Ref[]
}
export const EmployeeService = {
  list: (q: Q) => request<IPage<EmployeeListItem>>(withQuery("/v1/employees", q)),
  typeCounts: (q: Q) => request<{ all?: number; byType?: Record<string, number> }>(withQuery("/v1/employees/type-counts", q)),
  get: (id: string) => request<EmployeeDetail>(`/v1/employees/${id}`),
  /** EmployeeCreateForm: the employee ID (employeeNo) is generated; email + optional password create the login. */
  create: (body: { email: string; password?: string; profile: ProfileForm; documents?: { documentTypeId: number; fileId: number; expiryDate?: string }[] }) =>
    post<EmployeeDetail>("/v1/employees", body),
  update: (id: string, body: ProfileForm) => put<EmployeeDetail>(`/v1/employees/${id}`, body),
  remove: (id: string) => del(`/v1/employees/${id}`),
  status: (id: string, status: string) => put<EmployeeDetail>(`/v1/employees/${id}/status`, { status }),
  login: (id: string, enabled: boolean) => put<EmployeeDetail>(`/v1/employees/${id}/login`, { enabled }),
  addDocument: (id: string, body: { documentTypeId: number; fileId: number; expiryDate?: string }) => post<EmployeeDocument>(`/v1/employees/${id}/documents`, body),
  removeDocument: (id: string, documentId: string) => del(`/v1/employees/${id}/documents/${documentId}`),
  verifyDocument: (id: string, documentId: string, verified: boolean) => put<EmployeeDocument>(`/v1/employees/${id}/documents/${documentId}/verify`, { verified }),
}

// ------------------------------------------------------------------ attendance

export type EDayStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY" | "DAY_OFF" | "FUTURE" | "NOT_ADDED"
export interface DayCell {
  date?: string
  status?: EDayStatus
  weekend?: boolean
  late?: boolean
  earlyDeparture?: boolean
  overtime?: boolean
  clockIn?: string | null
  clockOut?: string | null
  notes?: string | null
  recordId?: string | null
}
export interface AttendanceCalendar {
  year?: number
  month?: number
  rows?: { employeeId?: string; fullName?: string; employeeCode?: string; designation?: string; days?: DayCell[]; attended?: number; workingDays?: number }[]
  page?: number
  size?: number
  totalElements?: number
}
export const WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const
export interface AttendanceSettings {
  weeklyOffDays?: string[]
  ipRestrictionEnabled?: boolean
  allowedIps?: string[]
}
export const AttendanceService = {
  calendar: (q: { year: number; month: number; employeeId?: string; page?: number; size?: number }) => request<AttendanceCalendar>(withQuery("/v1/attendance/records/calendar", q)),
  settings: () => request<AttendanceSettings>("/v1/attendance/settings"),
  saveSettings: (body: { weeklyOffDays: string[]; ipRestrictionEnabled: boolean; allowedIps: string[] }) => put<AttendanceSettings>("/v1/attendance/settings", body),
}

// ------------------------------------------------------------------ leave

export interface BalanceLine {
  leaveType?: { id?: string; name?: string; color?: string }
  allocated?: number
  carriedForward?: number
  adjustment?: number
  total?: number
  used?: number
  available?: number
}
export interface BalancePage {
  year?: number
  lastSyncedAt?: string | null
  cards?: { employee?: { id?: string; fullName?: string; employeeNo?: string }; balances?: BalanceLine[] }[]
  page?: number
  size?: number
  totalElements?: number
}
export const LeaveService = {
  balances: (q: { year: number; keyword?: string; page?: number; size?: number }) => request<BalancePage>(withQuery("/v1/attendance/leave/balances", q)),
  sync: (year: number) => post<unknown>(withQuery("/v1/attendance/leave/balances/sync", { year })),
}

// ------------------------------------------------------------------ payroll

export interface PayrollLine {
  componentId?: string
  name?: string
  type?: "EARNING" | "DEDUCTION"
  amount?: number
}
export interface PayrollEntry {
  id?: string
  employee?: { id?: string; fullName?: string; employeeNo?: string }
  basicSalary?: number
  workingDays?: number
  presentDays?: number
  paidLeaveDays?: number
  unpaidLeaveDays?: number
  overtimeHours?: number
  totalEarnings?: number
  overtimeAmount?: number
  manualOvertimeAmount?: number
  lopDeduction?: number
  unpaidLeaveDeduction?: number
  loanDeduction?: number
  grossPay?: number
  totalDeductions?: number
  netPay?: number
  lines?: PayrollLine[]
}
export const PayrollService = {
  entries: (runId: string) => request<IPage<PayrollEntry>>(withQuery(`/v1/payroll/runs/${runId}/entries`, { size: 500 })).then((p) => p.content ?? []),
  process: (runId: string) => post<Row>(`/v1/payroll/runs/${runId}/process`),
  pay: (runId: string, body: { bankAccountId?: number; paymentDate?: string }) => post<Row>(`/v1/payroll/runs/${runId}/pay`, body),
  generatePayslips: (runId: string) => post<unknown>(`/v1/payroll/runs/${runId}/generate-payslips`),
  cancel: (runId: string) => put<Row>(`/v1/payroll/runs/${runId}/cancel`),
  payslipPdf: (id: string) => request<Blob>(`/v1/payroll/payslips/${id}/pdf`, { as: "blob" }),
  /** pages (content), not arrays */
  overtimes: (employeeId: string) => request<IPage<Row>>(withQuery(`/v1/payroll/employees/${employeeId}/overtimes`, { size: 100 })).then((p) => p.content ?? []),
  addOvertime: (employeeId: string, body: unknown) => post<Row>(`/v1/payroll/employees/${employeeId}/overtimes`, body),
  overtimeStatus: (id: string, status: string) => put<Row>(`/v1/payroll/overtimes/${id}/status`, { status }),
  removeOvertime: (id: string) => del(`/v1/payroll/overtimes/${id}`),
  loans: (employeeId: string) => request<IPage<Row>>(withQuery(`/v1/payroll/employees/${employeeId}/loans`, { size: 100 })).then((p) => p.content ?? []),
  addLoan: (employeeId: string, body: unknown) => post<Row>(`/v1/payroll/employees/${employeeId}/loans`, body),
  removeLoan: (id: string) => del(`/v1/payroll/loans/${id}`),
}

// ------------------------------------------------------------------ documents

export const DocumentService = {
  /** {url}: a short-lived link to the file (DOC_025 before approval) */
  download: (id: string) => request<{ url?: string }>(`/v1/document/documents/${id}/download`),
}

// ------------------------------------------------------------------ performance & training (manual §16)
// employee-service performance/* (PERFORMANCE_VIEW / PERFORMANCE_MANAGE) and training/* (TRAINING_VIEW / TRAINING_MANAGE).
// Catalogs: /performance/{goal-types|indicator-categories}. A review is Pending → In Progress → Completed; conduct saves
// ratings (1..5 per indicator) and `submit` completes it once every indicator is rated (EMP_079); completed is final
// (EMP_077); nobody reviews themselves (EMP_076). Reviewer = an employee id.

export const PERF = {
  reviews: crud("/v1/performance/reviews"),
  goals: crud("/v1/performance/goals"),
  cycles: crud("/v1/performance/review-cycles"),
  indicators: crud("/v1/performance/indicators"),
  catalog: (kind: "goal-types" | "indicator-categories") => crud(`/v1/performance/${kind}`),
}
export const TRAINING = {
  types: crud("/v1/training/types"),
  trainers: crud("/v1/training/trainers"),
  programs: crud("/v1/training/programs"),
  sessions: crud("/v1/training/sessions"),
  trainings: crud("/v1/training/employee-trainings"),
}
export const PerfOptions = {
  cycles: () => request<Option[]>("/v1/performance/review-cycles/options"),
  catalog: (kind: "goal-types" | "indicator-categories") => request<Option[]>(`/v1/performance/${kind}/options`),
  trainingTypes: () => request<Option[]>("/v1/training/types/options"),
  trainers: () => request<Option[]>("/v1/training/trainers/options"),
  programs: () => request<Option[]>("/v1/training/programs/options"),
}
export interface RatingDto {
  indicatorId?: string
  indicatorName?: string
  description?: string | null
  measurementUnit?: string | null
  targetValue?: string | null
  weight?: number | null
  rating?: number | null
  comments?: string | null
}
export interface ReviewDto {
  id?: string
  employee?: { id?: string; fullName?: string }
  reviewer?: { id?: string; fullName?: string }
  reviewCycle?: Ref
  reviewDate?: string
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  overallRating?: number | null
  overallComments?: string | null
  pros?: string | null
  cons?: string | null
  groups?: { category?: string; indicators?: RatingDto[] }[]
}
/** ConductForm {ratings[{indicatorId, rating 1..5, comments}], overallComments, pros, cons, submit}. */
export const ReviewService = {
  get: (id: string) => request<ReviewDto>(`/v1/performance/reviews/${id}`),
  conduct: (id: string, body: { ratings: { indicatorId: number; rating?: number; comments?: string }[]; overallComments?: string; pros?: string; cons?: string; submit: boolean }) =>
    put<ReviewDto>(`/v1/performance/reviews/${id}/conduct`, body),
}

// ------------------------------------------------------------------ §15 events (meeting-service)
// Spec: meeting-service EventController under /v1/meeting (EVENT_VIEW / EVENT_MANAGE / EVENT_APPROVE).
// EventForm {title≤200, eventTypeId, startDate, endDate, startTime?, endTime? (both omitted = all day), location≤500,
// color #RRGGBB, departmentIds (≥1, active departments), description≤4000}; created PENDING, an edit sends an approved or
// rejected event back to PENDING; approve / reject only while PENDING (MTG_019). Calendar = approved events overlapping
// from..to (≤92 days, MTG_021). Event types {name≤150, description≤1000, status}; a type with events can't be deleted (MTG_004).
export const EVENTS = {
  events: crud("/v1/meeting/events"),
  types: crud("/v1/meeting/event-types"),
  typeOptions: () => request<Option[]>("/v1/meeting/event-types/options"),
  calendar: (from: string, to: string) => request<Row[]>(withQuery("/v1/meeting/events/calendar", { from, to })),
}
