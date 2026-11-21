"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { AuthService } from "@/lib/auth/auth.service"
import { useT } from "@/lib/i18n"

/** Opened from the emailed link `/verify-email?token=…` (one-time). */
export default function VerifyEmailPage() {
  return (
    <React.Suspense>
      <VerifyEmail />
    </React.Suspense>
  )
}

function VerifyEmail() {
  const t = useT()
  const token = useSearchParams().get("token") ?? ""
  const [state, setState] = React.useState<{ status: "checking" | "done" | "error"; message?: string }>({
    status: "checking",
  })
  const called = React.useRef(false) // the token is single-use: never send it twice (React strict mode)

  React.useEffect(() => {
    if (!token || called.current) return
    called.current = true
    AuthService.verifyEmail(token)
      .then(() => setState({ status: "done" }))
      .catch((e: Error) => setState({ status: "error", message: e.message }))
  }, [token])

  return (
    <AuthShell title={t("verify.title")}>
      {!token ? (
        <Alert variant="destructive">
          <AlertDescription>{t("verify.noToken")}</AlertDescription>
        </Alert>
      ) : state.status === "checking" ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> {t("verify.checking")}
        </div>
      ) : (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <AlertDescription>{state.status === "done" ? t("verify.done") : state.message}</AlertDescription>
        </Alert>
      )}
      <Link href="/login" className="text-primary mt-4 block text-center text-sm font-medium hover:underline">
        {t("common.backToLogin")}
      </Link>
    </AuthShell>
  )
}
