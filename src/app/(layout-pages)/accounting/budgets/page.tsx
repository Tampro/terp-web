"use client"

import * as React from "react"
import { CheckCheck, Lock, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { CoaService, type AccountDto } from "@/lib/accounting/accounting.service"
import {
  BUDGET_TYPES,
  BudgetService,
  type AllocationDto,
  type BudgetDto,
  type EBudgetType,
  type MonitoringDto,
  type PeriodDto,
  type PeriodMonitoringDto,
} from "@/lib/accounting/budget.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { CrmUserService, type CrmUserOption } from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { accountLabel, attempt, Field, PlainSelect } from "../_components/acc-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES = ["DRAFT", "APPROVED", "ACTIVE", "CLOSED"] as const
const VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = { DRAFT: "outline", APPROVED: "secondary", ACTIVE: "default", CLOSED: "outline" }
const num = (s: string) => (s.trim() === "" ? NaN : Number(s))
type Money = (n?: number | null) => string

export default function BudgetsPage() {
  return (
    <React.Suspense>
      <Budgets />
    </React.Suspense>
  )
}

/** §14 budget periods (Active → Closed) and budgets (Draft → Approved → Active → Closed) with allocations and monitoring. */
function Budgets() {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") === "periods" ? "periods" : "budgets"
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes("BUDGET_MANAGE")
  const approve = !!permissions?.includes("BUDGET_APPROVE")
  const [periods, setPeriods] = React.useState<PeriodDto[]>([])
  const [periodKey, setPeriodKey] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    BudgetService.periods({ size: 200 })
      .then((p) => !cancelled && setPeriods(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [periodKey])
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.bg.budgets")} description={t("bg.budgets.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "budgets" ? "" : v, page: 0 })}>
        <TabsList>
          <TabsTrigger value="budgets">{t("bg.budgets")}</TabsTrigger>
          <TabsTrigger value="periods">{t("bg.periods")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "budgets" ? (
        <BudgetList periods={periods} manage={manage} approve={approve} />
      ) : (
        <PeriodList periods={periods} manage={manage} onChanged={() => setPeriodKey((x) => x + 1)} />
      )}
    </div>
  )
}

function VarianceCell({ pct, over }: { pct?: number; over?: boolean }) {
  return <span className={over ? "text-destructive font-medium" : ""}>{pct == null ? "-" : `${pct.toFixed(1)}%`}</span>
}

function Totals({ m, money }: { m?: { allocated?: number; spent?: number; remaining?: number; variancePercent?: number; overBudget?: boolean }; money: Money }) {
  const t = useT()
  const items = [
    ["bg.allocated", money(m?.allocated)],
    ["bg.spent", money(m?.spent)],
    ["bg.remaining", money(m?.remaining)],
  ] as const
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <Card key={k}>
          <CardHeader>
            <CardDescription>{t(k)}</CardDescription>
            <CardTitle className="text-lg" data-testid={`m-${k.split(".")[1]}`}>
              {v}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardDescription>{t("bg.variance")}</CardDescription>
          <CardTitle className="text-lg">
            <VarianceCell pct={m?.variancePercent} over={m?.overBudget} />
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}

