"use client"

import * as React from "react"
import { Download, FileBarChart, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { partyService, type AddressDto, type EPartyKind, type PartyDto, type PartyForm, type PartyReport } from "@/lib/accounting/accounting.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { CrmUserService, type CrmUserOption } from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

import { attempt, errorMessage, Field, PlainSelect, today } from "./acc-kit"

const PAGE_SIZE = 20
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADDRESS_KEYS = ["name", "address", "address2", "city", "state", "country", "zip"] as const
const ADDRESS_MAX: Record<(typeof ADDRESS_KEYS)[number], number> = { name: 255, address: 255, address2: 255, city: 100, state: 100, country: 100, zip: 20 }

/**
 * §12.1 customers (CUST-0001, Client-role user) and vendors (VEN-0001, Vendor-role user): list, 3-step form (details;
 * billing address; shipping address or same as billing, notes), report for a date range with PDF.
 */
export function PartyPage({ kind }: { kind: EPartyKind }) {
  const t = useT()
  const permissions = useAuthStore((s) => s.me?.permissions)
  const k = kind === "customers" ? "customer" : "vendor"
  const manage = !!permissions?.includes(kind === "customers" ? "CUSTOMER_MANAGE" : "VENDOR_MANAGE")
  const canReport = !!permissions?.includes("ACCOUNTING_REPORT_VIEW")
  const service = React.useMemo(() => partyService(kind), [kind])
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<PartyDto>>()
  const [users, setUsers] = React.useState<CrmUserOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ party?: PartyDto } | null>(null)
  const [reporting, setReporting] = React.useState<PartyDto>()
  const [deleting, setDeleting] = React.useState<PartyDto>()

  React.useEffect(() => {
    let cancelled = false
    CrmUserService.users()
      .then((p) => !cancelled && setUsers(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    service
      .list({ keyword: keyword || undefined, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [service, keyword, page, reloadKey])

  async function openEdit(p: PartyDto) {
    try {
      setEditing({ party: await service.get(p.id!) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  // Client-role users for customers, Vendor-role users for vendors (the backend links one user to one party)
  const role = kind === "customers" ? "CLIENT" : "VENDOR"
  const roleUsers = users.filter((u) => u.roles?.includes(role))
  const rows = data?.content ?? []
  const code = (p: PartyDto) => p.customerCode ?? p.vendorCode ?? "-"

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t(`menu.acc.${kind}` as TranslationKey)} description={t(`acc.${k}.subtitle` as TranslationKey)}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t(`acc.${k}.create` as TranslationKey)}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              update({ keyword: search.trim(), page: 0 })
            }}
          >
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("acc.party.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
            </div>
            <Button type="submit" variant="secondary">
              {t("common.search")}
            </Button>
          </form>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("acc.code")}</TableHead>
                  <TableHead>{t("acc.party.company")}</TableHead>
                  <TableHead>{t("acc.party.contact")}</TableHead>
                  <TableHead>{t("crm.email")}</TableHead>
                  <TableHead>{t("crm.phone")}</TableHead>
                  <TableHead>{t("sales.paymentTerms")}</TableHead>
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
                      {t(`acc.${k}.empty` as TranslationKey)}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{code(p)}</TableCell>
                      <TableCell className="font-medium">{p.companyName}</TableCell>
                      <TableCell>{p.contactPerson}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.mobile || "-"}</TableCell>
                      <TableCell>{p.paymentTerms || "-"}</TableCell>
                      <TableCell>
                        {(manage || canReport) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("crm.actionsFor", { name: p.companyName ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canReport && (
                                <DropdownMenuItem onClick={() => setReporting(p)}>
                                  <FileBarChart className="size-4" /> {t("acc.party.report")}
                                </DropdownMenuItem>
                              )}
                              {manage && (
                                <>
                                  <DropdownMenuItem onClick={() => openEdit(p)}>
                                    <Pencil className="size-4" /> {t("common.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                                    <Trash2 className="size-4" /> {t("common.delete")}
                                  </DropdownMenuItem>
                                </>
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
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {editing && <PartyWizard key={editing.party?.id ?? "new"} kind={kind} party={editing.party} users={roleUsers} onClose={() => setEditing(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!reporting} onOpenChange={(o) => !o && setReporting(undefined)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">{reporting && <ReportView kind={kind} party={reporting} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("acc.confirm.deleteNamed", { name: deleting?.companyName ?? "" })}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => service.remove(deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}

type Address = Record<(typeof ADDRESS_KEYS)[number], string>
const toAddress = (a?: AddressDto | null): Address => Object.fromEntries(ADDRESS_KEYS.map((x) => [x, a?.[x] ?? ""])) as Address
const fromAddress = (a: Address): AddressDto => Object.fromEntries(ADDRESS_KEYS.map((x) => [x, a[x].trim() || null])) as AddressDto

function PartyWizard({ kind, party, users, onClose, onSaved }: { kind: EPartyKind; party?: PartyDto; users: CrmUserOption[]; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const k = kind === "customers" ? "customer" : "vendor"
  const [step, setStep] = React.useState(0)
  const [f, setF] = React.useState({
    userId: party?.userId ?? "",
    companyName: party?.companyName ?? "",
    contactPerson: party?.contactPerson ?? "",
    email: party?.email ?? "",
    mobile: party?.mobile ?? "",
    taxNumber: party?.taxNumber ?? "",
    paymentTerms: party?.paymentTerms ?? "",
    notes: party?.notes ?? "",
  })
  const [billing, setBilling] = React.useState<Address>(toAddress(party?.billing))
  const [same, setSame] = React.useState(party?.shippingSameAsBilling ?? true)
  const [shipping, setShipping] = React.useState<Address>(toAddress(party?.shipping))
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)

  const validate = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!f.companyName.trim()) e.companyName = t("project.v.required")
      if (!f.contactPerson.trim()) e.contactPerson = t("project.v.required")
      if (!EMAIL.test(f.email.trim())) e.email = t("purchase.v.email")
      if (f.mobile.length > 30) e.mobile = t("sales.v.max", { n: 30 })
      if (f.taxNumber.length > 50) e.taxNumber = t("sales.v.max", { n: 50 })
      if (f.paymentTerms.length > 100) e.paymentTerms = t("sales.v.max", { n: 100 })
    }
    const addr = (a: Address, prefix: string) => ADDRESS_KEYS.forEach((x) => a[x].length > ADDRESS_MAX[x] && (e[`${prefix}.${x}`] = t("sales.v.max", { n: ADDRESS_MAX[x] })))
    if (s === 1) addr(billing, "billing")
    if (s === 2) {
      if (!same) addr(shipping, "shipping")
      if (f.notes.length > 10000) e.notes = t("sales.v.max", { n: 10000 })
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate(2)) return
    const body: PartyForm = {
      companyName: f.companyName.trim(),
      contactPerson: f.contactPerson.trim(),
      email: f.email.trim(),
      mobile: f.mobile.trim() || null,
      taxNumber: f.taxNumber.trim() || null,
      paymentTerms: f.paymentTerms.trim() || null,
      userId: f.userId ? Number(f.userId) : null,
      billing: fromAddress(billing),
      shippingSameAsBilling: same,
      ...(same ? {} : { shipping: fromAddress(shipping) }),
      notes: f.notes.trim() || null,
    }
    setBusy(true)
    const ok = await attempt(() => partyService(kind).save(party?.id, body), t("common.saved"))
    setBusy(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }

  const text = (key: keyof typeof f, label: string, type = "text") => (
    <Field id={`pt-${key}`} label={label} error={errors[key]}>
      <Input id={`pt-${key}`} type={type} value={f[key]} onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value }))} />
    </Field>
  )
  const address = (a: Address, set: (a: Address) => void, prefix: string) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {ADDRESS_KEYS.map((x) => (
        <Field key={x} id={`${prefix}-${x}`} label={t(`acc.address.${x}` as TranslationKey)} error={errors[`${prefix}.${x}`]} className={x === "address" || x === "address2" ? "sm:col-span-2" : ""}>
          <Input id={`${prefix}-${x}`} value={a[x]} onChange={(e) => set({ ...a, [x]: e.target.value })} />
        </Field>
      ))}
    </div>
  )
  const titles: TranslationKey[] = ["acc.party.step1", "acc.party.step2", "acc.party.step3"]

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t(`acc.${k}.${party ? "edit" : "create"}` as TranslationKey)}</DialogTitle>
        <DialogDescription>{t("inventory.item.stepOf", { n: step + 1, total: 3, name: t(titles[step]) })}</DialogDescription>
      </DialogHeader>
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pt-user" label={t(`acc.${k}.user` as TranslationKey)} className="sm:col-span-2">
            <PlainSelect
              id="pt-user"
              label={t(`acc.${k}.user` as TranslationKey)}
              value={f.userId}
              onChange={(v) => setF((x) => ({ ...x, userId: v }))}
              none={t("crm.none")}
              options={users.map((u) => ({ value: u.id ?? "", label: `${u.fullName || u.username} (${u.email ?? ""})` }))}
            />
          </Field>
          {text("companyName", t("acc.party.company"))}
          {text("contactPerson", t("acc.party.contact"))}
          {text("email", t("crm.email"), "email")}
          {text("mobile", t("crm.phone"), "tel")}
          {text("taxNumber", t("acc.party.taxNumber"))}
          {text("paymentTerms", t("sales.paymentTerms"))}
        </div>
      )}
      {step === 1 && address(billing, setBilling, "billing")}
      {step === 2 && (
        <div className="grid gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={same} onCheckedChange={(c) => setSame(c === true)} /> {t("acc.party.sameAsBilling")}
          </label>
          {!same && address(shipping, setShipping, "shipping")}
          <Field id="pt-notes" label={t("crm.notes")} error={errors.notes}>
            <Textarea id="pt-notes" rows={3} value={f.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} />
          </Field>
        </div>
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}>
          {t(step === 0 ? "common.cancel" : "inventory.item.back")}
        </Button>
        {step < 2 ? (
          <Button key="next" type="button" onClick={() => validate(step) && setStep((s) => s + 1)}>
            {t("inventory.item.next")}
          </Button>
        ) : (
          <Button key="save" type="button" disabled={busy} onClick={save}>
            {t("common.save")}
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}

/** §12.1 customer report (invoiced, returns, credit notes, payments) / vendor report (billed, returns, debit notes, payments, balance). */
function ReportView({ kind, party }: { kind: EPartyKind; party: PartyDto }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const now = new Date()
  const [from, setFrom] = React.useState(new Date(now.getFullYear(), 0, 1).toLocaleDateString("en-CA"))
  const [to, setTo] = React.useState(today())
  const [report, setReport] = React.useState<{ key: string; data?: PartyReport; error?: string }>()
  const key = `${from}|${to}`
  React.useEffect(() => {
    let cancelled = false
    const [f, tt] = key.split("|")
    partyService(kind)
      .report(party.id!, f, tt)
      .then((data) => !cancelled && setReport({ key, data }))
      .catch((e: Error) => !cancelled && setReport({ key, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [kind, party.id, key])
  const r = report?.key === key ? report : undefined
  const d = r?.data
  async function pdf() {
    try {
      saveBlob(await partyService(kind).reportPdf(party.id!, from, to), `${party.customerCode ?? party.vendorCode ?? "report"}.pdf`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const sums = [
    { label: t(kind === "customers" ? "acc.report.invoiced" : "acc.report.billed"), value: d?.invoiced },
    { label: t("acc.report.returns"), value: d?.returns },
    { label: t(kind === "customers" ? "acc.report.creditNotes" : "acc.report.debitNotes"), value: d?.notes },
    { label: t("acc.report.payments"), value: d?.payments },
    { label: t("acc.report.balance"), value: d?.balance },
  ]
  const docs = [
    { title: t(kind === "customers" ? "acc.report.invoiced" : "acc.report.billed"), list: d?.invoices },
    { title: t("acc.report.returns"), list: d?.returnDocs },
    { title: t(kind === "customers" ? "acc.report.creditNotes" : "acc.report.debitNotes"), list: d?.noteDocs },
    { title: t("acc.report.payments"), list: d?.paymentDocs },
  ]
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("acc.party.reportOf", { name: party.companyName ?? "" })}</DialogTitle>
        <DialogDescription className="sr-only">{t("acc.party.report")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="w-40" aria-label={t("sales.from")} value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-40" aria-label={t("sales.to")} value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="outline" className="ml-auto" disabled={!d} onClick={pdf}>
          <Download className="size-4" /> {t("pos.downloadPdf")}
        </Button>
      </div>
      {!r ? (
        <Skeleton className="h-32 w-full" />
      ) : r.error ? (
        <p className="text-destructive text-sm">{r.error}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {sums.map((s) => (
              <div key={s.label} className="rounded-md border p-2">
                <dt className="text-muted-foreground text-xs">{s.label}</dt>
                <dd className="font-semibold">{money(s.value)}</dd>
              </div>
            ))}
          </dl>
          {docs.map((g) =>
            (g.list ?? []).length === 0 ? null : (
              <div key={g.title} className="grid gap-1">
                <h3 className="text-sm font-medium">{g.title}</h3>
                <ul className="grid gap-1 text-sm">
                  {(g.list ?? []).map((x) => (
                    <li key={`${x.id}-${x.number}`} className="flex justify-between gap-2 border-b py-1">
                      <span className="font-mono text-xs">{x.number}</span>
                      <span className="text-muted-foreground">{formatDate(x.date, language)}</span>
                      <span>{money(x.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
