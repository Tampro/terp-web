"use client"

import * as React from "react"
import { Eye, MoreHorizontal, Pencil, Plus, Search, Stamp, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  PurchaseInvoiceService,
  type EPurchaseStatus,
  type PurchaseInvoiceDetail,
  type PurchaseInvoiceRow,
  type PurchaseStatusCounts,
} from "@/lib/purchase/purchase.service"

import { SalesDetailDialog, type DetailView } from "../../sales/_components/document-detail-dialog"
import { SalesStatusBadge } from "../../sales/_components/sales-status-badge"
import { PurchaseInvoiceFormDialog } from "../_components/invoice-form-dialog"
import { usePurchaseLookups } from "../_components/use-purchase-lookups"

const PAGE_SIZE = 20
const ALL = "ALL"
const OVERDUE = "OVERDUE"
const STATUSES: EPurchaseStatus[] = ["DRAFT", "POSTED", "PARTIAL", "PAID"]

type Pending = { action: "delete" | "post"; row: PurchaseInvoiceRow }

export default function PurchaseInvoicesPage() {
  return (
    <React.Suspense>
      <PurchaseInvoices />
    </React.Suspense>
  )
}

/**
 * §8.1 Purchase invoices: as sales invoices, with Vendor and receiving Warehouse. Only drafts change (PUR_002);
 * posting (PURCHASE_POST) brings stock into the warehouse and needs one for stock items (PUR_005).
 */
