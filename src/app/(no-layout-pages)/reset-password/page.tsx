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
import { Label } from "@/components/ui/label"
import { getResetPasswordSchema, type TResetPasswordSchema } from "@/lib/auth/auth.schema"
import { AuthService } from "@/lib/auth/auth.service"
import { useT } from "@/lib/i18n"

/** Opened from the emailed link `/reset-password?token=…` (valid 30 minutes, once). */
export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetPasswordForm />
    </React.Suspense>
  )
}

function ResetPasswordForm() {
  const t = useT()
  const token = useSearchParams().get("token") ?? ""
  const [error, setError] = React.useState<string>()
  const [done, setDone] = React.useState(false)

  const form = useForm<TResetPasswordSchema>({
    resolver: zodResolver(getResetPasswordSchema(t)),
    mode: "all",
    defaultValues: { newPassword: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TResetPasswordSchema) {
    setError(undefined)
    try {
      await AuthService.resetPassword(token, v.newPassword)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AuthShell title={t("reset.title")} subtitle={t("reset.subtitle")}>
      {!token ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("reset.noToken")}{" "}
            <Link href="/forgot-password" className="font-medium underline">
              {t("forgot.title")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : done ? (
        <Alert>
          <AlertDescription>{t("reset.done")}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <PasswordInput id="newPassword" autoComplete="new-password" autoFocus {...form.register("newPassword")} />
            <FieldError message={errors.newPassword?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
            <FieldError message={errors.confirmPassword?.message} />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
            {t("reset.submit")}
          </Button>
        </form>
      )}
      <Link href="/login" className="text-primary mt-4 block text-center text-sm font-medium hover:underline">
        {t("common.backToLogin")}
      </Link>
    </AuthShell>
  )
}
