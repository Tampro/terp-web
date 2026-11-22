"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { MoreHorizontal, PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { getAddStockSchema, type TAddStockSchema } from "@/lib/inventory/inventory.schema"
import { CatalogService, ItemService, WarehouseService, type ItemDto } from "@/lib/inventory/inventory.service"
import { toNumber } from "@/lib/sales/sales.schema"

import { ItemFormDialog, type ItemLookups } from "../_components/item-form-dialog"
import { MediaThumb } from "../_components/media-thumb"

const PAGE_SIZE = 20
const ALL = "ALL"
const TYPES = ["PRODUCT", "SERVICE", "PART"] as const
const EMPTY_STOCK: TAddStockSchema = { warehouseId: "", quantity: "" }

export default function ItemsPage() {
  return (
    <React.Suspense>
      <Items />
    </React.Suspense>
  )
}

/** §9 Items list: image, name, SKU, prices, category, unit, quantity, type; filters type and category. */
function Items() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("INVENTORY_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const type = searchParams.get("type") ?? undefined
  const categoryId = searchParams.get("categoryId") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<ItemDto>>()
  const [lookups, setLookups] = React.useState<ItemLookups>({ categories: [], taxes: [], units: [], warehouses: [] })
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ item?: ItemDto } | null>(null)
  const [stocking, setStocking] = React.useState<ItemDto>()
  const [deleting, setDeleting] = React.useState<ItemDto>()

  React.useEffect(() => {
    let cancelled = false
    const safe = <T,>(p: Promise<T>, empty: T) => p.catch((e: Error) => (toast.error(e.message), empty))
    Promise.all([
      safe(CatalogService.categories.list(), []),
      safe(CatalogService.taxes.list(), []),
      safe(CatalogService.units.list(), []),
      safe(WarehouseService.list({ size: 100 }).then((p) => p.content ?? []), []),
    ]).then(([categories, taxes, units, warehouses]) => !cancelled && setLookups({ categories, taxes, units, warehouses }))
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    ItemService.list({ keyword: keyword || undefined, type, categoryId, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, type, categoryId, page, reloadKey])

  async function openEdit(row: ItemDto) {
    try {
      setEditing({ item: await ItemService.get(row.id!) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const colorOf = (id?: string) => lookups.categories.find((c) => c.id === id)?.color ?? undefined
  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.inventory.items")} description={t("inventory.item.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("inventory.item.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select value={type ?? ALL} onValueChange={(v) => update({ type: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-40" aria-label={t("inventory.item.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("inventory.item.allTypes")}</SelectItem>
                {TYPES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {t(`sales.itemType.${x}` as TranslationKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId ?? ALL} onValueChange={(v) => update({ categoryId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-44" aria-label={t("inventory.item.category")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("inventory.item.allCategories")}</SelectItem>
                {lookups.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id ?? ""}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  placeholder={t("inventory.item.searchPlaceholder")}
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
                  <TableHead>{t("inventory.item.product")}</TableHead>
                  <TableHead className="text-right">{t("inventory.item.salePrice")}</TableHead>
                  <TableHead className="text-right">{t("inventory.item.purchasePrice")}</TableHead>
                  <TableHead>{t("inventory.item.category")}</TableHead>
                  <TableHead>{t("inventory.item.unit")}</TableHead>
                  <TableHead className="text-right">{t("sales.quantity")}</TableHead>
                  <TableHead>{t("inventory.item.type")}</TableHead>
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
                      {t("inventory.item.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <MediaThumb fileId={r.mainImageId} alt={r.name ?? ""} />
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-muted-foreground font-mono text-xs">{r.sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{money(r.salePrice)}</TableCell>
                      <TableCell className="text-right">{money(r.purchasePrice)}</TableCell>
                      <TableCell>
                        {r.categoryName ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: colorOf(r.categoryId) ?? "var(--muted-foreground)" }} />
                            {r.categoryName}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{r.unitName ?? "-"}</TableCell>
                      <TableCell className="text-right">{r.type === "SERVICE" ? "-" : formatNumber(r.quantity, language, 2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.type ? t(`sales.itemType.${r.type}` as TranslationKey) : "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        {manage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("inventory.actionsFor", { name: r.name ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(r)}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                              {r.type !== "SERVICE" && (
                                <DropdownMenuItem onClick={() => setStocking(r)}>
                                  <PackagePlus className="size-4" /> {t("inventory.stock.add")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(r)}>
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

      <ItemFormDialog state={editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={reload} />
      <AddStockDialog key={stocking?.id ?? "none"} item={stocking} lookups={lookups} onClose={() => setStocking(undefined)} onSaved={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("inventory.confirm.deleteItem", { name: deleting?.name ?? "" })}
        description={t("inventory.confirm.deleteItemDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await ItemService.remove(deleting.id)
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

/** §9 Add Stock: product (read-only name / SKU), warehouse, quantity → POST /inventory/stock/add. */
function AddStockDialog({
  item,
  lookups,
  onClose,
  onSaved,
}: {
  item?: ItemDto
  lookups: ItemLookups
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  // keyed by item in the parent, so the form starts empty for every item
  const form = useForm<TAddStockSchema>({ resolver: zodResolver(getAddStockSchema(t)), mode: "all", defaultValues: EMPTY_STOCK })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await ItemService.addStock({ itemId: Number(item!.id), warehouseId: Number(v.warehouseId), quantity: toNumber(v.quantity) })
              toast.success(t("inventory.stock.added"))
              onSaved()
              onClose()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e))
            }
          })}
        >
          <DialogHeader>
            <DialogTitle>{t("inventory.stock.add")}</DialogTitle>
            <DialogDescription className="sr-only">{t("inventory.stock.add")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="stock-name">{t("inventory.name")}</Label>
              <Input id="stock-name" readOnly value={item?.name ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="stock-sku">{t("inventory.item.sku")}</Label>
              <Input id="stock-sku" readOnly value={item?.sku ?? ""} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stock-warehouse">{t("sales.warehouse")}</Label>
            <Controller
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="stock-warehouse" className="w-full" aria-label={t("sales.warehouse")}>
                    <SelectValue placeholder={t("sales.choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {lookups.warehouses
                      .filter((w) => w.active)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id ?? ""}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.warehouseId?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stock-qty">{t("sales.quantity")}</Label>
            <Input id="stock-qty" inputMode="decimal" {...form.register("quantity")} />
            <FieldError message={errors.quantity?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
