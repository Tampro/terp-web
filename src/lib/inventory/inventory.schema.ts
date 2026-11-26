import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"
import { toNumber as num } from "@/lib/sales/sales.schema"

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Limits from inventory-service ItemService.ItemCreateForm / ItemUpdateForm, AddStockForm; number inputs are strings.
export function getItemSchema(t: T) {
  const money = z.string().refine((v) => num(v) >= 0, t("inventory.v.amount"))
  return z
    .object({
      type: z.enum(["PRODUCT", "SERVICE", "PART"]),
      name: z.string().trim().min(1, t("purchase.v.required")).max(255, t("sales.v.max", { n: 255 })),
      sku: z.string().max(100, t("sales.v.max", { n: 100 })),
      generateSku: z.boolean(),
      taxId: z.string(),
      categoryId: z.string().min(1, t("inventory.v.category")),
      unitId: z.string().min(1, t("inventory.v.unit")),
      salePrice: money,
      purchasePrice: money,
      shortDescription: z.string().max(500, t("sales.v.max", { n: 500 })),
      description: z.string(),
      openingWarehouseId: z.string(),
      openingQuantity: z.string(),
    })
    .superRefine((v, ctx) => {
      if (!v.generateSku && !v.sku.trim()) ctx.addIssue({ code: "custom", path: ["sku"], message: t("inventory.v.sku") }) // INV_011
      if (v.type === "SERVICE") return
      // INV_018: an opening quantity needs a warehouse, and a warehouse a positive quantity
      const q = v.openingQuantity.trim()
      if (q !== "" && !(num(q) > 0)) ctx.addIssue({ code: "custom", path: ["openingQuantity"], message: t("sales.v.quantity") })
      if (q !== "" && !v.openingWarehouseId)
        ctx.addIssue({ code: "custom", path: ["openingWarehouseId"], message: t("purchase.v.warehouse") })
      if (q === "" && v.openingWarehouseId)
        ctx.addIssue({ code: "custom", path: ["openingQuantity"], message: t("inventory.v.openingQuantity") })
    })
}
export type TItemSchema = z.infer<ReturnType<typeof getItemSchema>>

/** The fields each step of the create wizard validates before "Next" (manual §9: 4 steps). */
export const ITEM_STEPS: (keyof TItemSchema)[][] = [
  ["type", "name", "sku", "generateSku", "taxId", "categoryId", "shortDescription", "description"],
  ["salePrice", "purchasePrice", "unitId", "openingQuantity"],
  [],
  ["openingWarehouseId", "openingQuantity"],
]

export function getAddStockSchema(t: T) {
  return z.object({
    warehouseId: z.string().min(1, t("purchase.v.warehouse")),
    quantity: z.string().refine((v) => num(v) > 0, t("sales.v.quantity")),
  })
}
export type TAddStockSchema = z.infer<ReturnType<typeof getAddStockSchema>>

// Limits from inventory-service StoreItemService.StoreItemForm / StoreItemUpdateForm (salePrice ≥ 0, purchaseLimitQty ≥ 1).
export function getStoreItemSchema(t: T, creating: boolean) {
  return z.object({
    itemId: creating ? z.string().min(1, t("inventory.storeItem.v.item")) : z.string(),
    salePrice: z.string().trim().min(1, t("purchase.v.required")).refine((v) => num(v) >= 0, t("inventory.v.amount")),
    status: z.enum(["ON_SALE", "SUSPENDED"]),
    purchaseLimitQty: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), t("inventory.storeItem.v.limit")),
  })
}
export type TStoreItemSchema = z.infer<ReturnType<typeof getStoreItemSchema>>
