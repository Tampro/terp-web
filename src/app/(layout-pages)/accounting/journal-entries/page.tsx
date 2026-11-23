"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Stamp, Trash2, Undo2, X } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import type { AccountDto } from "@/lib/accounting/accounting.service"
import { JournalService, REFERENCE_TYPES, type EReferenceType, type JournalEntryDto, type ManualForm } from "@/lib/accounting/ledger.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { accountLabel, attempt, errorMessage, Field, PlainSelect, today, useAccLookups } from "../_components/acc-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
const STATUS_VARIANT = { DRAFT: "outline", POSTED: "default", REVERSED: "secondary" } as const

export default function JournalEntriesPage() {
  return (
    <React.Suspense>
      <JournalEntries />
    </React.Suspense>
  )
}

/** Source of an automatic entry (backend SOURCE constants); unknown ones show the raw code. */
/** sourceType values written by the services (accounting JournalEntry.sourceType; payroll-service PAYROLL_ACCRUAL / RUN) */
const SOURCES = [
  "SALES_INVOICE", "SALES_RETURN", "PURCHASE_INVOICE", "PURCHASE_RETURN", "REVENUE", "EXPENSE", "CUSTOMER_PAYMENT", "VENDOR_PAYMENT",
  "CREDIT_NOTE", "DEBIT_NOTE", "BANK_TRANSFER", "POS_ORDER", "POS_ORDER_VOID", "PAYROLL_ACCRUAL", "PAYROLL_RUN", "REVERSAL", "YEAR_END_CLOSE",
] as const
/** source document with a detail view (?view=<sourceId>) → link back from the entry */
const SOURCE_PAGE: Partial<Record<string, string>> = {
  SALES_INVOICE: "/sales/invoices",
  SALES_RETURN: "/sales/returns",
  PURCHASE_INVOICE: "/purchase/invoices",
  PURCHASE_RETURN: "/purchase/returns",
  POS_ORDER: "/pos/orders",
}

function sourceLabel(t: ReturnType<typeof useT>, s: string) {
  const k = `le.source.${s}` as TranslationKey
  const label = t(k)
  return label === k ? s : label
}

function EntryStatusBadge({ status }: { status?: string }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={STATUS_VARIANT[status as keyof typeof STATUS_VARIANT] ?? "outline"}>{t(`le.status.${status}` as TranslationKey)}</Badge>
}

