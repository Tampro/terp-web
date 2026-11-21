"use client"

import * as React from "react"
import { Download, FileText, Folder, FolderPlus, HardDrive, Image as ImageIcon, Pencil, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import type { IPage } from "@/lib/api"
import { formatBytes, formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { MediaService, type FolderDto, type MediaFileDto, type MediaStats } from "@/lib/media/media.service"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

export default function MediaPage() {
  return (
    <RequireSuperAdmin>
      <MediaLibrary />
    </RequireSuperAdmin>
  )
}

/** §3.6 Media library — media-service. A super admin sees every company's files. */
function MediaLibrary() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const fileInput = React.useRef<HTMLInputElement>(null)

  const [folderId, setFolderId] = React.useState<string>()
  const [keyword, setKeyword] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(0)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  const [stats, setStats] = React.useState<MediaStats>()
  const [folders, setFolders] = React.useState<FolderDto[]>([])
  const [files, setFiles] = React.useState<IPage<MediaFileDto>>()
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)

  const [detail, setDetail] = React.useState<MediaFileDto>()
  const [deletingFile, setDeletingFile] = React.useState<MediaFileDto>()
  const [deletingFolder, setDeletingFolder] = React.useState<FolderDto>()
  const [folderDialog, setFolderDialog] = React.useState<{ folder?: FolderDto } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      MediaService.stats(),
      MediaService.folders(),
      MediaService.files({ folderId, keyword: keyword || undefined, page, size: PAGE_SIZE }),
    ])
      .then(([s, f, list]) => {
        if (cancelled) return
        setStats(s)
        setFolders(f ?? [])
        setFiles(list)
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [folderId, keyword, page, reloadKey])

  async function upload(list: FileList | File[] | null) {
    const arr = Array.from(list ?? [])
    if (!arr.length) return
    setUploading(true)
    try {
      const uploaded = await MediaService.upload(arr, folderId)
      toast.success(t("media.uploaded", { n: uploaded?.length ?? arr.length }))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const statCards = [
    { label: t("media.totalFiles"), value: formatNumber(stats?.files, language), icon: FileText },
    { label: t("media.storageUsed"), value: formatBytes(stats?.storageBytes), icon: HardDrive },
    { label: t("media.images"), value: formatNumber(stats?.images, language), icon: ImageIcon },
  ]
  const rows = files?.content ?? []
  const currentFolder = folders.find((f) => f.id === folderId)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("media.title")} description={t("media.subtitle")}>
        <Button variant="outline" onClick={() => setFolderDialog({})}>
          <FolderPlus className="size-4" /> {t("media.newFolder")}
        </Button>
        <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Upload className="size-4" /> {uploading ? t("media.uploading") : t("media.upload")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          data-testid="media-file-input"
          onChange={(e) => {
            void upload(e.target.files)
            e.target.value = ""
          }}
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="text-2xl font-semibold">{loading ? "…" : value}</p>
              </div>
              <Icon className="text-primary size-6" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card>
          <CardContent className="grid gap-1 p-2">
            <button
              type="button"
              onClick={() => {
                setFolderId(undefined)
                setPage(0)
              }}
              className={cn("hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", !folderId && "bg-muted font-medium")}
            >
              <Folder className="size-4" /> {t("media.allFiles")}
            </button>
            {folders.map((f) => (
              <div key={f.id} className={cn("group hover:bg-muted flex items-center rounded-md", folderId === f.id && "bg-muted")}>
                <button
                  type="button"
                  onClick={() => {
                    setFolderId(f.id)
                    setPage(0)
                  }}
                  className={cn("flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm", folderId === f.id && "font-medium")}
                >
                  <Folder className="size-4 shrink-0" />
                  <span className="truncate">{f.name ?? "-"}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{f.fileCount ?? 0}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t("media.renameFolder", { name: f.name ?? "" })}
                  onClick={() => setFolderDialog({ folder: f })}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t("media.deleteFolder", { name: f.name ?? "" })}
                  onClick={() => setDeletingFolder(f)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void upload(e.dataTransfer.files)
          }}
          className={cn(dragging && "ring-primary ring-2")}
        >
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <nav aria-label={t("media.breadcrumb")} className="text-muted-foreground text-sm">
                {t("media.allFiles")}
                {currentFolder && <> / <span className="text-foreground">{currentFolder.name}</span></>}
              </nav>
              <form
                className="ml-auto flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  setKeyword(search.trim())
                  setPage(0)
                }}
              >
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("media.searchPlaceholder")}
                    aria-label={t("common.search")}
                    className="w-56 pl-9"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  {t("common.search")}
                </Button>
              </form>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
                <Upload className="size-6" />
                {t("media.empty")}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {rows.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(f)}
                      className="hover:border-primary w-full overflow-hidden rounded-lg border text-left"
                      aria-label={f.displayName ?? f.originalName ?? "-"}
                    >
                      <div className="bg-muted flex aspect-square items-center justify-center">
                        {f.kind === "IMAGE" && f.viewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.viewUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <FileText className="text-muted-foreground size-8" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-medium">{f.displayName ?? f.originalName ?? "-"}</p>
                        <p className="text-muted-foreground text-[11px]">{formatBytes(f.sizeBytes)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Pager
              page={files?.page ?? page}
              size={files?.size ?? PAGE_SIZE}
              total={files?.totalElements ?? 0}
              totalPages={files?.totalPages ?? 0}
              onPage={setPage}
            />
          </CardContent>
        </Card>
      </div>

      <FileDetailDialog
        file={detail}
        folders={folders}
        onOpenChange={(o) => !o && setDetail(undefined)}
        onSaved={reload}
        onDelete={(f) => {
          setDetail(undefined)
          setDeletingFile(f)
        }}
      />
      <FolderDialog state={folderDialog} onClose={() => setFolderDialog(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!deletingFile}
        onOpenChange={(o) => !o && setDeletingFile(undefined)}
        title={t("media.deleteFileTitle", { name: deletingFile?.displayName ?? "" })}
        description={t("media.deleteFileDesc")}
        onConfirm={async () => {
          if (!deletingFile?.id) return
          try {
            await MediaService.remove(deletingFile.id)
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
      <ConfirmDialog
        open={!!deletingFolder}
        onOpenChange={(o) => !o && setDeletingFolder(undefined)}
        title={t("media.deleteFolder", { name: deletingFolder?.name ?? "" })}
        description={t("media.deleteFolderDesc")}
        onConfirm={async () => {
          if (!deletingFolder?.id) return
          try {
            await MediaService.deleteFolder(deletingFolder.id)
            if (folderId === deletingFolder.id) setFolderId(undefined)
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}

function FileDetailDialog({
  file,
  folders,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  file?: MediaFileDto
  folders: FolderDto[]
  onOpenChange: (o: boolean) => void
  onSaved: () => void
  onDelete: (f: MediaFileDto) => void
}) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [shown, setShown] = React.useState<string>()
  if (file?.id !== shown) {
    // Reset the editable name when another file is opened (state derived from props, no effect needed).
    setShown(file?.id)
    setName(file?.displayName ?? "")
  }

  async function save() {
    if (!file?.id || !name.trim()) return
    setSaving(true)
    try {
      await MediaService.update(file.id, {
        displayName: name.trim(),
        folderId: file.folderId ? Number(file.folderId) : null, // PUT is a full replacement: keep the folder
      })
      toast.success(t("common.saved"))
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const rows: [string, string][] = [
    [t("media.fileName"), file?.originalName ?? "-"],
    [t("media.mimeType"), file?.mimeType ?? "-"],
    [t("media.size"), formatBytes(file?.sizeBytes)],
    [t("media.uploadedAt"), formatDate(file?.uploadedAt, language, true)],
    [t("media.folder"), folders.find((f) => f.id === file?.folderId)?.name ?? "-"],
  ]

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("media.details")}</DialogTitle>
          <DialogDescription className="truncate">{file?.displayName ?? "-"}</DialogDescription>
        </DialogHeader>
        {file?.kind === "IMAGE" && file.viewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.viewUrl} alt={file.displayName ?? ""} className="bg-muted max-h-64 w-full rounded-md object-contain" />
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="displayName">{t("media.displayName")}</Label>
          <Input id="displayName" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={() => file && onDelete(file)}>
            <Trash2 className="size-4" /> {t("common.delete")}
          </Button>
          <div className="flex gap-2">
            {file?.downloadUrl && (
              <Button variant="outline" asChild>
                <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" /> {t("media.download")}
                </a>
              </Button>
            )}
            <Button onClick={save} disabled={saving || !name.trim() || name.trim() === file?.displayName}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FolderDialog({
  state,
  onClose,
  onSaved,
}: {
  state: { folder?: FolderDto } | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [openedFor, setOpenedFor] = React.useState<FolderDto | undefined | null>(null)
  if (state !== null && openedFor !== (state.folder ?? undefined)) {
    setOpenedFor(state.folder ?? undefined)
    setName(state.folder?.name ?? "")
  }
  if (state === null && openedFor !== null) setOpenedFor(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setSaving(true)
    try {
      if (state?.folder?.id) await MediaService.renameFolder(state.folder.id, n)
      else await MediaService.createFolder(n)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{state?.folder ? t("media.renameFolderTitle") : t("media.newFolder")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="folderName">{t("media.folderName")}</Label>
            <Input id="folderName" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
