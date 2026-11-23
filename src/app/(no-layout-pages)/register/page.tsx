"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { AuthShell } from "@/components/auth/auth-shell"
import { FieldError, PasswordInput } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePublicSettings } from "@/hooks/use-public-settings"
import { getRegisterSchema, type TRegisterSchema } from "@/lib/auth/auth.schema"
import { AuthService } from "@/lib/auth/auth.service"
import { useT } from "@/lib/i18n"

export default function RegisterPage() {
  return (
    <React.Suspense>
      <Register />
    </React.Suspense>
  )
}

/**
 * Shown only when System Settings → User Registration is on (the backend answers AUTH_015 otherwise). A referral link
 * /register?ref=CODE fills in the referral code (the referring company earns a commission on this company's orders).
 */
function Register() {
  const t = useT()
  const ref = (useSearchParams().get("ref") ?? "").trim().slice(0, 20).toUpperCase()
  const settings = usePublicSettings()
  const [error, setError] = React.useState<string>()
  const [doneEmail, setDoneEmail] = React.useState<string>()

  const form = useForm<TRegisterSchema>({
    resolver: zodResolver(getRegisterSchema(t)),
    mode: "all",
    defaultValues: { name: "", email: "", companyName: "", referralCode: ref, password: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TRegisterSchema) {
    setError(undefined)
    try {
      await AuthService.register({
        name: v.name,
        email: v.email,
        password: v.password,
        confirmPassword: v.confirmPassword,
        companyName: v.companyName || undefined,
        referralCode: v.referralCode ? v.referralCode.toUpperCase() : undefined,
      })
      setDoneEmail(v.email)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const disabled = settings !== undefined && !settings.system?.userRegistration

  return (
    <AuthShell title={t("register.title")} subtitle={t("register.subtitle")}>
      {disabled ? (
        <Alert>
          <AlertDescription>{t("register.disabled")}</AlertDescription>
        </Alert>
      ) : doneEmail ? (
        <Alert>
          <AlertDescription>
            {t("register.done")}{" "}
            {settings?.system?.emailVerification && t("register.checkEmail", { email: doneEmail })}
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input id="name" className="h-10" autoComplete="name" autoFocus {...form.register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" type="email" className="h-10" autoComplete="email" {...form.register("email")} />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="companyName">{t("register.companyName")}</Label>
            <Input id="companyName" className="h-10" autoComplete="organization" {...form.register("companyName")} />
            <p className="text-muted-foreground text-xs">{t("register.companyHint")}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="referralCode">{t("register.referralCode")}</Label>
            <Input id="referralCode" className="h-10 uppercase" maxLength={20} autoComplete="off" placeholder="REF000000" {...form.register("referralCode")} />
            <p className="text-muted-foreground text-xs">{t("register.referralHint")}</p>
            <FieldError message={errors.referralCode?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">{t("common.password")}</Label>
            <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
            <FieldError message={errors.password?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
            <FieldError message={errors.confirmPassword?.message} />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
            {t("register.submit")}
          </Button>
        </form>
      )}
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          {t("register.login")}
        </Link>
      </p>
    </AuthShell>
  )
}
