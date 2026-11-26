"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStoreItemSchema, type TStoreItemSchema } from "@/lib/inventory/inventory.schema"
import { ItemService, StoreItemService, type ItemDto, type StoreItemDto } from "@/lib/inventory/inventory.service"
import { useT } from "@/lib/i18n"

/** Add an item to the store (create) or change its price / status / limit (PUT = full replacement of those three). */
export function StoreItemDialog({
  state,
  warehouseId,
  onClose,
  onSaved,
}: {
  state: { row?: StoreItemDto } | null
  warehouseId: string
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const row = state?.row
  const creating = !row?.id
  const values = React.useMemo<TStoreItemSchema>(
    () => ({
      itemId: row?.itemId ?? "",
      salePrice: row?.salePrice != null ? String(row.salePrice) : "",
      status: row?.status ?? "ON_SALE",
      purchaseLimitQty: row?.purchaseLimitQty != null ? String(row.purchaseLimitQty) : "",
    }),
    [row]
  )
  const form = useForm<TStoreItemSchema>({ resolver: zodResolver(getStoreItemSchema(t, creating)), mode: "all", values })
  const { errors, isSubmitting } = form.formState

  const [query, setQuery] = React.useState("")
  const [found, setFound] = React.useState<ItemDto[]>([])
  React.useEffect(() => {
    if (!creating || state === null) return
    let cancelled = false
    const timer = setTimeout(() => {
      ItemService.list({ keyword: query.trim() || undefined, size: 20 })
        .then((p) => !cancelled && setFound((p.content ?? []).filter((i) => i.type !== "SERVICE")))
        .catch(() => undefined)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, creating, state])

  async function onSubmit(v: TStoreItemSchema) {
    const limit = v.purchaseLimitQty.trim() === "" ? null : Number(v.purchaseLimitQty)
    try {
      if (creating) {
        await StoreItemService.create({
          warehouseId: Number(warehouseId),
          itemId: Number(v.itemId),
          salePrice: Number(v.salePrice),
          status: v.status,
          purchaseLimitQty: limit,
        })
      } else if (row?.id) {
        await StoreItemService.update(row.id, { salePrice: Number(v.salePrice), status: v.status, purchaseLimitQty: limit })
      }
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e)) // INV_015/016/020/026 on create, INV_027 on edit
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {creating ? t("inventory.storeItem.add") : t("inventory.storeItem.edit", { name: row?.itemName ?? "" })}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("menu.inventory.storeItems")}</DialogDescription>
          </DialogHeader>
          {creating && (
            <div className="grid gap-1.5">
              <Label htmlFor="si-search">{t("inventory.storeItem.item")}</Label>
              <Input
                id="si-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("inventory.storeItem.itemSearch")}
              />
              <Controller
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(id) => {
                      field.onChange(id)
                      const item = found.find((i) => i.id === id)
                      if (item?.salePrice != null && !form.getValues("salePrice")) {
                        form.setValue("salePrice", String(item.salePrice), { shouldValidate: true })
                      }
                    }}
                  >
                    <SelectTrigger aria-label={t("inventory.storeItem.item")}>
                      <SelectValue placeholder={found.length ? t("inventory.storeItem.item") : t("inventory.storeItem.noItem")} />
                    </SelectTrigger>
                    <SelectContent>
                      {found.map((i) => (
                        <SelectItem key={i.id} value={i.id ?? ""}>
                          {i.name} · {i.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.itemId?.message} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="si-price">{t("inventory.storeItem.price")}</Label>
              <Input id="si-price" inputMode="decimal" {...form.register("salePrice")} />
              <FieldError message={errors.salePrice?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="si-limit">{t("inventory.storeItem.limit")}</Label>
              <Input id="si-limit" inputMode="numeric" placeholder={t("inventory.storeItem.limitHint")} {...form.register("purchaseLimitQty")} />
              <FieldError message={errors.purchaseLimitQty?.message} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("inventory.storeItem.status")}</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label={t("inventory.storeItem.status")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ON_SALE">{t("inventory.storeItem.onSale")}</SelectItem>
                    <SelectItem value="SUSPENDED">{t("inventory.storeItem.suspended")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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
