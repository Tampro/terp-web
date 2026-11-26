"use client"

import * as React from "react"
import { Plus, Send } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { textToHtml } from "@/lib/helpdesk/helpdesk.service"
import { htmlToText, PortalTicketService, TICKET_STATUSES, type PortalTicket, type PortalTicketRow, type TicketField } from "@/lib/support/support.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { attempt, errorMessage, Field, HrStatus, PlainSelect } from "../../hrm/_components/crud-kit"

const PAGE_SIZE = 20

export default function PortalTicketsPage() {
  return (
    <React.Suspense>
      <PortalTickets />
    </React.Suspense>
  )
}

/**
 * Client portal tickets (PORTAL_CLIENT, support-service /portal/client/tickets): the tickets I raised here or on the public
 * portal with my account's email; raise one (category, subject, description: name and email are my account's), read the
 * conversation and reply while it is not closed. Staff replies carry no sender name.
 */
function PortalTickets() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [reload, setReload] = React.useState(0)
  const key = JSON.stringify({ status, page, reload })
  const [data, setData] = React.useState<{ key: string; page?: IPage<PortalTicketRow> }>()
  const [creating, setCreating] = React.useState(false)
  const [viewing, setViewing] = React.useState<string>()

  React.useEffect(() => {
    let cancelled = false
    const q = JSON.parse(key) as { status: string; page: number }
    PortalTicketService.list({ status: q.status || undefined, page: q.page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData({ key, page: p }))
      .catch((e: unknown) => {
        if (cancelled) return
        toast.error(errorMessage(e))
        setData({ key })
      })
    return () => {
      cancelled = true
    }
  }, [key])
  const loading = data?.key !== key
  const rows = data?.page?.content ?? []

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.portal.tickets")} description={t("pt.subtitle")} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={status || "ALL"} onValueChange={(v) => update({ status: v === "ALL" ? "" : v, page: 0 })}>
              <TabsList>
                <TabsTrigger value="ALL">{t("companies.tabAll")}</TabsTrigger>
                {TICKET_STATUSES.map((s) => (
                  <TabsTrigger key={s} value={s}>
                    {t(`hr.status.${s}` as TranslationKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> {t("pt.create")}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pt.number")}</TableHead>
                  <TableHead>{t("pt.subject")}</TableHead>
                  <TableHead>{t("pt.category")}</TableHead>
                  <TableHead>{t("pt.updated")}</TableHead>
                  <TableHead>{t("hr.f.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      {t("pt.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.ticketNumber ?? "-"}</TableCell>
                      <TableCell>
                        <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setViewing(r.id)}>
                          {r.subject ?? "-"}
                        </button>
                      </TableCell>
                      <TableCell>{r.categoryName ?? "-"}</TableCell>
                      <TableCell>{formatDate(r.updatedDate ?? r.createdDate, language, true)}</TableCell>
                      <TableCell>
                        <HrStatus status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page?.page ?? page} size={data?.page?.size ?? PAGE_SIZE} total={data?.page?.totalElements ?? 0} totalPages={data?.page?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-xl">
          {creating && (
            <CreateTicket
              onClose={() => setCreating(false)}
              onCreated={(id) => {
                setReload((x) => x + 1)
                setViewing(id)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{viewing && <TicketView key={viewing} id={viewing} onChanged={() => setReload((x) => x + 1)} />}</DialogContent>
      </Dialog>
    </div>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** a custom field value the backend would refuse (SUP_035..SUP_039): required, TEXT ≤ 255 / TEXTAREA ≤ 2000, EMAIL, NUMBER, SELECT option */
function fieldError(f: TicketField, v: string, t: (k: TranslationKey) => string) {
  const x = v.trim()
  if (!x) return f.required ? t("pt.v.required") : undefined
  if (f.type === "EMAIL" && !EMAIL.test(x)) return t("hr.v.email")
  if (f.type === "NUMBER" && !Number.isFinite(Number(x))) return t("pt.v.number")
  if (f.type === "SELECT" && !(f.options ?? []).includes(x)) return t("pt.v.required")
  return undefined
}

/**
 * PortalTicketForm {categoryId, subject ≤255, description, customFields}: the description is sent as escaped paragraphs (the
 * backend sanitizes HTML); the company's active custom fields (GET /portal/client/tickets/fields) follow their type, width
 * (12 = full row) and options, and only filled values are sent as {fieldId, value}.
 */
function CreateTicket({ onClose, onCreated }: { onClose: () => void; onCreated: (id?: string) => void }) {
  const t = useT()
  const [categories, setCategories] = React.useState<{ id?: string; name?: string }[]>()
  const [fields, setFields] = React.useState<TicketField[]>([])
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [touched, setTouched] = React.useState(false)
  const [f, setF] = React.useState({ categoryId: "", subject: "", description: "" })
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    PortalTicketService.categories()
      .then((c) => !cancelled && setCategories(c ?? []))
      .catch((e: unknown) => {
        if (cancelled) return
        toast.error(errorMessage(e))
        setCategories([])
      })
    PortalTicketService.fields()
      .then((l) => !cancelled && setFields([...(l ?? [])].filter((x) => x.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))))
      .catch((e: unknown) => !cancelled && toast.error(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [])
  const errors = Object.fromEntries(fields.map((x) => [String(x.id), fieldError(x, values[String(x.id)] ?? "", t)]))
  const valid = !!f.categoryId && !!f.subject.trim() && !!f.description.trim() && !Object.values(errors).some(Boolean)
  async function submit() {
    setSaving(true)
    let created: PortalTicket | undefined
    const ok = await attempt(async () => {
      const customFields = fields.map((x) => ({ fieldId: Number(x.id), value: (values[String(x.id)] ?? "").trim() })).filter((x) => x.value)
      created = await PortalTicketService.create({ categoryId: Number(f.categoryId), subject: f.subject.trim(), description: textToHtml(f.description), ...(customFields.length ? { customFields } : {}) })
    }, t("pt.created"))
    setSaving(false)
    if (ok) {
      onClose()
      onCreated(created?.ticket?.id)
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("pt.create")}</DialogTitle>
        <DialogDescription>{t("pt.createDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Field id="pt-cat" label={t("pt.category")}>
          <PlainSelect id="pt-cat" label={t("pt.category")} value={f.categoryId} onChange={(v) => setF({ ...f, categoryId: v })} none={categories?.length === 0 ? t("pt.noCategories") : t("pt.pickCategory")} options={(categories ?? []).map((c) => ({ value: String(c.id), label: String(c.name ?? "") }))} />
        </Field>
        <Field id="pt-subject" label={t("pt.subject")}>
          <Input id="pt-subject" maxLength={255} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        </Field>
        <Field id="pt-desc" label={t("pt.description")}>
          <Textarea id="pt-desc" rows={6} maxLength={10000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        {fields.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="pt-custom-fields">
            {fields.map((x) => {
              const id = `pt-cf-${x.id}`
              const v = values[String(x.id)] ?? ""
              const set = (nv: string) => {
                setTouched(true)
                setValues((o) => ({ ...o, [String(x.id)]: nv }))
              }
              const label = `${x.label ?? ""}${x.required ? " *" : ""}`
              return (
                <Field key={x.id} id={id} label={label} error={touched || v ? errors[String(x.id)] : undefined} className={(x.width ?? 12) > 6 ? "sm:col-span-2" : ""}>
                  {x.type === "SELECT" ? (
                    <PlainSelect id={id} label={x.label ?? ""} value={v} onChange={set} none={x.placeholder || t("pt.pick")} options={(x.options ?? []).map((o) => ({ value: o, label: o }))} />
                  ) : x.type === "TEXTAREA" ? (
                    <Textarea id={id} rows={3} maxLength={2000} placeholder={x.placeholder ?? undefined} value={v} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <Input id={id} type={x.type === "EMAIL" ? "email" : x.type === "NUMBER" ? "number" : x.type === "DATE" ? "date" : "text"} step={x.type === "NUMBER" ? "any" : undefined} maxLength={x.type === "TEXT" ? 255 : undefined} placeholder={x.placeholder ?? undefined} value={v} onChange={(e) => set(e.target.value)} />
                  )}
                </Field>
              )
            })}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button disabled={!valid || saving} onClick={submit}>
          {t("pt.send")}
        </Button>
      </DialogFooter>
    </>
  )
}

/** One ticket: description, conversation (STAFF / CUSTOMER) and a reply box while the ticket is not CLOSED. */
function TicketView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [reload, setReload] = React.useState(0)
  const [data, setData] = React.useState<PortalTicket>()
  const [text, setText] = React.useState("")
  const [sending, setSending] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    PortalTicketService.get(id)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && toast.error(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [id, reload])
  if (!data) return <Skeleton className="h-48 w-full" />
  const tk = data.ticket ?? {}
  const closed = tk.status === "CLOSED"
  async function reply() {
    setSending(true)
    const ok = await attempt(() => PortalTicketService.reply(id, textToHtml(text)), t("pt.replied"))
    setSending(false)
    if (ok) {
      setText("")
      setReload((x) => x + 1)
      onChanged()
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{tk.subject ?? "-"}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{tk.ticketNumber}</span> · {tk.categoryName ?? "-"} · <HrStatus status={tk.status} />
        </DialogDescription>
      </DialogHeader>
      <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap" data-testid="pt-description">
        {htmlToText(data.description)}
      </div>
      {!!data.attachmentNames?.length && <p className="text-muted-foreground text-xs">{t("pt.attachments", { names: data.attachmentNames.join(", ") })}</p>}
      <div className="grid gap-2" role="log" aria-label={t("pt.conversation")}>
        {(data.replies ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("pt.noReplies")}</p>}
        {(data.replies ?? []).map((r, i) => (
          <div key={i} className={`rounded-md border p-3 text-sm ${r.senderType === "STAFF" ? "bg-primary/5" : ""}`}>
            <div className="mb-1 flex items-center gap-2 text-xs">
              <Badge variant={r.senderType === "STAFF" ? "default" : "outline"}>{r.senderType === "STAFF" ? t("pt.staff") : (r.senderName ?? t("pt.you"))}</Badge>
              <span className="text-muted-foreground">{formatDate(r.createdDate, language, true)}</span>
            </div>
            <div className="whitespace-pre-wrap">{htmlToText(r.description)}</div>
          </div>
        ))}
      </div>
      {closed ? (
        <p className="text-muted-foreground text-sm">{t("pt.closedNote")}</p>
      ) : (
        <div className="grid gap-2">
          <Textarea aria-label={t("pt.reply")} placeholder={t("pt.reply")} rows={3} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-end">
            <Button disabled={!text.trim() || sending} onClick={reply}>
              <Send className="size-4" /> {t("pt.sendReply")}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
