import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"

type T = (key: TranslationKey, params?: Record<string, string | number>) => string

// Limits copied from the IAM records (CompanyDtos, SettingsDtos).
const required = (t: T, max: number) => z.string().trim().min(1, t("common.required")).max(max, t("common.maxLength", { n: max }))
const email = (t: T, max = 255) => required(t, max).pipe(z.email(t("common.invalidEmail")))

export const getCompanyCreateSchema = (t: T) =>
  z.object({
    code: required(t, 50).regex(/^[A-Z0-9_]+$/, t("companies.codeInvalid")),
    name: required(t, 255),
    email: email(t),
    enableLogin: z.boolean(),
    adminUsername: z
      .string()
      .trim()
      .min(3, t("common.minLength", { n: 3 }))
      .max(100, t("common.maxLength", { n: 100 }))
      .regex(/^[a-zA-Z0-9._-]+$/, t("companies.usernameInvalid")),
    adminEmail: email(t),
    adminFullName: required(t, 255),
  })
export type TCompanyCreateSchema = z.infer<ReturnType<typeof getCompanyCreateSchema>>

export const getCompanyUpdateSchema = (t: T) => z.object({ name: required(t, 255), email: email(t) })
export type TCompanyUpdateSchema = z.infer<ReturnType<typeof getCompanyUpdateSchema>>

// Company ResetPasswordForm: newPassword 10..128.
export const getCompanyPasswordSchema = (t: T) =>
  z
    .object({
      newPassword: z.string().min(10, t("common.minLength", { n: 10 })).max(128),
      confirmPassword: z.string().min(1, t("common.required")),
    })
    .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: t("common.passwordsDiffer") })
export type TCompanyPasswordSchema = z.infer<ReturnType<typeof getCompanyPasswordSchema>>

export const getEmailSettingsSchema = (t: T) =>
  z.object({
    host: required(t, 255),
    port: z.coerce.number<string>().int().min(1, t("settings.portInvalid")).max(65535, t("settings.portInvalid")),
    username: z.string().trim().max(255),
    password: z.string().max(255),
    encryption: z.enum(["NONE", "SSL", "TLS"]),
    fromAddress: email(t),
    fromName: z.string().trim().max(100),
  })
export type TEmailSettingsSchema = z.input<ReturnType<typeof getEmailSettingsSchema>>
