"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Projects & form builder (manual §11.1, §11.2). Spec: project-service ProjectController, TaskController, BugController,
// StageController, MilestoneController, FormController, PublicFormController, FormConvertService. Errors PRJ_*/FRM_*.
// Permissions PROJECT_VIEW / PROJECT_MANAGE / PROJECT_TASK_MANAGE, FORM_VIEW / FORM_MANAGE. Every field optional.

export type EProjectStatus = "ONGOING" | "ON_HOLD" | "FINISHED"
export type EPriority = "LOW" | "MEDIUM" | "HIGH"
export type EStageKind = "TASK" | "BUG"
export type EMilestoneStatus = "INCOMPLETE" | "ONGOING" | "COMPLETE"

export interface ProjectDto {
  id?: string
  name?: string
  startDate?: string | null
  endDate?: string | null
  budget?: number | null
  description?: string | null
  status?: EProjectStatus
  /** past its end date and not finished */
  overdue?: boolean
  userIds?: string[]
  /** accounting customers */
  clientIds?: string[]
  createdDate?: string
}
export interface ProjectDetailDto {
  project?: ProjectDto
  daysLeft?: number | null
  progress?: number
  taskCount?: number
  doneTaskCount?: number
}
export interface ProjectForm {
  name: string
  startDate?: string | null
  endDate?: string | null
  budget?: number | null
  description?: string | null
  userIds?: number[]
}
export interface DuplicateForm {
  name?: string
  tasks?: boolean
  bugs?: boolean
  activity?: boolean
  team?: boolean
  clients?: boolean
  milestones?: boolean
  files?: boolean
}

export interface StageDto {
  id?: string
  kind?: EStageKind
  name?: string
  position?: number
  /** the last task stage is the done stage */
  done?: boolean
}
export interface TaskDto {
  id?: string
  projectId?: string
  milestoneId?: string | null
  title?: string
  priority?: EPriority
  stageId?: string
  stageName?: string
  position?: number
  done?: boolean
  assigneeIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  durationDays?: number | null
  description?: string | null
}
export interface TaskForm {
  milestoneId?: number | null
  title: string
  priority?: EPriority
  stageId?: number | null
  /** project team members only (PRJ_017) */
  assigneeIds?: number[]
  startDate?: string | null
  dueDate?: string | null
  description?: string | null
}
export interface SubtaskDto {
  id?: string
  name?: string
  done?: boolean
}
export interface CommentDto {
  id?: string
  authorUserId?: string
  body?: string
  createdDate?: string
}
export interface TaskDetailDto {
  task?: TaskDto
  subtasks?: SubtaskDto[]
  comments?: CommentDto[]
}
export interface BugDto {
  id?: string
  projectId?: string
  title?: string
  priority?: EPriority
  assigneeId?: string | null
  stageId?: string
  stageName?: string
  position?: number
  description?: string | null
}
export interface BugForm {
  title: string
  priority?: EPriority
  assigneeId?: number | null
  stageId?: number | null
  description?: string | null
}
export interface MilestoneDto {
  id?: string
  title?: string
  cost?: number | null
  startDate?: string | null
  endDate?: string | null
  summary?: string | null
  status?: EMilestoneStatus
  progress?: number | null
}
export interface MilestoneForm {
  title: string
  cost?: number | null
  startDate?: string | null
  endDate?: string | null
  summary?: string | null
  status: EMilestoneStatus
  progress?: number | null
}
export interface AttachmentDto {
  id?: string
  fileId?: string
  name?: string
  createdDate?: string
}
export interface ActivityDto {
  id?: string
  actorUserId?: string
  action?: string
  detail?: string | null
  createdDate?: string
}
export interface ProjectReport {
  name?: string
  status?: EProjectStatus
  budget?: number | null
  milestoneCost?: number | null
  startDate?: string | null
  endDate?: string | null
  daysLeft?: number | null
  overdue?: boolean
  taskCount?: number
  doneTaskCount?: number
  progress?: number
  tasksByStage?: { stageId?: string; stageName?: string; done?: boolean; count?: number }[]
  tasksByPriority?: Partial<Record<EPriority, number>>
  users?: { userId?: string; assigned?: number; done?: number; progress?: number }[]
  milestonesByStatus?: Partial<Record<EMilestoneStatus, number>>
}
export interface TaskColumn {
  stage?: StageDto
  tasks?: TaskDto[]
}
export interface BugColumn {
  stage?: StageDto
  bugs?: BugDto[]
}
export interface TaskCalendarItem {
  id?: string
  projectId?: string
  projectName?: string
  title?: string
  startDate?: string | null
  dueDate?: string | null
  stageName?: string
  done?: boolean
}

const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })

/** GET /v1/projects/stats (ProjectStatsService.ProjectStats): only the fields this app reads */
export interface ProjectStats {
  totalProjects?: number
  overdueProjects?: number
  byStatus?: Partial<Record<EProjectStatus, number>>
}

