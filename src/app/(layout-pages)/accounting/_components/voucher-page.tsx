"use client"

import * as React from "react"
import { CheckCheck, MoreHorizontal, Pencil, Plus, Stamp, Trash2 } from "lucide-react"
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
import { categoryService, voucherService, type CategoryDto, type EVoucherKind, type EVoucherStatus, type VoucherDto } from "@/lib/accounting/accounting.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { toNumber } from "@/lib/sales/sales.schema"

import { AccStatusBadge, accountLabel, attempt, bankLabel, Field, PlainSelect, today, useAccLookups } from "./acc-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES: EVoucherStatus[] = ["DRAFT", "APPROVED", "POSTED"]

/** §12.2 revenue (REV-) and expense (EXP-): Date, Category, Bank Account, Chart of Account, Amount, Reference, Description; Draft → Approved → Posted. */
export function VoucherPage({ kind }: { kind: EVoucherKind }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const k = kind === "revenues" ? "revenue" : "expense"
  const P = kind === "revenues" ? "REVENUE" : "EXPENSE"
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes(`${P}_MANAGE`)
  const approveRight = !!permissions?.includes(`${P}_APPROVE`)
  const service = React.useMemo(() => voucherService(kind), [kind])
  const lookups = useAccLookups()
  const [categories, setCategories] = React.useState<CategoryDto[]>([])
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const categoryId = searchParams.get("categoryId") ?? undefined
  const bankAccountId = searchParams.get("bankAccountId") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<VoucherDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ voucher?: VoucherDto } | null>(null)
  const [pending, setPending] = React.useState<{ action: "approve" | "post" | "delete"; row: VoucherDto }>()

  React.useEffect(() => {
    let cancelled = false
    categoryService(kind)
      .list({ size: 200 })
      .then((p) => !cancelled && setCategories(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [kind])

  React.useEffect(() => {
    let cancelled = false
    service
      .list({ status: status === ALL ? undefined : status, categoryId, bankAccountId, from, to, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [service, status, categoryId, bankAccountId, from, to, page, reloadKey])

  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "-"
  const rows = data?.content ?? []
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
              label={t("acc.category")}
              className="w-48"
              value={categoryId ?? ""}
              onChange={(v) => update({ categoryId: v, page: 0 })}
              none={t("acc.allCategories")}
              options={categories.map((c) => ({ value: c.id ?? "", label: c.name ?? "" }))}
            />
            <PlainSelect
              label={t("pos.bankAccount")}
              className="w-56"
              value={bankAccountId ?? ""}
              onChange={(v) => update({ bankAccountId: v, page: 0 })}
              none={t("acc.allBankAccounts")}
              options={lookups.banks.map((b) => ({ value: b.id ?? "", label: bankLabel(b) }))}
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
                  <TableHead>{t("acc.category")}</TableHead>
                  <TableHead>{t("pos.bankAccount")}</TableHead>
                  <TableHead>{t("acc.reference")}</TableHead>
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
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      {t(`acc.${k}.empty` as TranslationKey)}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.number}</TableCell>
                      <TableCell>{formatDate(v.date, language)}</TableCell>
                      <TableCell>{catName(v.categoryId)}</TableCell>
                      <TableCell>{bankLabel(lookups.banks.find((b) => b.id === v.bankAccountId))}</TableCell>
                      <TableCell>{v.reference || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{money(v.amount)}</TableCell>
                      <TableCell>
                        <AccStatusBadge status={v.status} />
                      </TableCell>
                      <TableCell>
                        {v.status !== "POSTED" && (manage || approveRight) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: v.number ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {v.status === "DRAFT" && approveRight && (
                                <DropdownMenuItem onClick={() => setPending({ action: "approve", row: v })}>
                                  <CheckCheck className="size-4" /> {t("sales.action.approve")}
                                </DropdownMenuItem>
                              )}
                              {v.status === "APPROVED" && approveRight && (
                                <DropdownMenuItem onClick={() => setPending({ action: "post", row: v })}>
                                  <Stamp className="size-4" /> {t("sales.action.post")}
                                </DropdownMenuItem>
                              )}
                              {v.status === "DRAFT" && manage && (
                                <>
                                  <DropdownMenuItem onClick={() => setEditing({ voucher: v })}>
                                    <Pencil className="size-4" /> {t("common.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: v })}>
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
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <VoucherForm
              key={editing.voucher?.id ?? "new"}
              kind={kind}
              voucher={editing.voucher}
              categories={categories.filter((c) => c.enabled || c.id === editing.voucher?.categoryId)}
              lookups={lookups}
              onClose={() => setEditing(null)}
              onSaved={reload}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`acc.confirm.${pending?.action ?? "delete"}` as TranslationKey, { number: pending?.row.number ?? "" })}
        description={t(`acc.confirm.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={t(`sales.action.${pending?.action ?? "delete"}` as TranslationKey)}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const call = { approve: () => service.approve(id), post: () => service.post(id), delete: () => service.remove(id) }[pending.action]
          if (await attempt(call, t("common.saved"))) reload()
        }}
      />
    </div>
  )
}

function VoucherForm({
  kind,
  voucher,
  categories,
  lookups,
  onClose,
  onSaved,
}: {
  kind: EVoucherKind
  voucher?: VoucherDto
  categories: CategoryDto[]
  lookups: ReturnType<typeof useAccLookups>
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const k = kind === "revenues" ? "revenue" : "expense"
  const [f, setF] = React.useState({
    date: voucher?.date ?? today(),
    categoryId: voucher?.categoryId ?? "",
    bankAccountId: voucher?.bankAccountId ?? "",
    accountId: voucher?.accountId ?? "",
    amount: voucher?.amount == null ? "" : String(voucher.amount),
    reference: voucher?.reference ?? "",
    description: voucher?.description ?? "",
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const set = (key: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [key]: v }))

  async function save() {
    const e: Record<string, string> = {}
    if (!f.categoryId) e.categoryId = t("project.v.required")
    if (!f.bankAccountId) e.bankAccountId = t("project.v.required")
    if (!(toNumber(f.amount) > 0)) e.amount = t("acc.v.amount")
    if (f.reference.length > 100) e.reference = t("sales.v.max", { n: 100 })
    if (f.description.length > 500) e.description = t("sales.v.max", { n: 500 })
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const ok = await attempt(
      () =>
        voucherService(kind).save(voucher?.id, {
          date: f.date || null,
          categoryId: Number(f.categoryId),
          bankAccountId: Number(f.bankAccountId),
          accountId: f.accountId ? Number(f.accountId) : null,
          amount: toNumber(f.amount),
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
        <DialogTitle>{t(`acc.${k}.${voucher ? "edit" : "create"}` as TranslationKey)}</DialogTitle>
        <DialogDescription>{t("acc.voucher.formDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="vc-date" label={t("pos.date")}>
          <Input id="vc-date" type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} />
        </Field>
        <Field id="vc-amount" label={t("acc.amount")} error={errors.amount}>
          <Input id="vc-amount" inputMode="decimal" value={f.amount} onChange={(e) => set("amount")(e.target.value)} />
        </Field>
        <Field id="vc-category" label={t("acc.category")} error={errors.categoryId}>
          <PlainSelect id="vc-category" label={t("acc.category")} value={f.categoryId} onChange={set("categoryId")} options={categories.map((c) => ({ value: c.id ?? "", label: c.name ?? "" }))} />
        </Field>
        <Field id="vc-bank" label={t("pos.bankAccount")} error={errors.bankAccountId}>
          <PlainSelect
            id="vc-bank"
            label={t("pos.bankAccount")}
            value={f.bankAccountId}
            onChange={set("bankAccountId")}
            options={lookups.banks.filter((b) => b.active || b.id === f.bankAccountId).map((b) => ({ value: b.id ?? "", label: bankLabel(b) }))}
          />
        </Field>
        <Field id="vc-account" label={t("acc.glAccount")} className="sm:col-span-2">
          <PlainSelect
            id="vc-account"
            label={t("acc.glAccount")}
            value={f.accountId}
            onChange={set("accountId")}
            none={t("acc.categoryAccount")}
            options={lookups.accounts.map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))}
          />
        </Field>
        <Field id="vc-ref" label={t("acc.reference")} error={errors.reference} className="sm:col-span-2">
          <Input id="vc-ref" value={f.reference} onChange={(e) => set("reference")(e.target.value)} />
        </Field>
      </div>
      <Field id="vc-desc" label={t("crm.description")} error={errors.description}>
        <Textarea id="vc-desc" rows={2} value={f.description} onChange={(e) => set("description")(e.target.value)} />
      </Field>
      {categories.length === 0 && <p className="text-muted-foreground text-xs">{t("acc.voucher.noCategories")}</p>}
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
