"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// CRM & contracts (manual §7). Spec: crm-service SetupController (/crm/pipelines, stages, labels, sources),
// CrmControllers (/crm/leads, /crm/deals, /crm/{leads|deals}/{id}/tasks|calls|discussions|emails|files|entries,
// /crm/reports), ContractController, ContractTypeController, ContractSettingController. The gateway has no Swagger
// route for crm: read http://localhost:18094/v3/api-docs. Every field optional.

export type EStageKind = "LEAD" | "DEAL"
export type EDealStatus = "ACTIVE" | "WON" | "LOSS"
export type ETaskPriority = "LOW" | "MEDIUM" | "HIGH"
export type ETaskStatus = "OPEN" | "DONE"
export type ECallType = "INBOUND" | "OUTBOUND"
export type EEntryType = "DISCUSSION" | "EMAIL" | "FILE" | "ACTIVITY"
export type EContractStatus = "PENDING" | "ACTIVE" | "CLOSED" | "DECLINED"
/** path segment of the activity endpoints */
export type ESubjectPath = "leads" | "deals"
/** PUT /{leads|deals}/{id}/{kind}; clients only on deals (CRM_013 on a lead) */
export type ELinkKind = "members" | "clients" | "labels" | "sources" | "products"
/** ConvertForm.copy values (LeadService.COPYABLE) */
export const CONVERT_COPY = ["PRODUCTS", "SOURCES", "FILES", "DISCUSSIONS", "NOTES", "CALLS", "EMAILS", "TASKS", "USERS"] as const

export interface StageDto {
  id?: string
  pipelineId?: string
  kind?: EStageKind
  name?: string
  position?: number
}
export interface PipelineDto {
  id?: string
  name?: string
  leadStages?: StageDto[]
  dealStages?: StageDto[]
}
export interface LabelDto {
  id?: string
  pipelineId?: string
  name?: string
  /** CSS colour, e.g. #2563eb */
  color?: string
}
export interface SourceDto {
  id?: string
  name?: string
}
export interface LinkDto {
  refId?: string
  name?: string
}
export interface TaskDto {
  id?: string
  name?: string
  date?: string
  /** HH:mm */
  time?: string | null
  priority?: ETaskPriority
  status?: ETaskStatus
}
export interface CallDto {
  id?: string
  subject?: string
  callType?: ECallType
  duration?: string | null
  assigneeUserId?: string | null
  description?: string | null
  callResult?: string | null
  createdDate?: string
}
export interface EntryDto {
  id?: string
  type?: EEntryType
  title?: string | null
  body?: string | null
  emailTo?: string | null
  mediaFileId?: string | null
  authorName?: string | null
  createdDate?: string
}
export interface Activity {
  members?: LinkDto[]
  clients?: LinkDto[]
  labels?: LinkDto[]
  sources?: LinkDto[]
  products?: LinkDto[]
  tasks?: TaskDto[]
  calls?: CallDto[]
  discussions?: EntryDto[]
  emails?: EntryDto[]
  files?: EntryDto[]
  activity?: EntryDto[]
}

export interface LeadRow {
  id?: string
  pipelineId?: string
  stageId?: string
  stageName?: string
  name?: string
  email?: string
  subject?: string
  phone?: string | null
  followUpDate?: string | null
  /** follow-up date in the past (shown red) */
  followUpOverdue?: boolean
  ownerUserId?: string
  tasksTotal?: number
  tasksDone?: number
  labels?: LinkDto[]
  position?: number
  /** set once converted ("Already Converted", CRM_011) */
  convertedDealId?: string | null
  createdDate?: string
}
export interface LeadDetail {
  lead?: LeadRow
  notes?: string | null
  activity?: Activity
}
export interface LeadForm {
  pipelineId: number
  /** omit = the pipeline's first lead stage (create only; later through move) */
  stageId?: number
  name: string
  email: string
  subject: string
  ownerUserId: number
  phone?: string | null
  followUpDate?: string | null
  notes?: string | null
}
export interface LeadColumn {
  stageId?: string
  name?: string
  leads?: LeadRow[]
}

