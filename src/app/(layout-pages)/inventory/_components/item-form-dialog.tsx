"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImagePlus, Star, X } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useT, type TranslationKey } from "@/lib/i18n"
import { getItemSchema, ITEM_STEPS, type TItemSchema } from "@/lib/inventory/inventory.schema"
import {
  ItemService,
  type CategoryDto,
  type ItemDto,
  type TaxDto,
  type UnitDto,
  type WarehouseDto,
} from "@/lib/inventory/inventory.service"
import { MediaService } from "@/lib/media/media.service"
import { toNumber } from "@/lib/sales/sales.schema"

import { MediaThumb } from "./media-thumb"

const NONE = "__none"
const TYPES = ["PRODUCT", "SERVICE", "PART"] as const
const MAX_ADDITIONAL = 10 // ItemImageService.MAX_ADDITIONAL
const str = (v?: number | null) => (v === null || v === undefined ? "" : String(v))

export interface ItemLookups {
  categories: CategoryDto[]
  taxes: TaxDto[]
  units: UnitDto[]
  warehouses: WarehouseDto[]
}

function toForm(item?: ItemDto): TItemSchema {
  return {
    type: item?.type ?? "PRODUCT",
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    generateSku: false,
    taxId: item?.taxId ?? "",
    categoryId: item?.categoryId ?? "",
    unitId: item?.unitId ?? "",
    salePrice: str(item?.salePrice),
    purchasePrice: str(item?.purchasePrice),
    shortDescription: item?.shortDescription ?? "",
    description: item?.description ?? "",
    openingWarehouseId: "",
    openingQuantity: "",
  }
}

/**
 * §9 Create item in 4 steps: (1) type, name, SKU or Generate, tax, category, descriptions; (2) prices, unit, opening
 * quantity (products / parts); (3) main and additional images; (4) warehouse of the opening quantity. Edit uses the
 * same steps without the opening stock (stock changes only through Add Stock). Images are saved after the item
 * (PUT /items/{id}/images, full replacement).
 */
