"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { LandingView } from "@/components/site/landing-view"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useT, type TranslationKey } from "@/lib/i18n"
import type { PlanDto } from "@/lib/saas/saas.service"
import { AdminPlanService } from "@/lib/saas/saas.service"
import { SECTION_SCHEMAS, str, type SiteField, type SiteList } from "@/lib/site/site.sections"
import { DISPLAY_KEYS, orderItems, SiteService, type Landing, type SectionContent, type SectionKey } from "@/lib/site/site.service"

import { errorMessage } from "../../hrm/_components/crud-kit"

const MAX_BYTES = 64 * 1024
const KEYS: SectionKey[] = ["general", "order", "advanced", ...DISPLAY_KEYS]
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

/**
 * §3.4 Landing Page Settings: one form per section (shapes in lib/site/site.sections.ts), each saved on its own with
 * PUT /landing/{key} (full replacement), and a live preview of the unsaved draft drawn by the public renderer.
 */
export function LandingEditor() {
  const t = useT()
  const [saved, setSaved] = React.useState<Landing>()
  const [draft, setDraft] = React.useState<Landing>({})
  const [key, setKey] = React.useState<SectionKey>("general")
  const [plans, setPlans] = React.useState<PlanDto[]>([])
  const [pages, setPages] = React.useState<{ title?: string; slug?: string }[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    SiteService.landing()
      .then((l) => {
        if (cancelled) return
        setSaved(l)
        setDraft(l)
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
    // preview only: enabled plans and published pages, as the public page shows them
    AdminPlanService.list()
      .then((p) => !cancelled && setPlans((p ?? []).filter((x) => x.enabled !== false)))
      .catch(() => undefined)
    SiteService.pages({ size: 50 })
      .then((p) => !cancelled && setPages((p.content ?? []).filter((x) => x.published)))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!saved) return <Skeleton className="h-96" />

  const value = (draft[key] ?? {}) as SectionContent
  const setValue = (v: SectionContent) => setDraft((d) => ({ ...d, [key]: v }))
  const dirty = (k: SectionKey) => !same(draft[k], saved[k])
  const save = async () => {
    const body = key === "order" ? { items: orderItems(draft.order) } : value
    if (new Blob([JSON.stringify(body)]).size > MAX_BYTES) {
      toast.error(t("site.tooLarge"))
      return
    }
    setBusy(true)
    try {
      const res = await SiteService.saveSection(key, body)
      setSaved((s) => ({ ...s, [key]: res ?? body }))
      setDraft((d) => ({ ...d, [key]: res ?? body }))
      toast.success(t("site.saved"))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const order = orderItems(draft.order)
    .filter((i) => i.enabled)
    .map((i) => i.key)

  return (
    <div className="grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)] 2xl:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)]">
      <nav aria-label={t("site.sections")} className="flex flex-wrap gap-1 lg:flex-col">
        {KEYS.map((k) => (
          <Button key={k} variant={k === key ? "secondary" : "ghost"} size="sm" className="justify-between" aria-current={k === key ? "true" : undefined} onClick={() => setKey(k)}>
            {t(`site.s.${k}` as TranslationKey)}
            {dirty(k) && <span className="bg-primary size-2 rounded-full" aria-label={t("site.unsaved")} />}
          </Button>
        ))}
      </nav>
      <Card>
        <CardHeader>
          <CardTitle>{t(`site.s.${key}` as TranslationKey)}</CardTitle>
          <CardDescription>{t(`site.h.${key}` as TranslationKey)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {key === "order" ? (
            <OrderEditor items={orderItems(draft.order)} onChange={(items) => setDraft((d) => ({ ...d, order: { items } }))} />
          ) : (
            <SectionForm k={key} value={value} onChange={setValue} />
          )}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={save} disabled={busy || !dirty(key)}>
              <Save /> {t("site.save")}
            </Button>
            <Button variant="outline" disabled={busy || !dirty(key)} onClick={() => setDraft((d) => ({ ...d, [key]: saved[key] }))}>
              <RotateCcw /> {t("site.discard")}
            </Button>
            <Button variant="link" asChild>
              <a href="/site" target="_blank" rel="noopener noreferrer">
                {t("site.open")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden lg:col-span-2 2xl:col-span-1">
        <CardHeader className="py-3">
          <CardTitle className="text-base">{t("site.preview")}</CardTitle>
        </CardHeader>
        <div className="h-[75vh] overflow-auto border-t" data-testid="site-preview">
          <LandingView sections={draft} order={order} plans={plans} pages={pages} live={false} />
        </div>
      </Card>
    </div>
  )
}

function OrderEditor({ items, onChange }: { items: { key: string; enabled: boolean }[]; onChange: (items: { key: string; enabled: boolean }[]) => void }) {
  const t = useT()
  const move = (i: number, d: number) => {
    const next = [...items]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <ol className="grid gap-2" data-testid="site-order">
      {items.map((it, i) => {
        const name = t(`site.s.${it.key}` as TranslationKey)
        return (
          <li key={it.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-muted-foreground w-6 text-sm">{i + 1}</span>
            <span className="flex-1 font-medium">{name}</span>
            <Switch checked={it.enabled} aria-label={t("site.showBlock", { name })} onCheckedChange={(c) => onChange(items.map((x, j) => (j === i ? { ...x, enabled: c } : x)))} />
            <Button size="icon" variant="ghost" disabled={i === 0} aria-label={t("site.moveUp", { name })} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button size="icon" variant="ghost" disabled={i === items.length - 1} aria-label={t("site.moveDown", { name })} onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
          </li>
        )
      })}
    </ol>
  )
}

function SectionForm({ k, value, onChange }: { k: Exclude<SectionKey, "order">; value: SectionContent; onChange: (v: SectionContent) => void }) {
  const t = useT()
  const schema = SECTION_SCHEMAS[k]
  return (
    <>
      {k === "advanced" && (
        <Alert>
          <AlertDescription>{t("site.jsHint")}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {schema.fields.map((f) => (
          <FieldInput key={f.name} id={`site-${k}-${f.name}`} f={f} value={value[f.name]} onChange={(v) => onChange({ ...value, [f.name]: v })} />
        ))}
      </div>
      {schema.lists?.map((l) => (
        <ListEditor key={l.name} k={k} l={l} items={Array.isArray(value[l.name]) ? (value[l.name] as SectionContent[]) : []} onChange={(items) => onChange({ ...value, [l.name]: items })} />
      ))}
    </>
  )
}

function ListEditor({ k, l, items, onChange }: { k: string; l: SiteList; items: SectionContent[]; onChange: (items: SectionContent[]) => void }) {
  const t = useT()
  const label = t(l.label)
  return (
    <fieldset className="grid gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-semibold">
        {label} ({items.length}/{l.maxItems})
      </legend>
      {items.map((it, i) => (
        <div key={i} className="bg-muted/40 grid gap-3 rounded-md p-3 sm:grid-cols-2" data-testid={`site-item-${l.name}`}>
          {l.fields.map((f) => (
            <FieldInput key={f.name} id={`site-${k}-${l.name}-${i}-${f.name}`} f={f} value={it[f.name]} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [f.name]: v } : x)))} />
          ))}
          <div className="flex justify-end sm:col-span-2">
            <Button size="sm" variant="ghost" aria-label={t("site.removeItem", { n: i + 1 })} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 /> {t("site.remove")}
            </Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="justify-self-start" disabled={items.length >= l.maxItems} onClick={() => onChange([...items, {}])}>
        <Plus /> {t("site.addItem", { name: label })}
      </Button>
    </fieldset>
  )
}

function FieldInput({ id, f, value, onChange }: { id: string; f: SiteField; value: unknown; onChange: (v: unknown) => void }) {
  const t = useT()
  const label = t(f.label)
  const v = str(value)
  if (f.type === "switch")
    return (
      <div className="flex items-center gap-2 self-end">
        <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
        <Label htmlFor={id}>{label}</Label>
      </div>
    )
  const hint = f.type === "image" || f.type === "url" ? t(f.type === "image" ? "site.imageHint" : "site.urlHint") : undefined
  return (
    <div className={`grid gap-1.5 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {f.type === "textarea" ? (
        <Textarea id={id} rows={f.name.startsWith("custom") ? 6 : 3} maxLength={f.max} value={v} onChange={(e) => onChange(e.target.value)} className={f.name.startsWith("custom") ? "font-mono text-xs" : ""} />
      ) : f.type === "color" ? (
        <div className="flex gap-2">
          <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#2563eb"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border" />
          <Input id={id} maxLength={7} value={v} placeholder="#2563eb" onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : f.type === "number" ? (
        <Input id={id} type="number" min={0} max={f.max} value={v} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      ) : (
        <Input id={id} maxLength={f.max} value={v} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}
