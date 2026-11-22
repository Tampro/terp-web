"use client"

import * as React from "react"
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Option, Row } from "@/lib/hrm/hrm.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"

import { attempt, errorMessage, Field, PlainSelect } from "../../accounting/_components/acc-kit"

export { attempt, errorMessage, Field, PlainSelect, today } from "../../accounting/_components/acc-kit"

/** Reads a dotted path ("employee.fullName") from a row. */
export function pick(row: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), row)
}
const str = (v: unknown) => (v == null ? "" : String(v))

// ------------------------------------------------------------------ option cache

const optionCache = new Map<string, Promise<Option[]>>()
const listeners = new Set<() => void>()
/** Drops every cached select list (after a setup change), and makes mounted `useOptions` reload. */
export function invalidateOptions() {
  optionCache.clear()
  listeners.forEach((l) => l())
}
/** Options for a select, cached per key for the page's lifetime; [] while loading or on error. */
export function useOptions(key: string, loader: () => Promise<Option[]>, enabled = true) {
  const [state, setState] = React.useState<{ key: string; options: Option[] }>({ key: "", options: [] })
  const [version, setVersion] = React.useState(0)
  React.useEffect(() => {
    const l = () => setVersion((v) => v + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  const loaderRef = React.useRef(loader)
  React.useEffect(() => {
    loaderRef.current = loader
  })
  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let p = optionCache.get(key)
    if (!p) {
      p = loaderRef.current().catch(() => [])
      optionCache.set(key, p)
    }
    p.then((options) => !cancelled && setState({ key, options }))
    return () => {
      cancelled = true
    }
  }, [key, enabled, version])
  return state.key === key ? state.options : []
}
/**
 * §20 dependent selects branch → department → designation: department / designation options filtered by the chosen
 * parent field (options carry branchId / departmentId, see /org/{departments,designations}/options).
 */
export function orgChain(departments: Option[], designations: Option[]) {
  return {
    departmentsOf: (branchField: string) => (v: Values) => toSelect(departments.filter((d) => !v[branchField] || String(d.branchId) === String(v[branchField]))),
    designationsOf: (departmentField: string) => (v: Values) => toSelect(designations.filter((d) => !v[departmentField] || String(d.departmentId) === String(v[departmentField]))),
  }
}
export const toSelect = (options: Option[]) => options.map((o) => ({ value: str(o.id), label: str(o.name ?? o.title ?? o.id) }))

// ------------------------------------------------------------------ status badge

const VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ACTIVE: "default",
  APPROVED: "default",
  ACCEPTED: "default",
  COMPLETED: "default",
  RESOLVED: "default",
  ACKNOWLEDGED: "default",
  PAID: "default",
  PUBLISHED: "default",
  PRESENT: "default",
  IN_PROGRESS: "secondary",
  IN_REVIEW: "secondary",
  ASSIGNED: "secondary",
  PROCESSING: "secondary",
  PROBATION: "secondary",
  GENERATED: "secondary",
  DOWNLOADED: "secondary",
  PENDING: "outline",
  DRAFT: "outline",
  INACTIVE: "outline",
  UNPAID: "outline",
  EXEMPTED: "outline",
  REJECTED: "destructive",
  CANCELLED: "destructive",
  TERMINATED: "destructive",
  EXPIRED: "destructive",
  OVERDUE: "destructive",
}
export function HrStatus({ status }: { status?: unknown }) {
  const t = useT()
  if (!status) return <span>-</span>
  const s = String(status)
  return <Badge variant={VARIANT[s] ?? "outline"}>{t(`hr.status.${s}` as TranslationKey)}</Badge>
}

// ------------------------------------------------------------------ form fields

