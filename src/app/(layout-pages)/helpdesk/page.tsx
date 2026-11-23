"use client"

import * as React from "react"
import { Lock, Paperclip, Send, Trash2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import { CompanyService } from "@/lib/admin/admin.service"
import { formatDate } from "@/lib/format"
import { HD_PRIORITIES, HD_STATUSES, HelpdeskService, textToHtml, type HdStats, type HdTicketDetail } from "@/lib/helpdesk/helpdesk.service"
import type { Row } from "@/lib/hrm/hrm.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"
import { htmlToText } from "@/lib/support/support.service"

import { attempt, CrudSection, Field, FileInput, FormDialogBody, HrStatus, initialValues, PlainSelect, TabbedPage, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../hrm/_components/crud-kit"

const MAX_FILES = 5

export default function HelpdeskPage() {
  return (
    <React.Suspense>
      <Helpdesk />
    </React.Suspense>
  )
}

/**
 * §3.3 platform helpdesk (companies → platform). One route: a company user (HELPDESK_VIEW / HELPDESK_CREATE) sees and
 * opens their company's tickets; the super admin sees every company's, edits, deletes, posts internal replies and manages
 * categories and the monthly figures.
 */
function Helpdesk() {
  const t = useT()
  const me = useAuthStore((s) => s.me)
  const admin = !!me?.superAdmin
  return (
    <TabbedPage
      title={t("menu.helpdesk")}
      description={t(admin ? "hd.subtitleAdmin" : "hd.subtitle")}
      tabs={[
        { key: "tickets", label: "hd.tickets", content: () => <Tickets admin={admin} create={admin || !!me?.permissions?.includes("HELPDESK_CREATE")} /> },
        { key: "categories", label: "hd.categories", content: () => <Categories />, visible: admin },
        { key: "stats", label: "hd.stats", content: () => <Stats />, visible: admin },
      ]}
    />
  )
}

const priorityVariant = (p?: unknown) => (p === "URGENT" ? "destructive" : p === "HIGH" ? "default" : p === "LOW" ? "outline" : "secondary")

function Tickets({ admin, create }: { admin: boolean; create: boolean }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const priority = searchParams.get("priority") ?? ""
  const categoryId = searchParams.get("categoryId") ?? ""
  const categories = useOptions("hd:categories", HelpdeskService.categories as () => Promise<Row[]>)
  const companies = useOptions("hd:companies", () => CompanyService.list({ size: 200 }).then((p) => (p.content ?? []).map((c) => ({ id: c.id, name: c.name }))), admin)
  const [viewing, setViewing] = React.useState<string>()
  const [editing, setEditing] = React.useState<{ id?: string; values?: Record<string, unknown> }>()
  const [reload, setReload] = React.useState(0)
  const activeCats = categories.filter((c) => c.active !== false).map((c) => ({ value: String(c.id), label: String(c.name) }))
  const allCats = categories.map((c) => ({ value: String(c.id), label: String(c.name) }))
  const cfg: CrudConfig = {
    id: `hd-${priority}-${categoryId}`,
    load: HelpdeskService.tickets,
    query: { priority: priority || undefined, categoryId: categoryId || undefined },
    keyword: true,
    statuses: [...HD_STATUSES],
    reloadKey: reload,
    onRowClick: (r) => setViewing(r.id),
    columns: [
      { label: "hd.number", path: "ticketNumber", kind: "mono" },
      { label: "hr.f.title", path: "title" },
      ...(admin ? [{ label: "hd.company" as TranslationKey, path: "companyName" }] : []),
      {
        label: "hr.f.category",
        render: (r) =>
          r.categoryName ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: String(r.categoryColor ?? "#999") }} /> {String(r.categoryName)}
            </span>
          ) : (
            "-"
          ),
      },
      { label: "hd.priority", render: (r) => <Badge variant={priorityVariant(r.priority)}>{t(`hd.priorityOf.${String(r.priority ?? "MEDIUM")}` as TranslationKey)}</Badge> },
      { label: "hd.created", render: (r) => formatDate(String(r.createdDate ?? ""), language) },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.ticketNumber ?? r.title ?? ""),
    remove: admin ? HelpdeskService.remove : undefined,
    manage: admin,
    toolbar: (
      <>
        <PlainSelect label={t("hd.priority")} className="w-36" value={priority} onChange={(v) => update({ priority: v, page: 0 })} none={t("hd.allPriorities")} options={HD_PRIORITIES.map((p) => ({ value: p, label: t(`hd.priorityOf.${p}`) }))} />
        <PlainSelect label={t("hr.f.category")} className="w-44" value={categoryId} onChange={(v) => update({ categoryId: v, page: 0 })} none={t("acc.allCategories")} options={allCats} />
        {create && <Button onClick={() => setEditing({})}>{t("hd.create")}</Button>}
      </>
    ),
  }
  const fields: FieldDef[] = [
    ...(admin && !editing?.id ? [{ name: "companyId", label: "hd.company", type: "select", required: true, numeric: true, options: companies.map((c) => ({ value: String(c.id), label: String(c.name) })) } satisfies FieldDef] : []),
    { name: "title", label: "hr.f.title", required: true, max: 255, full: true },
    { name: "categoryId", label: "hr.f.category", type: "select", numeric: true, none: true, options: editing?.id ? allCats : activeCats },
    ...(admin
      ? [
          { name: "priority", label: "hd.priority", type: "select", required: true, options: HD_PRIORITIES.map((p) => ({ value: p, label: t(`hd.priorityOf.${p}`) })) } satisfies FieldDef,
          ...(editing?.id ? [{ name: "status", label: "hr.f.status", type: "select", required: true, options: HD_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}` as TranslationKey) })) } satisfies FieldDef] : []),
        ]
      : []),
    { name: "description", label: "hr.f.description", type: "textarea", required: true, max: 15000 },
  ]
  return (
    <>
      <CrudSection config={cfg} />
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editing && (
            <FormDialogBody
              key={editing.id ?? "new"}
              prefix="hd"
              title={t(editing.id ? "hd.edit" : "hd.create")}
              description={editing.id ? undefined : t(admin ? "hd.createHintAdmin" : "hd.createHint")}
              fields={fields}
              initial={initialValues(fields, editing.values ?? null, { priority: "MEDIUM" })}
              onClose={() => setEditing(undefined)}
              onSubmit={async (b) => {
                const body = { ...b, description: textToHtml(String(b.description ?? "")), categoryId: b.categoryId ?? null }
                const ok = await attempt(() => (editing.id ? HelpdeskService.update(editing.id, body) : HelpdeskService.create(body)), t("common.saved"))
                if (ok) setReload((x) => x + 1)
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {viewing && (
            <TicketView
              key={viewing}
              id={viewing}
              admin={admin}
              canReply={create}
              onChanged={() => setReload((x) => x + 1)}
              onEdit={(d) => {
                setViewing(undefined)
                setEditing({ id: d.ticket?.id, values: { ...d.ticket, description: htmlToText(d.description) } })
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Conversation: description, replies (platform / company, internal notes for the super admin), attachments, reply. */
function TicketView({ id, admin, canReply, onChanged, onEdit }: { id: string; admin: boolean; canReply: boolean; onChanged: () => void; onEdit: (d: HdTicketDetail) => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [d, setD] = React.useState<HdTicketDetail>()
  const [key, setKey] = React.useState(0)
  const [text, setText] = React.useState("")
  const [internal, setInternal] = React.useState(false)
  const [files, setFiles] = React.useState<{ id: string; name: string }[]>([])
  const [sending, setSending] = React.useState(false)
  const [removing, setRemoving] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    HelpdeskService.ticket(id)
      .then((x) => !cancelled && setD(x))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, key])
  if (!d) return <Skeleton className="h-64 w-full" />
  const tk = d.ticket ?? {}
  const closed = tk.status === "CLOSED"
  // createdDate is an Instant (UTC): shown in the viewer's local time
  const when = (s?: string) => (s ? new Date(s).toLocaleString(language, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "")
  const refresh = () => {
    setKey((x) => x + 1)
    onChanged()
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <span className="font-mono text-sm">{tk.ticketNumber}</span> {tk.title}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          {admin && tk.companyName && <span>{tk.companyName} ·</span>}
          {tk.categoryName ?? "-"} · <Badge variant={priorityVariant(tk.priority)}>{t(`hd.priorityOf.${tk.priority ?? "MEDIUM"}` as TranslationKey)}</Badge> <HrStatus status={tk.status} />
          {admin && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => onEdit(d)}>
              {t("common.edit")}
            </Button>
          )}
        </DialogDescription>
      </DialogHeader>
      <Card>
        <CardContent className="pt-4 text-sm">
          <p className="whitespace-pre-wrap" data-testid="hd-description">
            {htmlToText(d.description)}
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-2" aria-label={t("hd.conversation")}>
        {(d.replies ?? []).map((r) => (
          <div
            key={r.id}
            data-testid="hd-reply"
            className={`max-w-[85%] rounded-lg p-3 text-sm ${r.internal ? "justify-self-end border border-dashed border-amber-500 bg-amber-500/10" : r.fromPlatform ? "bg-primary/10 justify-self-end" : "bg-muted justify-self-start"}`}
          >
            <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
              <span>
                {r.authorName} · {when(r.createdDate)}
              </span>
              {r.internal && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="size-3" /> {t("hd.internal")}
                </Badge>
              )}
              {admin && (
                <Button variant="ghost" size="icon" className="ml-auto size-6" aria-label={t("hd.deleteMessage")} onClick={() => setRemoving(r.id)}>
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
            <p className="whitespace-pre-wrap">{htmlToText(r.message)}</p>
            {!!r.attachmentFileIds?.length && (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.attachmentFileIds.map((f) => (
                  <Attachment key={f} id={f} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {canReply &&
        (closed ? (
          <p className="text-muted-foreground text-sm">{t("hd.closedNoReply")}</p>
        ) : (
          <div className="grid gap-2">
            <Field id="hd-reply" label={t("hd.reply")}>
              <Textarea id="hd-reply" rows={3} maxLength={15000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              {/* attachments must be media files of the ticket's company (HDK_007): only the company uploads them */}
              {!admin && files.length < MAX_FILES && <FileInput id="hd-file" label={t("sp.attach")} onUploaded={(fid, name) => setFiles((f) => [...f, { id: fid, name }])} />}
              {files.map((f) => (
                <Badge key={f.id} variant="secondary">
                  <Paperclip className="size-3" /> {f.name}
                </Badge>
              ))}
              {admin && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={internal} onCheckedChange={setInternal} aria-label={t("hd.internalNote")} /> {t("hd.internalNote")}
                </label>
              )}
            </div>
            <DialogFooter>
              <Button
                disabled={!text.trim() || sending}
                onClick={async () => {
                  setSending(true)
                  const body = { message: textToHtml(text), ...(files.length ? { attachmentFileIds: files.map((f) => Number(f.id)) } : {}), ...(admin ? { internal } : {}) }
                  const ok = await attempt(() => HelpdeskService.reply(id, body), t("common.saved"))
                  setSending(false)
                  if (ok) {
                    setText("")
                    setFiles([])
                    setInternal(false)
                    refresh()
                  }
                }}
              >
                <Send className="size-4" /> {t("sp.send")}
              </Button>
            </DialogFooter>
          </div>
        ))}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title={t("hd.deleteMessage")}
        description={t("hd.deleteMessageDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing && (await attempt(() => HelpdeskService.removeReply(id, removing), t("sales.done.deleted")))) refresh()
          setRemoving(undefined)
        }}
      />
    </>
  )
}

/** An attachment chip: the media file name, opened through its download url. */
function Attachment({ id }: { id: string }) {
  const [file, setFile] = React.useState<{ name?: string; url?: string }>()
  React.useEffect(() => {
    let cancelled = false
    MediaService.file(id)
      .then((f) => !cancelled && setFile({ name: f.displayName ?? f.originalName, url: f.downloadUrl ?? f.viewUrl }))
      .catch(() => !cancelled && setFile({}))
    return () => {
      cancelled = true
    }
  }, [id])
  const label = file?.name ?? `#${id}`
  return (
    <Badge variant="outline" className="gap-1">
      <Paperclip className="size-3" />
      {file?.url && /^https?:\/\/|^\//.test(file.url) ? (
        <a href={file.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          {label}
        </a>
      ) : (
        label
      )}
    </Badge>
  )
}

function Categories() {
  const t = useT()
  const cfg: CrudConfig = {
    id: "hd-categories",
    load: HelpdeskService.categories as () => Promise<Row[]>,
    columns: [
      { label: "hr.f.name", render: (r) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="inline-block size-2.5 rounded-full" style={{ background: String(r.color ?? "#999") }} /> {String(r.name ?? "")}
        </span>
      ) },
      { label: "hr.f.description", path: "description" },
      { label: "hr.f.active", path: "active", kind: "bool" },
    ],
    rowName: (r) => String(r.name ?? ""),
    createLabel: "hd.createCategory",
    fields: [
      { name: "name", label: "hr.f.name", required: true, max: 100 },
      { name: "color", label: "hr.f.color", type: "color", required: true },
      { name: "description", label: "hr.f.description", type: "textarea", max: 500 },
      { name: "active", label: "hr.f.active", type: "switch" },
    ],
    defaults: { active: true },
    save: HelpdeskService.saveCategory,
    remove: HelpdeskService.removeCategory,
    invalidates: true,
    manage: true,
  }
  return (
    <>
      <p className="text-muted-foreground text-xs">{t("hd.categoriesHint")}</p>
      <CrudSection config={cfg} />
    </>
  )
}

function Stats() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const thisYear = new Date().getFullYear()
  const [year, setYear] = React.useState(thisYear)
  const [data, setData] = React.useState<{ year: number; stats?: HdStats; error?: string }>()
  React.useEffect(() => {
    let cancelled = false
    HelpdeskService.stats(year)
      .then((stats) => !cancelled && setData({ year, stats }))
      .catch((e: unknown) => !cancelled && setData({ year, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
  }, [year])
  const s = data?.year === year ? data.stats : undefined
  const config = { created: { label: t("hd.createdCount"), color: "var(--chart-1)" }, resolved: { label: t("hd.resolvedCount"), color: "var(--chart-2)" } } satisfies ChartConfig
  const series = (s?.months ?? []).map((m) => ({ month: new Date(2000, (m.month ?? 1) - 1, 1).toLocaleDateString(language, { month: "short" }), created: m.created ?? 0, resolved: m.resolved ?? 0 }))
  return (
    <div className="grid gap-4">
      <PlainSelect label={t("hd.year")} className="w-32" value={String(year)} onChange={(v) => setYear(Number(v))} options={[0, 1, 2, 3].map((i) => ({ value: String(thisYear - i), label: String(thisYear - i) }))} />
      {data?.error && data.year === year && <p className="text-destructive text-sm">{data.error}</p>}
      <div className="grid gap-3 sm:grid-cols-5">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-normal">{t("hd.total")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="hd-total">
            {s ? (s.total ?? 0) : "…"}
          </CardContent>
        </Card>
        {HD_STATUSES.map((st) => (
          <Card key={st}>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-xs font-normal">{t(`hr.status.${st}` as TranslationKey)}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold" data-testid={`hd-count-${st}`}>
              {s ? (s.byStatus?.[st] ?? 0) : "…"}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hd.monthly", { year })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="h-64 w-full">
            <BarChart data={series}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={30} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="created" fill="var(--color-created)" radius={4} />
              <Bar dataKey="resolved" fill="var(--color-resolved)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
