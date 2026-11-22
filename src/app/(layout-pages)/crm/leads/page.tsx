"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Handshake, Kanban, List, MoreHorizontal, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { crmRecord, LeadService, type LeadColumn, type LeadDetail, type LeadRow } from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { ConvertDialog } from "../_components/convert-dialog"
import { attempt, errorMessage, LabelChips, PickDialog, PipelineSelect } from "../_components/crm-kit"
import { KanbanBoard } from "../_components/kanban-board"
import { LeadFormDialog } from "../_components/lead-form-dialog"
import { useCrmLookups, userName } from "../_components/use-crm-lookups"

const PAGE_SIZE = 20
const ALL = "ALL"

/** §7.2 Leads: list (filters user, stage, follow-up range) and Kanban per pipeline; convert, label, edit, delete. */
export default function LeadsPage() {
  return (
    <React.Suspense>
      <Leads />
    </React.Suspense>
  )
}

function Leads() {
  const t = useT()
  const router = useRouter()
  const language = useLanguageStore((s) => s.language)
  const me = useAuthStore((s) => s.me)
  const manage = !!me?.permissions?.includes("CRM_MANAGE")
  const lookups = useCrmLookups()
  const { searchParams, update } = useUrlQuery()
  const pipelineId = searchParams.get("pipelineId") ?? lookups.pipelines[0]?.id
  const mode = searchParams.get("mode") === "board" ? "board" : "list"
  const keyword = searchParams.get("keyword") ?? ""
  const stageId = searchParams.get("stageId") ?? undefined
  const ownerUserId = searchParams.get("ownerUserId") ?? undefined
  const followUpFrom = searchParams.get("from") ?? undefined
  const followUpTo = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const pipeline = lookups.pipelines.find((p) => p.id === pipelineId)
  const labelColors = Object.fromEntries(lookups.labels.map((l) => [l.id ?? "", l.color ?? ""]))

  const [data, setData] = React.useState<IPage<LeadRow>>()
  const [board, setBoard] = React.useState<LeadColumn[]>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ detail?: LeadDetail } | null>(null)
  const [converting, setConverting] = React.useState<LeadRow>()
  const [labeling, setLabeling] = React.useState<LeadRow>()
  const [deleting, setDeleting] = React.useState<LeadRow>()

  React.useEffect(() => {
    if (!pipelineId) return
    let cancelled = false
    const load =
      mode === "board"
        ? LeadService.board(pipelineId).then((b) => !cancelled && setBoard(b))
        : LeadService.list({ pipelineId, stageId, ownerUserId, followUpFrom, followUpTo, keyword: keyword || undefined, page, size: PAGE_SIZE }).then(
            (d) => !cancelled && setData(d)
          )
    load.catch((e: Error) => !cancelled && toast.error(e.message)).finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [pipelineId, mode, stageId, ownerUserId, followUpFrom, followUpTo, keyword, page, reloadKey])

  async function openEdit(row: LeadRow) {
    try {
      setEditing({ detail: await LeadService.get(row.id!) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const rows = data?.content ?? []
  const noPipeline = !lookups.loading && lookups.pipelines.length === 0
  const actions = (row: LeadRow) => (
    <LeadActions
      row={row}
      manage={manage}
      onView={() => router.push(`/crm/leads/${row.id}`)}
      onEdit={() => openEdit(row)}
      onConvert={() => setConverting(row)}
      onLabel={() => setLabeling(row)}
      onDelete={() => setDeleting(row)}
    />
  )

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.crm.leads")} description={t("crm.lead.subtitle")}>
        {manage && pipelineId && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("crm.lead.create")}
          </Button>
        )}
      </PageHeader>
      {lookups.error && (
        <Alert variant="destructive">
          <AlertDescription>{lookups.error}</AlertDescription>
        </Alert>
      )}
      {noPipeline ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center">
            {t("crm.pipeline.none")}{" "}
            <Link href="/crm/setup" className="text-primary underline">
              {t("menu.crm.setup")}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <PipelineSelect pipelines={lookups.pipelines} value={pipelineId} onChange={(v) => update({ pipelineId: v, stageId: "", page: 0 })} />
              <ToggleGroup
                type="single"
                variant="outline"
                value={mode}
                onValueChange={(v) => v && update({ mode: v === "board" ? "board" : "" })}
                aria-label={t("crm.viewMode")}
              >
                <ToggleGroupItem value="list" aria-label={t("crm.listView")}>
                  <List className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="board" aria-label={t("crm.boardView")}>
                  <Kanban className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              {mode === "list" && (
                <>
                  <Select value={stageId ?? ALL} onValueChange={(v) => update({ stageId: v === ALL ? "" : v, page: 0 })}>
                    <SelectTrigger className="w-44" aria-label={t("crm.stage")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("crm.allStages")}</SelectItem>
                      {(pipeline?.leadStages ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id ?? ""}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={ownerUserId ?? ALL} onValueChange={(v) => update({ ownerUserId: v === ALL ? "" : v, page: 0 })}>
                    <SelectTrigger className="w-44" aria-label={t("crm.owner")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("crm.allUsers")}</SelectItem>
                      {lookups.users.map((u) => (
                        <SelectItem key={u.id} value={u.id ?? ""}>
                          {u.fullName || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    className="w-40"
                    aria-label={t("crm.followUpFrom")}
                    value={followUpFrom ?? ""}
                    onChange={(e) => update({ from: e.target.value, page: 0 })}
                  />
                  <Input
                    type="date"
                    className="w-40"
                    aria-label={t("crm.followUpTo")}
                    value={followUpTo ?? ""}
                    onChange={(e) => update({ to: e.target.value, page: 0 })}
                  />
                  <form
                    className="flex min-w-60 flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      update({ keyword: search.trim(), page: 0 })
                    }}
                  >
                    <div className="relative flex-1">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("crm.lead.searchPlaceholder")}
                        aria-label={t("common.search")}
                        className="pl-9"
                      />
                    </div>
                    <Button type="submit" variant="secondary">
                      {t("common.search")}
                    </Button>
                  </form>
                </>
              )}
            </div>

            {mode === "board" ? (
              loading || !board ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <KanbanBoard
                  canMove={manage}
                  columns={board.map((c) => ({ id: c.stageId ?? "", name: c.name ?? "", cards: c.leads ?? [] }))}
                  onMove={async (id, stage, position) => {
                    if (await attempt(() => LeadService.move(id, stage, position))) reload()
                  }}
                  renderCard={(l) => (
                    <div className="bg-card flex flex-col gap-1.5 rounded-md border p-3 text-sm shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/crm/leads/${l.id}`} className="font-medium hover:underline">
                          {l.name}
                        </Link>
                        {actions(l)}
                      </div>
                      <div className="text-muted-foreground text-xs">{l.subject}</div>
                      <LabelChips labels={l.labels} colors={labelColors} />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>{t("crm.tasksCount", { done: l.tasksDone ?? 0, total: l.tasksTotal ?? 0 })}</span>
                        <span className={l.followUpOverdue ? "text-destructive" : undefined}>{formatDate(l.followUpDate, language)}</span>
                      </div>
                    </div>
                  )}
                />
              )
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("crm.name")}</TableHead>
                        <TableHead>{t("crm.subject")}</TableHead>
                        <TableHead>{t("crm.owner")}</TableHead>
                        <TableHead>{t("crm.tasks")}</TableHead>
                        <TableHead>{t("crm.followUp")}</TableHead>
                        <TableHead>{t("crm.stage")}</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">{t("common.actions")}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading && rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                            {t("crm.lead.empty")}
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading &&
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link href={`/crm/leads/${row.id}`} className="font-medium hover:underline">
                                {row.name}
                              </Link>
                              <div className="text-muted-foreground text-xs">{row.email}</div>
                              <LabelChips labels={row.labels} colors={labelColors} />
                            </TableCell>
                            <TableCell>{row.subject}</TableCell>
                            <TableCell>{userName(lookups.users, row.ownerUserId)}</TableCell>
                            <TableCell>{`${row.tasksDone ?? 0}/${row.tasksTotal ?? 0}`}</TableCell>
                            <TableCell className={row.followUpOverdue ? "text-destructive" : undefined}>
                              {formatDate(row.followUpDate, language)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.stageName ?? "-"}</Badge>
                              {row.convertedDealId && (
                                <Badge variant="secondary" className="ml-1">
                                  {t("crm.alreadyConverted")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{actions(row)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                <Pager
                  page={data?.page ?? page}
                  size={data?.size ?? PAGE_SIZE}
                  total={data?.totalElements ?? 0}
                  totalPages={data?.totalPages ?? 0}
                  onPage={(p) => update({ page: p })}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <LeadFormDialog
        state={editing}
        lookups={lookups}
        pipelineId={pipelineId}
        meId={me?.userId}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <ConvertDialog
        lead={converting}
        lookups={lookups}
        onClose={() => setConverting(undefined)}
        onConverted={(dealId) => (dealId ? router.push(`/crm/deals/${dealId}`) : reload())}
      />
      <PickDialog
        open={!!labeling}
        title={t("crm.action.labels", { name: labeling?.name ?? "" })}
        options={lookups.labels.filter((l) => l.pipelineId === labeling?.pipelineId).map((l) => ({ value: l.id ?? "", label: l.name ?? "" }))}
        selected={(labeling?.labels ?? []).map((l) => l.refId ?? "")}
        onClose={() => setLabeling(undefined)}
        onSave={async (ids) => {
          const ok = await attempt(() => crmRecord("leads").setLinks(labeling!.id!, "labels", ids), t("common.saved"))
          if (ok) reload()
          return ok
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("crm.confirm.deleteLead", { name: deleting?.name ?? "" })}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => LeadService.remove(deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}

function LeadActions({
  row,
  manage,
  onView,
  onEdit,
  onConvert,
  onLabel,
  onDelete,
}: {
  row: LeadRow
  manage: boolean
  onView: () => void
  onEdit: () => void
  onConvert: () => void
  onLabel: () => void
  onDelete: () => void
}) {
  const t = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label={t("crm.actionsFor", { name: row.name ?? "" })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="size-4" /> {t("crm.action.view")}
        </DropdownMenuItem>
        {manage && (
          <>
            {row.convertedDealId ? (
              <DropdownMenuItem disabled>
                <Handshake className="size-4" /> {t("crm.alreadyConverted")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onConvert}>
                <Handshake className="size-4" /> {t("crm.action.convert")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onLabel}>
              <Tag className="size-4" /> {t("crm.action.label")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" /> {t("common.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
