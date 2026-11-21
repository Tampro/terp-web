"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Mail } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { AuthShell } from "@/components/auth/auth-shell"
import { FieldError, PasswordInput } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePublicSettings } from "@/hooks/use-public-settings"
import { ApiError } from "@/lib/api"
import { getLoginSchema, type TLoginSchema } from "@/lib/auth/auth.schema"
import { AuthService } from "@/lib/auth/auth.service"
import { pendingLogin, safeRedirect } from "@/lib/auth/pending-login"
import { useT } from "@/lib/i18n"

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  )
}

function LoginForm() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const settings = usePublicSettings()
  const [error, setError] = React.useState<ApiError>()
  const [info, setInfo] = React.useState<string>()

  const form = useForm<TLoginSchema>({
    resolver: zodResolver(getLoginSchema(t)),
    // Not "all": the email field is autofocused, and a blur error inserted above "Forgot password?" moved the link
    // mid-click, so the click did nothing (E2E PWD-001). Validate on submit, then re-validate while typing.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { username: "", password: "", remember: true },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: TLoginSchema) {
    setError(undefined)
    setInfo(undefined)
    try {
      await AuthService.login({ username: values.username.trim(), password: values.password }, values.remember)
      router.replace(safeRedirect(params.get("redirect")))
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, undefined, String(e))
      if (err.code === "AUTH_004") {
        // Temporary password: replace it first (POST /auth/initial-password), then the user is logged in.
        pendingLogin.set({ username: values.username.trim(), password: values.password, remember: values.remember })
        router.push(`/initial-password${params.get("redirect") ? `?redirect=${encodeURIComponent(params.get("redirect")!)}` : ""}`)
        return
      }
      setError(err)
    }
  }

  async function resendVerification() {
    const email = form.getValues("username").trim()
    await AuthService.resendVerification(email).catch(() => undefined)
    setError(undefined)
    setInfo(t("login.resent"))
  }

  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message}
              {error.code === "AUTH_016" && (
                <button type="button" onClick={resendVerification} className="mt-1 block font-medium underline">
                  {t("login.resend")}
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="username">{t("common.email")}</Label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="username"
              autoComplete="username"
              placeholder={t("login.emailPlaceholder")}
              className="h-10 pl-9"
              aria-invalid={!!errors.username}
              autoFocus
              {...form.register("username")}
            />
          </div>
          <FieldError message={errors.username?.message} />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Link href="/forgot-password" className="text-primary text-xs font-medium hover:underline">
              {t("login.forgot")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={t("login.passwordPlaceholder")}
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>

        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              {t("login.remember")}
            </label>
          )}
        />

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>

      {settings?.system?.userRegistration && (
        <p className="text-muted-foreground mt-6 text-center text-sm">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            {t("login.register")}
          </Link>
        </p>
      )}
    </AuthShell>
  )
}
