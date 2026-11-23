"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Eye, Save } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { PageHeader } from "@/components/common/page-header"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmailTemplateService, TEMPLATE_LANGS, type EmailTemplateDetail, type RenderedEmail } from "@/lib/email-template/email-template.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { errorMessage } from "../../hrm/_components/crud-kit"

type Lang = (typeof TEMPLATE_LANGS)[number]
type Draft = { subject: string; content: string }
const MAX_SUBJECT = 255
const MAX_CONTENT = 60000

export default function EmailTemplateEditPage() {
  return (
    <RequireSuperAdmin>
      <Editor />
    </RequireSuperAdmin>
  )
}

const drafts = (d: EmailTemplateDetail) =>
  Object.fromEntries(TEMPLATE_LANGS.map((l) => {
    const c = d.contents?.find((x) => x.lang === l)
    return [l, { subject: c?.subject ?? "", content: c?.content ?? "" }]
  })) as Record<Lang, Draft>

/**
 * §3.5 edit one email template: From Name (PUT /settings) and subject + HTML body per language (PUT /content/{lang}),
 * variables inserted at the cursor, preview of the saved text with sample values in a sandboxed iframe.
 */
function Editor() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = React.useState<EmailTemplateDetail | null>()
  const [error, setError] = React.useState<string>()
  const [fromName, setFromName] = React.useState("")
  const [draft, setDraft] = React.useState<Record<Lang, Draft>>()
  const [lang, setLang] = React.useState<Lang>("vi")
  const [busy, setBusy] = React.useState(false)
  const [preview, setPreview] = React.useState<RenderedEmail>()
  const [touched, setTouched] = React.useState(false)
  const subjectRef = React.useRef<HTMLInputElement>(null)
  const contentRef = React.useRef<HTMLTextAreaElement>(null)
  const lastField = React.useRef<"subject" | "content">("content")

  const apply = (d: EmailTemplateDetail) => {
    setDetail(d)
    setFromName(d.template?.fromName ?? "")
    setDraft(drafts(d))
  }
  React.useEffect(() => {
    let cancelled = false
    EmailTemplateService.get(id)
      .then((d) => !cancelled && apply(d))
      .catch((e) => {
        if (cancelled) return
        setDetail(null)
        setError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (detail === undefined || (detail && !draft)) return <Skeleton className="h-96" />
  if (!detail || !draft) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const saved = drafts(detail)
  const cur = draft[lang]
  const dirty = (l: Lang) => draft[l].subject !== saved[l].subject || draft[l].content !== saved[l].content
  const hasSaved = (l: Lang) => !!detail.contents?.some((c) => c.lang === l)
  const subjectErr = touched && !cur.subject.trim() ? t("et.required") : undefined
  const contentErr = touched && !cur.content.trim() ? t("et.required") : undefined
  const fromDirty = fromName !== (detail.template?.fromName ?? "")
  const setCur = (patch: Partial<Draft>) => setDraft({ ...draft, [lang]: { ...cur, ...patch } })

  const run = async (fn: () => Promise<EmailTemplateDetail>, ok: TranslationKey) => {
    setBusy(true)
    try {
      const d = await fn()
      // keep the other languages' unsaved edits
      const fresh = drafts(d)
      setDetail(d)
      setFromName(d.template?.fromName ?? "")
      setDraft((prev) => Object.fromEntries(TEMPLATE_LANGS.map((l) => [l, prev && l !== lang && dirty(l) ? prev[l] : fresh[l]])) as Record<Lang, Draft>)
      toast.success(t(ok))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const saveContent = () => {
    setTouched(true)
    if (!cur.subject.trim() || !cur.content.trim()) return
    void run(() => EmailTemplateService.saveContent(id, lang, { subject: cur.subject, content: cur.content }), "et.contentSaved")
  }
  const insert = (v: string) => {
    const token = `{${v}}`
    const field = lastField.current
    const el = field === "subject" ? subjectRef.current : contentRef.current
    const text = cur[field]
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const max = field === "subject" ? MAX_SUBJECT : MAX_CONTENT
    const next = (text.slice(0, start) + token + text.slice(end)).slice(0, max)
    setCur({ [field]: next })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }
  const openPreview = async () => {
    setBusy(true)
    try {
      setPreview(await EmailTemplateService.preview(id, lang))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Button variant="link" asChild className="justify-self-start px-0">
        <Link href="/email-templates">
          <ArrowLeft /> {t("menu.emailTemplates")}
        </Link>
      </Button>
      <PageHeader title={detail.template?.name ?? ""} description={t("et.editHint")}>
        <Badge variant="outline" className="font-mono">
          {detail.template?.code}
        </Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{t("et.settings")}</CardTitle>
          <CardDescription>{t("et.settingsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-64 flex-1 gap-1.5">
            <Label htmlFor="et-from">{t("et.fromName")}</Label>
            <Input id="et-from" maxLength={100} value={fromName} onChange={(e) => setFromName(e.target.value)} aria-invalid={!fromName.trim()} />
            <FieldError message={!fromName.trim() ? t("et.required") : undefined} />
          </div>
          <Button disabled={busy || !fromDirty || !fromName.trim()} onClick={() => run(() => EmailTemplateService.saveFromName(id, fromName.trim()), "et.settingsSaved")}>
            <Save /> {t("et.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("et.content")}</CardTitle>
          <CardDescription>{t("et.contentHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs value={lang} onValueChange={(v) => { setLang(v as Lang); setTouched(false) }}>
            <TabsList>
              {TEMPLATE_LANGS.map((l) => (
                <TabsTrigger key={l} value={l}>
                  {t(`et.lang.${l}` as TranslationKey)}
                  {dirty(l) && <span className="bg-primary ml-1 size-2 rounded-full" aria-label={t("et.unsaved")} />}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {!hasSaved(lang) && (
            <Alert>
              <AlertDescription>{t("et.noText")}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="et-subject">{t("et.subject")} *</Label>
            <Input id="et-subject" ref={subjectRef} maxLength={MAX_SUBJECT} value={cur.subject} onFocus={() => (lastField.current = "subject")} onChange={(e) => setCur({ subject: e.target.value })} aria-invalid={!!subjectErr} />
            <FieldError message={subjectErr} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="et-content">{t("et.body")} *</Label>
            <Textarea id="et-content" ref={contentRef} rows={14} maxLength={MAX_CONTENT} className="font-mono text-xs" value={cur.content} onFocus={() => (lastField.current = "content")} onChange={(e) => setCur({ content: e.target.value })} aria-invalid={!!contentErr} />
            <div className="flex justify-between">
              <FieldError message={contentErr} />
              <span className="text-muted-foreground ml-auto text-xs">
                {cur.content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t("et.variables")}</span>
            <p className="text-muted-foreground text-xs">{t("et.variablesHint")}</p>
            <div className="flex flex-wrap gap-1.5" data-testid="et-variables">
              {[...(detail.variables ?? []), "app_name", "app_url"].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                <Button key={v} type="button" size="sm" variant="outline" className="font-mono text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}>
                  {`{${v}}`}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button disabled={busy || !dirty(lang)} onClick={saveContent}>
              <Save /> {t("et.saveLang", { lang: t(`et.lang.${lang}` as TranslationKey) })}
            </Button>
            <Button variant="outline" disabled={busy || !dirty(lang)} onClick={() => setDraft({ ...draft, [lang]: saved[lang] })}>
              {t("et.discard")}
            </Button>
            <Button variant="outline" disabled={busy || !hasSaved(lang)} onClick={openPreview}>
              <Eye /> {t("et.preview")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(undefined)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("et.preview")}</DialogTitle>
            <DialogDescription>{dirty(lang) ? t("et.previewUnsaved") : t("et.previewHint")}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("et.fromName")}</dt>
            <dd data-testid="et-preview-from">{preview?.fromName}</dd>
            <dt className="text-muted-foreground">{t("et.subject")}</dt>
            <dd data-testid="et-preview-subject">{preview?.subject}</dd>
          </dl>
          {/* admin-authored HTML: a sandbox without allow-scripts keeps it inert */}
          <iframe title={t("et.preview")} sandbox="" srcDoc={preview?.html ?? ""} className="h-[55vh] w-full rounded-md border bg-white" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
