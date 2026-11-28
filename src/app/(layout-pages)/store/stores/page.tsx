"use client"

import * as React from "react"
import { CalendarOff, Map, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { WarehouseService, type WarehouseDto } from "@/lib/inventory/inventory.service"
import { StoreService, type StoreDto } from "@/lib/store/store.service"
import { useT } from "@/lib/i18n"

import { DayOffsDialog } from "./_components/day-offs-dialog"
import { StoreDialog } from "./_components/store-dialog"
import { ZonesDialog } from "./_components/zones-dialog"

const PAGE_SIZE = 20

export default function StoresPage() {
  return (
    <React.Suspense>
      <Stores />
    </React.Suspense>
  )
}

/** Stores of the chain (store-service): each sells from one warehouse, with order hours, fees, zones and day-offs. */
function Stores() {
  const t = useT()
  const money = useMoney()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("STORE_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [warehouses, setWarehouses] = React.useState<WarehouseDto[]>([])
  const [data, setData] = React.useState<IPage<StoreDto>>()
  const [loading, setLoading] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ row?: StoreDto } | null>(null)
  const [deleting, setDeleting] = React.useState<StoreDto>()
  const [zonesOf, setZonesOf] = React.useState<StoreDto>()
  const [offsOf, setOffsOf] = React.useState<StoreDto>()

  React.useEffect(() => {
    if (!manage) return
    let cancelled = false
    WarehouseService.list({ active: true, size: 500 })
      .then((p) => !cancelled && setWarehouses(p.content ?? []))
      .catch(() => undefined) // the dialog then offers no warehouse; the server still checks it (STO_004)
    return () => {
      cancelled = true
    }
  }, [manage])

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the skeleton while the new page loads
    setLoading(true)
    StoreService.list({ keyword: keyword || undefined, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, page, reloadKey])

  const rows = data?.content ?? []
  const warehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? (id ? `#${id}` : "-")

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.store.stores")} description={t("store.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("store.add")}
          </Button>
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
            <div className="relative min-w-60 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("store.searchPlaceholder")}
                aria-label={t("common.search")}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              {t("common.search")}
            </Button>
          </form>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("store.code")}</TableHead>
                  <TableHead>{t("store.name")}</TableHead>
                  <TableHead>{t("store.warehouse")}</TableHead>
                  <TableHead>{t("store.hours")}</TableHead>
                  <TableHead className="text-right">{t("store.deliveryFee")}</TableHead>
                  <TableHead className="text-right">{t("store.minOrderAmount")}</TableHead>
                  <TableHead>{t("store.status")}</TableHead>
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
                      {t("store.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{warehouseName(r.warehouseId)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(r.orderStart ?? "").slice(0, 5)}–{(r.orderEnd ?? "").slice(0, 5)}
                      </TableCell>
                      <TableCell className="text-right">{money(r.deliveryFee)}</TableCell>
                      <TableCell className="text-right">{money(r.minOrderAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={r.active === false ? "outline" : "default"}>
                          {t(r.active === false ? "store.inactive" : "store.active")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("store.actionsFor", { name: r.name ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {manage && (
                              <DropdownMenuItem onClick={() => setEditing({ row: r })}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setZonesOf(r)}>
                              <Map className="size-4" /> {t("store.zones")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setOffsOf(r)}>
                              <CalendarOff className="size-4" /> {t("store.dayOffs")}
                            </DropdownMenuItem>
                            {manage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(r)}>
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

      <StoreDialog state={editing} warehouses={warehouses} onClose={() => setEditing(null)} onSaved={reload} />
      <ZonesDialog store={zonesOf} manage={manage} onClose={() => setZonesOf(undefined)} />
      <DayOffsDialog store={offsOf} manage={manage} onClose={() => setOffsOf(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("store.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("store.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await StoreService.remove(deleting.id)
            toast.success(t("sales.done.deleted"))
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e)) // STO_001
          }
          reload()
        }}
      />
    </div>
  )
}
