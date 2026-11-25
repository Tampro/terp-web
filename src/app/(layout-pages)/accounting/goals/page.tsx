"use client"

import * as React from "react"
import { CheckCheck, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import type { AccountDto } from "@/lib/accounting/accounting.service"
import {
  GOAL_TYPES,
  GoalService,
  PRIORITIES,
  type ContributionDto,
  type EGoalType,
  type EPriority,
  type GoalCategoryDto,
  type GoalDto,
  type MilestoneDto,
  type TrackingDto,
} from "@/lib/accounting/budget.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { accountLabel, attempt, Field, PlainSelect, today, useAccLookups } from "../_components/acc-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES = ["DRAFT", "ACTIVE", "COMPLETED"] as const
const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  DRAFT: "outline",
  ACTIVE: "secondary",
  COMPLETED: "default",
  AHEAD: "default",
  ON_TRACK: "secondary",
  BEHIND: "outline",
  CRITICAL: "destructive",
}
const num = (s: string) => (s.trim() === "" ? NaN : Number(s))

export default function GoalsPage() {
  return (
    <React.Suspense>
      <Goals />
    </React.Suspense>
  )
}

/** §14 financial goals (Draft → Active → Completed, milestones, tracking, contributions) and goal categories. */
function Goals() {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") === "categories" ? "categories" : "goals"
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("GOAL_MANAGE")
  const [categories, setCategories] = React.useState<GoalCategoryDto[]>([])
  const [catKey, setCatKey] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    GoalService.categories({ size: 200 })
      .then((p) => !cancelled && setCategories(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [catKey])
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.bg.goals")} description={t("bg.goals.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "goals" ? "" : v, page: 0 })}>
        <TabsList>
          <TabsTrigger value="goals">{t("bg.goals")}</TabsTrigger>
          <TabsTrigger value="categories">{t("bg.categories")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "goals" ? <GoalList categories={categories} manage={manage} /> : <CategoryList categories={categories} manage={manage} onChanged={() => setCatKey((x) => x + 1)} />}
    </div>
  )
}

function GoalStatusBadge({ status }: { status?: string | null }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{t(`bg.status.${status}` as TranslationKey)}</Badge>
}

