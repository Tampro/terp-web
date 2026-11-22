"use client"

import * as React from "react"
import { Download, Eye, Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { PosService, saveBlob, type PosOrderDetail, type PosOrderRow } from "@/lib/pos/pos.service"
import { SalesLookupService, type WarehouseOption } from "@/lib/sales/sales.service"

import { ReceiptView } from "../_components/receipt-view"

const PAGE_SIZE = 20
const ALL = "ALL"

export default function PosOrdersPage() {
  return (
    <React.Suspense>
      <PosOrders />
    </React.Suspense>
  )
}

/** §10 POS orders: sale number (#POS…), customer, warehouse, items, total; detail with taxes; PDF. */
function PosOrders() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const warehouseId = searchParams.get("warehouseId") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const view = searchParams.get("view") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<PosOrderRow>>()
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState(keyword)
  const [detail, setDetail] = React.useState<{ id: string; data?: PosOrderDetail; error?: string }>()

  React.useEffect(() => {
    let cancelled = false
    SalesLookupService.warehouses()
      .then((p) => !cancelled && setWarehouses(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    PosService.list({ keyword: keyword || undefined, warehouseId, from, to, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, warehouseId, from, to, page])

  React.useEffect(() => {
    if (!view) return
    let cancelled = false
    PosService.get(view)
      .then((d) => !cancelled && setDetail({ id: view, data: d }))
      .catch((e: Error) => !cancelled && setDetail({ id: view, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [view])

  async function pdf(row: PosOrderRow) {
    try {
      saveBlob(await PosService.receiptPdf(row.id!), `${row.receiptNumber ?? row.number ?? "receipt"}.pdf`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const rows = data?.content ?? []
  const shown = detail?.id === view ? detail : undefined
  const d = shown?.data
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.pos.orders")} description={t("pos.orders.subtitle")} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select value={warehouseId ?? ALL} onValueChange={(v) => update({ warehouseId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-44" aria-label={t("sales.warehouse")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("sales.allWarehouses")}</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id ?? ""}>
                    {w.name}
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
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("pos.orders.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
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
                  <TableHead>{t("pos.number")}</TableHead>
                  <TableHead>{t("pos.date")}</TableHead>
                  <TableHead>{t("sales.customer")}</TableHead>
                  <TableHead>{t("sales.warehouse")}</TableHead>
                  <TableHead className="text-right">{t("pos.items")}</TableHead>
                  <TableHead className="text-right">{t("sales.total")}</TableHead>
                  <TableHead className="w-24">
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
                      {t("pos.orders.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{r.number}</div>
                        <div className="text-muted-foreground font-mono text-xs">{r.receiptNumber}</div>
                      </TableCell>
                      <TableCell>{formatDate(r.orderDate, language)}</TableCell>
                      <TableCell>{r.customerName ?? t("pos.walkIn")}</TableCell>
                      <TableCell>{r.warehouseName ?? "-"}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.items, language)}</TableCell>
                      <TableCell className="text-right font-medium">{money(r.total)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={t("pos.orders.view", { number: r.number ?? "" })} onClick={() => update({ view: r.id ?? "" })}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={t("pos.orders.pdf", { number: r.number ?? "" })} onClick={() => pdf(r)}>
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && update({ view: "" })}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{d?.order?.number ?? t("pos.orders.detail")}</DialogTitle>
            <DialogDescription className="sr-only">{t("pos.orders.detail")}</DialogDescription>
          </DialogHeader>
          {!shown && <Skeleton className="h-48 w-full" />}
          {shown?.error && (
            <Alert variant="destructive">
              <AlertDescription>{shown.error}</AlertDescription>
            </Alert>
          )}
          {d && (
            <ReceiptView
              data={{
                id: d.order?.id,
                number: d.order?.number,
                receiptNumber: d.order?.receiptNumber,
                date: d.order?.orderDate,
                customerName: d.order?.customerName,
                warehouseName: d.order?.warehouseName,
                bankAccountName: d.bankAccountName,
                lines: d.lines,
                subtotal: d.subtotal,
                taxes: d.taxes,
                discount: d.discount,
                total: d.order?.total,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
