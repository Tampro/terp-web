"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// media-service (MediaController / MediaDtos). A super admin sees every company's files; companyId narrows to one.

export interface FolderDto {
  id?: string
  companyId?: string | null
  name?: string
  fileCount?: number
  createdDate?: string
}

export interface MediaFileDto {
  id?: string
  companyId?: string | null
  folderId?: string | null
  originalName?: string
  displayName?: string
  mimeType?: string
  extension?: string
  kind?: "IMAGE" | "DOCUMENT"
  sizeBytes?: number
  uploadedAt?: string
  viewUrl?: string
  downloadUrl?: string
  linkExpiresAt?: number
}

export interface MediaStats {
  files?: number
  storageBytes?: number
  images?: number
}

export const MediaService = {
  folders: () => request<FolderDto[]>("/v1/media/folders"),
  createFolder: (name: string) => request<FolderDto>("/v1/media/folders", { method: "POST", body: { name } }),
  renameFolder: (id: string, name: string) =>
    request<FolderDto>(`/v1/media/folders/${id}`, { method: "PUT", body: { name } }),
  deleteFolder: (id: string) => request<void>(`/v1/media/folders/${id}`, { method: "DELETE" }),
  files: (p: { folderId?: string; kind?: "IMAGE" | "DOCUMENT"; keyword?: string; page?: number; size?: number }) =>
    request<IPage<MediaFileDto>>(withQuery("/v1/media/files", { ...p })),
  file: (id: string) => request<MediaFileDto>(`/v1/media/files/${id}`),
  stats: () => request<MediaStats>("/v1/media/stats"),
  upload: (files: File[], folderId?: string) => {
    const fd = new FormData()
    for (const f of files) fd.append("files", f)
    return request<MediaFileDto[]>(withQuery("/v1/media/files", { folderId }), { method: "POST", body: fd })
  },
  update: (id: string, body: { displayName: string; folderId?: number | null }) =>
    request<MediaFileDto>(`/v1/media/files/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/media/files/${id}`, { method: "DELETE" }),
}
