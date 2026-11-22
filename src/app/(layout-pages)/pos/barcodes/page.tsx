"use client"

import * as React from "react"
import { Download, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useT } from "@/lib/i18n"
import { ItemService, TransferService, type ItemDto } from "@/lib/inventory/inventory.service"
import { PosService, saveBlob } from "@/lib/pos/pos.service"
import { SalesLookupService, type WarehouseOption } from "@/lib/sales/sales.service"

const MAX_LABELS = 300 // PosService.MAX_LABELS (POS_008)

/** §10 Barcodes: choose a warehouse, search its products, set copies, download the label PDF. */
export default function BarcodesPage() {
  const t = useT()
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([])
  const [warehouseId, setWarehouseId] = React.useState("")
  const [items, setItems] = React.useState<ItemDto[]>([])
  const [inStock, setInStock] = React.useState<{ warehouseId: string; ids: Set<string> }>()
  const [search, setSearch] = React.useState("")
  const [picked, setPicked] = React.useState<{ item: ItemDto; copies: string }[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([SalesLookupService.warehouses(), ItemService.list({ size: 100 })])
      .then(([w, i]) => {
        if (cancelled) return
        setWarehouses(w.content ?? [])
        setItems((i.content ?? []).filter((x) => x.type !== "SERVICE"))
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!warehouseId) return
    let cancelled = false
    TransferService.stock(warehouseId)
      .then((rows) => !cancelled && setInStock({ warehouseId, ids: new Set((rows ?? []).filter((r) => (r.quantity ?? 0) > 0).map((r) => r.itemId ?? "")) }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [warehouseId])

  const q = search.trim().toLowerCase()
  const ids = inStock?.warehouseId === warehouseId ? inStock.ids : undefined
  const results = ids
    ? items.filter((i) => ids.has(i.id ?? "") && !picked.some((p) => p.item.id === i.id) && (!q || i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)))
    : []
  const copiesOf = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)
  const total = picked.reduce((s, p) => s + (copiesOf(p.copies) || 0), 0)
  const invalid = picked.some((p) => !(copiesOf(p.copies) >= 1)) || total > MAX_LABELS

  async function download() {
    setBusy(true)
    try {
      const blob = await PosService.barcodesPdf({
        warehouseId: Number(warehouseId),
        items: picked.map((p) => ({ itemId: Number(p.item.id), copies: copiesOf(p.copies) })),
      })
      saveBlob(blob, "barcodes.pdf")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.pos.barcodes")} description={t("pos.barcode.subtitle", { n: MAX_LABELS })} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bc-warehouse">{t("sales.warehouse")}</Label>
              <Select
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId(v)
                  setPicked([])
                }}
              >
                <SelectTrigger id="bc-warehouse" className="w-full" aria-label={t("sales.warehouse")}>
                  <SelectValue placeholder={t("sales.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id ?? ""}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                disabled={!warehouseId}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("pos.searchPlaceholder")}
                aria-label={t("common.search")}
                className="pl-9"
              />
            </div>
            {warehouseId && ids && results.length === 0 && <p className="text-muted-foreground text-sm">{t("pos.noProducts")}</p>}
            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              {results.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => setPicked((p) => [...p, { item: i, copies: "1" }])}
                    aria-label={t("pos.barcode.pick", { name: i.name ?? "" })}
                  >
                    <span>{i.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">{i.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.item")}</TableHead>
                  <TableHead className="w-28">{t("pos.barcode.copies")}</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {picked.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground h-16 text-center">
                      {t("pos.barcode.none")}
                    </TableCell>
                  </TableRow>
                )}
                {picked.map((p, i) => (
                  <TableRow key={p.item.id}>
                    <TableCell>
                      <div className="font-medium">{p.item.name}</div>
                      <div className="text-muted-foreground font-mono text-xs">{p.item.sku}</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        value={p.copies}
                        aria-label={t("pos.barcode.copiesOf", { name: p.item.name ?? "" })}
                        aria-invalid={!(copiesOf(p.copies) >= 1)}
                        onChange={(e) => setPicked((xs) => xs.map((x, k) => (k === i ? { ...x, copies: e.target.value } : x)))}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("pos.remove", { name: p.item.name ?? "" })}
                        onClick={() => setPicked((xs) => xs.filter((_, k) => k !== i))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className={`text-sm ${total > MAX_LABELS ? "text-destructive" : "text-muted-foreground"}`}>
              {t("pos.barcode.total", { n: total, max: MAX_LABELS })}
            </p>
            <Button disabled={busy || picked.length === 0 || invalid} onClick={download}>
              <Download className="size-4" /> {t("pos.downloadPdf")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
