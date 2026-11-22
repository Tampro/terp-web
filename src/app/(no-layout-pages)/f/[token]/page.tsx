"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

import { FieldError } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { FormService, type FieldDto, type PublicFormDto } from "@/lib/project/project.service"

type Value = string | string[]
const INPUT_TYPE: Partial<Record<NonNullable<FieldDto["type"]>, string>> = {
  TEXT: "text",
  EMAIL: "email",
  NUMBER: "number",
  PHONE: "tel",
  URL: "url",
  PASSWORD: "password",
  DATE: "date",
  TIME: "time",
}

/**
 * §11.2 public form at /f/{token}, no sign-in (GET / POST /public/forms/{token}). Required fields are checked here;
 * the backend checks types and options (FRM_004..FRM_013) and its message is shown.
 */
export default function PublicFormPage() {
  const { token } = useParams<{ token: string }>()
  const t = useT()
  const [form, setForm] = React.useState<PublicFormDto>()
  const [error, setError] = React.useState<string>()
  const [values, setValues] = React.useState<Record<string, Value>>({})
  const [missing, setMissing] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string>()

  React.useEffect(() => {
    let cancelled = false
    FormService.publicGet(token)
      .then((f) => !cancelled && setForm(f))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [token])

  const set = (key: string, v: Value) => setValues((x) => ({ ...x, [key]: v }))
  const empty = (v?: Value) => (Array.isArray(v) ? v.length === 0 : !v?.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const miss = (form?.fields ?? []).filter((f) => f.required && empty(values[f.key ?? ""])).map((f) => f.key ?? "")
    setMissing(miss)
    if (miss.length) return
    const answers: Record<string, unknown> = {}
    for (const f of form?.fields ?? []) {
      const v = values[f.key ?? ""]
      if (!empty(v)) answers[f.key ?? ""] = Array.isArray(v) ? v : v!.trim()
    }
    setBusy(true)
    setSubmitError(undefined)
    try {
      await FormService.publicSubmit(token, answers)
      setSent(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const control = (f: FieldDto) => {
    const key = f.key ?? ""
    const id = `pf-${key}`
    const v = values[key]
    switch (f.type) {
      case "TEXTAREA":
        return <Textarea id={id} rows={4} placeholder={f.placeholder ?? undefined} value={(v as string) ?? ""} onChange={(e) => set(key, e.target.value)} />
      case "SELECT":
        return (
          <Select value={(v as string) ?? ""} onValueChange={(x) => set(key, x)}>
            <SelectTrigger id={id} className="w-full" aria-label={f.label}>
              <SelectValue placeholder={f.placeholder || t("sales.choose")} />
            </SelectTrigger>
            <SelectContent>
              {(f.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case "RADIO":
        return (
          <RadioGroup value={(v as string) ?? ""} onValueChange={(x) => set(key, x)} aria-label={f.label}>
            {(f.options ?? []).map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={o} /> {o}
              </label>
            ))}
          </RadioGroup>
        )
      case "CHECKBOX": {
        const list = (v as string[]) ?? []
        return (
          <div className="grid gap-1.5" role="group" aria-label={f.label}>
            {(f.options ?? []).map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <Checkbox checked={list.includes(o)} onCheckedChange={(c) => set(key, c === true ? [...list, o] : list.filter((x) => x !== o))} /> {o}
              </label>
            ))}
          </div>
        )
      }
      default:
        return <Input id={id} type={INPUT_TYPE[f.type ?? "TEXT"] ?? "text"} placeholder={f.placeholder ?? undefined} value={(v as string) ?? ""} onChange={(e) => set(key, e.target.value)} />
    }
  }

  const grid = form?.layout === "TWO_COLUMN" ? "sm:grid-cols-2" : ""
  return (
    <main className="bg-muted/30 flex min-h-screen items-start justify-center p-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">{form?.name ?? (error ? t("form.public.unavailable") : "…")}</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !form ? (
            <Skeleton className="h-48 w-full" />
          ) : sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="text-primary size-10" />
              <p className="font-medium">{t("form.public.thanks")}</p>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={submit} noValidate>
              <div className={`grid gap-4 ${grid}`}>
                {(form.fields ?? []).map((f) => (
                  <div key={f.key} className={`grid gap-1.5 ${form.layout === "CARD" ? "rounded-md border p-3" : ""} ${f.type === "TEXTAREA" && grid ? "sm:col-span-2" : ""}`}>
                    <Label htmlFor={`pf-${f.key}`}>
                      {f.label}
                      {f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {control(f)}
                    <FieldError message={missing.includes(f.key ?? "") ? t("form.v.answerRequired") : undefined} />
                  </div>
                ))}
              </div>
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Button type="submit" disabled={busy}>
                  {t("form.public.submit")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
