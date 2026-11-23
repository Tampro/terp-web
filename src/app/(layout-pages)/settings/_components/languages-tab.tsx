"use client"

import * as React from "react"
import { Languages, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Pager } from "@/components/common/pager"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { IPage } from "@/lib/api"
import en from "@/locales/en"
import ko from "@/locales/ko"
import vi from "@/locales/vi"
import { useRemoteLabels, useT } from "@/lib/i18n"
import { flag, LanguageService, type LabelRow, type LanguageDto } from "@/lib/language/language.service"

/** the app's own texts: imported into the backend's vi / en / ko so the key set exists for other languages */
const APP_LABELS: Record<string, Record<string, string>> = { vi, en, ko }
const CODE_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/
const COUNTRY_RE = /^$|^[A-Z]{2}$/
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Language Management (super admin, /settings/admin/languages): languages for the selector, enable / disable, add and
 * delete own languages, and the texts of each language. The app's texts must be synced first: a new language starts as a
 * copy of the default language's labels, which are empty until then.
 */
export function LanguagesTab() {
  const t = useT()
  const [rows, setRows] = React.useState<LanguageDto[]>()
  const [error, setError] = React.useState<string>()
  const [reload, setReload] = React.useState(0)
  const [editing, setEditing] = React.useState<LanguageDto | "new">()
  const [deleting, setDeleting] = React.useState<LanguageDto>()
  const [labelsOf, setLabelsOf] = React.useState<LanguageDto>()
  const [syncing, setSyncing] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    LanguageService.all()
      .then((r) => !cancelled && setRows(r ?? []))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [reload])
  const refresh = () => setReload((k) => k + 1)

  const toggle = async (l: LanguageDto, enabled: boolean) => {
    try {
      await LanguageService.update(String(l.code), { name: String(l.name), countryCode: l.countryCode ?? "", enabled })
      toast.success(t(enabled ? "lang.enabledToast" : "lang.disabledToast", { name: String(l.name) }))
      refresh()
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  const sync = async () => {
    setSyncing(true)
    try {
      let added = 0
      let updated = 0
      for (const code of Object.keys(APP_LABELS)) {
        const r = await LanguageService.importLabels(code, APP_LABELS[code])
        added += r?.added ?? 0
        updated += r?.updated ?? 0
      }
      toast.success(t("lang.synced", { added, updated }))
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{t("lang.title")}</CardTitle>
          <CardDescription>{t("lang.desc")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> {t("lang.sync")}
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus /> {t("lang.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted-foreground text-xs">{t("lang.syncHint")}</p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!rows && !error && <Skeleton className="h-40" />}
        {rows && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("lang.name")}</TableHead>
                  <TableHead>{t("lang.code")}</TableHead>
                  <TableHead>{t("lang.enabled")}</TableHead>
                  <TableHead className="w-40">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.code}>
                    <TableCell>
                      <span className="mr-2">{flag(l.countryCode)}</span>
                      <span className="font-medium">{l.name}</span>
                      {l.isDefault && <Badge className="ml-2">{t("lang.default")}</Badge>}
                      {l.system && (
                        <Badge variant="outline" className="ml-2">
                          {t("lang.system")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.code}</TableCell>
                    <TableCell>
                      <Switch checked={!!l.enabled} disabled={!!l.isDefault} aria-label={t("lang.enableOf", { name: String(l.name) })} onCheckedChange={(v) => toggle(l, v)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" aria-label={t("lang.labelsOf", { name: String(l.name) })} onClick={() => setLabelsOf(l)}>
                          <Languages />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("lang.editOf", { name: String(l.name) })} onClick={() => setEditing(l)}>
                          <Pencil />
                        </Button>
                        {!l.system && !l.isDefault && (
                          <Button variant="ghost" size="icon" aria-label={t("lang.deleteOf", { name: String(l.name) })} onClick={() => setDeleting(l)}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <LanguageDialog value={editing} onClose={() => setEditing(undefined)} onSaved={refresh} />
      <LabelsDialog language={labelsOf} onClose={() => setLabelsOf(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("lang.deleteTitle", { name: String(deleting?.name ?? "") })}
        description={t("lang.deleteDesc")}
        onConfirm={async () => {
          if (!deleting?.code) return
          try {
            await LanguageService.remove(deleting.code)
            toast.success(t("lang.deleted"))
            refresh()
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </Card>
  )
}

function LanguageDialog({ value, onClose, onSaved }: { value?: LanguageDto | "new"; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const isNew = value === "new"
  const current = value && value !== "new" ? value : undefined
  const [form, setForm] = React.useState({ code: "", name: "", countryCode: "" })
  const [touched, setTouched] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [lastKey, setLastKey] = React.useState<string>()
  const key = value === undefined ? undefined : isNew ? "new" : String(current?.code)
  // reset the form when another language (or "new") opens: state adjusted during render, not in an effect
  if (key !== lastKey) {
    setLastKey(key)
    setForm({ code: current?.code ?? "", name: current?.name ?? "", countryCode: current?.countryCode ?? "" })
    setTouched(false)
  }
  const errors = {
    code: isNew && !CODE_RE.test(form.code.trim()) ? t("lang.codeBad") : undefined,
    name: !form.name.trim() ? t("lang.required") : undefined,
    countryCode: !COUNTRY_RE.test(form.countryCode.trim()) ? t("lang.countryBad") : undefined,
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (errors.code || errors.name || errors.countryCode) return
    setBusy(true)
    try {
      if (isNew) await LanguageService.create({ code: form.code.trim(), name: form.name.trim(), countryCode: form.countryCode.trim() || undefined })
      else if (current?.code) await LanguageService.update(current.code, { name: form.name.trim(), countryCode: form.countryCode.trim(), enabled: !!current.enabled })
      toast.success(t("lang.saved"))
      onClose()
      onSaved()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={value !== undefined} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? t("lang.add") : t("lang.editOf", { name: String(current?.name ?? "") })}</DialogTitle>
            {isNew && <DialogDescription>{t("lang.addHint")}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="lang-code">{t("lang.code")} *</Label>
            <Input id="lang-code" placeholder="ja, zh-TW" maxLength={6} disabled={!isNew} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <FieldError message={touched ? errors.code : undefined} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lang-name">{t("lang.name")} *</Label>
            <Input id="lang-name" placeholder="日本語" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <FieldError message={touched ? errors.name : undefined} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lang-country">{t("lang.country")}</Label>
            <div className="flex items-center gap-2">
              <Input id="lang-country" placeholder="JP" maxLength={2} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} />
              <span className="text-2xl">{flag(form.countryCode)}</span>
            </div>
            <FieldError message={touched ? errors.countryCode : undefined} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const LABEL_PAGE = 20

/** Texts of one language: every key of the default language; only the edited ones are sent (PUT = {key: text}). */
function LabelsDialog({ language, onClose }: { language?: LanguageDto; onClose: () => void }) {
  const t = useT()
  const code = language?.code
  const [query, setQuery] = React.useState({ keyword: "", page: 0 })
  const [search, setSearch] = React.useState("")
  const [data, setData] = React.useState<IPage<LabelRow>>()
  const [error, setError] = React.useState<string>()
  const [edits, setEdits] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [reload, setReload] = React.useState(0)
  const [lastCode, setLastCode] = React.useState<string>()
  if (code !== lastCode) {
    setLastCode(code)
    setQuery({ keyword: "", page: 0 })
    setSearch("")
    setEdits({})
    setData(undefined)
    setError(undefined)
  }
  React.useEffect(() => {
    if (!code) return
    let cancelled = false
    LanguageService.labels(code, { keyword: query.keyword || undefined, page: query.page, size: LABEL_PAGE })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [code, query, reload])
  const dirty = Object.keys(edits).length
  const save = async () => {
    if (!code || !dirty) return
    setBusy(true)
    try {
      await LanguageService.saveLabels(code, edits)
      toast.success(t("lang.labelsSaved", { n: dirty }))
      setEdits({})
      // the published texts of this language changed: load them again next time
      useRemoteLabels.setState((s) => {
        const labels = { ...s.labels }
        delete labels[code]
        return { labels }
      })
      setReload((k) => k + 1)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const rows = data?.content ?? []
  return (
    <Dialog open={!!language} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {flag(language?.countryCode)} {t("lang.labelsOf", { name: String(language?.name ?? "") })}
          </DialogTitle>
          <DialogDescription>{t("lang.labelsHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery({ keyword: search.trim(), page: 0 })
          }}
        >
          <Input aria-label={t("common.search")} placeholder={t("lang.searchLabels")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="secondary">
            {t("common.search")}
          </Button>
        </form>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!data && !error && <Skeleton className="h-64" />}
        {data && rows.length === 0 && (
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <Upload className="size-4" /> {t("lang.noLabels")}
            </AlertDescription>
          </Alert>
        )}
        {rows.length > 0 && (
          <div className="max-h-[55vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">{t("lang.key")}</TableHead>
                  <TableHead>{t("lang.text")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const k = String(r.key)
                  const v = k in edits ? edits[k] : (r.translated ? (r.value ?? "") : "")
                  return (
                    <TableRow key={k}>
                      <TableCell className="align-top font-mono text-xs break-all">
                        {k}
                        {!r.translated && !(k in edits) && (
                          <Badge variant="outline" className="ml-1">
                            {t("lang.untranslated")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Textarea
                          aria-label={k}
                          rows={1}
                          maxLength={2000}
                          className="min-h-9 text-sm"
                          placeholder={r.defaultValue ?? ""}
                          value={v}
                          onChange={(e) => setEdits({ ...edits, [k]: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {data && <Pager page={data.page ?? query.page} size={data.size ?? LABEL_PAGE} total={data.totalElements ?? 0} totalPages={data.totalPages ?? 0} onPage={(p) => setQuery({ ...query, page: p })} />}
        <DialogFooter className="items-center">
          {dirty > 0 && <span className="text-muted-foreground mr-auto text-sm">{t("lang.unsaved", { n: dirty })}</span>}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy || !dirty}>
            {t("lang.saveLabels")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
