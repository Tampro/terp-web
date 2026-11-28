"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { WarehouseDto } from "@/lib/inventory/inventory.service"
import { getStoreSchema, type TStoreSchema } from "@/lib/store/store.schema"
import { StoreService, type StoreDto, type StoreForm } from "@/lib/store/store.service"
import { useT, type TranslationKey } from "@/lib/i18n"

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v))
const num = (v: string) => (v.trim() === "" ? null : Number(v))
const FEES = ["deliveryFee", "freeDeliveryThreshold", "minOrderAmount", "firstOrderMinAmount", "bagFee"] as const

/** Create, or PUT = full replacement (omitted fees become 0 on the server). */
export function StoreDialog({
  state,
  warehouses,
  onClose,
  onSaved,
}: {
  state: { row?: StoreDto } | null
  warehouses: WarehouseDto[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const row = state?.row
  const creating = !row?.id
  const values = React.useMemo<TStoreSchema>(
    () => ({
      code: row?.code ?? "",
      name: row?.name ?? "",
      warehouseId: row?.warehouseId ?? "",
      address: row?.address ?? "",
      lat: str(row?.lat),
      lon: str(row?.lon),
      phone: row?.phone ?? "",
      timeZone: row?.timeZone ?? "Asia/Seoul",
      orderStart: (row?.orderStart ?? "10:00").slice(0, 5),
      orderEnd: (row?.orderEnd ?? "22:00").slice(0, 5),
      deliveryFee: str(row?.deliveryFee),
      freeDeliveryThreshold: str(row?.freeDeliveryThreshold),
      minOrderAmount: str(row?.minOrderAmount),
      firstOrderMinAmount: str(row?.firstOrderMinAmount),
      bagFee: str(row?.bagFee),
      active: row?.active ?? true,
    }),
    [row]
  )
  const form = useForm<TStoreSchema>({ resolver: zodResolver(getStoreSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TStoreSchema) {
    const body: StoreForm = {
      code: v.code.trim(),
      name: v.name.trim(),
      warehouseId: Number(v.warehouseId),
      address: v.address.trim() || null,
      lat: num(v.lat),
      lon: num(v.lon),
      phone: v.phone.trim() || null,
      timeZone: v.timeZone.trim() || null,
      orderStart: v.orderStart,
      orderEnd: v.orderEnd,
      deliveryFee: num(v.deliveryFee),
      freeDeliveryThreshold: num(v.freeDeliveryThreshold),
      minOrderAmount: num(v.minOrderAmount),
      firstOrderMinAmount: num(v.firstOrderMinAmount),
      bagFee: num(v.bagFee),
      active: v.active,
    }
    try {
      if (creating) await StoreService.create(body)
      else if (row?.id) await StoreService.update(row.id, body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e)) // STO_002/003/004/005/006
    }
  }

  const field = (name: keyof TStoreSchema, label: TranslationKey, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`st-${name}`}>{t(label)}</Label>
      <Input id={`st-${name}`} {...props} {...form.register(name)} />
      <FieldError message={errors[name]?.message} />
    </div>
  )

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{creating ? t("store.add") : t("store.edit", { name: row?.name ?? "" })}</DialogTitle>
            <DialogDescription className="sr-only">{t("store.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("code", "store.code")}
            {field("name", "store.name")}
            <div className="grid gap-1.5">
              <Label>{t("store.warehouse")}</Label>
              <Controller
                control={form.control}
                name="warehouseId"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger aria-label={t("store.warehouse")}>
                      <SelectValue placeholder={t("store.warehouse")} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
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
            {field("phone", "store.phone")}
            {field("address", "store.address")}
            {field("timeZone", "store.timeZone")}
            {field("lat", "store.lat", { inputMode: "decimal" })}
            {field("lon", "store.lon", { inputMode: "decimal" })}
            {field("orderStart", "store.orderStart", { placeholder: "10:00" })}
            {field("orderEnd", "store.orderEnd", { placeholder: "22:00" })}
            {FEES.map((k) => (
              <React.Fragment key={k}>{field(k, `store.${k}` as TranslationKey, { inputMode: "decimal", placeholder: "0" })}</React.Fragment>
            ))}
          </div>
          <Controller
            control={form.control}
            name="active"
            render={({ field: f }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.value} onCheckedChange={(c) => f.onChange(c === true)} />
                {t("store.active")}
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