function GoalList({ categories, manage }: { categories: GoalCategoryDto[]; manage: boolean }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { accounts } = useAccLookups()
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const type = searchParams.get("type") ?? ""
  const categoryId = searchParams.get("categoryId") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<GoalDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ goal?: GoalDto } | null>(null)
  const [viewing, setViewing] = React.useState<GoalDto>()
  const [pending, setPending] = React.useState<{ action: "activate" | "complete" | "delete"; row: GoalDto }>()

  React.useEffect(() => {
    let cancelled = false
    GoalService.list({ status: status === ALL ? undefined : status, type: type || undefined, categoryId: categoryId || undefined, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [status, type, categoryId, page, reloadKey])

  // counts per status tab: GET /goals/status-counts with the list's category / type filters; All = their sum
  const [counts, setCounts] = React.useState<Record<string, number>>()
  React.useEffect(() => {
    let cancelled = false
    GoalService.statusCounts({ type: type || undefined, categoryId: categoryId || undefined })
      .then((c) => !cancelled && setCounts({ ...Object.fromEntries(STATUSES.map((s) => [s, c?.[s] ?? 0])), [ALL]: Object.values(c ?? {}).reduce((a, n) => a + (n ?? 0), 0) }))
      .catch(() => undefined) // the tabs simply show no count
    return () => {
      cancelled = true
    }
  }, [type, categoryId, reloadKey])

  const rows = data?.content ?? []
  // current amount / progress per row: GET /goals/{id}/tracking for the shown page (the list row has no current amount)
  const [tracks, setTracks] = React.useState<Record<string, TrackingDto | null>>({})
  React.useEffect(() => {
    let cancelled = false
    const ids = (data?.content ?? []).map((g) => g.id).filter((id): id is string => !!id)
    Promise.all(ids.map((id) => GoalService.tracking(id).then((tr) => [id, tr ?? null] as const, () => [id, null] as const))).then((pairs) => !cancelled && setTracks(Object.fromEntries(pairs)))
    return () => {
      cancelled = true
    }
  }, [data])
  const now = today()
  const catName = (id?: string | null) => categories.find((c) => c.id === id)?.name ?? "-"
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={status} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
            <TabsList>
              <TabsTrigger value={ALL}>
                {t("companies.tabAll")}
                {counts && ` (${counts[ALL]})`}
              </TabsTrigger>
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {t(`bg.status.${s}`)}
                  {counts && ` (${counts[s]})`}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {manage && (
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("bg.goal.create")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <PlainSelect label={t("le.type")} className="w-48" value={type} onChange={(v) => update({ type: v, page: 0 })} none={t("le.allTypes")} options={GOAL_TYPES.map((x) => ({ value: x, label: t(`bg.goalType.${x}`) }))} />
          <PlainSelect
            label={t("acc.category")}
            className="w-48"
            value={categoryId}
            onChange={(v) => update({ categoryId: v, page: 0 })}
            none={t("acc.allCategories")}
            options={categories.map((c) => ({ value: c.id ?? "", label: c.name ?? "" }))}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.name")}</TableHead>
                <TableHead>{t("acc.category")}</TableHead>
                <TableHead>{t("le.type")}</TableHead>
                <TableHead>{t("bg.priority")}</TableHead>
                <TableHead className="text-right">{t("bg.target")}</TableHead>
                <TableHead className="text-right">{t("bg.current")}</TableHead>
                <TableHead className="w-40">{t("bg.progress")}</TableHead>
                <TableHead>{t("bg.targetDate")}</TableHead>
                <TableHead>{t("crm.status")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground h-24 text-center">
                    {t("bg.goal.empty")}
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setViewing(g)}>
                        {g.name}
                      </button>
                    </TableCell>
                    <TableCell>{catName(g.categoryId)}</TableCell>
                    <TableCell>{g.type ? t(`bg.goalType.${g.type}`) : "-"}</TableCell>
                    <TableCell>{g.priority ? t(`bg.priority.${g.priority}`) : "-"}</TableCell>
                    <TableCell className="text-right">{money(g.targetAmount)}</TableCell>
                    <TableCell className="text-right">{g.id && tracks[g.id] ? money(tracks[g.id]?.currentAmount) : "-"}</TableCell>
                    <TableCell>
                      {g.id && tracks[g.id] ? (
                        <div className="flex items-center gap-2" data-testid="goal-row-progress">
                          <Progress className="h-2 flex-1" value={Math.min(100, tracks[g.id]?.progressPercent ?? 0)} aria-label={t("bg.progressOf", { name: g.name ?? "" })} />
                          <span className="text-muted-foreground w-12 text-right text-xs">{(tracks[g.id]?.progressPercent ?? 0).toFixed(0)}%</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(g.targetDate, language)}
                      {g.status !== "COMPLETED" && !!g.targetDate && g.targetDate < now && (
                        <Badge variant="destructive" className="ml-2">
                          {t("bg.overdue")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <GoalStatusBadge status={g.status} />
                    </TableCell>
                    <TableCell>
                      {manage && g.status !== "COMPLETED" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: g.name ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {g.status === "DRAFT" && (
                              <>
                                <DropdownMenuItem onClick={() => setPending({ action: "activate", row: g })}>
                                  <Play className="size-4" /> {t("bg.activate")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditing({ goal: g })}>
                                  <Pencil className="size-4" /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: g })}>
                                  <Trash2 className="size-4" /> {t("common.delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                            {g.status === "ACTIVE" && (
                              <DropdownMenuItem onClick={() => setPending({ action: "complete", row: g })}>
                                <CheckCheck className="size-4" /> {t("bg.complete")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          {editing && <GoalForm key={editing.goal?.id ?? "new"} goal={editing.goal} categories={categories.filter((c) => c.active || c.id === editing.goal?.categoryId)} accounts={accounts} onClose={() => setEditing(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing && <GoalView key={viewing.id} goal={viewing} manage={manage} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`bg.confirm.goal.${pending?.action ?? "delete"}` as TranslationKey, { name: pending?.row.name ?? "" })}
        description={t(`bg.confirm.goal.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={pending?.action === "delete" ? t("common.delete") : t(`bg.${pending?.action ?? "activate"}` as TranslationKey)}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const call = { activate: () => GoalService.activate(id), complete: () => GoalService.complete(id), delete: () => GoalService.remove(id) }[pending.action]
          if (await attempt(call, t("common.saved"))) reload()
        }}
      />
    </Card>
  )
}

/** Goal form: name, category, type, priority, target amount, start, target date (after start, ACC_081), account, description. */
function GoalForm({ goal, categories, accounts, onClose, onSaved }: { goal?: GoalDto; categories: GoalCategoryDto[]; accounts: AccountDto[]; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [f, setF] = React.useState({
    name: goal?.name ?? "",
    categoryId: goal?.categoryId ?? "",
    type: goal?.type ?? ("SAVINGS" as EGoalType),
    priority: goal?.priority ?? ("MEDIUM" as EPriority),
    targetAmount: goal?.targetAmount != null ? String(goal.targetAmount) : "",
    startDate: goal?.startDate ?? today(),
    targetDate: goal?.targetDate ?? "",
    accountId: goal?.accountId ?? "",
    description: goal?.description ?? "",
  })
  const [saving, setSaving] = React.useState(false)
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const amount = num(f.targetAmount)
  const errors = {
    name: !f.name.trim() ? t("bg.v.required") : undefined,
    targetAmount: !(amount >= 0) ? t("bg.v.amount") : undefined,
    targetDate: !f.targetDate ? t("bg.v.required") : f.targetDate <= f.startDate ? t("bg.v.afterStart") : undefined,
  }
  const valid = !Object.values(errors).some(Boolean) && !!f.startDate
  async function submit() {
    setSaving(true)
    const ok = await attempt(
      () =>
        GoalService.save(goal?.id, {
          name: f.name.trim(),
          categoryId: f.categoryId ? Number(f.categoryId) : undefined,
          type: f.type,
          priority: f.priority,
          targetAmount: amount,
          startDate: f.startDate,
          targetDate: f.targetDate,
          accountId: f.accountId ? Number(f.accountId) : undefined,
          description: f.description.trim() || undefined,
        }),
      t("common.saved"),
    )
    setSaving(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{goal ? t("bg.goal.edit") : t("bg.goal.create")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="g-name" label={t("crm.name")} error={f.name ? errors.name : undefined} className="sm:col-span-2">
          <Input id="g-name" maxLength={255} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="g-cat" label={t("acc.category")}>
          <PlainSelect id="g-cat" label={t("acc.category")} value={f.categoryId} onChange={(v) => set({ categoryId: v })} none={t("bg.none")} options={categories.map((c) => ({ value: c.id ?? "", label: c.name ?? "" }))} />
        </Field>
        <Field id="g-type" label={t("le.type")}>
          <PlainSelect id="g-type" label={t("le.type")} value={f.type} onChange={(v) => set({ type: v as EGoalType })} options={GOAL_TYPES.map((x) => ({ value: x, label: t(`bg.goalType.${x}`) }))} />
        </Field>
        <Field id="g-prio" label={t("bg.priority")}>
          <PlainSelect id="g-prio" label={t("bg.priority")} value={f.priority} onChange={(v) => set({ priority: v as EPriority })} options={PRIORITIES.map((x) => ({ value: x, label: t(`bg.priority.${x}`) }))} />
        </Field>
        <Field id="g-amount" label={t("bg.targetAmount")} error={f.targetAmount ? errors.targetAmount : undefined}>
          <Input id="g-amount" type="number" min={0} step="any" value={f.targetAmount} onChange={(e) => set({ targetAmount: e.target.value })} />
        </Field>
        <Field id="g-start" label={t("bg.startDate")}>
          <Input id="g-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field id="g-target" label={t("bg.targetDate")} error={f.targetDate ? errors.targetDate : undefined}>
          <Input id="g-target" type="date" value={f.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
        </Field>
        <Field id="g-acc" label={t("le.account")} className="sm:col-span-2">
          <PlainSelect id="g-acc" label={t("le.account")} value={f.accountId} onChange={(v) => set({ accountId: v })} none={t("bg.none")} options={accounts.map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))} />
        </Field>
        <Field id="g-desc" label={t("le.description")} className="sm:col-span-2">
          <Textarea id="g-desc" rows={2} maxLength={1000} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button disabled={!valid || saving} onClick={submit}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Goal detail: tracking (Ahead / On Track / Behind / Critical), milestones (Pending / Achieved) and contributions. */
function GoalView({ goal, manage }: { goal: GoalDto; manage: boolean }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const id = goal.id ?? ""
  const [data, setData] = React.useState<{ tracking?: TrackingDto; milestones: MilestoneDto[]; contributions: ContributionDto[] }>()
  const [key, setKey] = React.useState(0)
  const reload = () => setKey((x) => x + 1)
  React.useEffect(() => {
    let cancelled = false
    Promise.all([GoalService.tracking(id), GoalService.milestones(id), GoalService.contributions(id)])
      .then(([tracking, milestones, contributions]) => !cancelled && setData({ tracking, milestones: milestones ?? [], contributions: contributions ?? [] }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, key])
  const [ms, setMs] = React.useState({ name: "", targetAmount: "", targetDate: "" })
  const [ct, setCt] = React.useState({ date: today(), amount: "", notes: "" })
  if (!data) return <Skeleton className="h-64 w-full" />
  const tr = data.tracking
  const editMilestones = manage && goal.status !== "COMPLETED"
  const canContribute = manage && goal.status === "ACTIVE"
  const msValid = !!ms.name.trim() && num(ms.targetAmount) >= 0 && !!ms.targetDate
  const ctValid = num(ct.amount) > 0
  return (
    <>
      <DialogHeader>
        <DialogTitle>{goal.name}</DialogTitle>
        <DialogDescription>
          {formatDate(goal.startDate, language)} → {formatDate(goal.targetDate, language)} · <GoalStatusBadge status={goal.status} />
        </DialogDescription>
      </DialogHeader>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardDescription>{t("bg.progress")}</CardDescription>
            <CardTitle className="text-xl" data-testid="goal-current">
              {money(tr?.currentAmount)} / {money(tr?.targetAmount)}
            </CardTitle>
          </div>
          {tr?.trackingStatus && (
            <Badge variant={STATUS_VARIANT[tr.trackingStatus]} data-testid="goal-tracking">
              {t(`bg.tracking.${tr.trackingStatus}`)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Progress value={Math.min(100, tr?.progressPercent ?? 0)} aria-label={t("bg.progress")} />
          <div className="text-muted-foreground flex flex-wrap justify-between gap-2">
            <span>{t("bg.progressPct", { n: (tr?.progressPercent ?? 0).toFixed(1), e: (tr?.elapsedPercent ?? 0).toFixed(1) })}</span>
            <span>{t("bg.daysRemaining", { n: tr?.daysRemaining ?? 0 })}</span>
            {tr?.projectedCompletionDate && <span>{t("bg.projected", { date: formatDate(tr.projectedCompletionDate, language) })}</span>}
          </div>
          <div className="text-muted-foreground">
            {t("bg.manual")}: {money(tr?.manualAmount)} · {t("bg.automatic")}: {money(tr?.automaticAmount)}
          </div>
        </CardContent>
      </Card>

      <h3 className="font-medium">{t("bg.milestones")}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("crm.name")}</TableHead>
            <TableHead className="text-right">{t("bg.target")}</TableHead>
            <TableHead>{t("bg.targetDate")}</TableHead>
            <TableHead>{t("crm.status")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.milestones.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                {t("bg.noMilestones")}
              </TableCell>
            </TableRow>
          )}
          {data.milestones.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.name}</TableCell>
              <TableCell className="text-right">{money(m.targetAmount)}</TableCell>
              <TableCell className={m.overdue ? "text-destructive" : ""}>{formatDate(m.targetDate, language)}</TableCell>
              <TableCell>
                <Badge variant={m.status === "ACHIEVED" ? "default" : "outline"}>{t(`bg.milestone.${m.status ?? "PENDING"}`)}</Badge>
              </TableCell>
              <TableCell>
                {editMilestones && (
                  <Button variant="ghost" size="icon" aria-label={t("bg.removeMilestone", { name: m.name ?? "" })} onClick={async () => (await attempt(() => GoalService.removeMilestone(id, m.id ?? ""), t("common.saved"))) && reload()}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editMilestones && (
        <div className="flex flex-wrap items-end gap-2">
          <Input className="w-48" aria-label={t("bg.milestoneName")} placeholder={t("bg.milestoneName")} maxLength={255} value={ms.name} onChange={(e) => setMs({ ...ms, name: e.target.value })} />
          <Input className="w-36" aria-label={t("bg.milestoneAmount")} placeholder={t("bg.target")} type="number" min={0} value={ms.targetAmount} onChange={(e) => setMs({ ...ms, targetAmount: e.target.value })} />
          <Input className="w-40" aria-label={t("bg.milestoneDate")} type="date" value={ms.targetDate} onChange={(e) => setMs({ ...ms, targetDate: e.target.value })} />
          <Button
            variant="outline"
            disabled={!msValid}
            onClick={async () => {
              if (await attempt(() => GoalService.saveMilestone(id, undefined, { name: ms.name.trim(), targetAmount: num(ms.targetAmount), targetDate: ms.targetDate }), t("common.saved"))) {
                setMs({ name: "", targetAmount: "", targetDate: "" })
                reload()
              }
            }}
          >
            <Plus className="size-4" /> {t("bg.addMilestone")}
          </Button>
        </div>
      )}

      <h3 className="font-medium">{t("bg.contributions")}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("pos.date")}</TableHead>
            <TableHead>{t("le.type")}</TableHead>
            <TableHead>{t("le.notes")}</TableHead>
            <TableHead className="text-right">{t("acc.amount")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.contributions.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                {t("bg.noContributions")}
              </TableCell>
            </TableRow>
          )}
          {data.contributions.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{formatDate(c.date, language)}</TableCell>
              <TableCell>{t(`bg.contribution.${c.type ?? "MANUAL"}`)}</TableCell>
              <TableCell>{c.notes || "-"}</TableCell>
              <TableCell className="text-right">{money(c.amount)}</TableCell>
              <TableCell>
                {canContribute && c.type !== "AUTOMATIC" && (
                  <Button variant="ghost" size="icon" aria-label={t("bg.removeContribution")} onClick={async () => (await attempt(() => GoalService.removeContribution(id, c.id ?? ""), t("common.saved"))) && reload()}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canContribute && (
        <div className="flex flex-wrap items-end gap-2">
          <Input className="w-40" aria-label={t("bg.contributionDate")} type="date" value={ct.date} onChange={(e) => setCt({ ...ct, date: e.target.value })} />
          <Input className="w-36" aria-label={t("bg.contributionAmount")} placeholder={t("acc.amount")} type="number" min={0} value={ct.amount} onChange={(e) => setCt({ ...ct, amount: e.target.value })} />
          <Input className="w-48" aria-label={t("bg.contributionNotes")} placeholder={t("le.notes")} maxLength={500} value={ct.notes} onChange={(e) => setCt({ ...ct, notes: e.target.value })} />
          <Button
            variant="outline"
            disabled={!ctValid}
            onClick={async () => {
              if (await attempt(() => GoalService.contribute(id, { date: ct.date || undefined, amount: num(ct.amount), notes: ct.notes.trim() || undefined }), t("common.saved"))) {
                setCt({ date: today(), amount: "", notes: "" })
                reload()
              }
            }}
          >
            <Plus className="size-4" /> {t("bg.addContribution")}
          </Button>
        </div>
      )}
    </>
  )
}

function CategoryList({ categories, manage, onChanged }: { categories: GoalCategoryDto[]; manage: boolean; onChanged: () => void }) {
  const t = useT()
  const [editing, setEditing] = React.useState<{ cat?: GoalCategoryDto } | null>(null)
  const [deleting, setDeleting] = React.useState<GoalCategoryDto>()
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {manage && (
          <div className="flex justify-end">
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("bg.category.create")}
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("acc.code")}</TableHead>
              <TableHead>{t("crm.name")}</TableHead>
              <TableHead>{t("crm.status")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-16 text-center">
                  {t("bg.category.empty")}
                </TableCell>
              </TableRow>
            )}
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>
                  <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? t("bg.active") : t("bg.inactive")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {manage && (
                    <>
                      <Button variant="ghost" size="icon" aria-label={t("bg.editOf", { name: c.name ?? "" })} onClick={() => setEditing({ cat: c })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={t("bg.deleteOf", { name: c.name ?? "" })} onClick={() => setDeleting(c)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">{editing && <CategoryForm key={editing.cat?.id ?? "new"} cat={editing.cat} onClose={() => setEditing(null)} onSaved={onChanged} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("bg.confirm.deleteNamed", { name: deleting?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting?.id && (await attempt(() => GoalService.removeCategory(deleting.id ?? ""), t("common.saved")))) onChanged()
        }}
      />
    </Card>
  )
}

function CategoryForm({ cat, onClose, onSaved }: { cat?: GoalCategoryDto; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [code, setCode] = React.useState(cat?.code ?? "")
  const [name, setName] = React.useState(cat?.name ?? "")
  const [active, setActive] = React.useState(cat?.active ?? true)
  const valid = !!code.trim() && code.length <= 30 && !!name.trim()
  return (
    <>
      <DialogHeader>
        <DialogTitle>{cat ? t("bg.category.edit") : t("bg.category.create")}</DialogTitle>
      </DialogHeader>
      <Field id="gc-code" label={t("acc.code")}>
        <Input id="gc-code" maxLength={30} value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field id="gc-name" label={t("crm.name")}>
        <Input id="gc-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} aria-label={t("bg.active")} /> {t("bg.active")}
      </label>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!valid}
          onClick={async () => {
            if (await attempt(() => GoalService.saveCategory(cat?.id, { code: code.trim(), name: name.trim(), active }), t("common.saved"))) {
              onSaved()
              onClose()
            }
          }}
        >
          {t("common.save")}
        </Button>
      </DialogFooter>
    </>
  )
}
