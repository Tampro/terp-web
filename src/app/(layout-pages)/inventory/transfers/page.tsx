"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Plus, Trash2 } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate, formatNumber } from "@/lib/format"
import { TransferService, type StockDto, type TransferDto } from "@/lib/inventory/inventory.service"
import { useLanguageStore, useT } from "@/lib/i18n"
import { getTransferSchema, type TTransferSchema } from "@/lib/purchase/purchase.schema"
import { toNumber } from "@/lib/sales/sales.schema"
import { SalesLookupService, type ItemOption, type WarehouseOption } from "@/lib/sales/sales.service"

const PAGE_SIZE = 20
const ALL = "ALL"
const today = () => new Date().toLocaleDateString("en-CA")

export default function TransfersPage() {
  return (
    <React.Suspense>
      <Transfers />
    </React.Suspense>
  )
}

/** §8.4 Stock transfers: no status, delete only (StockTransferController). */
function Transfers() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("INVENTORY_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const fromWarehouseId = searchParams.get("fromWarehouseId") ?? undefined
  const toWarehouseId = searchParams.get("toWarehouseId") ?? undefined
  const dateFrom = searchParams.get("from") ?? undefined
  const dateTo = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<TransferDto>>()
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([])
  const [items, setItems] = React.useState<ItemOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<TransferDto>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      SalesLookupService.warehouses().then((p) => p.content ?? []),
      SalesLookupService.items().then((p) => p.content ?? []),
    ])
      .then(([w, i]) => !cancelled && (setWarehouses(w), setItems(i)))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    TransferService.list({ fromWarehouseId, toWarehouseId, dateFrom, dateTo, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fromWarehouseId, toWarehouseId, dateFrom, dateTo, page, reloadKey])

  const warehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? (id ? `#${id}` : "-")
  const item = (id?: string) => items.find((i) => i.id === id)
  const rows = data?.content ?? []
  const warehouseFilter = (key: "fromWarehouseId" | "toWarehouseId", value: string | undefined, label: string) => (
    <Select value={value ?? ALL} onValueChange={(v) => update({ [key]: v === ALL ? "" : v, page: 0 })}>
      <SelectTrigger className="w-44" aria-label={label}>
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
  )

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.inventory.transfers")} description={t("inventory.transfer.subtitle")}>
        {manage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t("inventory.transfer.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {warehouseFilter("fromWarehouseId", fromWarehouseId, t("inventory.fromWarehouse"))}
            {warehouseFilter("toWarehouseId", toWarehouseId, t("inventory.toWarehouse"))}
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={dateFrom ?? ""} onChange={(e) => update({ from: e.target.value, page: 0 })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={dateTo ?? ""} onChange={(e) => update({ to: e.target.value, page: 0 })} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inventory.transfer.date")}</TableHead>
                  <TableHead>{t("inventory.fromWarehouse")}</TableHead>
                  <TableHead>{t("inventory.toWarehouse")}</TableHead>
                  <TableHead>{t("sales.item")}</TableHead>
                  <TableHead className="text-right">{t("sales.quantity")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      {t("inventory.transfer.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.transferDate, language)}</TableCell>
                      <TableCell>{warehouseName(r.fromWarehouseId)}</TableCell>
                      <TableCell>{warehouseName(r.toWarehouseId)}</TableCell>
                      <TableCell>
                        {item(r.itemId)?.name ?? `#${r.itemId}`}
                        {item(r.itemId)?.sku && <span className="text-muted-foreground ml-1 text-xs">({item(r.itemId)?.sku})</span>}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(r.quantity, language, 2)}</TableCell>
                      <TableCell>
                        {manage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("inventory.transfer.deleteOf", { date: formatDate(r.transferDate, language) })}
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
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

      <TransferDialog open={creating} warehouses={warehouses} items={items} onClose={() => setCreating(false)} onSaved={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("inventory.confirm.deleteTransfer")}
        description={t("inventory.confirm.deleteTransferDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await TransferService.remove(deleting.id)
            toast.success(t("sales.done.deleted"))
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}

const EMPTY: TTransferSchema = { fromWarehouseId: "", toWarehouseId: "", itemId: "", available: 0, quantity: "", transferDate: "" }

/**
 * From Warehouse → To Warehouse → Product → Quantity → Date, each field unlocks after the previous (manual §8.4).
 * Products are those with stock in the source warehouse (GET /inventory/stock?warehouseId); the quantity is capped
 * at that stock (INV_017), the backend re-checks.
 */
function TransferDialog({
  open,
  warehouses,
  items,
  onClose,
  onSaved,
}: {
  open: boolean
  warehouses: WarehouseOption[]
  items: ItemOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const values = React.useMemo(() => ({ ...EMPTY, transferDate: today() }), [])
  const form = useForm<TTransferSchema>({ resolver: zodResolver(getTransferSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const [from, to, itemId, quantity] = useWatch({ control: form.control, name: ["fromWarehouseId", "toWarehouseId", "itemId", "quantity"] })
  const [stock, setStock] = React.useState<{ warehouseId: string; rows: StockDto[] }>()

  React.useEffect(() => {
    if (!open || !from) return
    let cancelled = false
    TransferService.stock(from)
      .then((rows) => !cancelled && setStock({ warehouseId: from, rows: (rows ?? []).filter((r) => (r.quantity ?? 0) > 0) }))
      .catch((e: Error) => {
        if (cancelled) return
        setStock({ warehouseId: from, rows: [] })
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [open, from])

  const close = () => {
    form.reset(values)
    onClose()
  }
  const stockRows = stock?.warehouseId === from ? stock.rows : undefined
  const itemName = (id?: string) => {
    const i = items.find((x) => x.id === id)
    return i ? `${i.name ?? "-"}${i.sku ? ` (${i.sku})` : ""}` : `#${id}`
  }

  async function onSubmit(v: TTransferSchema) {
    try {
      await TransferService.create({
        fromWarehouseId: Number(v.fromWarehouseId),
        toWarehouseId: Number(v.toWarehouseId),
        itemId: Number(v.itemId),
        quantity: toNumber(v.quantity),
        transferDate: v.transferDate,
      })
      toast.success(t("common.saved"))
      onSaved()
      close()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const warehouseSelect = (name: "fromWarehouseId" | "toWarehouseId", label: string, disabled: boolean, exclude?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`tr-${name}`}>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value}
            disabled={disabled}
            onValueChange={(v) => {
              field.onChange(v)
              // a new source invalidates what follows it
              if (name === "fromWarehouseId") {
                form.setValue("toWarehouseId", "")
                form.setValue("itemId", "")
                form.setValue("available", 0)
                form.setValue("quantity", "")
              }
            }}
          >
            <SelectTrigger id={`tr-${name}`} className="w-full" aria-label={label}>
              <SelectValue placeholder={t("sales.choose")} />
            </SelectTrigger>
            <SelectContent>
              {warehouses
                .filter((w) => w.id !== exclude)
                .map((w) => (
                  <SelectItem key={w.id} value={w.id ?? ""}>
                    {w.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError message={errors[name]?.message} />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t("inventory.transfer.create")}</DialogTitle>
            <DialogDescription>{t("inventory.transfer.formDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
            {warehouseSelect("fromWarehouseId", t("inventory.fromWarehouse"), false)}
            <ArrowRight className="text-muted-foreground mt-8 hidden size-4 sm:block" />
            {warehouseSelect("toWarehouseId", t("inventory.toWarehouse"), !from, from)}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tr-itemId">{t("sales.item")}</Label>
            <Controller
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={!from || !to || !stockRows}
                  onValueChange={(v) => {
                    field.onChange(v)
                    form.setValue("available", stockRows?.find((r) => r.itemId === v)?.quantity ?? 0)
                  }}
                >
                  <SelectTrigger id="tr-itemId" className="w-full" aria-label={t("sales.item")}>
                    <SelectValue placeholder={t("sales.choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(stockRows ?? []).map((r) => (
                      <SelectItem key={r.itemId} value={r.itemId ?? ""}>
                        {itemName(r.itemId)} · {formatNumber(r.quantity, language, 2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {from && to && stockRows?.length === 0 && <p className="text-muted-foreground text-xs">{t("inventory.transfer.noStock")}</p>}
            <FieldError message={errors.itemId?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tr-quantity">{t("sales.quantity")}</Label>
              <Input id="tr-quantity" inputMode="decimal" disabled={!itemId} {...form.register("quantity")} />
              {itemId && (
                <p className="text-muted-foreground text-xs">
                  {t("inventory.transfer.available", { n: formatNumber(form.getValues("available"), language, 2) })}
                </p>
              )}
              <FieldError message={errors.quantity?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tr-date">{t("inventory.transfer.date")}</Label>
              <Input id="tr-date" type="date" disabled={!itemId || !(toNumber(quantity ?? "") > 0)} {...form.register("transferDate")} />
              <FieldError message={errors.transferDate?.message} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