export const ProjectService = {
  stats: () => request<ProjectStats>("/v1/projects/stats"),
  list: (f: { status?: string; q?: string; page?: number; size?: number }) => request<IPage<ProjectDto>>(withQuery("/v1/projects", { ...f })),
  get: (id: string) => request<ProjectDetailDto>(`/v1/projects/${id}`),
  create: (body: ProjectForm) => post<ProjectDto>("/v1/projects", body),
  /** full replacement */
  update: (id: string, body: ProjectForm) => put<ProjectDto>(`/v1/projects/${id}`, body),
  remove: (id: string) => del(`/v1/projects/${id}`),
  status: (id: string, status: EProjectStatus) => put<ProjectDto>(`/v1/projects/${id}/status`, { status }),
  clients: (id: string, customerIds: string[]) => put<ProjectDto>(`/v1/projects/${id}/clients`, { customerIds: customerIds.map(Number) }),
  duplicate: (id: string, body: DuplicateForm) => post<ProjectDto>(`/v1/projects/${id}/duplicate`, body),
  report: (id: string) => request<ProjectReport>(`/v1/projects/${id}/report`),
  activity: (id: string) => request<IPage<ActivityDto>>(withQuery(`/v1/projects/${id}/activity`, { size: 100 })),
  milestones: (id: string) => request<MilestoneDto[]>(`/v1/projects/${id}/milestones`),
  addMilestone: (id: string, body: MilestoneForm) => post<MilestoneDto>(`/v1/projects/${id}/milestones`, body),
  updateMilestone: (mid: string, body: MilestoneForm) => put<MilestoneDto>(`/v1/projects/milestones/${mid}`, body),
  removeMilestone: (mid: string) => del(`/v1/projects/milestones/${mid}`),
  attachments: (id: string) => request<AttachmentDto[]>(`/v1/projects/${id}/attachments`),
  /** a file of the company's media library */
  addAttachment: (id: string, fileId: string) => post<AttachmentDto>(`/v1/projects/${id}/attachments`, { fileId: Number(fileId) }),
  removeAttachment: (aid: string) => del(`/v1/projects/attachments/${aid}`),
}

export const TaskService = {
  list: (projectId: string, f: { priority?: string; assigneeId?: string; from?: string; to?: string; page?: number; size?: number }) =>
    request<IPage<TaskDto>>(withQuery(`/v1/projects/${projectId}/tasks`, { ...f })),
  board: (projectId: string) => request<TaskColumn[]>(`/v1/projects/${projectId}/tasks/board`),
  get: (taskId: string) => request<TaskDetailDto>(`/v1/projects/tasks/${taskId}`),
  create: (projectId: string, body: TaskForm) => post<TaskDto>(`/v1/projects/${projectId}/tasks`, body),
  update: (taskId: string, body: TaskForm) => put<TaskDto>(`/v1/projects/tasks/${taskId}`, body),
  remove: (taskId: string) => del(`/v1/projects/tasks/${taskId}`),
  move: (taskId: string, stageId: string, position?: number) => put<TaskDto>(`/v1/projects/tasks/${taskId}/move`, { stageId: Number(stageId), position }),
  addSubtask: (taskId: string, name: string) => post<SubtaskDto>(`/v1/projects/tasks/${taskId}/subtasks`, { name, done: false }),
  updateSubtask: (sid: string, name: string, done: boolean) => put<SubtaskDto>(`/v1/projects/subtasks/${sid}`, { name, done }),
  removeSubtask: (sid: string) => del(`/v1/projects/subtasks/${sid}`),
  addComment: (taskId: string, body: string) => post<CommentDto>(`/v1/projects/tasks/${taskId}/comments`, { body }),
  removeComment: (cid: string) => del(`/v1/projects/comments/${cid}`),
  /** every project's tasks dated in [from, to] */
  calendar: (from: string, to: string) => request<TaskCalendarItem[]>(withQuery("/v1/projects/tasks/calendar", { from, to })),
}

export const BugService = {
  board: (projectId: string) => request<BugColumn[]>(`/v1/projects/${projectId}/bugs/board`),
  get: (bugId: string) => request<BugDto>(`/v1/projects/bugs/${bugId}`),
  create: (projectId: string, body: BugForm) => post<BugDto>(`/v1/projects/${projectId}/bugs`, body),
  update: (bugId: string, body: BugForm) => put<BugDto>(`/v1/projects/bugs/${bugId}`, body),
  remove: (bugId: string) => del(`/v1/projects/bugs/${bugId}`),
  move: (bugId: string, stageId: string, position?: number) => put<BugDto>(`/v1/projects/bugs/${bugId}/move`, { stageId: Number(stageId), position }),
}

export const StageService = {
  list: (kind: EStageKind) => request<StageDto[]>(withQuery("/v1/projects/stages", { kind })),
  create: (kind: EStageKind, name: string) => post<StageDto>("/v1/projects/stages", { kind, name }),
  rename: (id: string, name: string) => put<StageDto>(`/v1/projects/stages/${id}`, { name }),
  /** PRJ_014 while it holds tasks or bugs, PRJ_015 for the last one */
  remove: (id: string) => del(`/v1/projects/stages/${id}`),
  /** every stage of the kind exactly once (PRJ_013) */
  order: (kind: EStageKind, ids: string[]) => put<StageDto[]>("/v1/projects/stages/order", { kind, stageIds: ids.map(Number) }),
}

