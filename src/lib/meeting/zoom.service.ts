"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Video meetings (manual §11.4). Spec: meeting-service ZoomMeetingController / ZoomMeetingService (MeetingForm, MeetingDto,
// StartDto), ZoomSettingController (SettingsForm, Status). Errors MTG_022 (not set up), MTG_023 (credentials), MTG_024
// (Zoom down), MTG_028 (ended/cancelled). ZOOM_VIEW / ZOOM_MANAGE; passcode and startUrl only for ZOOM_MANAGE.

export type EZoomStatus = "SCHEDULED" | "STARTED" | "ENDED" | "CANCELLED"
export type ERecording = "NONE" | "LOCAL" | "CLOUD"

export interface ZoomPerson {
  id?: string
  fullName?: string
  email?: string | null
}
export interface ZoomMeetingDto {
  id?: string
  zoomMeetingId?: string
  topic?: string
  agenda?: string | null
  startDate?: string
  startTime?: string
  endTime?: string
  durationMinutes?: number
  status?: EZoomStatus
  joinUrl?: string | null
  passcode?: string | null
  startUrl?: string | null
  invitees?: ZoomPerson[]
  hostVideo?: boolean
  participantVideo?: boolean
  waitingRoom?: boolean
  autoRecording?: ERecording
}
export interface ZoomMeetingForm {
  topic: string
  startDate: string
  /** HH:mm */
  startTime: string
  /** 1..1440 */
  durationMinutes: number
  /** [A-Za-z0-9@_*-]{1,10}; omitted = random (create) / kept (edit) */
  passcode?: string | null
  /** employee ids */
  inviteeIds?: number[]
  agenda?: string | null
  hostVideo?: boolean
  participantVideo?: boolean
  waitingRoom?: boolean
  autoRecording?: ERecording
}
export interface ZoomSettings {
  accountId?: string
  clientId?: string
  clientSecretSet?: boolean
  verified?: boolean
}

export const ZoomService = {
  /** configured = settings saved; enabled = tested and the menu shown */
  status: () => request<{ configured?: boolean; enabled?: boolean }>("/v1/meeting/zoom/status"),
  list: (f: { from?: string; to?: string; status?: string }) => request<ZoomMeetingDto[]>(withQuery("/v1/meeting/zoom/meetings", { ...f })),
  get: (id: string) => request<ZoomMeetingDto>(`/v1/meeting/zoom/meetings/${id}`),
  create: (body: ZoomMeetingForm) => request<ZoomMeetingDto>("/v1/meeting/zoom/meetings", { method: "POST", body }),
  update: (id: string, body: ZoomMeetingForm) => request<ZoomMeetingDto>(`/v1/meeting/zoom/meetings/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/meeting/zoom/meetings/${id}`, { method: "DELETE" }),
  setStatus: (id: string, status: EZoomStatus) => request<ZoomMeetingDto>(`/v1/meeting/zoom/meetings/${id}/status`, { method: "PUT", body: { status } }),
  /** → the host start URL */
  start: (id: string) => request<{ status?: EZoomStatus; startUrl?: string }>(`/v1/meeting/zoom/meetings/${id}/start`, { method: "POST" }),
  settings: () => request<ZoomSettings>("/v1/meeting/zoom/settings"),
  /** the secret is write-only: omit it to keep the stored one */
  saveSettings: (body: { accountId: string; clientId: string; clientSecret?: string }) =>
    request<ZoomSettings>("/v1/meeting/zoom/settings", { method: "PUT", body }),
  testSettings: () => request<ZoomSettings>("/v1/meeting/zoom/settings/test", { method: "POST" }),
}

export interface EmployeeOption {
  id?: string
  fullName?: string
  employeeCode?: string
  email?: string | null
}
/** employee-service (EMPLOYEE_VIEW); TODO(assumption): the first 100 are enough until a searchable picker is needed. */
export const EmployeeLookupService = {
  employees: () => request<IPage<EmployeeOption>>(withQuery("/v1/employees", { size: 100 })),
}