export interface DealRow {
  id?: string
  pipelineId?: string
  stageId?: string
  stageName?: string
  name?: string
  price?: number
  phone?: string | null
  status?: EDealStatus
  tasksTotal?: number
  tasksDone?: number
  clients?: LinkDto[]
  labels?: LinkDto[]
  position?: number
  fromLeadId?: string | null
  createdDate?: string
}
export interface DealDetail {
  deal?: DealRow
  notes?: string | null
  activity?: Activity
}
export interface DealForm {
  pipelineId: number
  stageId?: number
  name: string
  price: number
  phone?: string | null
  /** accounting customers */
  clientIds?: number[]
  notes?: string | null
}
export interface DealColumn {
  stageId?: string
  name?: string
  count?: number
  total?: number
  deals?: DealRow[]
}

export interface ConvertForm {
  /** omit = the lead's subject */
  dealName?: string
  /** omit = 0 */
  price?: number
  /** an existing accounting customer, or newClient (exactly one, CRM_018) */
  customerId?: number
  newClient?: { companyName: string; contactPerson?: string; email?: string; mobile?: string }
  copy?: string[]
}

export interface TaskForm {
  name: string
  date: string
  time?: string | null
  priority?: ETaskPriority
  status?: ETaskStatus
}
export interface CallForm {
  subject: string
  callType: ECallType
  duration?: string | null
  assigneeUserId?: number | null
  description?: string | null
  callResult?: string | null
}

export interface LeadFilter {
  pipelineId?: string
  stageId?: string
  ownerUserId?: string
  followUpFrom?: string
  followUpTo?: string
  keyword?: string
  page?: number
  size?: number
}
export interface DealFilter {
  pipelineId?: string
  stageId?: string
  status?: EDealStatus
  keyword?: string
  page?: number
  size?: number
}

export interface CountRow {
  id?: string
  name?: string
  count?: number
}
export interface AmountRow extends CountRow {
  value?: number
}
export interface LeadReport {
  year?: number
  total?: number
  converted?: number
  conversionPercent?: number
  byStage?: CountRow[]
  bySource?: CountRow[]
  byMonth?: { month?: number; created?: number; converted?: number }[]
  byUser?: CountRow[]
}
export interface DealReport {
  year?: number
  total?: number
  totalValue?: number
  byStatus?: Partial<Record<EDealStatus, AmountRow>>
  byStage?: AmountRow[]
  bySource?: CountRow[]
  byMonth?: { month?: number; count?: number; value?: number }[]
}

