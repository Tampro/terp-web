"use client"

import * as React from "react"
import { Ban, CheckCheck, Eye, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import {
  partyService,
  paymentService,
  type EPaymentKind,
  type EPaymentStatus,
  type NoteDto,
  type OpenInvoice,
  type PartyDto,
  type PaymentDto,
} from "@/lib/accounting/accounting.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { toNumber } from "@/lib/sales/sales.schema"

import { AccStatusBadge, attempt, bankLabel, errorMessage, Field, PlainSelect, today, useAccLookups } from "./acc-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES: EPaymentStatus[] = ["PENDING", "CLEARED", "CANCELLED"]

/**
 * §12.4 customer payments (CP-) and vendor payments (VP-): allocate to open invoices, apply available credit / debit
 * notes; Pending → Cleared (PAYMENT_CLEAR: invoice balances, journal, bank) or Cancelled.
 */
export function PaymentPage({ kind }: { kind: EPaymentKind }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const customer = kind === "customer-payments"
  const k = customer ? "customerPayment" : "vendorPayment"
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes("PAYMENT_MANAGE")
  const canClear = !!permissions?.includes("PAYMENT_CLEAR")
  const service = React.useMemo(() => paymentService(kind), [kind])
  const lookups = useAccLookups()
  const [parties, setParties] = React.useState<PartyDto[]>([])
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const partyId = searchParams.get("partyId") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<PaymentDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [creating, setCreating] = React.useState(false)
  const [viewing, setViewing] = React.useState<PaymentDto>()
  const [pending, setPending] = React.useState<{ action: "clear" | "cancel" | "delete"; row: PaymentDto }>()

  React.useEffect(() => {
    let cancelled = false
    partyService(customer ? "customers" : "vendors")
      .list({ size: 100 })
      .then((p) => !cancelled && setParties(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [customer])

  React.useEffect(() => {
    let cancelled = false
    service
      .list({ status: status === ALL ? undefined : status, partyId, from, to, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [service, status, partyId, from, to, page, reloadKey])

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t(`menu.acc.${kind}` as TranslationKey)} description={t(`acc.${k}.subtitle` as TranslationKey)}>
        {manage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t(`acc.${k}.create` as TranslationKey)}
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
                  {t(`acc.status.${s}` as TranslationKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-end gap-3">
            <PlainSelect
              label={t(customer ? "sales.customer" : "purchase.vendor")}
              className="w-56"
              value={partyId ?? ""}
              onChange={(v) => update({ partyId: v, page: 0 })}
              none={t(customer ? "sales.allCustomers" : "purchase.allVendors")}
              options={parties.map((p) => ({ value: p.id ?? "", label: p.companyName ?? "" }))}
            />
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from ?? ""} onChange={(e) => update({ from: e.target.value, page: 0 })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to ?? ""} onChange={(e) => update({ to: e.target.value, page: 0 })} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.number")}</TableHead>
                  <TableHead>{t("pos.date")}</TableHead>
                  <TableHead>{t(customer ? "sales.customer" : "purchase.vendor")}</TableHead>
                  <TableHead>{t("pos.bankAccount")}</TableHead>
                  <TableHead className="text-right">{t("acc.payment.allocated")}</TableHead>
                  <TableHead className="text-right">{t("acc.payment.notesApplied")}</TableHead>
                  <TableHead className="text-right">{t("acc.amount")}</TableHead>
                  <TableHead>{t("crm.status")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                      {t(`acc.${k}.empty` as TranslationKey)}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.number}</TableCell>
                      <TableCell>{formatDate(p.paymentDate, language)}</TableCell>
                      <TableCell>{p.partyName}</TableCell>
                      <TableCell>{bankLabel(lookups.banks.find((b) => b.id === p.bankAccountId))}</TableCell>
                      <TableCell className="text-right">{money(p.allocatedTotal)}</TableCell>
                      <TableCell className="text-right">{money(p.notesTotal)}</TableCell>
                      <TableCell className="text-right font-medium">{money(p.amount)}</TableCell>
                      <TableCell>
                        <AccStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: p.number ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewing(p)}>
                              <Eye className="size-4" /> {t("sales.action.view")}
                            </DropdownMenuItem>
                            {p.status === "PENDING" && canClear && (
                              <DropdownMenuItem onClick={() => setPending({ action: "clear", row: p })}>
                                <CheckCheck className="size-4" /> {t("acc.payment.clear")}
                              </DropdownMenuItem>
                            )}
                            {p.status === "PENDING" && manage && (
                              <>
                                <DropdownMenuItem onClick={() => setPending({ action: "cancel", row: p })}>
                                  <Ban className="size-4" /> {t("acc.payment.cancel")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: p })}>
                                  <Trash2 className="size-4" /> {t("common.delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          {creating && <PaymentForm kind={kind} parties={parties} lookups={lookups} onClose={() => setCreating(false)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <div className="grid gap-3">
              <DialogHeader>
                <DialogTitle>{viewing.number}</DialogTitle>
                <DialogDescription>
                  {viewing.partyName} · {formatDate(viewing.paymentDate, language)}
                </DialogDescription>
              </DialogHeader>
              <ul className="grid gap-1 text-sm">
                {(viewing.allocations ?? []).map((a) => (
                  <li key={a.invoiceId} className="flex justify-between border-b py-1">
                    <span className="font-mono text-xs">{a.invoiceNumber}</span>
                    <span>{money(a.amount)}</span>
                  </li>
                ))}
                {(viewing.appliedNotes ?? []).map((n) => (
                  <li key={n.noteId} className="text-muted-foreground flex justify-between border-b py-1">
                    <span>{t("acc.payment.noteN", { id: n.noteId ?? "" })}</span>
                    <span>-{money(n.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold">
                <span>{t("acc.amount")}</span>
                <span>{money(viewing.amount)}</span>
              </div>
              {viewing.notes && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{viewing.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`acc.confirm.${pending?.action === "clear" ? "clear" : pending?.action === "cancel" ? "cancelPayment" : "delete"}` as TranslationKey, { number: pending?.row.number ?? "" })}
        description={t(`acc.confirm.${pending?.action === "clear" ? "clearDesc" : pending?.action === "cancel" ? "cancelPaymentDesc" : "deleteDesc"}` as TranslationKey)}
        confirmLabel={t(pending?.action === "clear" ? "acc.payment.clear" : pending?.action === "cancel" ? "acc.payment.cancel" : "common.delete")}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const call = { clear: () => service.clear(id), cancel: () => service.cancel(id), delete: () => service.remove(id) }[pending.action]
          if (await attempt(call, t("common.saved"))) reload()
        }}
      />
    </div>
  )
}

function PaymentForm({
  kind,
  parties,
  lookups,
  onClose,
  onSaved,
}: {
  kind: EPaymentKind
  parties: PartyDto[]
  lookups: ReturnType<typeof useAccLookups>
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const customer = kind === "customer-payments"
  const [partyId, setPartyId] = React.useState("")
  const [bankAccountId, setBankAccountId] = React.useState("")
  const [date, setDate] = React.useState(today())
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [open, setOpen] = React.useState<{ partyId: string; invoices: OpenInvoice[]; notes: NoteDto[] }>()
  const [alloc, setAlloc] = React.useState<Record<string, string>>({})
  const [use, setUse] = React.useState<Record<string, string>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!partyId) return
    let cancelled = false
    paymentService(kind)
      .openItems(partyId)
      .then((o) => !cancelled && setOpen({ partyId, invoices: o.invoices ?? [], notes: o.notes ?? [] }))
      .catch((e: Error) => !cancelled && (setOpen({ partyId, invoices: [], notes: [] }), toast.error(e.message)))
    return () => {
      cancelled = true
    }
  }, [kind, partyId])

  const items = open?.partyId === partyId ? open : undefined
  const num = (v?: string) => (v && v.trim() ? toNumber(v) : 0)
  const allocated = Object.values(alloc).reduce((s, v) => s + (num(v) || 0), 0)
  const applied = Object.values(use).reduce((s, v) => s + (num(v) || 0), 0)

  async function save() {
    const e: Record<string, string> = {}
    if (!partyId) e.partyId = t("project.v.required")
    if (!bankAccountId) e.bankAccountId = t("project.v.required")
    for (const inv of items?.invoices ?? []) {
      const v = alloc[inv.id ?? ""]
      if (v && !(num(v) > 0 && num(v) <= (inv.balance ?? 0))) e[`inv.${inv.id}`] = t("acc.v.upTo", { amount: money(inv.balance) }) // ACC_054
    }
    for (const n of items?.notes ?? []) {
      const v = use[n.id ?? ""]
      if (v && !(num(v) > 0 && num(v) <= (n.balance ?? 0))) e[`note.${n.id}`] = t("acc.v.upTo", { amount: money(n.balance) }) // ACC_057
    }
    if (allocated <= 0) e.allocations = t("acc.v.oneInvoice") // ACC_059
    else if (applied > allocated) e.allocations = t("acc.v.notesOverInvoices") // ACC_058
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const ok = await attempt(
      () =>
        paymentService(kind).create({
          partyId: Number(partyId),
          bankAccountId: Number(bankAccountId),
          paymentDate: date,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          allocations: Object.entries(alloc)
            .filter(([, v]) => num(v) > 0)
            .map(([id, v]) => ({ invoiceId: Number(id), amount: num(v) })),
          appliedNotes: Object.entries(use)
            .filter(([, v]) => num(v) > 0)
            .map(([id, v]) => ({ noteId: Number(id), amount: num(v) })),
        }),
      t("common.saved")
    )
    setBusy(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t(customer ? "acc.customerPayment.create" : "acc.vendorPayment.create")}</DialogTitle>
        <DialogDescription>{t("acc.payment.formDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pm-party" label={t(customer ? "sales.customer" : "purchase.vendor")} error={errors.partyId}>
          <PlainSelect
            id="pm-party"
            label={t(customer ? "sales.customer" : "purchase.vendor")}
            value={partyId}
            onChange={(v) => {
              setPartyId(v)
              setAlloc({})
              setUse({})
            }}
            options={parties.map((p) => ({ value: p.id ?? "", label: p.companyName ?? "" }))}
          />
        </Field>
        <Field id="pm-bank" label={t("pos.bankAccount")} error={errors.bankAccountId}>
          <PlainSelect id="pm-bank" label={t("pos.bankAccount")} value={bankAccountId} onChange={setBankAccountId} options={lookups.banks.filter((b) => b.active).map((b) => ({ value: b.id ?? "", label: bankLabel(b) }))} />
        </Field>
        <Field id="pm-date" label={t("pos.date")}>
          <Input id="pm-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="pm-ref" label={t("acc.reference")}>
          <Input id="pm-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
      {partyId && !items && <Skeleton className="h-24 w-full" />}
      {items && (
        <>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">{t(customer ? "acc.payment.openInvoices" : "acc.payment.openBills")}</h3>
            {items.invoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("acc.payment.noOpen")}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.number")}</TableHead>
                      <TableHead>{t("sales.dueDate")}</TableHead>
                      <TableHead className="text-right">{t("sales.total")}</TableHead>
                      <TableHead className="text-right">{t("sales.balance")}</TableHead>
                      <TableHead className="w-40">{t("acc.payment.pay")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                        <TableCell>{formatDate(inv.dueDate, language)}</TableCell>
                        <TableCell className="text-right">{money(inv.total)}</TableCell>
                        <TableCell className="text-right">{money(inv.balance)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Input
                              inputMode="decimal"
                              aria-label={t("acc.payment.payOf", { number: inv.number ?? "" })}
                              value={alloc[inv.id ?? ""] ?? ""}
                              onChange={(e) => setAlloc((x) => ({ ...x, [inv.id ?? ""]: e.target.value }))}
                            />
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAlloc((x) => ({ ...x, [inv.id ?? ""]: String(inv.balance ?? 0) }))}>
                              {t("acc.payment.full")}
                            </Button>
                          </div>
                          {errors[`inv.${inv.id}`] && <p className="text-destructive text-xs">{errors[`inv.${inv.id}`]}</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          {items.notes.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">{t(customer ? "acc.payment.creditNotes" : "acc.payment.debitNotes")}</h3>
              <ul className="grid gap-2">
                {items.notes.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1 font-mono text-xs">
                      {n.number} · {t("sales.balance")} {money(n.balance)}
                    </span>
                    <Input
                      className="w-40"
                      inputMode="decimal"
                      aria-label={t("acc.payment.useOf", { number: n.number ?? "" })}
                      value={use[n.id ?? ""] ?? ""}
                      onChange={(e) => setUse((x) => ({ ...x, [n.id ?? ""]: e.target.value }))}
                    />
                    {errors[`note.${n.id}`] && <p className="text-destructive w-full text-xs">{errors[`note.${n.id}`]}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="grid gap-1 text-sm" data-testid="payment-totals">
            <div className="flex justify-between">
              <dt>{t("acc.payment.allocated")}</dt>
              <dd>{money(allocated)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("acc.payment.notesApplied")}</dt>
              <dd>-{money(applied)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <dt>{t("acc.payment.toPay")}</dt>
              <dd>{money(allocated - applied)}</dd>
            </div>
          </dl>
          {errors.allocations && <p className="text-destructive text-sm">{errors.allocations}</p>}
        </>
      )}
      <Field id="pm-notes" label={t("crm.notes")}>
        <Textarea id="pm-notes" rows={2} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={busy || !items} onClick={() => save().catch((e) => toast.error(errorMessage(e)))}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </div>
  )
}
