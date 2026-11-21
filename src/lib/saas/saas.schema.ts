import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"

type T = (key: TranslationKey, params?: Record<string, string | number>) => string

// Limits copied from PlanForm / CouponForm (SaasDtos, CouponDtos). Number inputs arrive as strings: "" = not set
// (the backend reads an omitted limit as unlimited).

const optionalNumber = (t: T, min: number, int = false) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && (!int || Number.isInteger(Number(v)))), {
      message: int ? t("saas.intMin", { n: min }) : t("saas.numberMin", { n: min }),
    })

const requiredNumber = (t: T, min: number) =>
  z
    .string()
    .trim()
    .min(1, t("common.required"))
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= min, { message: t("saas.numberMin", { n: min }) })

export const toNumberOrNull = (v: string) => (v.trim() === "" ? null : Number(v))

export const getPlanSchema = (t: T) =>
  z.object({
    code: z.string().trim().min(1, t("common.required")).max(50, t("common.maxLength", { n: 50 })),
    name: z.string().trim().min(1, t("common.required")).max(100, t("common.maxLength", { n: 100 })),
    description: z.string().trim().max(255, t("common.maxLength", { n: 255 })),
    monthlyPrice: requiredNumber(t, 0),
    yearlyPrice: optionalNumber(t, 0),
    maxUsers: optionalNumber(t, 1, true),
    maxEmployees: optionalNumber(t, 1, true),
    storageLimitGb: optionalNumber(t, 0),
    trialDays: optionalNumber(t, 0, true),
    aiIntegration: z.boolean(),
    defaultPlan: z.boolean(),
    enabled: z.boolean(),
    recommended: z.boolean(),
    modules: z.array(z.string()),
  })
export type TPlanSchema = z.infer<ReturnType<typeof getPlanSchema>>

export const getCouponSchema = (t: T) =>
  z
    .object({
      name: z.string().trim().min(1, t("common.required")).max(100, t("common.maxLength", { n: 100 })),
      type: z.enum(["PERCENTAGE", "FLAT"]),
      discountValue: requiredNumber(t, 0),
      codeGeneration: z.enum(["MANUAL", "AUTO"]),
      code: z.string().trim().max(50, t("common.maxLength", { n: 50 })),
      minimumSpend: optionalNumber(t, 0),
      maximumSpend: optionalNumber(t, 0),
      useLimitTotal: optionalNumber(t, 1, true),
      useLimitPerCompany: optionalNumber(t, 1, true),
      expiryDate: z.string(),
      enabled: z.boolean(),
      description: z.string().trim().max(500, t("common.maxLength", { n: 500 })),
    })
    // Same rules the backend answers with SAAS_021 / SAAS_012 / SAAS_020.
    .refine((v) => v.codeGeneration === "AUTO" || v.code.length > 0, { path: ["code"], message: t("common.required") })
    .refine((v) => v.type !== "PERCENTAGE" || Number(v.discountValue) <= 100, {
      path: ["discountValue"],
      message: t("coupons.percentMax"),
    })
    .refine((v) => v.minimumSpend === "" || v.maximumSpend === "" || Number(v.minimumSpend) <= Number(v.maximumSpend), {
      path: ["maximumSpend"],
      message: t("coupons.minAboveMax"),
    })
export type TCouponSchema = z.infer<ReturnType<typeof getCouponSchema>>
