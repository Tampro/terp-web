"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, CircleCheck, CircleDot, CircleX, Eye, Kanban, List, MoreHorizontal, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react"
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
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { crmRecord, DealService, type DealColumn, type DealDetail, type DealRow, type EDealStatus } from "@/lib/crm/crm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { attempt, DealStatusBadge, errorMessage, LabelChips, PickDialog, PipelineSelect } from "../_components/crm-kit"
import { DealFormDialog } from "../_components/deal-form-dialog"
import { KanbanBoard } from "../_components/kanban-board"
import { useCrmLookups } from "../_components/use-crm-lookups"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES: EDealStatus[] = ["ACTIVE", "WON", "LOSS"]
const STATUS_ICON = { ACTIVE: CircleDot, WON: CircleCheck, LOSS: CircleX }

/** §7.3 Deals: list (name, price, tasks, clients, stage, status) and Kanban with counts and totals per stage. */
export default function DealsPage() {
  return (
    <React.Suspense>
      <Deals />
    </React.Suspense>
  )
}

function Deals() {
  const t = useT()
  const money = useMoney()
  const router = useRouter()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("CRM_MANAGE")
  const lookups = useCrmLookups()
  const { searchParams, update } = useUrlQuery()
  const pipelineId = searchParams.get("pipelineId") ?? lookups.pipelines[0]?.id
  const mode = searchParams.get("mode") === "board" ? "board" : "list"
  const keyword = searchParams.get("keyword") ?? ""
  const stageId = searchParams.get("stageId") ?? undefined
  const status = (searchParams.get("status") as EDealStatus | null) ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const pipeline = lookups.pipelines.find((p) => p.id === pipelineId)
  const labelColors = Object.fromEntries(lookups.labels.map((l) => [l.id ?? "", l.color ?? ""]))

  const [data, setData] = React.useState<IPage<DealRow>>()
  const [board, setBoard] = React.useState<DealColumn[]>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ detail?: DealDetail } | null>(null)
  const [labeling, setLabeling] = React.useState<DealRow>()
  const [deleting, setDeleting] = React.useState<DealRow>()

  React.useEffect(() => {
    if (!pipelineId) return
    let cancelled = false
    const load =
      mode === "board"
        ? DealService.board(pipelineId).then((b) => !cancelled && setBoard(b))
        : DealService.list({ pipelineId, stageId, status, keyword: keyword || undefined, page, size: PAGE_SIZE }).then(
            (d) => !cancelled && setData(d)
          )
    load.catch((e: Error) => !cancelled && toast.error(e.message)).finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [pipelineId, mode, stageId, status, keyword, page, reloadKey])

  async function openEdit(row: DealRow) {
    try {
      setEditing({ detail: await DealService.get(row.id!) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const rows = data?.content ?? []
  const noPipeline = !lookups.loading && lookups.pipelines.length === 0
  const actions = (row: DealRow) => (
    <DealActions
      row={row}
      manage={manage}
      onView={() => router.push(`/crm/deals/${row.id}`)}
      onEdit={() => openEdit(row)}
      onStatus={async (s) => {
        if (await attempt(() => DealService.status(row.id!, s), t("common.saved"))) reload()
      }}
      onLabel={() => setLabeling(row)}
      onDelete={() => setDeleting(row)}
    />
  )
  const clients = (row: DealRow) => (row.clients ?? []).map((c) => c.name).join(", ") || "-"

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.crm.deals")} description={t("crm.deal.subtitle")}>
        {/* core's CRM tasks page: the unified calendar (crm-service /crm/tasks/calendar) filtered on DEAL_TASK */}
        <Button variant="outline" asChild>
          <Link href="/calendar?kinds=DEAL_TASK">
            <CalendarDays className="size-4" /> {t("crm.taskCalendar")}
          </Link>
        </Button>
        {manage && pipelineId && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("crm.deal.create")}
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
                      {(pipeline?.dealStages ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id ?? ""}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={status ?? ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
                    <SelectTrigger className="w-40" aria-label={t("crm.status")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("crm.allStatuses")}</SelectItem>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`crm.dealStatus.${s}` as TranslationKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        placeholder={t("crm.deal.searchPlaceholder")}
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
                  columns={board.map((c) => ({ id: c.stageId ?? "", name: c.name ?? "", extra: money(c.total), cards: c.deals ?? [] }))}
                  onMove={async (id, stage, position) => {
                    if (await attempt(() => DealService.move(id, stage, position))) reload()
                  }}
                  renderCard={(d) => (
                    <div className="bg-card flex flex-col gap-1.5 rounded-md border p-3 text-sm shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/crm/deals/${d.id}`} className="font-medium hover:underline">
                          {d.name}
                        </Link>
                        {actions(d)}
                      </div>
                      <div className="font-medium">{money(d.price)}</div>
                      <div className="text-muted-foreground text-xs">{clients(d)}</div>
                      <LabelChips labels={d.labels} colors={labelColors} />
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>{t("crm.tasksCount", { done: d.tasksDone ?? 0, total: d.tasksTotal ?? 0 })}</span>
                        <DealStatusBadge status={d.status} />
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
                        <TableHead>{t("crm.deal.name")}</TableHead>
                        <TableHead className="text-right">{t("crm.price")}</TableHead>
                        <TableHead>{t("crm.tasks")}</TableHead>
                        <TableHead>{t("crm.clients")}</TableHead>
                        <TableHead>{t("crm.stage")}</TableHead>
                        <TableHead>{t("crm.status")}</TableHead>
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
                            {t("crm.deal.empty")}
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading &&
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Link href={`/crm/deals/${row.id}`} className="font-medium hover:underline">
                                {row.name}
                              </Link>
                              <LabelChips labels={row.labels} colors={labelColors} />
                            </TableCell>
                            <TableCell className="text-right">{money(row.price)}</TableCell>
                            <TableCell>{`${row.tasksDone ?? 0}/${row.tasksTotal ?? 0}`}</TableCell>
                            <TableCell>{clients(row)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.stageName ?? "-"}</Badge>
                            </TableCell>
                            <TableCell>
                              <DealStatusBadge status={row.status} />
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

      <DealFormDialog state={editing} lookups={lookups} pipelineId={pipelineId} onClose={() => setEditing(null)} onSaved={reload} />
      <PickDialog
        open={!!labeling}
        title={t("crm.action.labels", { name: labeling?.name ?? "" })}
        options={lookups.labels.filter((l) => l.pipelineId === labeling?.pipelineId).map((l) => ({ value: l.id ?? "", label: l.name ?? "" }))}
        selected={(labeling?.labels ?? []).map((l) => l.refId ?? "")}
        onClose={() => setLabeling(undefined)}
        onSave={async (ids) => {
          const ok = await attempt(() => crmRecord("deals").setLinks(labeling!.id!, "labels", ids), t("common.saved"))
          if (ok) reload()
          return ok
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("crm.confirm.deleteDeal", { name: deleting?.name ?? "" })}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => DealService.remove(deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}

function DealActions({
  row,
  manage,
  onView,
  onEdit,
  onStatus,
  onLabel,
  onDelete,
}: {
  row: DealRow
  manage: boolean
  onView: () => void
  onEdit: () => void
  onStatus: (s: EDealStatus) => void
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
            {STATUSES.filter((s) => s !== row.status).map((s) => {
              const Icon = STATUS_ICON[s]
              return (
                <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                  <Icon className="size-4" /> {t(`crm.markAs.${s}` as TranslationKey)}
                </DropdownMenuItem>
              )
            })}
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
