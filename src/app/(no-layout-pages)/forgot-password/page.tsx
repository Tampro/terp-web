"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { Mail } from "lucide-react"
import { useForm } from "react-hook-form"

import { AuthShell } from "@/components/auth/auth-shell"
import { FieldError } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getForgotPasswordSchema, type TForgotPasswordSchema } from "@/lib/auth/auth.schema"
import { AuthService } from "@/lib/auth/auth.service"
import { useT } from "@/lib/i18n"

/** The backend always answers 200 (no account enumeration), so the same message shows either way. */
export default function ForgotPasswordPage() {
  const t = useT()
  const [error, setError] = React.useState<string>()
  const [sent, setSent] = React.useState(false)

  const form = useForm<TForgotPasswordSchema>({
    resolver: zodResolver(getForgotPasswordSchema(t)),
    mode: "all",
    defaultValues: { email: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TForgotPasswordSchema) {
    setError(undefined)
    try {
      await AuthService.forgotPassword(v.email)
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AuthShell title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {sent && (
          <Alert>
            <AlertDescription>{t("forgot.sent")}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t("common.email")}</Label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("login.emailPlaceholder")}
              className="h-10 pl-9"
              autoFocus
              {...form.register("email")}
            />
          </div>
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {t("forgot.submit")}
        </Button>
        <Link href="/login" className="text-primary text-center text-sm font-medium hover:underline">
          {t("common.backToLogin")}
        </Link>
      </form>
    </AuthShell>
  )
}
