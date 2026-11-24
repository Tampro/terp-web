"use client"

import * as React from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import {
  categoryService,
  CoaService,
  type AccountDto,
  type AccountTypeDto,
  type CategoryDto,
  type ECategory,
  type ENormal,
} from "@/lib/accounting/accounting.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT, type TranslationKey } from "@/lib/i18n"
import { toNumber } from "@/lib/sales/sales.schema"

import { accountLabel, attempt, Field, PlainSelect } from "../_components/acc-kit"
import { AccountMapping } from "./_components/account-mapping"

type Tab = "accounts" | "types" | "revenue" | "expense" | "mapping"
const TABS: Tab[] = ["accounts", "types", "revenue", "expense", "mapping"]
const CATEGORIES: ECategory[] = ["ASSETS", "LIABILITIES", "EQUITY", "REVENUE", "EXPENSES"]
const NORMALS: ENormal[] = ["DEBIT", "CREDIT"]
const PAGE_SIZE = 50
// ChartOfAccountsService: account / type codes ≤ 20, CategoryService: category codes ≤ 30
const CODE = /^[A-Za-z0-9._-]{1,20}$/
const CATEGORY_CODE = /^[A-Za-z0-9._-]{1,30}$/
type Row = AccountDto & AccountTypeDto & CategoryDto

export default function ChartOfAccountsPage() {
  return (
    <React.Suspense>
      <Coa />
    </React.Suspense>
  )
}

/**
 * §12.7 chart of accounts (type, code, name, normal balance, opening / current balance, active, sub-account of,
 * description), account types (category, code, name, normal balance) and revenue / expense categories (name, code,
 * GL account, enabled). Deleting something in use answers ACC_013 / ACC_032 / ACC_033.
 */
