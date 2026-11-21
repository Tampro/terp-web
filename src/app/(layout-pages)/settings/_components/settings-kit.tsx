"use client"

import * as React from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"

/**
 * Loads one settings block, keeps an editable copy, saves it with PUT (each block is a full replacement).
 * `toForm` maps the GET view to the PUT body when they differ.
 */
export function useSettingsBlock<V, F = V>(load: () => Promise<V>, save: (f: F) => Promise<unknown>, toForm: (v: V) => F) {
  const t = useT()
  const [form, setForm] = React.useState<F>()
  const [error, setError] = React.useState<string>()
  const [saving, setSaving] = React.useState(false)
  const [loadKey, setLoadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    load()
      .then((v) => !cancelled && setForm(toForm(v)))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
    // load/save/toForm are module-level service calls: stable for the page's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey])

  const patch = (p: Partial<F>) => setForm((f) => (f ? { ...f, ...p } : f))

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      await save(form)
      toast.success(t("common.saved"))
      setLoadKey((k) => k + 1) // reload what the backend stored (normalised values, secrets masked)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return { form, patch, error, saving, submit }
}

export function SettingsCard({
  title,
  description,
  error,
  loading,
  saving,
  onSubmit,
  children,
  footerExtra,
}: {
  title: string
  description?: string
  error?: string
  loading: boolean
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  children: React.ReactNode
  footerExtra?: React.ReactNode
}) {
  const t = useT()
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4 pb-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {loading && !error ? (
            <div className="grid gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          ) : (
            !error && children
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2 border-t pt-6">
          {footerExtra}
          <Button type="submit" disabled={loading || saving || !!error}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function FieldRow({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

export function SelectRow<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: V | undefined
  options: { value: V; label: string }[]
  onChange: (v: V) => void
}) {
  return (
    <FieldRow id={id} label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as V)}>
        <SelectTrigger id={id} className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  )
}
