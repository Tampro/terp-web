"use client"

import * as React from "react"
import { MoreHorizontal, Pause, Pencil, Play, Plus, Search, Trash2, Upload } from "lucide-react"
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
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatNumber } from "@/lib/format"
import {
  CatalogService,
  StoreItemService,
  WarehouseService,
  type CategoryDto,
  type StoreItemDto,
  type WarehouseDto,
} from "@/lib/inventory/inventory.service"
import { useLanguageStore, useT } from "@/lib/i18n"

import { StoreItemDialog } from "./_components/store-item-dialog"
import { StoreItemImportDialog } from "./_components/store-item-import-dialog"

const PAGE_SIZE = 20
const ALL = "ALL"

export default function StoreItemsPage() {
  return (
    <React.Suspense>
      <StoreItems />
    </React.Suspense>
  )
}

/**
 * Price and on-sale status of items per store (a store is a warehouse). The list is only loaded once a store is chosen
 * (`?warehouseId=`): a chain can hold hundreds of stores × thousands of items.
 */
function StoreItems() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("INVENTORY_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const warehouseId = searchParams.get("warehouseId") ?? ""
  const keyword = searchParams.get("keyword") ?? ""
  const categoryId = searchParams.get("categoryId") ?? ALL
  const status = searchParams.get("status") ?? ALL
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [stores, setStores] = React.useState<WarehouseDto[]>([])
  const [categories, setCategories] = React.useState<CategoryDto[]>([])
  const [data, setData] = React.useState<IPage<StoreItemDto>>()
  const [loading, setLoading] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ row?: StoreItemDto } | null>(null)
  const [deleting, setDeleting] = React.useState<StoreItemDto>()
  const [importing, setImporting] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    WarehouseService.list({ active: true, size: 500 })
      .then((p) => !cancelled && setStores(p.content ?? []))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    CatalogService.categories
      .list()
      .then((c) => !cancelled && setCategories(c ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!warehouseId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the skeleton while the new page loads
    setLoading(true)
    StoreItemService.list({
      warehouseId,
      keyword: keyword || undefined,
      categoryId: categoryId === ALL ? undefined : categoryId,
      status: status === ALL ? undefined : status,
      page,
      size: PAGE_SIZE,
    })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [warehouseId, keyword, categoryId, status, page, reloadKey])

  const store = stores.find((s) => s.id === warehouseId)
  const rows = warehouseId ? (data?.content ?? []) : []

  async function toggle(row: StoreItemDto) {
    if (!row.id) return
    try {
      await StoreItemService.status(row.id, row.status === "SUSPENDED" ? "ON_SALE" : "SUSPENDED")
      toast.success(t("common.saved"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e)) // INV_027: removed meanwhile
    }
    reload()
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.inventory.storeItems")} description={t("inventory.storeItem.subtitle")}>
        {manage && warehouseId && (
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="size-4" /> {t("inventory.storeItem.import")}
            </Button>
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("inventory.storeItem.add")}
            </Button>
          </>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              update({ keyword: search.trim(), page: 0 })
            }}
          >
            <Select value={warehouseId} onValueChange={(v) => update({ warehouseId: v, page: 0 })}>
              <SelectTrigger className="w-60" aria-label={t("inventory.storeItem.store")}>
                <SelectValue placeholder={t("inventory.storeItem.pickStore")} />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id ?? ""}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {warehouseId && (
              <>
                <Select value={categoryId} onValueChange={(v) => update({ categoryId: v, page: 0 })}>
                  <SelectTrigger className="w-48" aria-label={t("inventory.item.category")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("inventory.item.allCategories")}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id ?? ""}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => update({ status: v, page: 0 })}>
                  <SelectTrigger className="w-40" aria-label={t("inventory.storeItem.status")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("inventory.allStatuses")}</SelectItem>
                    <SelectItem value="ON_SALE">{t("inventory.storeItem.onSale")}</SelectItem>
                    <SelectItem value="SUSPENDED">{t("inventory.storeItem.suspended")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative min-w-60 flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("inventory.storeItem.searchPlaceholder")}
                    aria-label={t("common.search")}
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  {t("common.search")}
                </Button>
              </>
            )}
          </form>

          {!warehouseId ? (
            <p className="text-muted-foreground py-10 text-center text-sm">{t("inventory.storeItem.pickStoreHint")}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.item.sku")}</TableHead>
                      <TableHead>{t("inventory.storeItem.item")}</TableHead>
                      <TableHead className="text-right">{t("inventory.storeItem.price")}</TableHead>
                      <TableHead>{t("inventory.storeItem.status")}</TableHead>
                      <TableHead className="text-right">{t("inventory.storeItem.limit")}</TableHead>
                      <TableHead className="text-right">{t("inventory.storeItem.stock")}</TableHead>
                      <TableHead className="w-12">
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
                          {t("inventory.storeItem.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading &&
                      rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.sku || "-"}</TableCell>
                          <TableCell className="font-medium">{r.itemName || "-"}</TableCell>
                          <TableCell className="text-right">{money(r.salePrice)}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "SUSPENDED" ? "outline" : "default"}>
                              {t(r.status === "SUSPENDED" ? "inventory.storeItem.suspended" : "inventory.storeItem.onSale")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{r.purchaseLimitQty ?? "–"}</TableCell>
                          <TableCell className="text-right">{formatNumber(r.stockQuantity ?? 0, language, 2)}</TableCell>
                          <TableCell>
                            {manage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label={t("inventory.actionsFor", { name: r.itemName ?? "" })}>
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditing({ row: r })}>
                                    <Pencil className="size-4" /> {t("common.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggle(r)}>
                                    {r.status === "SUSPENDED" ? <Play className="size-4" /> : <Pause className="size-4" />}{" "}
                                    {t(r.status === "SUSPENDED" ? "inventory.storeItem.resume" : "inventory.storeItem.suspend")}
                                  </DropdownMenuItem>
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
            </>
          )}
        </CardContent>
      </Card>

      {warehouseId && (
        <StoreItemDialog state={editing} warehouseId={warehouseId} onClose={() => setEditing(null)} onSaved={reload} />
      )}
      {warehouseId && (
        <StoreItemImportDialog
          open={importing}
          warehouseId={warehouseId}
          storeName={store?.name ?? ""}
          onClose={() => setImporting(false)}
          onImported={reload}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("inventory.storeItem.deleteTitle", { name: deleting?.itemName ?? "" })}
        description={t("inventory.storeItem.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await StoreItemService.remove(deleting.id)
            toast.success(t("sales.done.deleted"))
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e)) // INV_027
          }
          reload()
        }}
      />
    </div>
  )
}