export interface ContractRow {
  id?: string
  /** prefix + number, e.g. CON0001 */
  number?: string
  subject?: string
  customerId?: string
  customerName?: string | null
  contractTypeId?: string
  value?: number | null
  startDate?: string
  endDate?: string
  status?: EContractStatus
  progressPercent?: number
  daysLeft?: number
  /** owner = creator (Keycloak user id); name null on contracts created before 2026-11-24 */
  ownerId?: string | null
  ownerName?: string | null
  createdDate?: string
}
export interface RenewalDto {
  id?: string
  startDate?: string
  endDate?: string
  value?: number
  status?: EContractStatus
  notes?: string | null
  createdBy?: string
  createdDate?: string
}
export interface CommentDto {
  id?: string
  message?: string
  authorName?: string | null
  createdBy?: string
  createdDate?: string
}
export interface NoteDto {
  id?: string
  note?: string
  createdBy?: string
  createdDate?: string
  updatedDate?: string
}
export interface AttachmentDto {
  id?: string
  mediaFileId?: string
  fileName?: string | null
  createdBy?: string
  createdDate?: string
}
export interface ContractDetail {
  contract?: ContractRow
  contractTypeName?: string | null
  /** agreement text */
  description?: string | null
  renewals?: RenewalDto[]
  comments?: CommentDto[]
  notes?: NoteDto[]
  attachments?: AttachmentDto[]
}
// Contract signatures (crm-service ContractSignatureController): one hand-drawn PNG per side (COMPANY here, CLIENT on the
// client portal); PENDING only (CTR_017); either side first, both → ACTIVE; after the first signature no edit / delete
// (CTR_018); image CTR_013 bad PNG data URL, CTR_014 > 200 KB, CTR_015 > 2000 x 1000 px, CTR_016 side already signed.
export type ESignerType = "COMPANY" | "CLIENT"
export interface SignatureDto {
  signerType?: ESignerType
  signerUserId?: string | null
  signerName?: string | null
  signerEmail?: string | null
  signedAt?: string
  contentSha256?: string
  /** the contract's current content hash equals the one stored when this side signed */
  contentMatches?: boolean
  ip?: string | null
  userAgent?: string | null
}
export interface ContractForm {
  subject: string
  customerId: number
  contractTypeId: number
  value?: number | null
  startDate: string
  endDate: string
  status?: EContractStatus
  description?: string | null
}
export interface ContractFilter {
  customerId?: string
  contractTypeId?: string
  status?: EContractStatus
  startFrom?: string
  startTo?: string
  endFrom?: string
  endTo?: string
  keyword?: string
  page?: number
  size?: number
}
export interface ContractCounts {
  total?: number
  active?: number
  pending?: number
  closed?: number
  declined?: number
}
export interface RenewalForm {
  startDate: string
  endDate: string
  value: number
  status: EContractStatus
  notes?: string | null
}
export interface ContractTypeDto {
  id?: string
  companyId?: string
  name?: string
  /** contracts (not deleted) of this type in the company */
  contractCount?: number
  active?: boolean
}
export interface ContractSettingDto {
  companyId?: string
  prefix?: string
  nextNumber?: number
  nextContractNumber?: string
}
export interface CrmUserOption {
  id?: string
  username?: string
  fullName?: string | null
  email?: string
  status?: string
  roles?: string[]
}

const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })

export const CrmSetupService = {
  pipelines: () => request<PipelineDto[]>("/v1/crm/pipelines"),
  createPipeline: (name: string) => post<PipelineDto>("/v1/crm/pipelines", { name }),
  renamePipeline: (id: string, name: string) => put<PipelineDto>(`/v1/crm/pipelines/${id}`, { name }),
  /** with its stages and labels; CRM_009 while leads or deals use it */
  removePipeline: (id: string) => del(`/v1/crm/pipelines/${id}`),
  addStage: (pipelineId: string, kind: EStageKind, name: string) =>
    post<StageDto>(`/v1/crm/pipelines/${pipelineId}/stages`, { kind, name }),
  /** exactly the pipeline's stages of that kind (CRM_020) */
  orderStages: (pipelineId: string, kind: EStageKind, stageIds: string[]) =>
    put<PipelineDto>(`/v1/crm/pipelines/${pipelineId}/stages/order`, { kind, stageIds: stageIds.map(Number) }),
  renameStage: (id: string, name: string) => put<StageDto>(`/v1/crm/stages/${id}`, { name }),
  removeStage: (id: string) => del(`/v1/crm/stages/${id}`),
  labels: (pipelineId?: string) => request<LabelDto[]>(withQuery("/v1/crm/labels", { pipelineId })),
  saveLabel: (id: string | undefined, body: { pipelineId: number; name: string; color: string }) =>
    id ? put<LabelDto>(`/v1/crm/labels/${id}`, body) : post<LabelDto>("/v1/crm/labels", body),
  removeLabel: (id: string) => del(`/v1/crm/labels/${id}`),
  sources: () => request<SourceDto[]>("/v1/crm/sources"),
  saveSource: (id: string | undefined, name: string) =>
    id ? put<SourceDto>(`/v1/crm/sources/${id}`, { name }) : post<SourceDto>("/v1/crm/sources", { name }),
  removeSource: (id: string) => del(`/v1/crm/sources/${id}`),
}

