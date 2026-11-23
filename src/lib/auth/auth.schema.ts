import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"

type T = (key: TranslationKey, params?: Record<string, string | number>) => string

// Limits follow the IAM forms (LoginForm, RegisterForm, ResetPasswordForm, PasswordForm, ProfileForm).
const required = (t: T, max: number) => z.string().trim().min(1, t("common.required")).max(max)
const email = (t: T, max = 255) => required(t, max).pipe(z.email(t("common.invalidEmail")))
const newPassword = (t: T, min: number) => z.string().min(min, t("common.minLength", { n: min })).max(128)

export const getLoginSchema = (t: T) =>
  z.object({
    // The login name: an email for company users; the platform super admin logs in with a username.
    username: required(t, 100),
    password: z.string().min(1, t("common.required")).max(128),
    remember: z.boolean(),
  })
export type TLoginSchema = z.infer<ReturnType<typeof getLoginSchema>>

const withConfirm = <S extends z.ZodObject<{ newPassword: z.ZodString; confirmPassword: z.ZodString }>>(t: T, s: S) =>
  s.refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: t("common.passwordsDiffer") })

export const getInitialPasswordSchema = (t: T) =>
  withConfirm(t, z.object({ newPassword: newPassword(t, 8), confirmPassword: z.string().min(1, t("common.required")) }))
export type TInitialPasswordSchema = z.infer<ReturnType<typeof getInitialPasswordSchema>>

export const getRegisterSchema = (t: T) =>
  z
    .object({
      name: required(t, 255),
      email: email(t, 100),
      companyName: z.string().trim().max(255),
      // RegisterForm.referralCode ≤20; an unknown code is refused by the backend (SAAS_026)
      referralCode: z.string().trim().max(20, t("common.maxLength", { n: 20 })),
      password: newPassword(t, 8),
      confirmPassword: z.string().min(1, t("common.required")),
    })
    .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: t("common.passwordsDiffer") })
export type TRegisterSchema = z.infer<ReturnType<typeof getRegisterSchema>>

export const getForgotPasswordSchema = (t: T) => z.object({ email: email(t) })
export type TForgotPasswordSchema = z.infer<ReturnType<typeof getForgotPasswordSchema>>

// The emailed-link reset requires 10 characters (ResetPasswordForm), unlike the 8 of the other forms.
export const getResetPasswordSchema = (t: T) =>
  withConfirm(t, z.object({ newPassword: newPassword(t, 10), confirmPassword: z.string().min(1, t("common.required")) }))
export type TResetPasswordSchema = z.infer<ReturnType<typeof getResetPasswordSchema>>

export const getProfileSchema = (t: T) =>
  z.object({
    fullName: required(t, 255),
    email: email(t),
    mobile: z
      .string()
      .trim()
      .max(30)
      .regex(/^$|^[0-9+()\-. ]{3,30}$/, t("profile.mobileInvalid")),
  })
export type TProfileSchema = z.infer<ReturnType<typeof getProfileSchema>>

export const getChangePasswordSchema = (t: T) =>
  withConfirm(
    t,
    z.object({
      currentPassword: z.string().min(1, t("common.required")).max(128),
      newPassword: newPassword(t, 8),
      confirmPassword: z.string().min(1, t("common.required")),
    })
  )
export type TChangePasswordSchema = z.infer<ReturnType<typeof getChangePasswordSchema>>
