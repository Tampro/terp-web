import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Limits from crm-service LeadForm, DealForm, ConvertForm, TaskForm, CallForm, ContractForm, RenewalForm; number inputs
// are strings.
const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")))
export const toNumber = num
const max = (t: T, n: number) => z.string().max(n, t("crm.v.max", { n }))
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getLeadSchema(t: T) {
  return z.object({
    pipelineId: z.string().min(1, t("crm.v.pipeline")),
    stageId: z.string(),
    name: max(t, 255).trim().min(1, t("crm.v.required")),
    email: max(t, 255).trim().regex(EMAIL, t("crm.v.email")),
    subject: max(t, 255).trim().min(1, t("crm.v.required")),
    ownerUserId: z.string().min(1, t("crm.v.owner")),
    phone: max(t, 30),
    followUpDate: z.string(),
    notes: max(t, 20000),
  })
}
export type TLeadSchema = z.infer<ReturnType<typeof getLeadSchema>>

export function getDealSchema(t: T) {
  return z.object({
    pipelineId: z.string().min(1, t("crm.v.pipeline")),
    stageId: z.string(),
    name: max(t, 255).trim().min(1, t("crm.v.required")),
    price: z.string().refine((v) => num(v) >= 0, t("crm.v.amount")),
    phone: max(t, 30),
    clientIds: z.array(z.string()),
    notes: max(t, 20000),
  })
}
export type TDealSchema = z.infer<ReturnType<typeof getDealSchema>>

export function getConvertSchema(t: T) {
  return z
    .object({
      dealName: max(t, 255),
      price: z.string().refine((v) => v.trim() === "" || num(v) >= 0, t("crm.v.amount")),
      clientMode: z.enum(["existing", "new"]),
      customerId: z.string(),
      companyName: max(t, 255),
      contactPerson: max(t, 255),
      email: max(t, 255).refine((v) => v.trim() === "" || EMAIL.test(v.trim()), t("crm.v.email")),
      mobile: max(t, 30),
      copy: z.array(z.string()),
    })
    .superRefine((v, ctx) => {
      // CRM_018: an existing client or the new client's name
      if (v.clientMode === "existing" && !v.customerId)
        ctx.addIssue({ code: "custom", path: ["customerId"], message: t("crm.v.client") })
      if (v.clientMode === "new" && !v.companyName.trim())
        ctx.addIssue({ code: "custom", path: ["companyName"], message: t("crm.v.required") })
    })
}
export type TConvertSchema = z.infer<ReturnType<typeof getConvertSchema>>

export function getTaskSchema(t: T) {
  return z.object({
    name: max(t, 255).trim().min(1, t("crm.v.required")),
    date: z.string().min(1, t("crm.v.date")),
    time: z.string(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    status: z.enum(["OPEN", "DONE"]),
  })
}
export type TTaskSchema = z.infer<ReturnType<typeof getTaskSchema>>

export function getCallSchema(t: T) {
  return z.object({
    subject: max(t, 255).trim().min(1, t("crm.v.required")),
    callType: z.enum(["INBOUND", "OUTBOUND"]),
    duration: max(t, 20),
    assigneeUserId: z.string(),
    description: max(t, 5000),
    callResult: max(t, 5000),
  })
}
export type TCallSchema = z.infer<ReturnType<typeof getCallSchema>>

export function getEmailSchema(t: T) {
  return z.object({
    to: max(t, 255).trim().regex(EMAIL, t("crm.v.email")),
    subject: max(t, 255).trim().min(1, t("crm.v.required")),
    body: max(t, 20000).trim().min(1, t("crm.v.required")),
  })
}
export type TEmailSchema = z.infer<ReturnType<typeof getEmailSchema>>

const STATUS = z.enum(["PENDING", "ACTIVE", "CLOSED", "DECLINED"])
const endAfterStart = <V extends { startDate: string; endDate: string }>(v: V) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate

export function getContractSchema(t: T) {
  return z
    .object({
      subject: max(t, 255).trim().min(1, t("crm.v.required")),
      customerId: z.string().min(1, t("crm.v.client")),
      contractTypeId: z.string().min(1, t("crm.v.contractType")),
      value: z.string().refine((v) => v.trim() === "" || num(v) >= 0, t("crm.v.amount")),
      startDate: z.string().min(1, t("crm.v.date")),
      endDate: z.string().min(1, t("crm.v.date")),
      status: STATUS,
      description: max(t, 1_000_000),
    })
    .refine(endAfterStart, { path: ["endDate"], message: t("crm.v.endBeforeStart") }) // CTR_006
}
export type TContractSchema = z.infer<ReturnType<typeof getContractSchema>>

export function getRenewalSchema(t: T) {
  return z
    .object({
      startDate: z.string().min(1, t("crm.v.date")),
      endDate: z.string().min(1, t("crm.v.date")),
      value: z.string().refine((v) => num(v) >= 0, t("crm.v.amount")),
      status: STATUS,
      notes: max(t, 5000),
    })
    .refine(endAfterStart, { path: ["endDate"], message: t("crm.v.endBeforeStart") })
}
export type TRenewalSchema = z.infer<ReturnType<typeof getRenewalSchema>>