function PurchaseInvoices() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes("PURCHASE_MANAGE")
  const canPost = !!permissions?.includes("PURCHASE_POST")
  const lookups = usePurchaseLookups()

  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const tab = searchParams.get("status") ?? ALL
  const vendorId = searchParams.get("vendorId") ?? undefined
  const warehouseId = searchParams.get("warehouseId") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const viewParam = searchParams.get("view") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<PurchaseInvoiceRow>>()
  const [counts, setCounts] = React.useState<PurchaseStatusCounts>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ detail?: PurchaseInvoiceDetail } | null>(null)
  const [pending, setPending] = React.useState<Pending>()

  React.useEffect(() => {
    let cancelled = false
    const filter = { keyword: keyword || undefined, vendorId, warehouseId, from, to }
    Promise.all([
      PurchaseInvoiceService.list({
        ...filter,
        status: tab === ALL || tab === OVERDUE ? undefined : tab,
        overdue: tab === OVERDUE ? true : undefined,
        page,
        size: PAGE_SIZE,
      }),
      PurchaseInvoiceService.counts(filter),
    ])
      .then(([list, c]) => {
        if (cancelled) return
        setData(list)
        setCounts(c)
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, tab, vendorId, warehouseId, from, to, page, reloadKey])

  async function openEdit(row: PurchaseInvoiceRow) {
    if (!row.id) return
    try {
      setEditing({ detail: await PurchaseInvoiceService.get(row.id) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirmPending() {
    if (!pending?.row.id) return
    const id = pending.row.id
    try {
      if (pending.action === "delete") await PurchaseInvoiceService.remove(id)
      else await PurchaseInvoiceService.post(id)
      toast.success(t(pending.action === "delete" ? "sales.done.deleted" : "sales.done.posted"))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const warehouseName = (id?: string | null) => lookups.warehouses.find((w) => w.id === id)?.name ?? (id ? `#${id}` : "-")
  const vendorName = (row: PurchaseInvoiceRow) =>
    row.vendorName ?? lookups.vendors.find((v) => v.id === row.vendorId)?.companyName ?? "-"
  const loadDetail = React.useCallback((id: string) => PurchaseInvoiceService.get(id), [])
  const detailView = (d: PurchaseInvoiceDetail): DetailView => {
    const doc = d.invoice ?? {}
    return {
      title: doc.number ?? "-",
      status: doc.status,
      flags: doc.overdue ? [t("sales.overdue")] : [],
      fields: [
        { label: t("purchase.vendor"), value: vendorName(doc) },
        { label: t("sales.invoice.date"), value: formatDate(doc.invoiceDate, language) },
        { label: t("sales.dueDate"), value: formatDate(doc.dueDate, language) },
        { label: t("purchase.receivingWarehouse"), value: warehouseName(doc.warehouseId) },
        { label: t("sales.paymentTerms"), value: d.paymentTerms || "-" },
      ],
      lines: d.lines,
      totals: [
        { label: t("sales.subtotal"), value: money(doc.subtotal) },
        { label: t("sales.discount"), value: `-${money(doc.discount)}` },
        { label: t("sales.tax"), value: money(doc.tax) },
        { label: t("sales.total"), value: money(doc.total), strong: true },
        { label: t("sales.balance"), value: money(doc.balance) },
      ],
      notes: d.notes,
    }
  }

  const total = STATUSES.reduce((s, x) => s + (counts?.[x] ?? 0), 0)
  const tabs = [
    { value: ALL, label: t("companies.tabAll"), count: counts ? total : undefined },
    ...STATUSES.map((s) => ({ value: s, label: t(`sales.status.${s}` as TranslationKey), count: counts?.[s] })),
    { value: OVERDUE, label: t("sales.overdue"), count: undefined },
  ]
  const rows = data?.content ?? []

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.purchase.invoices")} description={t("purchase.invoice.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("purchase.invoice.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(v) => update({ status: v, page: 0 })}>
            <TabsList className="flex-wrap">
              {tabs.map((x) => (
                <TabsTrigger key={x.value} value={x.value}>
                  {x.label}
                  {x.count !== undefined && <span className="text-muted-foreground ml-1 text-xs">({x.count})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-end gap-3">
            <Select value={vendorId ?? ALL} onValueChange={(v) => update({ vendorId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-52" aria-label={t("purchase.vendor")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("purchase.allVendors")}</SelectItem>
                {lookups.vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id ?? ""}>
                    {v.companyName ?? v.vendorCode ?? "-"}
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
                  placeholder={t("purchase.searchPlaceholder")}
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
                  <TableHead>{t("purchase.vendor")}</TableHead>
                  <TableHead>{t("sales.warehouse")}</TableHead>
                  <TableHead>{t("sales.invoice.date")}</TableHead>
                  <TableHead>{t("sales.dueDate")}</TableHead>
                  <TableHead className="text-right">{t("sales.total")}</TableHead>
                  <TableHead className="text-right">{t("sales.balance")}</TableHead>
                  <TableHead>{t("orders.status")}</TableHead>
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
                      {t("purchase.invoice.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-medium">{row.number ?? "-"}</TableCell>
                      <TableCell>{vendorName(row)}</TableCell>
                      <TableCell>{warehouseName(row.warehouseId)}</TableCell>
                      <TableCell>{formatDate(row.invoiceDate, language)}</TableCell>
                      <TableCell>
                        <span className={row.overdue ? "text-destructive" : undefined}>{formatDate(row.dueDate, language)}</span>
                        {row.overdue && (
                          <Badge variant="destructive" className="ml-2">
                            {t("sales.overdue")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{money(row.total)}</TableCell>
                      <TableCell className="text-right">{money(row.balance)}</TableCell>
                      <TableCell>
                        <SalesStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: row.number ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => row.id && update({ view: row.id })}>
                              <Eye className="size-4" /> {t("sales.action.view")}
                            </DropdownMenuItem>
                            {manage && row.status === "DRAFT" && (
                              <DropdownMenuItem onClick={() => openEdit(row)}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                            )}
                            {canPost && row.status === "DRAFT" && (
                              <DropdownMenuItem onClick={() => setPending({ action: "post", row })}>
                                <Stamp className="size-4" /> {t("sales.action.post")}
                              </DropdownMenuItem>
                            )}
                            {manage && row.status === "DRAFT" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row })}>
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

      <PurchaseInvoiceFormDialog state={editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={reload} />
      <SalesDetailDialog id={viewParam} load={loadDetail} view={detailView} onClose={() => update({ view: "" })} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(pending?.action === "post" ? "purchase.confirm.post" : "sales.confirm.delete", { number: pending?.row.number ?? "" })}
        description={t(pending?.action === "post" ? "purchase.confirm.postDesc" : "sales.confirm.deleteDesc")}
        confirmLabel={t(pending?.action === "post" ? "sales.action.post" : "sales.action.delete")}
        onConfirm={confirmPending}
      />
    </div>
  )
}