function Coa() {
  const t = useT()
  const money = useMoney()
  const permissions = useAuthStore((s) => s.me?.permissions)
  const { searchParams, update } = useUrlQuery()
  const tab = (TABS.find((x) => x === searchParams.get("tab")) ?? "accounts") as Tab
  const keyword = searchParams.get("keyword") ?? ""
  const typeId = searchParams.get("typeId") ?? undefined
  const normal = searchParams.get("normal") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const manage =
    tab === "revenue" ? !!permissions?.includes("REVENUE_MANAGE") : tab === "expense" ? !!permissions?.includes("EXPENSE_MANAGE") : !!permissions?.includes("COA_MANAGE")
  const [types, setTypes] = React.useState<AccountTypeDto[]>([])
  const [allAccounts, setAllAccounts] = React.useState<AccountDto[]>([])
  const [data, setData] = React.useState<{ tab: Tab; page?: IPage<Row> }>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ row?: Row } | null>(null)
  const [deleting, setDeleting] = React.useState<Row>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([CoaService.types({ size: 200 }).then((p) => p.content ?? []), CoaService.accounts({ size: 500 }).then((p) => p.content ?? [])])
      .then(([ty, ac]) => !cancelled && (setTypes(ty), setAllAccounts(ac)))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  React.useEffect(() => {
    // the mapping tab loads its own data (AccountMapping)
    if (tab === "mapping") return
    let cancelled = false
    const load: Promise<IPage<Row>> =
      tab === "accounts"
        ? CoaService.accounts({ keyword: keyword || undefined, accountTypeId: typeId, normalBalance: normal, page, size: PAGE_SIZE })
        : tab === "types"
          ? CoaService.types({ page, size: PAGE_SIZE })
          : categoryService(tab === "revenue" ? "revenues" : "expenses").list({ page, size: PAGE_SIZE })
    load
      .then((p) => !cancelled && setData({ tab, page: p }))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        // end the loading state on an error too (the skeleton otherwise stays forever)
        setData({ tab, page: { content: [] } })
      })
    return () => {
      cancelled = true
    }
  }, [tab, keyword, typeId, normal, page, reloadKey])

  const typeName = (id?: string) => types.find((x) => x.id === id)?.name ?? "-"
  const rows = data?.tab === tab ? (data.page?.content ?? []) : undefined
  const remove = (r: Row) =>
    tab === "accounts" ? CoaService.removeAccount(r.id!) : tab === "types" ? CoaService.removeType(r.id!) : categoryService(tab === "revenue" ? "revenues" : "expenses").remove(r.id!)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.acc.coa")} description={t("acc.coa.subtitle")}>
        {manage && tab !== "mapping" && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t(`acc.coa.create.${tab}` as TranslationKey)}
          </Button>
        )}
      </PageHeader>
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "accounts" ? "" : v, page: 0, keyword: "", typeId: "", normal: "" })}>
        <TabsList>
          {TABS.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`acc.coa.tab.${x}` as TranslationKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "mapping" ? (
        <AccountMapping manage={manage} />
      ) : (
      <Card>
        <CardContent className="flex flex-col gap-4">
          {tab === "accounts" && (
            <div className="flex flex-wrap items-end gap-3">
              <PlainSelect label={t("acc.coa.type")} className="w-52" value={typeId ?? ""} onChange={(v) => update({ typeId: v, page: 0 })} none={t("acc.coa.allTypes")} options={types.map((x) => ({ value: x.id ?? "", label: `${x.code} · ${x.name}` }))} />
              <PlainSelect label={t("acc.coa.normal")} className="w-40" value={normal ?? ""} onChange={(v) => update({ normal: v, page: 0 })} none={t("acc.coa.allNormals")} options={NORMALS.map((n) => ({ value: n, label: t(`acc.coa.normalOf.${n}` as TranslationKey) }))} />
              <form
                className="flex min-w-60 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  update({ keyword: search.trim(), page: 0 })
                }}
              >
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("acc.coa.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
                </div>
                <Button type="submit" variant="secondary">
                  {t("common.search")}
                </Button>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            {!rows ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("acc.code")}</TableHead>
                    <TableHead>{t("crm.name")}</TableHead>
                    {tab === "accounts" && (
                      <>
                        <TableHead>{t("acc.coa.parent")}</TableHead>
                        <TableHead>{t("acc.coa.type")}</TableHead>
                        <TableHead>{t("acc.coa.normal")}</TableHead>
                        <TableHead className="text-right">{t("acc.bank.opening")}</TableHead>
                        <TableHead className="text-right">{t("acc.coa.current")}</TableHead>
                      </>
                    )}
                    {tab === "types" && (
                      <>
                        <TableHead>{t("acc.coa.category")}</TableHead>
                        <TableHead>{t("acc.coa.normal")}</TableHead>
                      </>
                    )}
                    {(tab === "revenue" || tab === "expense") && <TableHead>{t("acc.glAccount")}</TableHead>}
                    <TableHead>{t("crm.status")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-muted-foreground h-20 text-center">
                        {t("crm.noEntries")}
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => {
                    const on = tab === "revenue" || tab === "expense" ? r.enabled : r.active
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="font-medium">
                          {tab === "accounts" && r.parentId ? <span className="text-muted-foreground mr-1">↳</span> : null}
                          {r.name}
                        </TableCell>
                        {tab === "accounts" && (
                          <>
                            <TableCell>{r.parentId ? accountLabel(allAccounts.find((a) => a.id === r.parentId)) || r.parentId : "-"}</TableCell>
                            <TableCell>{typeName(r.accountTypeId)}</TableCell>
                            <TableCell>{r.normalBalance ? t(`acc.coa.normalOf.${r.normalBalance}` as TranslationKey) : "-"}</TableCell>
                            <TableCell className="text-right">{money(r.openingBalance)}</TableCell>
                            <TableCell className="text-right font-medium">{money(r.currentBalance)}</TableCell>
                          </>
                        )}
                        {tab === "types" && (
                          <>
                            <TableCell>{r.category ? t(`acc.coa.categoryOf.${r.category}` as TranslationKey) : "-"}</TableCell>
                            <TableCell>{r.normalBalance ? t(`acc.coa.normalOf.${r.normalBalance}` as TranslationKey) : "-"}</TableCell>
                          </>
                        )}
                        {(tab === "revenue" || tab === "expense") && <TableCell>{accountLabel(allAccounts.find((a) => a.id === r.glAccountId))}</TableCell>}
                        <TableCell>
                          <Badge variant={on ? "default" : "outline"}>{t(on ? "crm.active" : "crm.inactive")}</Badge>
                        </TableCell>
                        <TableCell>
                          {manage && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" aria-label={t("crm.editNamed", { name: r.name ?? "" })} onClick={() => setEditing({ row: r })}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label={t("crm.deleteNamed", { name: r.name ?? "" })} onClick={() => setDeleting(r)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <Pager page={data?.page?.page ?? page} size={data?.page?.size ?? PAGE_SIZE} total={data?.page?.totalElements ?? 0} totalPages={data?.page?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {editing && <CoaForm key={`${tab}-${editing.row?.id ?? "new"}`} tab={tab} row={editing.row} types={types} accounts={allAccounts} onClose={() => setEditing(null)} onSaved={reload} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("acc.confirm.deleteNamed", { name: deleting?.name ?? "" })}
        description={t("acc.coa.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => remove(deleting), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}

function CoaForm({ tab, row, types, accounts, onClose, onSaved }: { tab: Tab; row?: Row; types: AccountTypeDto[]; accounts: AccountDto[]; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [f, setF] = React.useState({
    code: row?.code ?? "",
    name: row?.name ?? "",
    accountTypeId: row?.accountTypeId ?? "",
    normalBalance: (row?.normalBalance ?? "DEBIT") as string,
    openingBalance: row?.openingBalance == null ? "0" : String(row.openingBalance),
    parentId: row?.parentId ?? "",
    description: row?.description ?? "",
    category: (row?.category ?? "ASSETS") as string,
    glAccountId: row?.glAccountId ?? "",
  })
  const [on, setOn] = React.useState(tab === "revenue" || tab === "expense" ? (row?.enabled ?? true) : (row?.active ?? true))
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))

  async function save() {
    const e: Record<string, string> = {}
    if (!(tab === "revenue" || tab === "expense" ? CATEGORY_CODE : CODE).test(f.code.trim())) e.code = t(tab === "revenue" || tab === "expense" ? "acc.v.categoryCode" : "acc.v.code")
    if (!f.name.trim()) e.name = t("project.v.required")
    else if (f.name.length > 255) e.name = t("sales.v.max", { n: 255 })
    if (tab === "accounts" && !f.accountTypeId) e.accountTypeId = t("project.v.required")
    if (tab === "accounts" && !Number.isFinite(toNumber(f.openingBalance || "0"))) e.openingBalance = t("inventory.v.amount")
    if ((tab === "revenue" || tab === "expense") && !f.glAccountId) e.glAccountId = t("project.v.required")
    if (f.description.length > 500) e.description = t("sales.v.max", { n: 500 })
    setErrors(e)
    if (Object.keys(e).length) return
    const desc = f.description.trim() || null
    setBusy(true)
    const call =
      tab === "accounts"
        ? () =>
            CoaService.saveAccount(row?.id, {
              accountTypeId: Number(f.accountTypeId),
              code: f.code.trim(),
              name: f.name.trim(),
              normalBalance: f.normalBalance as ENormal,
              openingBalance: toNumber(f.openingBalance || "0"),
              active: on,
              parentId: f.parentId ? Number(f.parentId) : null,
              description: desc,
            })
        : tab === "types"
          ? () => CoaService.saveType(row?.id, { category: f.category as ECategory, code: f.code.trim(), name: f.name.trim(), normalBalance: f.normalBalance as ENormal, active: on })
          : () => categoryService(tab === "revenue" ? "revenues" : "expenses").save(row?.id, { name: f.name.trim(), code: f.code.trim(), glAccountId: Number(f.glAccountId), description: desc, enabled: on })
    const ok = await attempt(call, t("common.saved"))
    setBusy(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t(`acc.coa.${row ? "edit" : "create"}.${tab}` as TranslationKey)}</DialogTitle>
        <DialogDescription className="sr-only">{t("menu.acc.coa")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="coa-code" label={t("acc.code")} error={errors.code}>
          <Input id="coa-code" value={f.code} onChange={(e) => set("code")(e.target.value)} />
        </Field>
        <Field id="coa-name" label={t("crm.name")} error={errors.name}>
          <Input id="coa-name" value={f.name} onChange={(e) => set("name")(e.target.value)} />
        </Field>
        {tab === "types" && (
          <Field id="coa-category" label={t("acc.coa.category")}>
            <PlainSelect id="coa-category" label={t("acc.coa.category")} value={f.category} onChange={set("category")} options={CATEGORIES.map((c) => ({ value: c, label: t(`acc.coa.categoryOf.${c}` as TranslationKey) }))} />
          </Field>
        )}
        {tab === "accounts" && (
          <Field id="coa-type" label={t("acc.coa.type")} error={errors.accountTypeId}>
            <PlainSelect id="coa-type" label={t("acc.coa.type")} value={f.accountTypeId} onChange={set("accountTypeId")} options={types.map((x) => ({ value: x.id ?? "", label: `${x.code} · ${x.name}` }))} />
          </Field>
        )}
        {(tab === "accounts" || tab === "types") && (
          <Field id="coa-normal" label={t("acc.coa.normal")}>
            <PlainSelect id="coa-normal" label={t("acc.coa.normal")} value={f.normalBalance} onChange={set("normalBalance")} options={NORMALS.map((n) => ({ value: n, label: t(`acc.coa.normalOf.${n}` as TranslationKey) }))} />
          </Field>
        )}
        {tab === "accounts" && (
          <>
            <Field id="coa-opening" label={t("acc.bank.opening")} error={errors.openingBalance}>
              <Input id="coa-opening" inputMode="decimal" value={f.openingBalance} onChange={(e) => set("openingBalance")(e.target.value)} />
            </Field>
            <Field id="coa-parent" label={t("acc.coa.parent")}>
              <PlainSelect
                id="coa-parent"
                label={t("acc.coa.parent")}
                value={f.parentId}
                onChange={set("parentId")}
                none={t("crm.none")}
                options={accounts.filter((a) => a.id !== row?.id).map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))}
              />
            </Field>
          </>
        )}
        {(tab === "revenue" || tab === "expense") && (
          <Field id="coa-gl" label={t("acc.glAccount")} error={errors.glAccountId} className="sm:col-span-2">
            <PlainSelect id="coa-gl" label={t("acc.glAccount")} value={f.glAccountId} onChange={set("glAccountId")} options={accounts.filter((a) => a.active).map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))} />
          </Field>
        )}
      </div>
      {tab !== "types" && (
        <Field id="coa-desc" label={t("crm.description")} error={errors.description}>
          <Textarea id="coa-desc" rows={2} value={f.description} onChange={(e) => set("description")(e.target.value)} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={on} onCheckedChange={setOn} /> {t("crm.active")}
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