export function ItemFormDialog({
  state,
  lookups,
  onClose,
  onSaved,
}: {
  /** null = closed; {} = new; {item} = edit */
  state: { item?: ItemDto } | null
  lookups: ItemLookups
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {state && <ItemWizard key={state.item?.id ?? "new"} item={state.item} lookups={lookups} onClose={onClose} onSaved={onSaved} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function ItemWizard({
  item,
  lookups,
  onClose,
  onSaved,
  t,
}: {
  item?: ItemDto
  lookups: ItemLookups
  onClose: () => void
  onSaved: () => void
  t: ReturnType<typeof useT>
}) {
  const editId = item?.id
  const [step, setStep] = React.useState(0)
  const values = React.useMemo(() => toForm(item), [item])
  const form = useForm<TItemSchema>({ resolver: zodResolver(getItemSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const [type, generateSku] = useWatch({ control: form.control, name: ["type", "generateSku"] })
  const stocked = type !== "SERVICE"
  // step 4 is the opening stock warehouse: products / parts on create only
  const steps = editId || !stocked ? 3 : 4

  const [images, setImages] = React.useState<{ main?: string; additional: string[]; loaded: boolean }>({ additional: [], loaded: !editId })
  const [uploading, setUploading] = React.useState(false)
  React.useEffect(() => {
    if (!editId) return
    let cancelled = false
    ItemService.images(editId)
      .then((d) => !cancelled && setImages({ main: d.mainImageId ?? undefined, additional: d.additionalImageIds ?? [], loaded: true }))
      .catch((e: Error) => {
        if (cancelled) return
        setImages({ additional: [], loaded: true })
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  async function upload(files: FileList | null) {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/"))
    if (list.length === 0) return
    setUploading(true)
    try {
      const uploaded = (await MediaService.upload(list)).map((f) => f.id).filter((x): x is string => !!x)
      setImages((s) => {
        const ids = [...uploaded]
        const main = s.main ?? ids.shift()
        return { ...s, main, additional: [...s.additional, ...ids].slice(0, MAX_ADDITIONAL) }
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function next(e: React.MouseEvent) {
    e.preventDefault()
    if (await form.trigger(ITEM_STEPS[step], { shouldFocus: true })) setStep((s) => s + 1)
  }

  async function onSubmit(v: TItemSchema) {
    const base = {
      type: v.type,
      name: v.name.trim(),
      taxId: v.taxId ? Number(v.taxId) : null,
      categoryId: Number(v.categoryId),
      unitId: Number(v.unitId),
      salePrice: toNumber(v.salePrice),
      purchasePrice: toNumber(v.purchasePrice),
      shortDescription: v.shortDescription.trim() || null,
      description: v.description.trim() || null,
    }
    const opening = v.type !== "SERVICE" && v.openingQuantity.trim() !== ""
    try {
      const saved = editId
        ? await ItemService.update(editId, { ...base, sku: v.sku.trim() })
        : await ItemService.create({
            ...base,
            ...(v.generateSku ? { generateSku: true } : { sku: v.sku.trim() }),
            ...(opening ? { openingWarehouseId: Number(v.openingWarehouseId), openingQuantity: toNumber(v.openingQuantity) } : {}),
          })
      const hadImages = !!item?.mainImageId || images.additional.length > 0
      if (saved.id && (images.main || images.additional.length > 0 || (editId && hadImages))) {
        await ItemService.setImages(saved.id, {
          mainImageId: images.main ? Number(images.main) : null,
          additionalImageIds: images.additional.map(Number),
        })
      }
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const select = (
    name: "categoryId" | "unitId" | "taxId" | "openingWarehouseId",
    label: string,
    options: { value: string; label: string }[],
    noneLabel?: string
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`item-${name}`}>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={field.value || (noneLabel ? NONE : "")} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
            <SelectTrigger id={`item-${name}`} className="w-full" aria-label={label}>
              <SelectValue placeholder={t("sales.choose")} />
            </SelectTrigger>
            <SelectContent>
              {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError message={errors[name]?.message} />
    </div>
  )
  const text = (name: "name" | "sku" | "salePrice" | "purchasePrice" | "openingQuantity", label: string, decimal = false) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`item-${name}`}>{label}</Label>
      <Input
        id={`item-${name}`}
        inputMode={decimal ? "decimal" : undefined}
        disabled={name === "sku" && generateSku}
        {...form.register(name)}
      />
      <FieldError message={errors[name]?.message} />
    </div>
  )
  const stepTitles: TranslationKey[] = ["inventory.item.step1", "inventory.item.step2", "inventory.item.step3", "inventory.item.step4"]

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DialogHeader>
        <DialogTitle>{t(editId ? "inventory.item.edit" : "inventory.item.create")}</DialogTitle>
        <DialogDescription>{t("inventory.item.stepOf", { n: step + 1, total: steps, name: t(stepTitles[step]) })}</DialogDescription>
      </DialogHeader>
      <ol className="flex gap-1" aria-hidden>
        {Array.from({ length: steps }, (_, i) => (
          <li key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="item-type">{t("inventory.item.type")}</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item-type" className="w-full" aria-label={t("inventory.item.type")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((x) => (
                      <SelectItem key={x} value={x}>
                        {t(`sales.itemType.${x}` as TranslationKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {text("name", t("inventory.name"))}
          <div className="grid gap-1.5">
            {text("sku", t("inventory.item.sku"))}
            {!editId && (
              <Controller
                control={form.control}
                name="generateSku"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => {
                        field.onChange(c === true)
                        if (c === true) form.setValue("sku", "", { shouldValidate: true })
                      }}
                    />
                    {t("inventory.item.generateSku")}
                  </label>
                )}
              />
            )}
          </div>
          {select(
            "taxId",
            t("sales.tax"),
            lookups.taxes.map((x) => ({ value: x.id ?? "", label: `${x.name} (${x.rate ?? 0}%)` })),
            t("sales.noTax")
          )}
          {select("categoryId", t("inventory.item.category"), lookups.categories.map((x) => ({ value: x.id ?? "", label: x.name ?? "-" })))}
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="item-short">{t("inventory.item.shortDescription")}</Label>
            <Input id="item-short" {...form.register("shortDescription")} />
            <FieldError message={errors.shortDescription?.message} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="item-desc">{t("inventory.item.description")}</Label>
            <Textarea id="item-desc" rows={3} {...form.register("description")} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("salePrice", t("inventory.item.salePrice"), true)}
          {text("purchasePrice", t("inventory.item.purchasePrice"), true)}
          {select("unitId", t("inventory.item.unit"), lookups.units.map((x) => ({ value: x.id ?? "", label: x.name ?? "-" })))}
          {!editId && stocked && text("openingQuantity", t("inventory.item.openingQuantity"), true)}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          <p className="text-muted-foreground text-sm">{t("inventory.item.imagesHint", { n: MAX_ADDITIONAL })}</p>
          {!images.loaded ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="flex flex-wrap gap-3">
              {[...(images.main ? [images.main] : []), ...images.additional].map((id) => {
                const main = id === images.main
                return (
                  <li key={id} className={`relative rounded-md border p-1 ${main ? "ring-primary ring-2" : ""}`}>
                    <MediaThumb fileId={id} alt={t(main ? "inventory.item.mainImage" : "inventory.item.additionalImage")} className="size-20" />
                    <div className="mt-1 flex justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        disabled={main}
                        aria-label={t("inventory.item.makeMain")}
                        onClick={() =>
                          setImages((s) => ({
                            ...s,
                            main: id,
                            additional: [...(s.main ? [s.main] : []), ...s.additional.filter((x) => x !== id)].slice(0, MAX_ADDITIONAL),
                          }))
                        }
                      >
                        <Star className={`size-3.5 ${main ? "fill-current" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={t("inventory.item.removeImage")}
                        onClick={() =>
                          setImages((s) =>
                            main ? { ...s, main: s.additional[0], additional: s.additional.slice(1) } : { ...s, additional: s.additional.filter((x) => x !== id) }
                          )
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
              <li>
                <label className="hover:bg-muted flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs">
                  <ImagePlus className="size-5" />
                  {uploading ? t("inventory.item.uploading") : t("inventory.item.addImages")}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={uploading || images.additional.length >= MAX_ADDITIONAL}
                    aria-label={t("inventory.item.addImages")}
                    onChange={(e) => {
                      void upload(e.target.files)
                      e.target.value = ""
                    }}
                  />
                </label>
              </li>
            </ul>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {select(
            "openingWarehouseId",
            t("sales.warehouse"),
            lookups.warehouses.filter((w) => w.active).map((w) => ({ value: w.id ?? "", label: w.name ?? "-" })),
            t("sales.noWarehouse")
          )}
          {text("openingQuantity", t("inventory.item.openingQuantity"), true)}
          <p className="text-muted-foreground text-xs sm:col-span-2">{t("inventory.item.openingHint")}</p>
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}>
          {t(step === 0 ? "common.cancel" : "inventory.item.back")}
        </Button>
        {step < steps - 1 ? (
          // distinct keys: reusing one <button> and flipping its type to submit during the click would submit the form
          <Button key="next" type="button" onClick={next}>
            {t("inventory.item.next")}
          </Button>
        ) : (
          <Button key="save" type="submit" disabled={isSubmitting || uploading}>
            {t("common.save")}
          </Button>
        )}
      </DialogFooter>
    </form>
  )
}
