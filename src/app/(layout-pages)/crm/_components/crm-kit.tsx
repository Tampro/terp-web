"use client"

import * as React from "react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EContractStatus, EDealStatus, PipelineDto } from "@/lib/crm/crm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))
export const today = () => new Date().toLocaleDateString("en-CA") // yyyy-MM-dd, local

/** Runs an API call, toasts the backend message on failure; returns whether it succeeded. */
export async function attempt(fn: () => Promise<unknown>, success?: string) {
  try {
    await fn()
    if (success) toast.success(success)
    return true
  } catch (e) {
    toast.error(errorMessage(e))
    return false
  }
}

export function FormField({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

/** Pipeline selector of the lead / deal boards (manual §7.2 "pipeline selector"). */
export function PipelineSelect({
  pipelines,
  value,
  onChange,
}: {
  pipelines: PipelineDto[]
  value?: string
  onChange: (id: string) => void
}) {
  const t = useT()
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="w-52" aria-label={t("crm.pipeline")}>
        <SelectValue placeholder={t("crm.choosePipeline")} />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map((p) => (
          <SelectItem key={p.id} value={p.id ?? ""}>
            {p.name ?? "-"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** One-field dialog for a name (pipeline, stage, source, contract type prefix). */
export function NameDialog({
  open,
  title,
  label,
  initial,
  maxLength = 100,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  label: string
  initial?: string
  maxLength?: number
  onClose: () => void
  onSave: (name: string) => Promise<boolean>
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && <NameForm title={title} label={label} initial={initial} maxLength={maxLength} onClose={onClose} onSave={onSave} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  label,
  initial,
  maxLength,
  onClose,
  onSave,
  t,
}: {
  title: string
  label: string
  initial?: string
  maxLength: number
  onClose: () => void
  onSave: (name: string) => Promise<boolean>
  t: ReturnType<typeof useT>
}) {
  const [name, setName] = React.useState(initial ?? "")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const v = name.trim()
        if (!v) return setError(t("crm.v.required"))
        if (v.length > maxLength) return setError(t("crm.v.max", { n: maxLength }))
        setBusy(true)
        const ok = await onSave(v)
        setBusy(false)
        if (ok) onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
      </DialogHeader>
      <FormField id="crm-name" label={label} error={error}>
        <Input id="crm-name" value={name} autoFocus onChange={(e) => (setName(e.target.value), setError(undefined))} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={busy}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Checkbox list dialog for a link list (members, clients, labels, sources, products): saving replaces the list. */
export function PickDialog({
  open,
  title,
  options,
  selected,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  options: { value: string; label: string }[]
  selected: string[]
  onClose: () => void
  onSave: (ids: string[]) => Promise<boolean>
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && <PickForm title={title} options={options} selected={selected} onClose={onClose} onSave={onSave} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function PickForm({
  title,
  options,
  selected,
  onClose,
  onSave,
  t,
}: {
  title: string
  options: { value: string; label: string }[]
  selected: string[]
  onClose: () => void
  onSave: (ids: string[]) => Promise<boolean>
  t: ReturnType<typeof useT>
}) {
  const [ids, setIds] = React.useState<string[]>(selected)
  const [busy, setBusy] = React.useState(false)
  const toggle = (v: string, on: boolean) => setIds((xs) => (on ? [...xs, v] : xs.filter((x) => x !== v)))
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t("crm.pickDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid max-h-80 gap-2 overflow-y-auto">
        {options.length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noOptions")}</p>}
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <Checkbox checked={ids.includes(o.value)} onCheckedChange={(c) => toggle(o.value, c === true)} />
            {o.label}
          </label>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await onSave(ids)
            setBusy(false)
            if (ok) onClose()
          }}
        >
          {t("common.save")}
        </Button>
      </DialogFooter>
    </div>
  )
}

const DEAL_VARIANT: Record<EDealStatus, "default" | "secondary" | "destructive"> = {
  ACTIVE: "secondary",
  WON: "default",
  LOSS: "destructive",
}
export function DealStatusBadge({ status }: { status?: EDealStatus }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={DEAL_VARIANT[status]}>{t(`crm.dealStatus.${status}` as TranslationKey)}</Badge>
}

const CONTRACT_VARIANT: Record<EContractStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  ACTIVE: "default",
  CLOSED: "secondary",
  DECLINED: "destructive",
}
export function ContractStatusBadge({ status }: { status?: EContractStatus }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={CONTRACT_VARIANT[status]}>{t(`crm.contractStatus.${status}` as TranslationKey)}</Badge>
}

/** Coloured label chips (labels carry a CSS colour). */
export function LabelChips({ labels, colors }: { labels?: { refId?: string; name?: string }[]; colors?: Record<string, string> }) {
  if (!labels?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l.refId}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: colors?.[l.refId ?? ""] ?? "var(--muted-foreground)" }}
        >
          {l.name}
        </span>
      ))}
    </div>
  )
}
