"use client"

import * as React from "react"
import { ArrowRightLeft, CheckCheck, List, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { BankService, type BankAccountDto, type BankTransactionDto, type EBankAccountType, type TransferDto } from "@/lib/accounting/accounting.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { toNumber } from "@/lib/sales/sales.schema"

import { AccStatusBadge, accountLabel, attempt, bankLabel, Field, PlainSelect, today, useAccLookups } from "../_components/acc-kit"

const PAGE_SIZE = 20
const TYPES: EBankAccountType[] = ["CHECKING", "SAVINGS", "CREDIT", "LOAN"]

export default function BankingPage() {
  return (
    <React.Suspense>
      <Banking />
    </React.Suspense>
  )
}

/** §12.3 banking: bank accounts (with their system transactions and Reconcile) and bank transfers (Pending → Process → Completed). */
function Banking() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("BANK_MANAGE")
  const lookups = useAccLookups()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") === "transfers" ? "transfers" : "accounts"
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const keyword = searchParams.get("keyword") ?? ""
  const [search, setSearch] = React.useState(keyword)
  const [accounts, setAccounts] = React.useState<IPage<BankAccountDto>>()
  const [transfers, setTransfers] = React.useState<IPage<TransferDto>>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ account?: BankAccountDto } | null>(null)
  const [transfer, setTransfer] = React.useState<{ transfer?: TransferDto } | null>(null)
  const [txOf, setTxOf] = React.useState<BankAccountDto>()
  const [pending, setPending] = React.useState<{ title: string; desc: string; label: string; run: () => Promise<unknown> }>()

  React.useEffect(() => {
    let cancelled = false
    const load =
      tab === "accounts"
        ? BankService.accounts({ keyword: keyword || undefined, page, size: PAGE_SIZE }).then((p) => !cancelled && setAccounts(p))
        : BankService.transfers({ page, size: PAGE_SIZE }).then((p) => !cancelled && setTransfers(p))
    load.catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [tab, keyword, page, reloadKey])

  const bank = (id?: string) => lookups.banks.find((b) => b.id === id) ?? accounts?.content?.find((b) => b.id === id)
  const data = tab === "accounts" ? accounts : transfers
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.acc.banking")} description={t("acc.bank.subtitle")}>
        {manage &&
          (tab === "accounts" ? (
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("acc.bank.create")}
            </Button>
          ) : (
            <Button onClick={() => setTransfer({})}>
              <ArrowRightLeft className="size-4" /> {t("acc.transfer.create")}
            </Button>
          ))}
      </PageHeader>
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "accounts" ? "" : v, page: 0, keyword: "" })}>
        <TabsList>
          <TabsTrigger value="accounts">{t("acc.bank.accounts")}</TabsTrigger>
          <TabsTrigger value="transfers">{t("acc.bank.transfers")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {tab === "accounts" && (
            <form
              className="flex max-w-md items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                update({ keyword: search.trim(), page: 0 })
              }}
            >
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("acc.bank.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
          )}
          <div className="overflow-x-auto">
            {!data ? (
              <Skeleton className="h-32 w-full" />
            ) : tab === "accounts" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("acc.bank.accountNumber")}</TableHead>
                    <TableHead>{t("acc.bank.holder")}</TableHead>
                    <TableHead>{t("acc.bank.bankName")}</TableHead>
                    <TableHead>{t("acc.bank.type")}</TableHead>
                    <TableHead className="text-right">{t("acc.bank.opening")}</TableHead>
                    <TableHead className="text-right">{t("acc.bank.balance")}</TableHead>
                    <TableHead>{t("crm.status")}</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(accounts?.content ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                        {t("acc.bank.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {(accounts?.content ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.accountNumber}</TableCell>
                      <TableCell className="font-medium">{b.holderName}</TableCell>
                      <TableCell>
                        {b.bankName}
                        {b.branch ? <span className="text-muted-foreground text-xs"> · {b.branch}</span> : null}
                      </TableCell>
                      <TableCell>{b.accountType ? t(`acc.bank.typeOf.${b.accountType}` as TranslationKey) : "-"}</TableCell>
                      <TableCell className="text-right">{money(b.openingBalance)}</TableCell>
                      <TableCell className="text-right font-medium">{money(b.balance)}</TableCell>
                      <TableCell>
                        <Badge variant={b.active ? "default" : "outline"}>{t(b.active ? "crm.active" : "crm.inactive")}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("crm.actionsFor", { name: b.accountNumber ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setTxOf(b)}>
                              <List className="size-4" /> {t("acc.bank.transactions")}
                            </DropdownMenuItem>
                            {manage && (
                              <>
                                <DropdownMenuItem onClick={() => setEditing({ account: b })}>
                                  <Pencil className="size-4" /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    setPending({
                                      title: t("acc.confirm.deleteNamed", { name: b.accountNumber ?? "" }),
                                      desc: t("crm.confirm.deleteDesc"),
                                      label: t("common.delete"),
                                      run: () => BankService.removeAccount(b.id!),
                                    })
                                  }
                                >
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sales.number")}</TableHead>
                    <TableHead>{t("pos.date")}</TableHead>
                    <TableHead>{t("acc.transfer.from")}</TableHead>
                    <TableHead>{t("acc.transfer.to")}</TableHead>
                    <TableHead className="text-right">{t("acc.amount")}</TableHead>
                    <TableHead className="text-right">{t("acc.transfer.charges")}</TableHead>
                    <TableHead>{t("crm.status")}</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transfers?.content ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                        {t("acc.transfer.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {(transfers?.content ?? []).map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-mono text-xs">{x.number}</TableCell>
                      <TableCell>{formatDate(x.date, language)}</TableCell>
                      <TableCell>{bankLabel(bank(x.fromAccountId))}</TableCell>
                      <TableCell>{bankLabel(bank(x.toAccountId))}</TableCell>
                      <TableCell className="text-right font-medium">{money(x.amount)}</TableCell>
                      <TableCell className="text-right">{money(x.charges ?? 0)}</TableCell>
                      <TableCell>
                        <AccStatusBadge status={x.status} />
                      </TableCell>
                      <TableCell>
                        {manage && x.status === "PENDING" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: x.number ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setPending({
                                    title: t("acc.confirm.process", { number: x.number ?? "" }),
                                    desc: t("acc.confirm.processDesc"),
                                    label: t("acc.transfer.process"),
                                    run: () => BankService.process(x.id!),
                                  })
                                }
                              >
                                <CheckCheck className="size-4" /> {t("acc.transfer.process")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTransfer({ transfer: x })}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() =>
                                  setPending({
                                    title: t("acc.confirm.deleteNamed", { name: x.number ?? "" }),
                                    desc: t("crm.confirm.deleteDesc"),
                                    label: t("common.delete"),
                                    run: () => BankService.removeTransfer(x.id!),
                                  })
                                }
                              >
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
            )}
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {editing && <AccountForm key={editing.account?.id ?? "new"} account={editing.account} lookups={lookups} onClose={() => setEditing(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!transfer} onOpenChange={(o) => !o && setTransfer(null)}>
        <DialogContent className="sm:max-w-lg">
          {transfer && <TransferForm key={transfer.transfer?.id ?? "new"} transfer={transfer.transfer} lookups={lookups} onClose={() => setTransfer(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!txOf} onOpenChange={(o) => !o && setTxOf(undefined)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">{txOf && <Transactions account={txOf} manage={manage} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={pending?.title ?? ""}
        description={pending?.desc}
        confirmLabel={pending?.label}
        onConfirm={async () => {
          if (pending && (await attempt(pending.run, t("common.saved")))) reload()
        }}
      />
    </div>
  )
}

function AccountForm({ account, lookups, onClose, onSaved }: { account?: BankAccountDto; lookups: ReturnType<typeof useAccLookups>; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [f, setF] = React.useState({
    accountNumber: account?.accountNumber ?? "",
    holderName: account?.holderName ?? "",
    bankName: account?.bankName ?? "",
    branch: account?.branch ?? "",
    accountType: (account?.accountType ?? "CHECKING") as string,
    glAccountId: account?.glAccountId ?? "",
    paymentGateway: account?.paymentGateway ?? "",
    openingBalance: account?.openingBalance == null ? "0" : String(account.openingBalance),
    iban: account?.iban ?? "",
    swift: account?.swift ?? "",
    routingNumber: account?.routingNumber ?? "",
  })
  const [active, setActive] = React.useState(account?.active ?? true)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const MAX: Partial<Record<keyof typeof f, number>> = { accountNumber: 50, holderName: 255, bankName: 255, branch: 255, paymentGateway: 100, iban: 34, swift: 11, routingNumber: 30 }
  async function save() {
    const e: Record<string, string> = {}
    for (const key of ["accountNumber", "holderName", "bankName"] as const) if (!f[key].trim()) e[key] = t("project.v.required")
    for (const [key, n] of Object.entries(MAX)) if (f[key as keyof typeof f].length > (n ?? 0)) e[key] = t("sales.v.max", { n: n ?? 0 })
    if (!(toNumber(f.openingBalance || "0") >= 0)) e.openingBalance = t("inventory.v.amount")
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const ok = await attempt(
      () =>
        BankService.saveAccount(account?.id, {
          accountNumber: f.accountNumber.trim(),
          holderName: f.holderName.trim(),
          bankName: f.bankName.trim(),
          branch: f.branch.trim() || null,
          accountType: f.accountType as EBankAccountType,
          glAccountId: f.glAccountId ? Number(f.glAccountId) : null,
          paymentGateway: f.paymentGateway.trim() || null,
          openingBalance: toNumber(f.openingBalance || "0"),
          iban: f.iban.trim() || null,
          swift: f.swift.trim() || null,
          routingNumber: f.routingNumber.trim() || null,
          active,
        }),
      t("common.saved")
    )
    setBusy(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }
  const text = (key: keyof typeof f, label: string) => (
    <Field id={`ba-${key}`} label={label} error={errors[key]}>
      <Input id={`ba-${key}`} value={f[key]} onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value }))} />
    </Field>
  )
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t(account ? "acc.bank.edit" : "acc.bank.create")}</DialogTitle>
        <DialogDescription className="sr-only">{t("acc.bank.accounts")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("accountNumber", t("acc.bank.accountNumber"))}
        {text("holderName", t("acc.bank.holder"))}
        {text("bankName", t("acc.bank.bankName"))}
        {text("branch", t("acc.bank.branch"))}
        <Field id="ba-type" label={t("acc.bank.type")}>
          <PlainSelect id="ba-type" label={t("acc.bank.type")} value={f.accountType} onChange={(v) => setF((x) => ({ ...x, accountType: v }))} options={TYPES.map((x) => ({ value: x, label: t(`acc.bank.typeOf.${x}` as TranslationKey) }))} />
        </Field>
        <Field id="ba-gl" label={t("acc.glAccount")}>
          <PlainSelect id="ba-gl" label={t("acc.glAccount")} value={f.glAccountId} onChange={(v) => setF((x) => ({ ...x, glAccountId: v }))} none={t("crm.none")} options={lookups.accounts.map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))} />
        </Field>
        {text("openingBalance", t("acc.bank.opening"))}
        {text("paymentGateway", t("acc.bank.gateway"))}
        {text("iban", "IBAN")}
        {text("swift", "SWIFT")}
        {text("routingNumber", t("acc.bank.routing"))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} /> {t("crm.active")}
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={busy} onClick={save}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </div>
  )
}

function TransferForm({ transfer, lookups, onClose, onSaved }: { transfer?: TransferDto; lookups: ReturnType<typeof useAccLookups>; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [f, setF] = React.useState({
    date: transfer?.date ?? today(),
    fromAccountId: transfer?.fromAccountId ?? "",
    toAccountId: transfer?.toAccountId ?? "",
    amount: transfer?.amount == null ? "" : String(transfer.amount),
    charges: transfer?.charges == null ? "" : String(transfer.charges),
    reference: transfer?.reference ?? "",
    description: transfer?.description ?? "",
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const set = (key: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [key]: v }))
  const options = lookups.banks.filter((b) => b.active).map((b) => ({ value: b.id ?? "", label: bankLabel(b) }))
  async function save() {
    const e: Record<string, string> = {}
    if (!f.fromAccountId) e.fromAccountId = t("project.v.required")
    if (!f.toAccountId) e.toAccountId = t("project.v.required")
    else if (f.toAccountId === f.fromAccountId) e.toAccountId = t("acc.v.sameAccount") // ACC_025
    if (!(toNumber(f.amount) > 0)) e.amount = t("acc.v.amount")
    if (f.charges.trim() && !(toNumber(f.charges) >= 0)) e.charges = t("inventory.v.amount")
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const ok = await attempt(
      () =>
        BankService.saveTransfer(transfer?.id, {
          date: f.date || null,
          fromAccountId: Number(f.fromAccountId),
          toAccountId: Number(f.toAccountId),
          amount: toNumber(f.amount),
          charges: f.charges.trim() ? toNumber(f.charges) : null,
          reference: f.reference.trim() || null,
          description: f.description.trim() || null,
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
        <DialogTitle>{t(transfer ? "acc.transfer.edit" : "acc.transfer.create")}</DialogTitle>
        <DialogDescription>{t("acc.transfer.formDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tf-from" label={t("acc.transfer.from")} error={errors.fromAccountId}>
          <PlainSelect id="tf-from" label={t("acc.transfer.from")} value={f.fromAccountId} onChange={set("fromAccountId")} options={options} />
        </Field>
        <Field id="tf-to" label={t("acc.transfer.to")} error={errors.toAccountId}>
          <PlainSelect id="tf-to" label={t("acc.transfer.to")} value={f.toAccountId} onChange={set("toAccountId")} options={options} />
        </Field>
        <Field id="tf-date" label={t("pos.date")}>
          <Input id="tf-date" type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} />
        </Field>
        <Field id="tf-amount" label={t("acc.amount")} error={errors.amount}>
          <Input id="tf-amount" inputMode="decimal" value={f.amount} onChange={(e) => set("amount")(e.target.value)} />
        </Field>
        <Field id="tf-charges" label={t("acc.transfer.charges")} error={errors.charges}>
          <Input id="tf-charges" inputMode="decimal" value={f.charges} onChange={(e) => set("charges")(e.target.value)} />
        </Field>
        <Field id="tf-ref" label={t("acc.reference")}>
          <Input id="tf-ref" maxLength={100} value={f.reference} onChange={(e) => set("reference")(e.target.value)} />
        </Field>
      </div>
      <Field id="tf-desc" label={t("crm.description")}>
        <Textarea id="tf-desc" rows={2} maxLength={500} value={f.description} onChange={(e) => set("description")(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={busy} onClick={save}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** System-generated transactions of one account with the running balance; a cleared one can be reconciled. */
function Transactions({ account, manage }: { account: BankAccountDto; manage: boolean }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [page, setPage] = React.useState(0)
  const [data, setData] = React.useState<IPage<BankTransactionDto>>()
  const [reloadKey, setReloadKey] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    BankService.transactions(account.id!, { page, size: 20 })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [account.id, page, reloadKey])
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("acc.bank.transactionsOf", { name: bankLabel(account) })}</DialogTitle>
        <DialogDescription>{t("acc.bank.balanceNow", { amount: money(account.balance) })}</DialogDescription>
      </DialogHeader>
      {!data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pos.date")}</TableHead>
                <TableHead>{t("acc.reference")}</TableHead>
                <TableHead>{t("acc.bank.txType")}</TableHead>
                <TableHead className="text-right">{t("acc.amount")}</TableHead>
                <TableHead className="text-right">{t("acc.bank.running")}</TableHead>
                <TableHead>{t("crm.status")}</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.content ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                    {t("crm.noEntries")}
                  </TableCell>
                </TableRow>
              )}
              {(data.content ?? []).map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{formatDate(x.transactionDate, language)}</TableCell>
                  <TableCell>
                    <div>{x.reference || "-"}</div>
                    {x.description && <div className="text-muted-foreground text-xs">{x.description}</div>}
                  </TableCell>
                  <TableCell>{x.type ? t(`acc.bank.tx.${x.type}` as TranslationKey) : "-"}</TableCell>
                  <TableCell className={`text-right ${x.type === "DEBIT" ? "text-destructive" : ""}`}>
                    {x.type === "DEBIT" ? "-" : "+"}
                    {money(x.amount)}
                  </TableCell>
                  <TableCell className="text-right">{money(x.runningBalance)}</TableCell>
                  <TableCell>
                    <AccStatusBadge status={x.status} />
                  </TableCell>
                  <TableCell>
                    {manage && x.status === "CLEARED" && (
                      <Button size="sm" variant="outline" onClick={async () => (await attempt(() => BankService.reconcile(x.id!), t("common.saved"))) && setReloadKey((n) => n + 1)}>
                        {t("acc.bank.reconcile")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={data?.page ?? page} size={data?.size ?? 20} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={setPage} />
      <DialogFooter />
    </div>
  )
}
