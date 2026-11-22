import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Limits from commerce-service SalesDtos.DocumentForm / LineForm and SalesReturn ReturnForm; number inputs are strings.
const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")))

export function getDocumentSchema(t: T) {
  const line = z
    .object({
      itemId: z.string().min(1, t("sales.v.item")),
      quantity: z.string(),
      unitPrice: z.string(),
      discountPct: z.string(),
    })
    .superRefine((l, ctx) => {
      const q = num(l.quantity)
      if (!(q > 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: t("sales.v.quantity") })
      if (l.unitPrice.trim() !== "" && !(num(l.unitPrice) >= 0))
        ctx.addIssue({ code: "custom", path: ["unitPrice"], message: t("sales.v.price") })
      const d = l.discountPct.trim() === "" ? 0 : num(l.discountPct)
      if (!(d >= 0 && d <= 100)) ctx.addIssue({ code: "custom", path: ["discountPct"], message: t("sales.v.discount") })
    })
  return z
    .object({
      customerId: z.string().min(1, t("sales.v.customer")),
      warehouseId: z.string(),
      invoiceType: z.enum(["PRODUCT", "SERVICE"]),
      docDate: z.string().min(1, t("sales.v.date")),
      dueDate: z.string().min(1, t("sales.v.date")),
      paymentTerms: z.string().max(100, t("sales.v.max", { n: 100 })),
      notes: z.string().max(5000, t("sales.v.max", { n: 5000 })),
      lines: z.array(line).min(1, t("sales.v.lines")).max(200, t("sales.v.linesMax")),
    })
    .refine((v) => !v.docDate || !v.dueDate || v.dueDate >= v.docDate, {
      path: ["dueDate"],
      message: t("sales.v.dueBeforeDate"), // SAL_007
    })
}
export type TDocumentSchema = z.infer<ReturnType<typeof getDocumentSchema>>

export function getReturnSchema(t: T) {
  return z.object({
    invoiceId: z.string().min(1, t("sales.v.invoice")),
    warehouseId: z.string(),
    returnDate: z.string().min(1, t("sales.v.date")),
    reason: z.string().max(255, t("sales.v.max", { n: 255 })),
    notes: z.string().max(5000, t("sales.v.max", { n: 5000 })),
    lines: z
      .array(
        z
          .object({ invoiceLineId: z.string(), returnable: z.number(), quantity: z.string(), reason: z.string().max(255) })
          .superRefine((l, ctx) => {
            if (l.quantity.trim() === "") return
            const q = num(l.quantity)
            if (!(q >= 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: t("sales.v.quantity") })
            else if (q > l.returnable)
              ctx.addIssue({ code: "custom", path: ["quantity"], message: t("sales.v.returnMax", { n: l.returnable }) }) // SAL_011
          })
      )
      .refine((ls) => ls.some((l) => num(l.quantity) > 0), t("sales.v.returnLines")),
  })
}
export type TReturnSchema = z.infer<ReturnType<typeof getReturnSchema>>

export const toNumber = num