/** §13 ledger summary: every journal entry (JE-YYYY-NNN), automatic or manual, Draft / Posted / Reversed, expandable lines; manual journal. */
function JournalEntries() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("LEDGER_MANAGE")
  const lookups = useAccLookups()
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const type = searchParams.get("type") ?? ""
  const sourceType = searchParams.get("sourceType") ?? ""
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<JournalEntryDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [open, setOpen] = React.useState<Record<string, JournalEntryDto | "loading">>({})
  const [editing, setEditing] = React.useState<{ entry?: JournalEntryDto } | null>(null)
  const [pending, setPending] = React.useState<{ action: "post" | "delete"; row: JournalEntryDto }>()
  const [reversing, setReversing] = React.useState<JournalEntryDto>()

  React.useEffect(() => {
    let cancelled = false
    JournalService.list({ status: status === ALL ? undefined : status, type: type || undefined, sourceType: sourceType || undefined, from, to, page, size: PAGE_SIZE })
      .then((p) => !cancelled && (setData(p), setOpen({})))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [status, type, sourceType, from, to, page, reloadKey])

  async function toggle(id: string) {
    if (open[id]) return setOpen((o) => without(o, id))
    setOpen((o) => ({ ...o, [id]: "loading" }))
    try {
      const full = await JournalService.get(id)
      setOpen((o) => ({ ...o, [id]: full }))
    } catch (e) {
      toast.error(errorMessage(e))
      setOpen((o) => without(o, id))
    }
  }
  async function edit(row: JournalEntryDto) {
    try {
      setEditing({ entry: await JournalService.get(row.id ?? "") })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.le.journal")} description={t("le.journal.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("le.journal.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={status} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
            <TabsList>
              <TabsTrigger value={ALL}>{t("companies.tabAll")}</TabsTrigger>
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {t(`le.status.${s}` as TranslationKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-end gap-3">
            <PlainSelect
              label={t("le.type")}
              className="w-44"
              value={type}
              onChange={(v) => update({ type: v, page: 0 })}
              none={t("le.allTypes")}
              options={(["AUTOMATIC", "MANUAL"] as const).map((x) => ({ value: x, label: t(`le.type.${x}`) }))}
            />
            <PlainSelect
              label={t("le.source")}
              className="w-52"
              value={sourceType}
              onChange={(v) => update({ sourceType: v, page: 0 })}
              none={t("le.allSources")}
              options={SOURCES.map((x) => ({ value: x, label: sourceLabel(t, x) }))}
            />
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from ?? ""} onChange={(e) => update({ from: e.target.value, page: 0 })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to ?? ""} onChange={(e) => update({ to: e.target.value, page: 0 })} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t("sales.number")}</TableHead>
                  <TableHead>{t("pos.date")}</TableHead>
                  <TableHead>{t("le.type")}</TableHead>
                  <TableHead>{t("acc.reference")}</TableHead>
                  <TableHead>{t("le.description")}</TableHead>
                  <TableHead className="text-right">{t("le.debit")}</TableHead>
                  <TableHead className="text-right">{t("le.credit")}</TableHead>
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
                      {t("le.journal.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((e) => {
                    const id = e.id ?? ""
                    const detail = open[id]
                    const manualDraft = e.type === "MANUAL" && e.status === "DRAFT"
                    return (
                      <React.Fragment key={id}>
                        <TableRow>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="size-7" aria-expanded={!!detail} aria-label={t("le.showLines", { number: e.number ?? "" })} onClick={() => toggle(id)}>
                              {detail ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.number}</TableCell>
                          <TableCell>{formatDate(e.date, language)}</TableCell>
                          <TableCell>
                            {t(`le.type.${e.type ?? "MANUAL"}` as TranslationKey)}
                            {e.sourceType &&
                              (SOURCE_PAGE[e.sourceType] && e.sourceId ? (
                                <Link
                                  href={`${SOURCE_PAGE[e.sourceType]}?view=${encodeURIComponent(e.sourceId)}`}
                                  className="text-primary block text-xs hover:underline"
                                  aria-label={t("le.openSource", { source: sourceLabel(t, e.sourceType), number: e.number ?? "" })}
                                >
                                  {sourceLabel(t, e.sourceType)}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground block text-xs">{sourceLabel(t, e.sourceType)}</span>
                              ))}
                          </TableCell>
                          <TableCell>{e.reference || "-"}</TableCell>
                          <TableCell className="max-w-64 truncate" title={e.description}>
                            {e.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">{money(e.totalDebit)}</TableCell>
                          <TableCell className="text-right">{money(e.totalCredit)}</TableCell>
                          <TableCell>
                            <EntryStatusBadge status={e.status} />
                          </TableCell>
                          <TableCell>
                            {manage && (manualDraft || e.status === "POSTED") && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: e.number ?? "" })}>
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {manualDraft && (
                                    <>
                                      <DropdownMenuItem onClick={() => setPending({ action: "post", row: e })}>
                                        <Stamp className="size-4" /> {t("sales.action.post")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => edit(e)}>
                                        <Pencil className="size-4" /> {t("common.edit")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: e })}>
                                        <Trash2 className="size-4" /> {t("common.delete")}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {e.status === "POSTED" && (
                                    <DropdownMenuItem onClick={() => setReversing(e)}>
                                      <Undo2 className="size-4" /> {t("le.reverse")}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                        {detail && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell />
                            <TableCell colSpan={9}>
                              {detail === "loading" ? <Skeleton className="h-12 w-full" /> : <LinesTable entry={detail} />}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-4xl">
          {editing && <ManualJournalForm key={editing.entry?.id ?? "new"} entry={editing.entry} accounts={lookups.accounts} onClose={() => setEditing(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!reversing} onOpenChange={(o) => !o && setReversing(undefined)}>
        <DialogContent className="sm:max-w-md">{reversing && <ReverseForm key={reversing.id} entry={reversing} onClose={() => setReversing(undefined)} onSaved={reload} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`le.confirm.${pending?.action ?? "delete"}` as TranslationKey, { number: pending?.row.number ?? "" })}
        description={t(`le.confirm.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={t(`sales.action.${pending?.action ?? "delete"}` as TranslationKey)}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          if (await attempt(() => (pending.action === "post" ? JournalService.post(id) : JournalService.remove(id)), t("common.saved"))) reload()
        }}
      />
    </div>
  )
}

function LinesTable({ entry }: { entry: JournalEntryDto }) {
  const t = useT()
  const money = useMoney()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("le.account")}</TableHead>
          <TableHead>{t("le.description")}</TableHead>
          <TableHead className="text-right">{t("le.debit")}</TableHead>
          <TableHead className="text-right">{t("le.credit")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(entry.lines ?? []).map((l, i) => (
          <TableRow key={l.id ?? i}>
            <TableCell>
              <span className="font-mono text-xs">{l.accountCode}</span> {l.accountName}
            </TableCell>
            <TableCell>{l.description || "-"}</TableCell>
            <TableCell className="text-right">{l.debit ? money(l.debit) : ""}</TableCell>
            <TableCell className="text-right">{l.credit ? money(l.credit) : ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type Line = { key: number; accountId: string; description: string; debit: string; credit: string }
const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}
/** A copy of the expanded-rows map without one entry. */
function without<T>(o: Record<string, T>, id: string) {
  const next = { ...o }
  delete next[id]
  return next
}

let lineKey = 0
const blankLine = (): Line => ({ key: ++lineKey, accountId: "", description: "", debit: "", credit: "" })

/** Manual journal: date, reference type, reference, description (5..500), lines; Create stays disabled until debits = credits. */
function ManualJournalForm({ entry, accounts, onClose, onSaved }: { entry?: JournalEntryDto; accounts: AccountDto[]; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const money = useMoney()
  const [date, setDate] = React.useState(entry?.date ?? today())
  const [referenceType, setReferenceType] = React.useState<EReferenceType>(entry?.referenceType ?? "GENERAL")
  const [reference, setReference] = React.useState(entry?.reference ?? "")
  const [description, setDescription] = React.useState(entry?.description ?? "")
  const [lines, setLines] = React.useState<Line[]>(() =>
    entry?.lines?.length
      ? entry.lines.map((l) => ({ key: ++lineKey, accountId: l.accountId ?? "", description: l.description ?? "", debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "" }))
      : [blankLine(), blankLine()],
  )
  const [saving, setSaving] = React.useState(false)
  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))
  const debit = lines.reduce((s, l) => s + num(l.debit), 0)
  const credit = lines.reduce((s, l) => s + num(l.credit), 0)
  const used = lines.filter((l) => l.accountId || num(l.debit) || num(l.credit))
  const lineError = used.some((l) => !l.accountId || (num(l.debit) > 0) === (num(l.credit) > 0))
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.005
  const descError = description.trim().length < 5 ? t("le.descMin") : undefined
  const valid = balanced && !lineError && used.length >= 2 && !descError && !!date && reference.length <= 100

  async function save(postNow: boolean) {
    setSaving(true)
    const body: ManualForm = {
      date,
      referenceType,
      reference: reference.trim() || undefined,
      description: description.trim(),
      lines: used.map((l) => ({ accountId: Number(l.accountId), description: l.description.trim() || undefined, debit: num(l.debit), credit: num(l.credit) })),
      post: postNow,
    }
    const ok = await attempt(() => JournalService.save(entry?.id, body), t("common.saved"))
    setSaving(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }

  const options = accounts.map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))
  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry ? t("le.journal.edit", { number: entry.number ?? "" }) : t("le.journal.create")}</DialogTitle>
        <DialogDescription>{t("le.journal.hint")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="je-date" label={t("pos.date")}>
          <Input id="je-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="je-reftype" label={t("le.referenceType")}>
          <PlainSelect id="je-reftype" label={t("le.referenceType")} value={referenceType} onChange={(v) => setReferenceType(v as EReferenceType)} options={REFERENCE_TYPES.map((r) => ({ value: r, label: t(`le.ref.${r}`) }))} />
        </Field>
        <Field id="je-ref" label={t("acc.reference")} error={reference.length > 100 ? t("le.max100") : undefined}>
          <Input id="je-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field id="je-desc" label={t("le.description")} error={description ? descError : undefined} className="sm:col-span-3">
          <Textarea id="je-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">{t("le.account")}</TableHead>
              <TableHead className="min-w-40">{t("le.description")}</TableHead>
              <TableHead className="w-36 text-right">{t("le.debit")}</TableHead>
              <TableHead className="w-36 text-right">{t("le.credit")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={l.key}>
                <TableCell>
                  <PlainSelect label={t("le.lineAccount", { n: i + 1 })} value={l.accountId} onChange={(v) => patch(l.key, { accountId: v })} options={options} />
                </TableCell>
                <TableCell>
                  <Input aria-label={t("le.lineDescription", { n: i + 1 })} maxLength={500} value={l.description} onChange={(e) => patch(l.key, { description: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input aria-label={t("le.lineDebit", { n: i + 1 })} type="number" min={0} step="any" className="text-right" value={l.debit} onChange={(e) => patch(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
                </TableCell>
                <TableCell>
                  <Input aria-label={t("le.lineCredit", { n: i + 1 })} type="number" min={0} step="any" className="text-right" value={l.credit} onChange={(e) => patch(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" disabled={lines.length <= 2} aria-label={t("le.removeLine", { n: i + 1 })} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <X className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>
                <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
                  <Plus className="size-4" /> {t("le.addLine")}
                </Button>
              </TableCell>
              <TableCell className="text-right font-semibold" data-testid="je-total-debit">
                {money(debit)}
              </TableCell>
              <TableCell className="text-right font-semibold" data-testid="je-total-credit">
                {money(credit)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className={`text-sm ${balanced ? "text-emerald-600" : "text-destructive"}`} role="status">
        {balanced ? t("le.balanced") : t("le.difference", { amount: money(Math.abs(debit - credit)) })}
        {lineError && ` · ${t("le.lineRule")}`}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button key="save-draft" variant="secondary" disabled={!valid || saving} onClick={() => save(false)}>
          {t("le.saveDraft")}
        </Button>
        <Button key="save-post" disabled={!valid || saving} onClick={() => save(true)}>
          {entry ? t("le.saveAndPost") : t("le.createAndPost")}
        </Button>
      </DialogFooter>
    </>
  )
}

function ReverseForm({ entry, onClose, onSaved }: { entry: JournalEntryDto; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [date, setDate] = React.useState(today())
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("le.reverseTitle", { number: entry.number ?? "" })}</DialogTitle>
        <DialogDescription>{t("le.reverseHint")}</DialogDescription>
      </DialogHeader>
      <Field id="rv-date" label={t("pos.date")}>
        <Input id="rv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field id="rv-desc" label={t("le.description")}>
        <Textarea id="rv-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={saving || !date}
          onClick={async () => {
            setSaving(true)
            const ok = await attempt(() => JournalService.reverse(entry.id ?? "", { date, description: description.trim() || undefined }), t("common.saved"))
            setSaving(false)
            if (ok) {
              onSaved()
              onClose()
            }
          }}
        >
          {t("le.reverse")}
        </Button>
      </DialogFooter>
    </>
  )
}