// ---- Form builder (§11.2) ----

export type EFieldType = "TEXT" | "EMAIL" | "NUMBER" | "PHONE" | "URL" | "PASSWORD" | "TEXTAREA" | "SELECT" | "RADIO" | "CHECKBOX" | "DATE" | "TIME"
export const FIELD_TYPES: EFieldType[] = ["TEXT", "EMAIL", "NUMBER", "PHONE", "URL", "PASSWORD", "TEXTAREA", "SELECT", "RADIO", "CHECKBOX", "DATE", "TIME"]
/** types that need options (FRM_003) */
export const OPTION_TYPES: EFieldType[] = ["SELECT", "RADIO", "CHECKBOX"]
export type ELayout = "SINGLE_COLUMN" | "TWO_COLUMN" | "CARD"
export type EConvertTarget = "PROJECT" | "CONTRACT" | "LEAD" | "DEAL"
/** Target fields per conversion (FormConvertService.ConvertForm description). */
export const CONVERT_FIELDS: Record<EConvertTarget, { key: string; required?: boolean }[]> = {
  LEAD: [
    { key: "pipelineId", required: true },
    { key: "stageId" },
    { key: "name", required: true },
    { key: "email", required: true },
    { key: "subject", required: true },
    { key: "ownerUserId", required: true },
    { key: "phone" },
    { key: "followUpDate" },
    { key: "notes" },
  ],
  DEAL: [
    { key: "pipelineId", required: true },
    { key: "stageId" },
    { key: "name", required: true },
    { key: "price", required: true },
    { key: "phone" },
    { key: "clientIds" },
    { key: "notes" },
  ],
  CONTRACT: [
    { key: "subject", required: true },
    { key: "customerId", required: true },
    { key: "contractTypeId", required: true },
    { key: "value" },
    { key: "startDate", required: true },
    { key: "endDate", required: true },
    { key: "description" },
  ],
  PROJECT: [{ key: "name", required: true }, { key: "startDate" }, { key: "endDate" }, { key: "budget" }, { key: "description" }, { key: "userIds" }],
}

export interface FieldDto {
  id?: string
  /** answer key; generated from the label when omitted */
  key?: string
  label?: string
  type?: EFieldType
  required?: boolean
  placeholder?: string | null
  options?: string[]
}
export interface FormRow {
  id?: string
  name?: string
  active?: boolean
  layout?: ELayout
  /** public link /f/{publicToken} */
  publicToken?: string
  createdDate?: string
}
export interface FormDto {
  form?: FormRow
  fields?: FieldDto[]
}
export interface FormForm {
  name: string
  active: boolean
  layout: ELayout
  fields: { key?: string; label: string; type: EFieldType; required: boolean; placeholder?: string | null; options?: string[] }[]
}
export interface AnswerDto {
  key?: string
  label?: string
  type?: EFieldType
  value?: unknown
}
export interface ResponseDto {
  id?: string
  answers?: AnswerDto[]
  convertedTargetType?: EConvertTarget | null
  convertedTargetId?: string | null
  convertedAt?: string | null
  createdDate?: string
}
export interface PublicFormDto {
  name?: string
  layout?: ELayout
  fields?: FieldDto[]
}

export const FormService = {
  list: (f: { keyword?: string; page?: number; size?: number }) => request<IPage<FormRow>>(withQuery("/v1/forms", { ...f })),
  get: (id: string) => request<FormDto>(`/v1/forms/${id}`),
  create: (body: FormForm) => post<FormDto>("/v1/forms", body),
  /** full replacement of the form and its fields */
  update: (id: string, body: FormForm) => put<FormDto>(`/v1/forms/${id}`, body),
  remove: (id: string) => del(`/v1/forms/${id}`),
  /** a new public link; the old one stops working */
  regenerateToken: (id: string) => post<FormDto>(`/v1/forms/${id}/regenerate-token`),
  responses: (id: string, f: { from?: string; to?: string; page?: number; size?: number }) =>
    request<IPage<ResponseDto>>(withQuery(`/v1/forms/${id}/responses`, { ...f })),
  removeResponse: (id: string, rid: string) => del(`/v1/forms/${id}/responses/${rid}`),
  /** once per response (FRM_015) */
  convert: (id: string, rid: string, body: { target: EConvertTarget; mapping: Record<string, string>; values: Record<string, string> }) =>
    post<{ targetType?: EConvertTarget; targetId?: string }>(`/v1/forms/${id}/responses/${rid}/convert`, body),
  publicGet: (token: string) => request<PublicFormDto>(`/v1/public/forms/${token}`, { auth: false }),
  publicSubmit: (token: string, answers: Record<string, unknown>) =>
    request<void>(`/v1/public/forms/${token}/responses`, { method: "POST", body: { answers }, auth: false }),
}
