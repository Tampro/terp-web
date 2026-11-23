"use client"

import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { ItemService, type ItemDto, type StockDto } from "@/lib/inventory/inventory.service"

/**
 * Stock of one product / part per warehouse: inventory-service GET /inventory/stock?itemId= (INVENTORY_VIEW,
 * SALES_VIEW or POS_SELL; StockDto {warehouseId, warehouseName, quantity}). Warehouses that never held it are absent.
 */
export function ItemStockDialog({ item, onClose }: { item?: ItemDto; onClose: () => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [state, setState] = React.useState<{ id?: string; rows?: StockDto[]; error?: string }>({})

  React.useEffect(() => {
    if (!item?.id) return
    let cancelled = false
    const id = item.id
    ItemService.stockOfItem(id)
      .then((rows) => !cancelled && setState({ id, rows }))
      .catch((e: Error) => !cancelled && setState({ id, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [item?.id])

  const ready = !!item && state.id === item.id
  const rows = (state.rows ?? []).filter((r) => (r.quantity ?? 0) !== 0)
  const total = rows.reduce((s, r) => s + (r.quantity ?? 0), 0)
  const n = (v?: number) => formatNumber(v ?? 0, language, 2)

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inventory.stock.byWarehouse")}</DialogTitle>
          <DialogDescription>
            {item?.name ?? "-"}
            {item?.sku ? ` · ${item.sku}` : ""}
          </DialogDescription>
        </DialogHeader>
        {!ready && <Skeleton className="h-24 w-full" />}
        {ready && state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {ready && !state.error && (
          rows.length ? (
            <Table data-testid="item-stock">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.warehouse")}</TableHead>
                  <TableHead className="text-right">{t("sales.quantity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.warehouseId}>
                    <TableCell>{r.warehouseName ?? `#${r.warehouseId}`}</TableCell>
                    <TableCell className="text-right">{n(r.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">{t("sales.total")}</TableCell>
                  <TableCell className="text-right font-semibold">{n(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">{t("inventory.stock.none")}</p>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