export const LeadService = {
  list: (f: LeadFilter) => request<IPage<LeadRow>>(withQuery("/v1/crm/leads", { ...f })),
  board: (pipelineId: string) => request<LeadColumn[]>(withQuery("/v1/crm/leads/board", { pipelineId })),
  get: (id: string) => request<LeadDetail>(`/v1/crm/leads/${id}`),
  create: (body: LeadForm) => post<LeadDetail>("/v1/crm/leads", body),
  /** full replacement; pipeline and stage change only through move */
  update: (id: string, body: LeadForm) => put<LeadDetail>(`/v1/crm/leads/${id}`, body),
  remove: (id: string) => del(`/v1/crm/leads/${id}`),
  /** Kanban drag; position 1-based, omit = end of the column */
  move: (id: string, stageId: string, position?: number) =>
    put<LeadDetail>(`/v1/crm/leads/${id}/stage`, { stageId: Number(stageId), position }),
  /** → {dealId, customerId} */
  convert: (id: string, body: ConvertForm) => post<Record<string, string>>(`/v1/crm/leads/${id}/convert`, body),
}

export const DealService = {
  list: (f: DealFilter) => request<IPage<DealRow>>(withQuery("/v1/crm/deals", { ...f })),
  board: (pipelineId: string) => request<DealColumn[]>(withQuery("/v1/crm/deals/board", { pipelineId })),
  get: (id: string) => request<DealDetail>(`/v1/crm/deals/${id}`),
  create: (body: DealForm) => post<DealDetail>("/v1/crm/deals", body),
  update: (id: string, body: DealForm) => put<DealDetail>(`/v1/crm/deals/${id}`, body),
  remove: (id: string) => del(`/v1/crm/deals/${id}`),
  move: (id: string, stageId: string, position?: number) =>
    put<DealDetail>(`/v1/crm/deals/${id}/stage`, { stageId: Number(stageId), position }),
  status: (id: string, status: EDealStatus) => put<DealDetail>(`/v1/crm/deals/${id}/status`, { status }),
}

/** Links and activity shared by leads and deals. */
export function crmRecord(subject: ESubjectPath) {
  const base = (id: string) => `/v1/crm/${subject}/${id}`
  return {
    /** full replacement of one link list (ids of users / customers / labels / sources / items) */
    setLinks: (id: string, kind: ELinkKind, ids: string[]) =>
      put<LinkDto[]>(`${base(id)}/${kind}`, { ids: ids.map(Number) }),
    addTask: (id: string, body: TaskForm) => post<TaskDto>(`${base(id)}/tasks`, body),
    updateTask: (id: string, taskId: string, body: TaskForm) => put<TaskDto>(`${base(id)}/tasks/${taskId}`, body),
    removeTask: (id: string, taskId: string) => del(`${base(id)}/tasks/${taskId}`),
    addCall: (id: string, body: CallForm) => post<CallDto>(`${base(id)}/calls`, body),
    updateCall: (id: string, callId: string, body: CallForm) => put<CallDto>(`${base(id)}/calls/${callId}`, body),
    removeCall: (id: string, callId: string) => del(`${base(id)}/calls/${callId}`),
    addDiscussion: (id: string, comment: string) => post<EntryDto>(`${base(id)}/discussions`, { comment }),
    /** logged only, not sent */
    addEmail: (id: string, body: { to: string; subject: string; body: string }) => post<EntryDto>(`${base(id)}/emails`, body),
    /** a file of the company's media library (CRM_014) */
    addFile: (id: string, mediaFileId: string) => post<EntryDto>(`${base(id)}/files`, { mediaFileId: Number(mediaFileId) }),
    removeEntry: (id: string, entryId: string) => del(`${base(id)}/entries/${entryId}`),
  }
}

export const CrmReportService = {
  leads: (year: number, pipelineId?: string) => request<LeadReport>(withQuery("/v1/crm/reports/leads", { year, pipelineId })),
  deals: (year: number, pipelineId?: string) => request<DealReport>(withQuery("/v1/crm/reports/deals", { year, pipelineId })),
}

