"use client"

import { request, withQuery, type IPage } from "@/lib/api"
import { crud, type Option, type Row } from "@/lib/hrm/hrm.service"

// Recruitment (manual §17). Spec: recruitment-service (RECRUITMENT_VIEW / RECRUITMENT_MANAGE; public career portal
// /v1/public/career/{slug}/** without auth). Swagger merges every StatusForm; per the code each is {status} with its
// own enum: candidates NEW|SCREENING|INTERVIEW|OFFER|HIRED|REJECTED, interviews SCHEDULED|COMPLETED|CANCELLED|NO_SHOW,
// offers DRAFT|SENT|NEGOTIATING|ACCEPTED|DECLINED|EXPIRED (+ approval PENDING|APPROVED|REJECTED), onboardings
// PENDING|IN_PROGRESS|COMPLETED, catalogs / locations / rounds / checklists / templates ACTIVE|INACTIVE.
// Catalogs: /recruitment/{job-categories|job-types|candidate-sources|interview-types}. Resume upload = PUT multipart
// `file`; the public apply is multipart: part `application` (JSON ApplicationForm) + optional `resume`, `coverLetter`.
// Every field optional.

const R = "/v1/recruitment"
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })

export const CATALOG_KINDS = ["job-types", "job-categories", "candidate-sources", "interview-types"] as const
export type ECatalogKind = (typeof CATALOG_KINDS)[number]
export const CANDIDATE_STATUSES = ["NEW", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const
export const QUESTION_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX"] as const
export const TASK_CATEGORIES = ["DOCUMENTATION", "IT_SETUP", "TRAINING", "HR", "ORIENTATION", "OTHER"] as const
export const RECOMMENDATIONS = ["STRONG_HIRE", "HIRE", "MAYBE", "REJECT", "STRONG_REJECT"] as const

export const REC = {
  catalog: (kind: ECatalogKind) => crud(`${R}/${kind}`),
  postings: crud(`${R}/job-postings`),
  locations: crud(`${R}/job-locations`),
  rounds: crud(`${R}/interview-rounds`),
  questions: crud(`${R}/custom-questions`),
  checklists: crud(`${R}/onboarding-checklists`),
  items: crud(`${R}/checklist-items`),
  templates: crud(`${R}/offer-templates`),
  candidates: crud(`${R}/candidates`),
  interviews: crud(`${R}/interviews`),
  assessments: crud(`${R}/assessments`),
  offers: crud(`${R}/offers`),
  onboardings: crud(`${R}/onboardings`),
}

export const RecOptions = {
  catalog: (kind: ECatalogKind) => request<Option[]>(`${R}/${kind}/options`),
  postings: () => request<{ id?: string; jobCode?: string; title?: string }[]>(`${R}/job-postings/options`).then((l) => l.map((p) => ({ id: p.id, name: `${p.title ?? ""}${p.jobCode ? ` (${p.jobCode})` : ""}` }))),
  locations: () => request<Option[]>(`${R}/job-locations/options`),
  questions: () => request<{ id?: string; question?: string }[]>(`${R}/custom-questions/options`).then((l) => l.map((q) => ({ id: q.id, name: q.question }))),
  /** /interview-rounds/options needs jobPostingId (COMMON_001 without): the list gives every round with its job */
  rounds: () => request<IPage<Row>>(withQuery(`${R}/interview-rounds`, { status: "ACTIVE", size: 500 })).then((p) => (p.content ?? []).map((r) => ({ id: r.id, name: `${String(r.sequenceNumber ?? "")}. ${String(r.name ?? "")}`, jobId: (r.job as { id?: string } | undefined)?.id }))),
  checklists: () => request<Option[]>(`${R}/onboarding-checklists/options`),
  candidates: () => request<IPage<Row>>(withQuery(`${R}/candidates`, { size: 200 })).then((p) => (p.content ?? []).map((c) => ({ id: c.id, name: `${String(c.fullName ?? "")} · ${String(c.email ?? "")}`, jobId: (c.job as { id?: string } | undefined)?.id }))),
  templates: () => request<IPage<Row>>(withQuery(`${R}/offer-templates`, { status: "ACTIVE", size: 100 })).then((p) => (p.content ?? []).map((x) => ({ id: x.id, name: String(x.name ?? "") }))),
}

export interface CandidateDetail {
  id?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  job?: { id?: string; jobCode?: string; title?: string }
  source?: { id?: string; name?: string } | null
  currentCompany?: string
  currentPosition?: string
  experienceYears?: number
  currentSalary?: number
  expectedSalary?: number
  noticePeriod?: string
  gender?: string
  dateOfBirth?: string
  coverLetterMessage?: string
  resumeName?: string | null
  resumeUrl?: string | null
  coverLetterName?: string | null
  coverLetterUrl?: string | null
  answers?: { questionId?: string; question?: string; answer?: string }[]
  status?: string
  employeeId?: string | null
  applicationDate?: string
}
export interface FeedbackDto {
  id?: string
  employeeId?: string
  interviewerName?: string
  overallScore?: number
  technicalScore?: number
  communicationScore?: number
  culturalFitScore?: number
  recommendation?: string
  strengths?: string
  weaknesses?: string
  comments?: string
}
export interface InterviewDetail {
  id?: string
  candidate?: { id?: string; fullName?: string; email?: string; status?: string }
  job?: { title?: string }
  round?: { name?: string }
  interviewType?: { name?: string }
  date?: string
  startTime?: string
  durationMinutes?: number
  location?: string | null
  meetingLink?: string | null
  status?: string
  interviewers?: { employeeId?: string; name?: string }[]
  feedbackSummary?: { count?: number; overall?: number | null; technical?: number | null; communication?: number | null; culturalFit?: number | null; recommendations?: Record<string, number> }
  feedback?: FeedbackDto[]
}
export interface OnboardingDetail {
  id?: string
  employee?: { id?: string; name?: string; email?: string }
  buddy?: { name?: string } | null
  startDate?: string
  status?: string
  checklist?: { name?: string; items?: { id?: string; taskName?: string; description?: string; category?: string; required?: boolean; dueDay?: number; dueDate?: string }[] }
}
export interface CareerSettings {
  slug?: string
  enabled?: boolean
  displayName?: string
  headline?: string
  tagline?: string
  publicPath?: string
}

export const RecruitmentService = {
  candidate: (id: string) => request<CandidateDetail>(`${R}/candidates/${id}`),
  candidateStatus: (id: string, status: string) => put<Row>(`${R}/candidates/${id}/status`, { status }),
  uploadResume: (id: string, file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    return request<Row>(`${R}/candidates/${id}/resume`, { method: "PUT", body: fd })
  },
  interview: (id: string) => request<InterviewDetail>(`${R}/interviews/${id}`),
  addFeedback: (id: string, body: unknown) => post<Row>(`${R}/interviews/${id}/feedback`, body),
  removeFeedback: (id: string, feedbackId: string) => request<void>(`${R}/interviews/${id}/feedback/${feedbackId}`, { method: "DELETE" }),
  offerLetter: (id: string, templateId: string) => request<Blob>(withQuery(`${R}/offers/${id}/letter`, { templateId }), { as: "blob" }),
  convert: (id: string, body: unknown) => post<Row>(`${R}/offers/${id}/convert-to-employee`, body),
  onboarding: (id: string) => request<OnboardingDetail>(`${R}/onboardings/${id}`),
  settings: () => request<CareerSettings | null>(`${R}/career-settings`),
  saveSettings: (body: { slug: string; enabled: boolean; displayName: string; headline?: string; tagline?: string }) => put<CareerSettings>(`${R}/career-settings`, body),
}

// ------------------------------------------------------------------ public career portal (no sign-in)

export interface JobCard {
  id?: string
  title?: string
  skills?: string[]
  branch?: string | null
  location?: { id?: string; name?: string; city?: string; remote?: boolean } | null
  jobType?: { id?: string; name?: string } | null
  positions?: number
  featured?: boolean
  minSalary?: number | null
  maxSalary?: number | null
  applicationDeadline?: string | null
}
export interface PublicQuestion {
  id?: string
  question?: string
  type?: (typeof QUESTION_TYPES)[number]
  options?: string[]
  required?: boolean
}
export interface JobDetail {
  job?: JobCard
  department?: string | null
  description?: string | null
  requirements?: string | null
  benefits?: string | null
  minExperience?: number | null
  maxExperience?: number | null
  applicationType?: "EXISTING" | "CUSTOM"
  applicationUrl?: string | null
  askGender?: boolean
  askDateOfBirth?: boolean
  showCoverLetter?: boolean
  showTerms?: boolean
  questions?: PublicQuestion[]
  similarJobs?: JobCard[]
}
export interface Site {
  slug?: string
  displayName?: string
  headline?: string | null
  tagline?: string | null
  openJobs?: number
}
const P = (slug: string) => `/v1/public/career/${encodeURIComponent(slug)}`
export const CareerPortal = {
  site: (slug: string) => request<Site>(P(slug), { auth: false }),
  filters: (slug: string) => request<{ locations?: { id?: string; name?: string }[]; jobTypes?: Option[]; sources?: Option[] }>(`${P(slug)}/filters`, { auth: false }),
  jobs: (slug: string, q: { keyword?: string; locationId?: string; jobTypeIds?: string }) => request<JobCard[] | IPage<JobCard>>(withQuery(`${P(slug)}/jobs`, q), { auth: false }),
  job: (slug: string, id: string) => request<JobDetail>(`${P(slug)}/jobs/${id}`, { auth: false }),
  apply: (slug: string, id: string, application: unknown, resume?: File, coverLetter?: File) => {
    const fd = new FormData()
    fd.append("application", new Blob([JSON.stringify(application)], { type: "application/json" }))
    if (resume) fd.append("resume", resume)
    if (coverLetter) fd.append("coverLetter", coverLetter)
    return request<{ jobTitle?: string; applicationDate?: string; trackingId?: string }>(`${P(slug)}/jobs/${id}/apply`, { method: "POST", body: fd, auth: false })
  },
  track: (slug: string, trackingId: string, email: string) =>
    request<{ trackingId?: string; jobTitle?: string; applicationDate?: string; status?: string }>(withQuery(`${P(slug)}/track`, { trackingId, email }), { auth: false }),
}
