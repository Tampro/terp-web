"use client"

import * as React from "react"
import { CheckCheck, Eye, MoreHorizontal, PackageCheck, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { SalesReturnService, type EReturnStatus, type ReturnDetail, type ReturnRow } from "@/lib/sales/sales.service"

import { SalesDetailDialog, type DetailView } from "../_components/document-detail-dialog"
import { ReturnFormDialog } from "../_components/return-form-dialog"
import { SalesStatusBadge } from "../_components/sales-status-badge"
import { useSalesLookups } from "../_components/use-sales-lookups"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES: EReturnStatus[] = ["DRAFT", "APPROVED", "COMPLETED"]

export default function SalesReturnsPage() {
  return (
    <React.Suspense>
      <SalesReturns />
    </React.Suspense>
  )
}

type Pending = { action: "delete" | "approve" | "complete"; row: ReturnRow }

/**
 * §6.3 Sales returns — /sales/returns. Draft → Approved → Completed (goods received, stock back in the warehouse).
 * Approve and Complete need SALES_POST, add/edit/delete SALES_MANAGE (SalesReturnController).
 */
function SalesReturns() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes("SALES_MANAGE")
  const canPost = !!permissions?.includes("SALES_POST")
  const lookups = useSalesLookups()
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const tab = searchParams.get("status") ?? ALL
  const customerId = searchParams.get("customerId") ?? undefined
  const warehouseId = searchParams.get("warehouseId") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const viewParam = searchParams.get("view") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<ReturnRow>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ detail?: ReturnDetail } | null>(null)
  const [pending, setPending] = React.useState<Pending>()

  React.useEffect(() => {
    let cancelled = false
    SalesReturnService.list({
      keyword: keyword || undefined,
      status: tab === ALL ? undefined : tab,
      customerId,
      warehouseId,
      from,
      to,
      page,
      size: PAGE_SIZE,
    })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, tab, customerId, warehouseId, from, to, page, reloadKey])

  async function openEdit(row: ReturnRow) {
    if (!row.id) return
    try {
      setEditing({ detail: await SalesReturnService.get(row.id) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirmPending() {
    if (!pending?.row.id) return
    const id = pending.row.id
    const call = {
      delete: () => SalesReturnService.remove(id),
      approve: () => SalesReturnService.approve(id),
      complete: () => SalesReturnService.complete(id),
    }[pending.action]
    try {
      await call()
      toast.success(t(`sales.done.${pending.action === "delete" ? "deleted" : pending.action === "approve" ? "approved" : "completed"}` as TranslationKey))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const warehouseName = (id?: string | null) =>
    lookups.warehouses.find((w) => w.id === id)?.name ?? (id ? `#${id}` : "-")
  const loadDetail = React.useCallback((id: string) => SalesReturnService.get(id), [])
  const detailView = (d: ReturnDetail): DetailView => ({
    title: d.ret?.number ?? "-",
    status: d.ret?.status,
    fields: [
      { label: t("sales.customer"), value: d.ret?.customerName ?? "-" },
      { label: t("sales.return.date"), value: formatDate(d.ret?.returnDate, language) },
      { label: t("sales.return.warehouse"), value: warehouseName(d.ret?.warehouseId) },
      { label: t("sales.return.reason"), value: d.reason || "-" },
    ],
    lines: d.lines,
    withReason: true,
    totals: [
      { label: t("sales.subtotal"), value: money(d.subtotal) },
      { label: t("sales.discount"), value: `-${money(d.discount)}` },
      { label: t("sales.tax"), value: money(d.tax) },
      { label: t("sales.total"), value: money(d.ret?.total), strong: true },
    ],
    notes: d.notes,
  })

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.sales.return")} description={t("sales.return.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("sales.return.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(v) => update({ status: v, page: 0 })}>
            <TabsList className="flex-wrap">
              <TabsTrigger value={ALL}>{t("companies.tabAll")}</TabsTrigger>
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {t(`sales.status.${s}` as TranslationKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-end gap-3">
            <Select value={customerId ?? ALL} onValueChange={(v) => update({ customerId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-52" aria-label={t("sales.customer")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("sales.allCustomers")}</SelectItem>
                {lookups.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id ?? ""}>
                    {c.companyName ?? c.customerCode ?? "-"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseId ?? ALL} onValueChange={(v) => update({ warehouseId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-44" aria-label={t("sales.warehouse")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("sales.allWarehouses")}</SelectItem>
                {lookups.warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id ?? ""}>
                    {w.name ?? "-"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from ?? ""} onChange={(e) => update({ from: e.target.value, page: 0 })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to ?? ""} onChange={(e) => update({ to: e.target.value, page: 0 })} />
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
                  placeholder={t("sales.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.number")}</TableHead>
                  <TableHead>{t("sales.customer")}</TableHead>
                  <TableHead>{t("sales.warehouse")}</TableHead>
                  <TableHead>{t("sales.return.date")}</TableHead>
                  <TableHead className="text-right">{t("sales.total")}</TableHead>
                  <TableHead className="text-right">{t("sales.return.items")}</TableHead>
                  <TableHead>{t("orders.status")}</TableHead>
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
                      {t("sales.return.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">{r.number ?? "-"}</TableCell>
                      <TableCell>{r.customerName ?? "-"}</TableCell>
                      <TableCell>{warehouseName(r.warehouseId)}</TableCell>
                      <TableCell>{formatDate(r.returnDate, language)}</TableCell>
                      <TableCell className="text-right font-medium">{money(r.total)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.items, language)}</TableCell>
                      <TableCell>
                        <SalesStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: r.number ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => r.id && update({ view: r.id })}>
                              <Eye className="size-4" /> {t("sales.action.view")}
                            </DropdownMenuItem>
                            {manage && r.status === "DRAFT" && (
                              <DropdownMenuItem onClick={() => openEdit(r)}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                            )}
                            {canPost && r.status === "DRAFT" && (
                              <DropdownMenuItem onClick={() => setPending({ action: "approve", row: r })}>
                                <CheckCheck className="size-4" /> {t("sales.action.approve")}
                              </DropdownMenuItem>
                            )}
                            {canPost && r.status === "APPROVED" && (
                              <DropdownMenuItem onClick={() => setPending({ action: "complete", row: r })}>
                                <PackageCheck className="size-4" /> {t("sales.action.complete")}
                              </DropdownMenuItem>
                            )}
                            {manage && r.status === "DRAFT" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: r })}>
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
          <Pager
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={data?.totalElements ?? 0}
            totalPages={data?.totalPages ?? 0}
            onPage={(p) => update({ page: p })}
          />
        </CardContent>
      </Card>

      <ReturnFormDialog state={editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={reload} />
      <SalesDetailDialog id={viewParam} load={loadDetail} view={detailView} onClose={() => update({ view: "" })} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`sales.confirm.${pending?.action ?? "delete"}` as TranslationKey, { number: pending?.row.number ?? "" })}
        description={t(`sales.confirm.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={t(`sales.action.${pending?.action ?? "delete"}` as TranslationKey)}
        onConfirm={confirmPending}
      />
    </div>
  )
}