export const ContractService = {
  list: (f: ContractFilter) => request<IPage<ContractRow>>(withQuery("/v1/crm/contracts", { ...f })),
  counts: () => request<ContractCounts>("/v1/crm/contracts/status-counts"),
  get: (id: string) => request<ContractDetail>(`/v1/crm/contracts/${id}`),
  create: (body: ContractForm) => post<ContractDetail>("/v1/crm/contracts", body),
  update: (id: string, body: ContractForm) => put<ContractDetail>(`/v1/crm/contracts/${id}`, body),
  remove: (id: string) => del(`/v1/crm/contracts/${id}`),
  status: (id: string, status: EContractStatus) => put<ContractDetail>(`/v1/crm/contracts/${id}/status`, { status }),
  duplicate: (id: string) => post<ContractDetail>(`/v1/crm/contracts/${id}/duplicate`),
  addRenewal: (id: string, body: RenewalForm) => post<RenewalDto>(`/v1/crm/contracts/${id}/renewals`, body),
  updateRenewal: (id: string, rid: string, body: RenewalForm) =>
    put<RenewalDto>(`/v1/crm/contracts/${id}/renewals/${rid}`, body),
  removeRenewal: (id: string, rid: string) => del(`/v1/crm/contracts/${id}/renewals/${rid}`),
  addNote: (id: string, note: string) => post<NoteDto>(`/v1/crm/contracts/${id}/notes`, { note }),
  updateNote: (id: string, nid: string, note: string) => put<NoteDto>(`/v1/crm/contracts/${id}/notes/${nid}`, { note }),
  removeNote: (id: string, nid: string) => del(`/v1/crm/contracts/${id}/notes/${nid}`),
  addComment: (id: string, message: string) => post<CommentDto>(`/v1/crm/contracts/${id}/comments`, { message }),
  removeComment: (id: string, cid: string) => del(`/v1/crm/contracts/${id}/comments/${cid}`),
  /** a file of the contract company's media library (CTR_012) */
  addAttachment: (id: string, mediaFileId: string) =>
    post<AttachmentDto>(`/v1/crm/contracts/${id}/attachments`, { mediaFileId: Number(mediaFileId) }),
  removeAttachment: (id: string, aid: string) => del(`/v1/crm/contracts/${id}/attachments/${aid}`),
  signatures: (id: string) => request<SignatureDto[]>(`/v1/crm/contracts/${id}/signatures`),
  /** company side; signerName omitted = my name from the token */
  sign: (id: string, body: { signatureDataUrl: string; signerName?: string }) => post<SignatureDto[]>(`/v1/crm/contracts/${id}/signatures`, body),
  signatureImage: (id: string, type: ESignerType) => request<Blob>(`/v1/crm/contracts/${id}/signatures/${type}/image`, { as: "blob" }),
  /** contract PDF with both signatures (or empty signature boxes) */
  pdf: (id: string) => request<Blob>(`/v1/crm/contracts/${id}/pdf`, { as: "blob" }),
}

export const ContractTypeService = {
  list: () => request<ContractTypeDto[]>("/v1/crm/contract-types"),
  save: (id: string | undefined, body: { name: string; active: boolean }) =>
    id ? put<ContractTypeDto>(`/v1/crm/contract-types/${id}`, body) : post<ContractTypeDto>("/v1/crm/contract-types", body),
  /** CTR_005 while contracts use it */
  remove: (id: string) => del(`/v1/crm/contract-types/${id}`),
  settings: () => request<ContractSettingDto>("/v1/crm/contract-settings"),
  saveSettings: (prefix: string) => put<ContractSettingDto>("/v1/crm/contract-settings", { prefix }),
}

/** IAM accounts of the company (lead owner, members, call assignee); IAM_USER_VIEW. */
export const CrmUserService = {
  users: () => request<IPage<CrmUserOption>>(withQuery("/v1/iam/users", { size: 100 })),
}
