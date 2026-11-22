import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"
import { toNumber as num } from "@/lib/sales/sales.schema"

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Limits from commerce-service PurchaseInvoiceService.InvoiceForm / LineForm, inventory-service WarehouseForm and
// TransferForm; number inputs are strings.

export function getPurchaseInvoiceSchema(t: T) {
  const line = z
    .object({ itemId: z.string().min(1, t("sales.v.item")), quantity: z.string(), unitPrice: z.string(), discountPct: z.string() })
    .superRefine((l, ctx) => {
      if (!(num(l.quantity) > 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: t("sales.v.quantity") })
      if (l.unitPrice.trim() !== "" && !(num(l.unitPrice) >= 0))
        ctx.addIssue({ code: "custom", path: ["unitPrice"], message: t("sales.v.price") })
      const d = l.discountPct.trim() === "" ? 0 : num(l.discountPct)
      if (!(d >= 0 && d <= 100)) ctx.addIssue({ code: "custom", path: ["discountPct"], message: t("sales.v.discount") })
    })
  return z
    .object({
      vendorId: z.string().min(1, t("purchase.v.vendor")),
      warehouseId: z.string(),
      invoiceDate: z.string().min(1, t("sales.v.date")),
      dueDate: z.string().min(1, t("sales.v.date")),
      paymentTerms: z.string().max(100, t("sales.v.max", { n: 100 })),
      notes: z.string().max(5000, t("sales.v.max", { n: 5000 })),
      lines: z.array(line).min(1, t("sales.v.lines")).max(200, t("sales.v.linesMax")),
    })
    .refine((v) => !v.invoiceDate || !v.dueDate || v.dueDate >= v.invoiceDate, {
      path: ["dueDate"],
      message: t("sales.v.dueBeforeDate"), // PUR_004
    })
}
export type TPurchaseInvoiceSchema = z.infer<ReturnType<typeof getPurchaseInvoiceSchema>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function getWarehouseSchema(t: T) {
  const req = (n: number) => z.string().trim().min(1, t("purchase.v.required")).max(n, t("sales.v.max", { n }))
  return z.object({
    name: req(255),
    address: req(500),
    city: req(100),
    zipCode: req(20),
    phone: z.string().max(30, t("sales.v.max", { n: 30 })),
    email: z
      .string()
      .max(255, t("sales.v.max", { n: 255 }))
      .refine((v) => v.trim() === "" || EMAIL.test(v.trim()), t("purchase.v.email")),
    active: z.boolean(),
  })
}
export type TWarehouseSchema = z.infer<ReturnType<typeof getWarehouseSchema>>

export function getTransferSchema(t: T) {
  return z
    .object({
      fromWarehouseId: z.string().min(1, t("purchase.v.warehouse")),
      toWarehouseId: z.string().min(1, t("purchase.v.warehouse")),
      itemId: z.string().min(1, t("sales.v.item")),
      available: z.number(),
      quantity: z.string(),
      transferDate: z.string().min(1, t("sales.v.date")),
    })
    .superRefine((v, ctx) => {
      if (v.fromWarehouseId && v.fromWarehouseId === v.toWarehouseId)
        ctx.addIssue({ code: "custom", path: ["toWarehouseId"], message: t("purchase.v.sameWarehouse") }) // INV_022
      const q = num(v.quantity)
      if (!(q > 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: t("sales.v.quantity") })
      else if (v.itemId && q > v.available)
        ctx.addIssue({ code: "custom", path: ["quantity"], message: t("purchase.v.notEnough", { n: v.available }) }) // INV_017
    })
}
export type TTransferSchema = z.infer<ReturnType<typeof getTransferSchema>>