export type FieldType = "text" | "textarea" | "number" | "date" | "time" | "select" | "switch" | "color" | "multi" | "email" | "password" | "file" | "datetime"
export interface FieldDef {
  name: string
  label: TranslationKey
  type?: FieldType
  required?: boolean
  /** max length (text) or max value (number) */
  max?: number
  min?: number
  options?: { value: string; label: string }[]
  /** options that depend on other values of the form (e.g. rounds of the chosen candidate's job) */
  optionsFor?: (v: Values) => { value: string; label: string }[]
  /** fields cleared when this one changes (branch → department → designation) */
  resets?: string[]
  /** a select whose value is sent as a number (ids) */
  numeric?: boolean
  pattern?: RegExp
  patternMsg?: TranslationKey
  /** spans both columns */
  full?: boolean
  hidden?: (v: Values) => boolean
  /** shown as the none entry of an optional select */
  none?: boolean
  /** cross-field check; returns an error key */
  check?: (v: Values) => TranslationKey | undefined
}
export type Values = Record<string, unknown>

export function initialValues(fields: FieldDef[], row?: Values | null, defaults?: Values): Values {
  const v: Values = {}
  for (const f of fields) {
    const raw = row?.[f.name] ?? defaults?.[f.name]
    if (f.type === "switch") v[f.name] = raw == null ? !!defaults?.[f.name] : !!raw
    else if (f.type === "multi") v[f.name] = Array.isArray(raw) ? raw.map(String) : []
    else if (f.type === "color") v[f.name] = raw == null ? "#3B82F6" : String(raw)
    else if (f.type === "datetime") v[f.name] = raw == null ? "" : String(raw).slice(0, 16)
    else v[f.name] = raw == null ? "" : String(raw)
  }
  return v
}

export function fieldErrors(fields: FieldDef[], v: Values, t: (k: TranslationKey, p?: Record<string, string | number>) => string) {
  const e: Record<string, string | undefined> = {}
  for (const f of fields) {
    if (f.hidden?.(v)) continue
    const val = v[f.name]
    const s = typeof val === "string" ? val.trim() : ""
    if (f.type === "switch") continue
    if (f.type === "multi") {
      if (f.required && !(val as string[]).length) e[f.name] = t("hr.v.required")
      continue
    }
    if (f.required && !s) e[f.name] = t("hr.v.required")
    else if (s && f.type === "number") {
      const n = Number(s)
      if (!Number.isFinite(n)) e[f.name] = t("hr.v.number")
      else if (f.min != null && n < f.min) e[f.name] = t("hr.v.min", { n: f.min })
      else if (f.max != null && n > f.max) e[f.name] = t("hr.v.max", { n: f.max })
    } else if (s && f.max != null && s.length > f.max) e[f.name] = t("hr.v.maxLength", { n: f.max })
    else if (s && f.pattern && !f.pattern.test(s)) e[f.name] = t(f.patternMsg ?? "hr.v.format")
    if (!e[f.name] && f.check) {
      const k = f.check(v)
      if (k) e[f.name] = t(k)
    }
  }
  return e
}

/** Form values → request body: "" → omitted, numbers / numeric selects → number, multi → number[]. */
export function toBody(fields: FieldDef[], v: Values) {
  const b: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.hidden?.(v)) continue
    const val = v[f.name]
    if (f.type === "switch") b[f.name] = !!val
    else if (f.type === "multi") b[f.name] = (val as string[]).map(Number)
    else {
      const s = String(val ?? "").trim()
      if (!s) continue
      b[f.name] = f.type === "number" || f.type === "file" || f.numeric ? Number(s) : s
    }
  }
  return b
}

