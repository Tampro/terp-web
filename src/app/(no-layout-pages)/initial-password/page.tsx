"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { AuthShell } from "@/components/auth/auth-shell"
import { FieldError, PasswordInput } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { getInitialPasswordSchema, type TInitialPasswordSchema } from "@/lib/auth/auth.schema"
import { AuthService } from "@/lib/auth/auth.service"
import { pendingLogin, safeRedirect } from "@/lib/auth/pending-login"
import { useT } from "@/lib/i18n"

export default function InitialPasswordPage() {
  return (
    <React.Suspense>
      <InitialPasswordForm />
    </React.Suspense>
  )
}

function InitialPasswordForm() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = React.useState<string>()
  // Read once: pendingLogin is cleared on success, and a later re-render must not bounce to /login.
  const [pending] = React.useState(() => pendingLogin.get())

  React.useEffect(() => {
    if (!pending) router.replace("/login")
  }, [pending, router])

  const form = useForm<TInitialPasswordSchema>({
    resolver: zodResolver(getInitialPasswordSchema(t)),
    mode: "all",
    defaultValues: { newPassword: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: TInitialPasswordSchema) {
    if (!pending) return
    setError(undefined)
    try {
      await AuthService.initialPassword(
        { username: pending.username, currentPassword: pending.password, newPassword: values.newPassword },
        pending.remember
      )
      pendingLogin.clear()
      router.replace(safeRedirect(params.get("redirect")))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AuthShell title={t("initial.title")} subtitle={t("initial.subtitle")}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="newPassword">{t("initial.newPassword")}</Label>
          <PasswordInput id="newPassword" autoComplete="new-password" autoFocus {...form.register("newPassword")} />
          <FieldError message={errors.newPassword?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
          <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting || !pending}>
          {t("initial.submit")}
        </Button>
        <Link href="/login" className="text-primary text-center text-sm font-medium hover:underline">
          {t("common.backToLogin")}
        </Link>
      </form>
    </AuthShell>
  )
}
