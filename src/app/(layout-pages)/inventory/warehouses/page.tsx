"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { WarehouseService, type WarehouseDto, type WarehouseForm } from "@/lib/inventory/inventory.service"
import { useT, type TranslationKey } from "@/lib/i18n"
import { getWarehouseSchema, type TWarehouseSchema } from "@/lib/purchase/purchase.schema"

const PAGE_SIZE = 20
const ALL = "ALL"

export default function WarehousesPage() {
  return (
    <React.Suspense>
      <Warehouses />
    </React.Suspense>
  )
}

/** §8.3 Warehouses: Name, Address, City, Zip Code, Phone, Email, Status; filters city and status. */
function Warehouses() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("INVENTORY_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const city = searchParams.get("city") ?? ""
  const status = searchParams.get("status") ?? ALL
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<WarehouseDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [cityInput, setCityInput] = React.useState(city)
  const [editing, setEditing] = React.useState<{ row?: WarehouseDto } | null>(null)
  const [deleting, setDeleting] = React.useState<WarehouseDto>()

  React.useEffect(() => {
    let cancelled = false
    WarehouseService.list({
      keyword: keyword || undefined,
      city: city || undefined,
      active: status === ALL ? undefined : status === "ACTIVE",
      page,
      size: PAGE_SIZE,
    })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, city, status, page, reloadKey])

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.inventory.warehouses")} description={t("inventory.warehouse.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("inventory.warehouse.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              update({ keyword: search.trim(), city: cityInput.trim(), page: 0 })
            }}
          >
            <Select value={status} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-40" aria-label={t("orders.status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("inventory.allStatuses")}</SelectItem>
                <SelectItem value="ACTIVE">{t("inventory.active")}</SelectItem>
                <SelectItem value="INACTIVE">{t("inventory.inactive")}</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-44" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder={t("inventory.city")} aria-label={t("inventory.city")} />
            <div className="relative min-w-60 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("inventory.warehouse.searchPlaceholder")}
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
                  <TableHead>{t("inventory.name")}</TableHead>
                  <TableHead>{t("inventory.address")}</TableHead>
                  <TableHead>{t("inventory.city")}</TableHead>
                  <TableHead>{t("inventory.zipCode")}</TableHead>
                  <TableHead>{t("inventory.phone")}</TableHead>
                  <TableHead>{t("inventory.email")}</TableHead>
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
                      {t("inventory.warehouse.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{w.address || "-"}</TableCell>
                      <TableCell>{w.city || "-"}</TableCell>
                      <TableCell>{w.zipCode || "-"}</TableCell>
                      <TableCell>{w.phone || "-"}</TableCell>
                      <TableCell>{w.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={w.active ? "default" : "outline"}>{t(w.active ? "inventory.active" : "inventory.inactive")}</Badge>
                      </TableCell>
                      <TableCell>
                        {manage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("inventory.actionsFor", { name: w.name ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing({ row: w })}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(w)}>
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

      <WarehouseDialog state={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("inventory.confirm.deleteWarehouse", { name: deleting?.name ?? "" })}
        description={t("inventory.confirm.deleteWarehouseDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await WarehouseService.remove(deleting.id)
            toast.success(t("sales.done.deleted"))
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e)) // INV_008: still holds stock
          }
        }}
      />
    </div>
  )
}

function WarehouseDialog({
  state,
  onClose,
  onSaved,
}: {
  state: { row?: WarehouseDto } | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const editId = state?.row?.id
  const values = React.useMemo<TWarehouseSchema>(
    () => ({
      name: state?.row?.name ?? "",
      address: state?.row?.address ?? "",
      city: state?.row?.city ?? "",
      zipCode: state?.row?.zipCode ?? "",
      phone: state?.row?.phone ?? "",
      email: state?.row?.email ?? "",
      active: state?.row?.active ?? true,
    }),
    [state]
  )
  const form = useForm<TWarehouseSchema>({ resolver: zodResolver(getWarehouseSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TWarehouseSchema) {
    const body: WarehouseForm = {
      name: v.name.trim(),
      address: v.address.trim(),
      city: v.city.trim(),
      zipCode: v.zipCode.trim(),
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      active: v.active,
    }
    try {
      if (editId) await WarehouseService.update(editId, body)
      else await WarehouseService.create(body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const field = (name: "name" | "address" | "city" | "zipCode" | "phone" | "email", type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`wh-${name}`}>{t(`inventory.${name}` as TranslationKey)}</Label>
      <Input id={`wh-${name}`} type={type} {...form.register(name)} />
      <FieldError message={errors[name]?.message} />
    </div>
  )

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t(editId ? "inventory.warehouse.edit" : "inventory.warehouse.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("menu.inventory.warehouses")}</DialogDescription>
          </DialogHeader>
          {field("name")}
          {field("address")}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("city")}
            {field("zipCode")}
            {field("phone", "tel")}
            {field("email", "email")}
          </div>
          <Controller
            control={form.control}
            name="active"
            render={({ field: f }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={f.value} onCheckedChange={f.onChange} /> {t("inventory.active")}
              </label>
            )}
          />
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
