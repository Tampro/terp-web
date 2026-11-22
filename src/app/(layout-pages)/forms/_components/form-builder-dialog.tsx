"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useT, type TranslationKey } from "@/lib/i18n"
import { FIELD_TYPES, FormService, OPTION_TYPES, type EFieldType, type ELayout, type FormDto, type FormForm } from "@/lib/project/project.service"

import { attempt } from "../../projects/_components/project-kit"

const LAYOUTS: ELayout[] = ["SINGLE_COLUMN", "TWO_COLUMN", "CARD"]
// FRM_021: limits of the backend (FormService)
const MAX_FIELDS = 50
type FieldRow = { uid: string; key: string; label: string; type: EFieldType; required: boolean; placeholder: string; options: string }

let seq = 0
const uid = () => `f${++seq}`

/**
 * §11.2 form builder: name, active, layout and fields of 12 types (options for select / radio / checkbox, one per line).
 * PUT replaces the form and every field; a field keeps its key (answers are stored by key).
 */
export function FormBuilderDialog({ state, onClose, onSaved }: { state: { form?: FormDto } | null; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        {state && <Builder key={state.form?.form?.id ?? "new"} initial={state.form} onClose={onClose} onSaved={onSaved} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function Builder({ initial, onClose, onSaved, t }: { initial?: FormDto; onClose: () => void; onSaved: () => void; t: ReturnType<typeof useT> }) {
  const editId = initial?.form?.id
  const [name, setName] = React.useState(initial?.form?.name ?? "")
  const [active, setActive] = React.useState(initial?.form?.active ?? true)
  const [layout, setLayout] = React.useState<ELayout>(initial?.form?.layout ?? "SINGLE_COLUMN")
  const [fields, setFields] = React.useState<FieldRow[]>(() =>
    (initial?.fields ?? []).map((f) => ({
      uid: uid(),
      key: f.key ?? "",
      label: f.label ?? "",
      type: f.type ?? "TEXT",
      required: !!f.required,
      placeholder: f.placeholder ?? "",
      options: (f.options ?? []).join("\n"),
    }))
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)

  const set = (id: string, patch: Partial<FieldRow>) => setFields((xs) => xs.map((f) => (f.uid === id ? { ...f, ...patch } : f)))
  const move = (i: number, d: -1 | 1) =>
    setFields((xs) => {
      const c = [...xs]
      ;[c[i], c[i + d]] = [c[i + d], c[i]]
      return c
    })

  async function save() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t("project.v.required")
    if (fields.length === 0) errs.fields = t("form.v.fields")
    for (const f of fields) {
      if (!f.label.trim()) errs[f.uid] = t("project.v.required")
      else if (OPTION_TYPES.includes(f.type) && f.options.split("\n").every((o) => !o.trim())) errs[f.uid] = t("form.v.options") // FRM_003
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    const body: FormForm = {
      name: name.trim(),
      active,
      layout,
      fields: fields.map((f) => ({
        ...(f.key ? { key: f.key } : {}),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        placeholder: f.placeholder.trim() || null,
        ...(OPTION_TYPES.includes(f.type) ? { options: f.options.split("\n").map((o) => o.trim()).filter(Boolean) } : {}),
      })),
    }
    setBusy(true)
    const ok = await attempt(() => (editId ? FormService.update(editId, body) : FormService.create(body)), t("common.saved"))
    setBusy(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t(editId ? "form.edit" : "form.create")}</DialogTitle>
        <DialogDescription>{t("form.builderDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="fm-name">{t("crm.name")}</Label>
          <Input id="fm-name" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
          <FieldError message={errors.name} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fm-layout">{t("form.layout")}</Label>
          <Select value={layout} onValueChange={(v) => setLayout(v as ELayout)}>
            <SelectTrigger id="fm-layout" className="w-full" aria-label={t("form.layout")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`form.layoutOf.${l}` as TranslationKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} /> {t("form.active")}
      </label>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>{t("form.fields")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= MAX_FIELDS}
            onClick={() => setFields((xs) => [...xs, { uid: uid(), key: "", label: "", type: "TEXT", required: false, placeholder: "", options: "" }])}
          >
            <Plus className="size-4" /> {t("form.addField")}
          </Button>
        </div>
        {fields.length === 0 && <p className="text-muted-foreground text-sm">{t("form.noFields")}</p>}
        <FieldError message={errors.fields} />
        <ol className="grid gap-3">
          {fields.map((f, i) => (
            <li key={f.uid} className="grid gap-2 rounded-md border p-3" aria-label={t("form.fieldN", { n: i + 1 })}>
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                <Input value={f.label} placeholder={t("form.label")} aria-label={t("form.labelOf", { n: i + 1 })} onChange={(e) => set(f.uid, { label: e.target.value })} />
                <Select value={f.type} onValueChange={(v) => set(f.uid, { type: v as EFieldType })}>
                  <SelectTrigger className="w-full" aria-label={t("form.typeOf", { n: i + 1 })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((x) => (
                      <SelectItem key={x} value={x}>
                        {t(`form.type.${x}` as TranslationKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === 0} aria-label={t("form.up", { n: i + 1 })} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === fields.length - 1} aria-label={t("form.down", { n: i + 1 })} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t("form.remove", { n: i + 1 })} onClick={() => setFields((xs) => xs.filter((x) => x.uid !== f.uid))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={f.placeholder} placeholder={t("form.placeholder")} aria-label={t("form.placeholderOf", { n: i + 1 })} onChange={(e) => set(f.uid, { placeholder: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.required} onCheckedChange={(c) => set(f.uid, { required: c === true })} /> {t("form.required")}
                </label>
              </div>
              {OPTION_TYPES.includes(f.type) && (
                <textarea
                  className="border-input min-h-16 rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={f.options}
                  placeholder={t("form.optionsHint")}
                  aria-label={t("form.optionsOf", { n: i + 1 })}
                  onChange={(e) => set(f.uid, { options: e.target.value })}
                />
              )}
              {f.key && <p className="text-muted-foreground font-mono text-xs">key: {f.key}</p>}
              <FieldError message={errors[f.uid]} />
            </li>
          ))}
        </ol>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={busy} onClick={save}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </div>
  )
}