function BudgetList({ periods, manage, approve }: { periods: PeriodDto[]; manage: boolean; approve: boolean }) {
  const t = useT()
  const money = useMoney()
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const periodId = searchParams.get("periodId") ?? ""
  const type = searchParams.get("type") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<BudgetDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ budget?: BudgetDto } | null>(null)
  const [viewing, setViewing] = React.useState<BudgetDto>()
  const [pending, setPending] = React.useState<{ action: "approve" | "activate" | "close" | "delete"; row: BudgetDto }>()

  React.useEffect(() => {
    let cancelled = false
    BudgetService.list({ status: status === ALL ? undefined : status, periodId: periodId || undefined, type: type || undefined, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [status, periodId, type, page, reloadKey])

  // approvedBy is an IAM user id; names need IAM_USER_VIEW, otherwise the id stays.
  const [users, setUsers] = React.useState<CrmUserOption[]>([])
  const canSeeUsers = !!useAuthStore((s) => s.me?.permissions)?.includes("IAM_USER_VIEW")
  React.useEffect(() => {
    if (!canSeeUsers) return
    let cancelled = false
    CrmUserService.users()
      .then((p) => !cancelled && setUsers(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [canSeeUsers])
  const userName = (id?: string | null) => (id ? (users.find((u) => u.id === id)?.fullName ?? users.find((u) => u.id === id)?.username ?? id) : "-")
  const rows = data?.content ?? []
  const periodName = (id?: string) => periods.find((p) => p.id === id)?.name ?? "-"
  const next = { DRAFT: "approve", APPROVED: "activate", ACTIVE: "close" } as const
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={status} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
            <TabsList>
              <TabsTrigger value={ALL}>{t("companies.tabAll")}</TabsTrigger>
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {t(`bg.status.${s}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {manage && (
            <Button disabled={!periods.some((p) => p.status === "ACTIVE")} onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("bg.budget.create")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <PlainSelect label={t("bg.period")} className="w-52" value={periodId} onChange={(v) => update({ periodId: v, page: 0 })} none={t("bg.allPeriods")} options={periods.map((p) => ({ value: p.id ?? "", label: p.name ?? "" }))} />
          <PlainSelect label={t("le.type")} className="w-44" value={type} onChange={(v) => update({ type: v, page: 0 })} none={t("le.allTypes")} options={BUDGET_TYPES.map((x) => ({ value: x, label: t(`bg.budgetType.${x}`) }))} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.name")}</TableHead>
                <TableHead>{t("bg.period")}</TableHead>
                <TableHead>{t("le.type")}</TableHead>
                <TableHead className="text-right">{t("acc.amount")}</TableHead>
                <TableHead>{t("crm.status")}</TableHead>
                <TableHead>{t("bg.approvedBy")}</TableHead>
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
                    {t("bg.budget.empty")}
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((b) => {
                  const step = b.status && b.status !== "CLOSED" ? next[b.status] : undefined
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setViewing(b)}>
                          {b.name}
                        </button>
                      </TableCell>
                      <TableCell>{periodName(b.periodId)}</TableCell>
                      <TableCell>{b.type ? t(`bg.budgetType.${b.type}`) : "-"}</TableCell>
                      <TableCell className="text-right">{money(b.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={VARIANT[b.status ?? "DRAFT"]}>{t(`bg.status.${b.status ?? "DRAFT"}` as TranslationKey)}</Badge>
                      </TableCell>
                      <TableCell>{userName(b.approvedBy)}</TableCell>
                      <TableCell>
                        {((approve && step) || (manage && b.status === "DRAFT")) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: b.name ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {approve && step && (
                                <DropdownMenuItem onClick={() => setPending({ action: step, row: b })}>
                                  {step === "approve" ? <CheckCheck className="size-4" /> : step === "activate" ? <Play className="size-4" /> : <Lock className="size-4" />} {t(`bg.${step}`)}
                                </DropdownMenuItem>
                              )}
                              {manage && b.status === "DRAFT" && (
                                <>
                                  <DropdownMenuItem onClick={() => setEditing({ budget: b })}>
                                    <Pencil className="size-4" /> {t("common.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: b })}>
                                    <Trash2 className="size-4" /> {t("common.delete")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
        <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && <BudgetForm key={editing.budget?.id ?? "new"} budget={editing.budget} periods={periods.filter((p) => p.status === "ACTIVE" || p.id === editing.budget?.periodId)} onClose={() => setEditing(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">{viewing && <BudgetView key={viewing.id} budget={viewing} manage={manage} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`bg.confirm.budget.${pending?.action ?? "delete"}` as TranslationKey, { name: pending?.row.name ?? "" })}
        description={t(`bg.confirm.budget.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={pending?.action === "delete" ? t("common.delete") : t(`bg.${pending?.action ?? "approve"}` as TranslationKey)}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const call = { approve: () => BudgetService.approve(id), activate: () => BudgetService.activate(id), close: () => BudgetService.close(id), delete: () => BudgetService.remove(id) }[pending.action]
          if (await attempt(call, t("common.saved"))) reload()
        }}
      />
    </Card>
  )
}

function BudgetForm({ budget, periods, onClose, onSaved }: { budget?: BudgetDto; periods: PeriodDto[]; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [f, setF] = React.useState({
    name: budget?.name ?? "",
    periodId: budget?.periodId ?? periods[0]?.id ?? "",
    type: budget?.type ?? ("OPERATIONAL" as EBudgetType),
    amount: budget?.amount != null ? String(budget.amount) : "",
    description: budget?.description ?? "",
  })
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const amount = num(f.amount)
  const valid = !!f.name.trim() && !!f.periodId && amount >= 0
  return (
    <>
      <DialogHeader>
        <DialogTitle>{budget ? t("bg.budget.edit") : t("bg.budget.create")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="b-name" label={t("crm.name")} className="sm:col-span-2">
          <Input id="b-name" maxLength={255} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="b-period" label={t("bg.period")}>
          <PlainSelect id="b-period" label={t("bg.period")} value={f.periodId} onChange={(v) => set({ periodId: v })} options={periods.map((p) => ({ value: p.id ?? "", label: p.name ?? "" }))} />
        </Field>
        <Field id="b-type" label={t("le.type")}>
          <PlainSelect id="b-type" label={t("le.type")} value={f.type} onChange={(v) => set({ type: v as EBudgetType })} options={BUDGET_TYPES.map((x) => ({ value: x, label: t(`bg.budgetType.${x}`) }))} />
        </Field>
        <Field id="b-amount" label={t("acc.amount")} error={f.amount && !(amount >= 0) ? t("bg.v.amount") : undefined}>
          <Input id="b-amount" type="number" min={0} step="any" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field id="b-desc" label={t("le.description")} className="sm:col-span-2">
          <Textarea id="b-desc" rows={2} maxLength={1000} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!valid}
          onClick={async () => {
            const body = { name: f.name.trim(), periodId: Number(f.periodId), type: f.type, amount, description: f.description.trim() || undefined }
            if (await attempt(() => BudgetService.save(budget?.id, body), t("common.saved"))) {
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

/** Budget monitoring (allocated, spent, remaining, variance %) and allocations on expense accounts (ACC_093/094/095). */
function BudgetView({ budget, manage }: { budget: BudgetDto; manage: boolean }) {
  const t = useT()
  const money = useMoney()
  const id = budget.id ?? ""
  const [m, setM] = React.useState<MonitoringDto>()
  const [key, setKey] = React.useState(0)
  const [expenseAccounts, setExpenseAccounts] = React.useState<AccountDto[]>([])
  const [editing, setEditing] = React.useState<AllocationDto | null>(null)
  const [form, setForm] = React.useState({ accountId: "", allocated: "", notes: "" })
  React.useEffect(() => {
    let cancelled = false
    BudgetService.monitoring(id)
      .then((d) => !cancelled && setM(d))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, key])
  React.useEffect(() => {
    let cancelled = false
    Promise.all([CoaService.types({ category: "EXPENSES", size: 100 }), CoaService.accounts({ active: true, size: 500 })])
      .then(([types, accounts]) => {
        const ids = new Set((types.content ?? []).map((x) => x.id))
        if (!cancelled) setExpenseAccounts((accounts.content ?? []).filter((a) => ids.has(a.accountTypeId)))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  const editable = manage && budget.status !== "CLOSED"
  const allocated = num(form.allocated)
  const valid = !!form.accountId && allocated >= 0
  function startEdit(a: AllocationDto | null) {
    setEditing(a)
    setForm(a ? { accountId: a.accountId ?? "", allocated: String(a.allocated ?? ""), notes: a.notes ?? "" } : { accountId: "", allocated: "", notes: "" })
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{budget.name}</DialogTitle>
        <DialogDescription>
          {budget.type ? t(`bg.budgetType.${budget.type}`) : ""} · {t("acc.amount")} {money(m?.budgetAmount ?? budget.amount)} · {t(`bg.status.${budget.status ?? "DRAFT"}` as TranslationKey)}
        </DialogDescription>
      </DialogHeader>
      {!m ? <Skeleton className="h-24 w-full" /> : <Totals m={m} money={money} />}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("le.account")}</TableHead>
              <TableHead className="text-right">{t("bg.allocated")}</TableHead>
              <TableHead className="text-right">{t("bg.spent")}</TableHead>
              <TableHead className="text-right">{t("bg.remaining")}</TableHead>
              <TableHead className="text-right">{t("bg.variance")}</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {m && !m.lines?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  {t("bg.noAllocations")}
                </TableCell>
              </TableRow>
            )}
            {(m?.lines ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="font-mono text-xs">{a.accountCode}</span> {a.accountName}
                  {a.notes && <span className="text-muted-foreground block text-xs">{a.notes}</span>}
                </TableCell>
                <TableCell className="text-right">{money(a.allocated)}</TableCell>
                <TableCell className="text-right">{money(a.spent)}</TableCell>
                <TableCell className={`text-right ${a.overBudget ? "text-destructive" : ""}`}>{money(a.remaining)}</TableCell>
                <TableCell className="text-right">
                  <VarianceCell pct={a.variancePercent} over={a.overBudget} />
                </TableCell>
                <TableCell className="text-right">
                  {editable && (
                    <>
                      <Button variant="ghost" size="icon" aria-label={t("bg.editOf", { name: a.accountCode ?? "" })} onClick={() => startEdit(a)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={t("bg.deleteOf", { name: a.accountCode ?? "" })} onClick={async () => (await attempt(() => BudgetService.removeAllocation(id, a.id ?? ""), t("common.saved"))) && setKey((x) => x + 1)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {!!m?.lines?.length && (
            <TableFooter>
              <TableRow>
                <TableCell>{t("sales.total")}</TableCell>
                <TableCell className="text-right">{money(m.allocated)}</TableCell>
                <TableCell className="text-right">{money(m.spent)}</TableCell>
                <TableCell className="text-right">{money(m.remaining)}</TableCell>
                <TableCell className="text-right">
                  <VarianceCell pct={m.variancePercent} over={m.overBudget} />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {editable && (
        <div className="grid gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">{editing ? t("bg.editAllocation", { code: editing.accountCode ?? "" }) : t("bg.addAllocation")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <PlainSelect
              label={t("bg.expenseAccount")}
              className="w-64"
              value={form.accountId}
              onChange={(v) => setForm({ ...form, accountId: v })}
              options={expenseAccounts.map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))}
            />
            <Input className="w-40" aria-label={t("bg.allocated")} placeholder={t("bg.allocated")} type="number" min={0} value={form.allocated} onChange={(e) => setForm({ ...form, allocated: e.target.value })} />
            <Input className="w-48" aria-label={t("le.notes")} placeholder={t("le.notes")} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button
              disabled={!valid}
              onClick={async () => {
                const body = { accountId: Number(form.accountId), allocated, notes: form.notes.trim() || undefined }
                if (await attempt(() => BudgetService.saveAllocation(id, editing?.id, body), t("common.saved"))) {
                  startEdit(null)
                  setKey((x) => x + 1)
                }
              }}
            >
              {editing ? t("common.save") : t("bg.allocate")}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => startEdit(null)}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t("bg.allocationHint")}</p>
        </div>
      )}
    </>
  )
}

function PeriodList({ periods, manage, onChanged }: { periods: PeriodDto[]; manage: boolean; onChanged: () => void }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [editing, setEditing] = React.useState<{ period?: PeriodDto } | null>(null)
  const [pending, setPending] = React.useState<{ action: "close" | "delete"; row: PeriodDto }>()
  const [viewing, setViewing] = React.useState<PeriodDto>()
  const [mon, setMon] = React.useState<{ id: string; data?: PeriodMonitoringDto }>()
  React.useEffect(() => {
    if (!viewing?.id) return
    let cancelled = false
    const id = viewing.id
    BudgetService.periodMonitoring(id)
      .then((data) => !cancelled && setMon({ id, data }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [viewing])
  const monitoring = mon && mon.id === viewing?.id ? mon.data : undefined
  const { searchParams, update } = useUrlQuery()
  const pstatus = searchParams.get("pstatus") ?? ALL
  const count = (s: string) => (s === ALL ? periods.length : periods.filter((p) => p.status === s).length)
  const shown = pstatus === ALL ? periods : periods.filter((p) => p.status === pstatus)
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={pstatus} onValueChange={(v) => update({ pstatus: v === ALL ? "" : v })}>
            <TabsList>
              {[ALL, "ACTIVE", "CLOSED"].map((s) => (
                <TabsTrigger key={s} value={s}>
                  {s === ALL ? t("companies.tabAll") : t(`bg.status.${s}` as TranslationKey)} ({count(s)})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          {manage && (
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("bg.period.create")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.name")}</TableHead>
                <TableHead>{t("le.financialYear")}</TableHead>
                <TableHead>{t("bg.startDate")}</TableHead>
                <TableHead>{t("bg.endDate")}</TableHead>
                <TableHead>{t("crm.status")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                    {t("bg.period.empty")}
                  </TableCell>
                </TableRow>
              )}
              {shown.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setViewing(p)}>
                      {p.name}
                    </button>
                  </TableCell>
                  <TableCell>{p.financialYear}</TableCell>
                  <TableCell>{formatDate(p.startDate, language)}</TableCell>
                  <TableCell>{formatDate(p.endDate, language)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "ACTIVE" ? "default" : "outline"}>{t(`bg.status.${p.status ?? "ACTIVE"}` as TranslationKey)}</Badge>
                  </TableCell>
                  <TableCell>
                    {manage && p.status === "ACTIVE" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: p.name ?? "" })}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing({ period: p })}>
                            <Pencil className="size-4" /> {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPending({ action: "close", row: p })}>
                            <Lock className="size-4" /> {t("bg.close")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: p })}>
                            <Trash2 className="size-4" /> {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">{editing && <PeriodForm key={editing.period?.id ?? "new"} period={editing.period} onClose={() => setEditing(null)} onSaved={onChanged} />}</DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              {formatDate(viewing?.startDate, language)} → {formatDate(viewing?.endDate, language)}
            </DialogDescription>
          </DialogHeader>
          {!monitoring ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <Totals m={monitoring} money={money} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bg.budgets")}</TableHead>
                    <TableHead className="text-right">{t("bg.allocated")}</TableHead>
                    <TableHead className="text-right">{t("bg.spent")}</TableHead>
                    <TableHead className="text-right">{t("bg.remaining")}</TableHead>
                    <TableHead className="text-right">{t("bg.variance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!monitoring.budgets?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        {t("bg.budget.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {(monitoring.budgets ?? []).map((b) => (
                    <TableRow key={b.budgetId}>
                      <TableCell>{b.name}</TableCell>
                      <TableCell className="text-right">{money(b.allocated)}</TableCell>
                      <TableCell className="text-right">{money(b.spent)}</TableCell>
                      <TableCell className="text-right">{money(b.remaining)}</TableCell>
                      <TableCell className="text-right">
                        <VarianceCell pct={b.variancePercent} over={b.overBudget} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`bg.confirm.period.${pending?.action ?? "delete"}` as TranslationKey, { name: pending?.row.name ?? "" })}
        description={t(`bg.confirm.period.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={pending?.action === "close" ? t("bg.close") : t("common.delete")}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          if (await attempt(() => (pending.action === "close" ? BudgetService.closePeriod(id) : BudgetService.removePeriod(id)), t("common.saved"))) onChanged()
        }}
      />
    </Card>
  )
}

function PeriodForm({ period, onClose, onSaved }: { period?: PeriodDto; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const year = new Date().getFullYear()
  const [f, setF] = React.useState({
    name: period?.name ?? "",
    financialYear: String(period?.financialYear ?? year),
    startDate: period?.startDate ?? `${year}-01-01`,
    endDate: period?.endDate ?? `${year}-12-31`,
  })
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const orderError = f.startDate && f.endDate && f.endDate <= f.startDate ? t("bg.v.endAfterStart") : undefined
  const valid = !!f.name.trim() && Number(f.financialYear) >= 1900 && !!f.startDate && !!f.endDate && !orderError
  return (
    <>
      <DialogHeader>
        <DialogTitle>{period ? t("bg.period.edit") : t("bg.period.create")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-name" label={t("crm.name")} className="sm:col-span-2">
          <Input id="p-name" maxLength={255} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="p-year" label={t("le.financialYear")}>
          <Input id="p-year" type="number" min={1900} value={f.financialYear} onChange={(e) => set({ financialYear: e.target.value })} />
        </Field>
        <div />
        <Field id="p-start" label={t("bg.startDate")}>
          <Input id="p-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field id="p-end" label={t("bg.endDate")} error={orderError}>
          <Input id="p-end" type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!valid}
          onClick={async () => {
            const body = { name: f.name.trim(), financialYear: Number(f.financialYear), startDate: f.startDate, endDate: f.endDate }
            if (await attempt(() => BudgetService.savePeriod(period?.id, body), t("common.saved"))) {
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