export function FormFields({ fields, values, onChange, errors, prefix }: { fields: FieldDef[]; values: Values; onChange: (v: Values) => void; errors: Record<string, string | undefined>; prefix: string }) {
  const t = useT()
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const set = (name: string, val: unknown) => {
    setTouched((x) => ({ ...x, [name]: true }))
    const next: Values = { ...values, [name]: val }
    // a changed parent clears its dependants, recursively (branch → department → designation)
    const clear = (n: string) => {
      for (const r of fields.find((f) => f.name === n)?.resets ?? []) {
        if (next[r]) next[r] = ""
        clear(r)
      }
    }
    if (val !== values[name]) clear(name)
    onChange(next)
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields
        .filter((f) => !f.hidden?.(values))
        .map((f) => {
          const id = `${prefix}-${f.name}`
          const label = t(f.label) + (f.required ? " *" : "")
          const err = touched[f.name] || String(values[f.name] ?? "") ? errors[f.name] : undefined
          const span = f.full || f.type === "textarea" || f.type === "multi" ? "sm:col-span-2" : ""
          const val = values[f.name]
          if (f.type === "switch")
            return (
              <label key={f.name} className={`flex items-center gap-2 self-end text-sm ${span}`}>
                <Switch checked={!!val} onCheckedChange={(c) => set(f.name, c)} aria-label={t(f.label)} /> {t(f.label)}
              </label>
            )
          return (
            <Field key={f.name} id={id} label={label} error={err} className={span}>
              {f.type === "textarea" ? (
                <Textarea id={id} rows={3} maxLength={f.max} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === "select" ? (
                <PlainSelect id={id} label={t(f.label)} value={String(val ?? "")} onChange={(x) => set(f.name, x)} options={f.optionsFor?.(values) ?? f.options ?? []} none={f.none ? t("hr.none") : undefined} />
              ) : f.type === "multi" ? (
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-2" role="group" aria-label={t(f.label)}>
                  {(f.options ?? []).length === 0 && <span className="text-muted-foreground text-sm">{t("hr.noOptions")}</span>}
                  {(f.options ?? []).map((o) => {
                    const list = (val as string[]) ?? []
                    const on = list.includes(o.value)
                    return (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={on} onChange={() => set(f.name, on ? list.filter((x) => x !== o.value) : [...list, o.value])} /> {o.label}
                      </label>
                    )
                  })}
                </div>
              ) : f.type === "file" ? (
                <FileInput id={id} label={t(f.label)} fileName={String(values[`${f.name}__name`] ?? (val ? `#${String(val)}` : ""))} onUploaded={(fileId, fileName) => onChange({ ...values, [f.name]: fileId, [`${f.name}__name`]: fileName })} />
              ) : f.type === "color" ? (
                <div className="flex items-center gap-2">
                  <input id={id} type="color" className="h-9 w-12 rounded border" value={String(val ?? "#3B82F6")} onChange={(e) => set(f.name, e.target.value.toUpperCase())} />
                  <span className="font-mono text-sm">{String(val ?? "")}</span>
                </div>
              ) : (
                <Input
                  id={id}
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : f.type === "time" ? "time" : f.type === "email" ? "email" : f.type === "password" ? "password" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  maxLength={f.type === "number" ? undefined : f.max}
                  value={String(val ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Field>
          )
        })}
    </div>
  )
}

/** Uploads one file to the media library and reports its id. */
export function FileInput({ id, label, fileName, onUploaded, accept }: { id: string; label: string; fileName?: string; onUploaded: (fileId: string, name: string) => void; accept?: string }) {
  const t = useT()
  const [busy, setBusy] = React.useState(false)
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <Upload className="size-4" /> {busy ? t("hr.uploading") : fileName || t("hr.chooseFile")}
      <input
        id={id}
        type="file"
        className="sr-only"
        aria-label={label}
        accept={accept}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setBusy(true)
          try {
            const [m] = await MediaService.upload([file])
            if (m?.id) onUploaded(m.id, m.originalName ?? file.name)
          } catch (err) {
            toast.error(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}

/** A dialog body with a field form and one submit button. */
export function FormDialogBody({
  title,
  description,
  fields,
  initial,
  submitLabel,
  onSubmit,
  onClose,
  prefix,
}: {
  title: string
  description?: string
  fields: FieldDef[]
  initial: Values
  submitLabel?: string
  onSubmit: (body: Record<string, unknown>, values: Values) => Promise<boolean>
  onClose: () => void
  prefix: string
}) {
  const t = useT()
  const [values, setValues] = React.useState(initial)
  const [saving, setSaving] = React.useState(false)
  const errors = fieldErrors(fields, values, t)
  const valid = !Object.values(errors).some(Boolean)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <FormFields fields={fields} values={values} onChange={setValues} errors={errors} prefix={prefix} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true)
            const ok = await onSubmit(toBody(fields, values), values)
            setSaving(false)
            if (ok) onClose()
          }}
        >
          {submitLabel ?? t("common.save")}
        </Button>
      </DialogFooter>
    </>
  )
}

// ------------------------------------------------------------------ list section

export interface Column {
  label: TranslationKey
  path?: string
  kind?: "text" | "date" | "money" | "status" | "bool" | "mono" | "color"
  render?: (row: Row) => React.ReactNode
  className?: string
}
export interface RowAction {
  key: string
  label: TranslationKey
  icon?: React.ReactNode
  when: (row: Row) => boolean
  /** a form shown before running; without one a confirmation is asked */
  fields?: FieldDef[]
  /** pre-filled values of the action form */
  initial?: (row: Row) => Values
  confirmDesc?: TranslationKey
  destructive?: boolean
  run: (row: Row, body: Record<string, unknown>) => Promise<unknown>
}
export interface CrudConfig {
  id: string
  load: (q: Record<string, string | number | boolean | undefined>) => Promise<IPage<Row> | Row[]>
  columns: Column[]
  /** label of the row in menus and confirmations */
  rowName: (row: Row) => string
  createLabel?: TranslationKey
  emptyLabel?: TranslationKey
  fields?: FieldDef[]
  defaults?: Values
  /** loads the full record before editing (lists may carry a preview only) */
  fetchRow?: (row: Row) => Promise<Row>
  /** row → form values (defaults to the row itself) */
  toValues?: (row: Row) => Values
  save?: (id: string | undefined, body: Record<string, unknown>) => Promise<unknown>
  remove?: (id: string) => Promise<unknown>
  canEdit?: (row: Row) => boolean
  canDelete?: (row: Row) => boolean
  actions?: RowAction[]
  statuses?: string[]
  /** the query parameter the status tabs set (default "status"); `tab` for announcements */
  statusParam?: string
  keyword?: boolean
  /** extra query parameters always sent */
  query?: Record<string, string | number | boolean | undefined>
  onRowClick?: (row: Row) => void
  /** a section that changes setup lists drops the option cache after saving */
  invalidates?: boolean
  manage: boolean
  toolbar?: React.ReactNode
  reloadKey?: number
}

const PAGE_SIZE = 20
export function CrudSection({ config }: { config: CrudConfig }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ""
  const keyword = searchParams.get("q") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [draft, setDraft] = React.useState(keyword)
  const [data, setData] = React.useState<{ key: string; rows: Row[]; page?: IPage<Row> }>()
  const [reload, setReload] = React.useState(0)
  const [editing, setEditing] = React.useState<{ row?: Row } | null>(null)
  const [pending, setPending] = React.useState<{ action: RowAction; row: Row }>()
  const [deleting, setDeleting] = React.useState<Row>()
  const { query, statusParam = "status" } = config
  // config objects are rebuilt every render: keep the latest loader in a ref so only the key reloads
  const loadRef = React.useRef(config.load)
  React.useEffect(() => {
    loadRef.current = config.load
  })
  const key = JSON.stringify({ id: config.id, status, keyword, page, reload, ext: config.reloadKey, query })

  React.useEffect(() => {
    let cancelled = false
    const q = JSON.parse(key) as { status: string; keyword: string; page: number; query?: Record<string, string> }
    loadRef.current({ ...q.query, [statusParam]: q.status || undefined, keyword: q.keyword || undefined, page: q.page, size: PAGE_SIZE })
      .then((r) => !cancelled && setData(Array.isArray(r) ? { key, rows: r } : { key, rows: r.content ?? [], page: r }))
      .catch((e: Error) => {
        if (cancelled) return
        toast.error(e.message)
        setData({ key, rows: [] })
      })
    return () => {
      cancelled = true
    }
  }, [key, statusParam])

  const done = () => {
    if (config.invalidates) invalidateOptions()
    setReload((x) => x + 1)
  }
  const loading = data?.key !== key
  const rows = data?.rows ?? []
  const cell = (row: Row, c: Column) => {
    if (c.render) return c.render(row)
    const v = c.path ? pick(row, c.path) : undefined
    switch (c.kind) {
      case "date":
        return formatDate(str(v) || undefined, language)
      case "money":
        return money(v as number)
      case "status":
        return <HrStatus status={v} />
      case "bool":
        return v ? t("hr.yes") : t("hr.no")
      case "mono":
        return <span className="font-mono text-xs">{str(v) || "-"}</span>
      case "color":
        return <span className="inline-block size-4 rounded-full border" style={{ background: str(v) }} title={str(v)} />
      default:
        return str(v) || "-"
    }
  }
  async function startEdit(r: Row) {
    if (!config.fetchRow) return setEditing({ row: r })
    try {
      setEditing({ row: await config.fetchRow(r) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const editable = (r: Row) => config.manage && !!config.fields && !!config.save && (config.canEdit?.(r) ?? true)
  const deletable = (r: Row) => config.manage && !!config.remove && (config.canDelete?.(r) ?? true)
  const actionsFor = (r: Row) => (config.actions ?? []).filter((a) => config.manage && a.when(r))
  const hasMenu = (r: Row) => editable(r) || deletable(r) || actionsFor(r).length > 0

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {config.statuses ? (
            <Tabs value={status || "ALL"} onValueChange={(v) => update({ status: v === "ALL" ? "" : v, page: 0 })}>
              <div className="max-w-full overflow-x-auto">
                <TabsList>
                  <TabsTrigger value="ALL">{t("companies.tabAll")}</TabsTrigger>
                  {config.statuses.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {t(`hr.status.${s}` as TranslationKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {config.keyword && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  update({ q: draft.trim(), page: 0 })
                }}
              >
                <Input className="w-48" aria-label={t("hr.search")} placeholder={t("hr.search")} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <Button type="submit" variant="outline" size="icon" aria-label={t("hr.search")}>
                  <Search className="size-4" />
                </Button>
              </form>
            )}
            {config.toolbar}
            {config.manage && config.fields && config.save && config.createLabel && (
              <Button onClick={() => setEditing({})}>
                <Plus className="size-4" /> {t(config.createLabel)}
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((c) => (
                  <TableHead key={c.label} className={c.kind === "money" ? "text-right" : c.className}>
                    {t(c.label)}
                  </TableHead>
                ))}
                <TableHead className="w-12">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={config.columns.length + 1}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={config.columns.length + 1} className="text-muted-foreground h-20 text-center">
                    {t(config.emptyLabel ?? "hr.empty")}
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((r, i) => (
                  <TableRow key={r.id ?? i}>
                    {config.columns.map((c, ci) => (
                      <TableCell key={c.label} className={c.kind === "money" ? "text-right" : c.className}>
                        {ci === 0 && config.onRowClick ? (
                          <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => config.onRowClick?.(r)}>
                            {cell(r, c)}
                          </button>
                        ) : (
                          cell(r, c)
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      {hasMenu(r) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: config.rowName(r) })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actionsFor(r).map((a) => (
                              <DropdownMenuItem key={a.key} variant={a.destructive ? "destructive" : undefined} onClick={() => setPending({ action: a, row: r })}>
                                {a.icon} {t(a.label)}
                              </DropdownMenuItem>
                            ))}
                            {editable(r) && (
                              <DropdownMenuItem onClick={() => startEdit(r)}>
                                <Pencil className="size-4" /> {t("common.edit")}
                              </DropdownMenuItem>
                            )}
                            {deletable(r) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(r)}>
                                  <Trash2 className="size-4" /> {t("common.delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {data?.page && <Pager page={data.page.page ?? page} size={data.page.size ?? PAGE_SIZE} total={data.page.totalElements ?? 0} totalPages={data.page.totalPages ?? 0} onPage={(p) => update({ page: p })} />}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editing && config.fields && (
            <FormDialogBody
              key={editing.row?.id ?? "new"}
              prefix={config.id}
              title={editing.row ? `${t("common.edit")}: ${config.rowName(editing.row)}` : t(config.createLabel ?? "common.save")}
              fields={config.fields}
              initial={initialValues(config.fields, editing.row ? (config.toValues?.(editing.row) ?? editing.row) : null, config.defaults)}
              onClose={() => setEditing(null)}
              onSubmit={async (body) => {
                const ok = await attempt(() => config.save!(editing.row?.id, body), t("common.saved"))
                if (ok) done()
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!pending?.action.fields} onOpenChange={(o) => !o && setPending(undefined)}>
        <DialogContent className="sm:max-w-lg">
          {pending?.action.fields && (
            <FormDialogBody
              key={`${pending.action.key}-${pending.row.id}`}
              prefix={`${config.id}-${pending.action.key}`}
              title={`${t(pending.action.label)}: ${config.rowName(pending.row)}`}
              description={pending.action.confirmDesc ? t(pending.action.confirmDesc) : undefined}
              fields={pending.action.fields}
              initial={initialValues(pending.action.fields, pending.action.initial?.(pending.row) ?? null)}
              submitLabel={t(pending.action.label)}
              onClose={() => setPending(undefined)}
              onSubmit={async (body) => {
                const ok = await attempt(() => pending.action.run(pending.row, body), t("common.saved"))
                if (ok) done()
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending && !pending.action.fields}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={pending ? `${t(pending.action.label)}: ${config.rowName(pending.row)}?` : ""}
        description={pending?.action.confirmDesc ? t(pending.action.confirmDesc) : undefined}
        confirmLabel={pending ? t(pending.action.label) : undefined}
        onConfirm={async () => {
          if (!pending) return
          if (await attempt(() => pending.action.run(pending.row, {}), t("common.saved"))) done()
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("hr.confirmDelete", { name: deleting ? config.rowName(deleting) : "" })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting?.id && (await attempt(() => config.remove!(deleting.id ?? ""), t("common.saved")))) done()
        }}
      />
    </Card>
  )
}

/** Page shell with tabs kept in `?tab=` (the first tab is the default and drops the parameter). */
export function TabbedPage({ title, description, tabs }: { title: string; description?: string; tabs: { key: string; label: TranslationKey; content: () => React.ReactNode; visible?: boolean }[] }) {
  const t = useT()
  const { searchParams, update } = useUrlQuery()
  const shown = tabs.filter((x) => x.visible !== false)
  const active = shown.find((x) => x.key === searchParams.get("tab")) ?? shown[0]
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {shown.length > 1 && (
        <Tabs value={active?.key} onValueChange={(v) => update({ tab: v === shown[0].key ? "" : v, status: "", q: "", page: 0 })}>
          <div className="max-w-full overflow-x-auto">
            <TabsList>
              {shown.map((x) => (
                <TabsTrigger key={x.key} value={x.key}>
                  {t(x.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      )}
      {active ? <React.Fragment key={active.key}>{active.content()}</React.Fragment> : <p className="text-muted-foreground text-sm">{t("hr.noAccess")}</p>}
    </div>
  )
}

/** Permission check against `me.permissions`. */
export { useAuthStore } from "@/lib/auth/auth.store"
