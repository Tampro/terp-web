"use client"

import * as React from "react"
import { Paperclip, Send } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { Row } from "@/lib/hrm/hrm.service"
import { ACCOUNT_TYPES, SUP, SupportService, TICKET_STATUSES, type TicketDetail, type TicketField } from "@/lib/support/support.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, Field, FileInput, FormDialogBody, HrStatus, initialValues, PlainSelect, TabbedPage, useAuthStore, useOptions, type CrudConfig, type FieldDef } from "../../hrm/_components/crud-kit"

const MAX_FILES = 5

export default function TicketsPage() {
  return (
    <React.Suspense>
      <Tickets />
    </React.Suspense>
  )
}

/** Custom ticket fields (SupportService.fields) as kit fields named `cf_<id>`. */
function customFieldDefs(fields: TicketField[]): FieldDef[] {
  return fields
    .filter((f) => f.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f) => ({
      name: `cf_${f.id}`,
      label: f.label as TranslationKey,
      required: f.required,
      type: f.type === "TEXTAREA" ? "textarea" : f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : f.type === "EMAIL" ? "email" : f.type === "SELECT" ? "select" : "text",
      options: f.type === "SELECT" ? (f.options ?? []).map((o) => ({ value: o, label: o })) : undefined,
      pattern: f.type === "EMAIL" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/ : undefined,
      patternMsg: "hr.v.email",
      max: f.type === "NUMBER" ? undefined : 2000,
      full: (f.width ?? 12) > 6,
    }))
}

/** §18 tickets: account type, name, email, category, subject, status, description, attachments, custom fields; tabs In Progress / On Hold / Closed; reply disabled when closed. */
function Tickets() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("SUPPORT_TICKET_MANAGE")
  const categories = useOptions("sup:categories", SupportService.categories)
  const fields = useOptions("sup:fields", SupportService.fields as () => Promise<Row[]>) as TicketField[]
  const { searchParams, update } = useUrlQuery()
  const categoryId = searchParams.get("categoryId") ?? ""
  const accountType = searchParams.get("accountType") ?? ""
  const [viewing, setViewing] = React.useState<string>()
  const [reload, setReload] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const catOptions = categories.map((c) => ({ value: String(c.id), label: String(c.name) }))
  const color = (id: unknown) => String(categories.find((c) => c.id === String(id))?.color ?? "#999")
  const cfg: CrudConfig = {
    id: `tickets-${categoryId}-${accountType}`,
    load: SUP.tickets.list,
    query: { categoryId: categoryId || undefined, accountType: accountType || undefined },
    keyword: true,
    statuses: [...TICKET_STATUSES],
    reloadKey: reload,
    onRowClick: (r) => setViewing(r.id),
    columns: [
      { label: "sp.number", path: "ticketNumber", kind: "mono" },
      { label: "sp.subject", path: "subject" },
      { label: "sp.requester", render: (r) => <span>{String(r.name ?? "")}<span className="text-muted-foreground block text-xs">{String(r.email ?? "")}</span></span> },
      { label: "sp.accountType", render: (r) => t(`sp.account.${String(r.accountType)}` as TranslationKey) },
      {
        label: "hr.f.category",
        render: (r) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: color(r.categoryId) }} /> {String(r.categoryName ?? "-")}
          </span>
        ),
      },
      { label: "sp.created", render: (r) => <span>{formatDate(String(r.createdDate ?? ""), language)} {r.fromPortal ? <Badge variant="outline">{t("sp.fromPortal")}</Badge> : null}</span> },
      { label: "hr.f.status", path: "status", kind: "status" },
    ],
    rowName: (r) => String(r.ticketNumber ?? r.subject ?? ""),
    remove: SUP.tickets.remove,
    manage,
    toolbar: (
      <>
        <PlainSelect label={t("hr.f.category")} className="w-44" value={categoryId} onChange={(v) => update({ categoryId: v, page: 0 })} none={t("acc.allCategories")} options={catOptions} />
        <PlainSelect label={t("sp.accountType")} className="w-40" value={accountType} onChange={(v) => update({ accountType: v, page: 0 })} none={t("le.allTypes")} options={ACCOUNT_TYPES.map((a) => ({ value: a, label: t(`sp.account.${a}`) }))} />
        {manage && <Button onClick={() => setCreating(true)}>{t("sp.ticket.create")}</Button>}
      </>
    ),
  }
  const baseFields: FieldDef[] = [
    { name: "accountType", label: "sp.accountType", type: "select", required: true, options: ACCOUNT_TYPES.map((a) => ({ value: a, label: t(`sp.account.${a}`) })) },
    { name: "categoryId", label: "hr.f.category", type: "select", required: true, numeric: true, options: catOptions },
    { name: "name", label: "hr.f.name", required: true, max: 255 },
    { name: "email", label: "hr.f.email", type: "email", required: true, max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
    { name: "subject", label: "sp.subject", required: true, max: 255, full: true },
    { name: "status", label: "hr.f.status", type: "select", options: TICKET_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}`) })) },
    { name: "description", label: "hr.f.description", type: "textarea", required: true, max: 100000 },
    ...Array.from({ length: 3 }, (_, i): FieldDef => ({ name: `file${i}`, label: "sp.attachmentN", type: "file", hidden: (v) => i > 0 && !v[`file${i - 1}`] })),
    ...customFieldDefs(fields),
  ]
  return (
    <>
      <TabbedPage title={t("menu.sp.tickets")} description={t("sp.tickets.subtitle")} tabs={[{ key: "list", label: "menu.sp.tickets", content: () => <CrudSection config={cfg} /> }]} />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {creating && (
            <FormDialogBody
              prefix="ticket"
              title={t("sp.ticket.create")}
              fields={baseFields}
              initial={initialValues(baseFields, null, { accountType: "CUSTOM", status: "IN_PROGRESS" })}
              onClose={() => setCreating(false)}
              onSubmit={async (b) => {
                const attachmentFileIds = [0, 1, 2].map((i) => b[`file${i}`]).filter((x): x is number => typeof x === "number")
                const customFields = Object.entries(b)
                  .filter(([k]) => k.startsWith("cf_"))
                  .map(([k, v]) => ({ fieldId: Number(k.slice(3)), value: String(v) }))
                const rest = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith("cf_") && !k.startsWith("file")))
                const ok = await attempt(() => SUP.tickets.save(undefined, { ...rest, attachmentFileIds, customFields }), t("common.saved"))
                if (ok) setReload((x) => x + 1)
                return ok
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{viewing && <TicketView key={viewing} id={viewing} manage={manage} onChanged={() => setReload((x) => x + 1)} />}</DialogContent>
      </Dialog>
    </>
  )
}

/** Conversation with the requester: description, replies (staff / customer), attachments, custom fields; reply and status. */
function TicketView({ id, manage, onChanged }: { id: string; manage: boolean; onChanged: () => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [d, setD] = React.useState<TicketDetail>()
  const [key, setKey] = React.useState(0)
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<{ id: string; name: string }[]>([])
  const [sending, setSending] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    SupportService.ticket(id)
      .then((x) => !cancelled && setD(x))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, key])
  if (!d) return <Skeleton className="h-64 w-full" />
  const tk = d.ticket ?? {}
  const closed = tk.status === "CLOSED"
  const when = (s?: string) => (s ? `${formatDate(s.slice(0, 10), language)} ${s.slice(11, 16)}` : "")
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <span className="font-mono text-sm">{tk.ticketNumber}</span> {tk.subject}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          {tk.name} · {tk.email} · {tk.categoryName} · {t(`sp.account.${tk.accountType ?? "CUSTOM"}` as TranslationKey)} <HrStatus status={tk.status} />
        </DialogDescription>
      </DialogHeader>
      {manage && (
        <PlainSelect
          label={t("hr.changeStatus")}
          className="w-48"
          value={String(tk.status ?? "")}
          onChange={async (v) => {
            if (await attempt(() => SupportService.setStatus(id, v), t("common.saved"))) {
              setKey((x) => x + 1)
              onChanged()
            }
          }}
          options={TICKET_STATUSES.map((s) => ({ value: s, label: t(`hr.status.${s}`) }))}
        />
      )}
      <Card>
        <CardContent className="grid gap-2 pt-4 text-sm">
          <p className="whitespace-pre-wrap">{d.description}</p>
          {!!d.attachments?.length && <p className="text-muted-foreground text-xs">📎 {d.attachments.map((a) => a.name).join(", ")}</p>}
          {!!d.customFields?.length && (
            <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 text-xs">
              {d.customFields.map((c) => (
                <React.Fragment key={c.fieldId}>
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd>{c.value || "-"}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {d.note && <p className="rounded bg-amber-500/10 p-2 text-xs">{t("sp.note")}: {d.note}</p>}
        </CardContent>
      </Card>
      <div className="grid gap-2" aria-label={t("sp.replies")}>
        {(d.replies ?? []).map((r) => (
          <div key={r.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${r.senderType === "STAFF" ? "bg-primary/10 justify-self-end" : "bg-muted justify-self-start"}`}>
            <p className="text-muted-foreground mb-1 text-xs">
              {r.senderName} · {when(r.createdDate)}
            </p>
            <p className="whitespace-pre-wrap">{r.description}</p>
            {!!r.attachments?.length && <p className="text-muted-foreground mt-1 text-xs">📎 {r.attachments.map((a) => a.name).join(", ")}</p>}
          </div>
        ))}
      </div>
      {manage &&
        (closed ? (
          <p className="text-muted-foreground text-sm">{t("sp.closedNoReply")}</p>
        ) : (
          <div className="grid gap-2">
            <Field id="reply" label={t("sp.reply")}>
              <Textarea id="reply" rows={3} maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              {files.length < MAX_FILES && <FileInput id="reply-file" label={t("sp.attach")} onUploaded={(fid, name) => setFiles((f) => [...f, { id: fid, name }])} />}
              {files.map((f) => (
                <Badge key={f.id} variant="secondary">
                  <Paperclip className="size-3" /> {f.name}
                </Badge>
              ))}
            </div>
            <DialogFooter>
              <Button
                disabled={!text.trim() || sending}
                onClick={async () => {
                  setSending(true)
                  const ok = await attempt(() => SupportService.reply(id, { description: text.trim(), attachmentFileIds: files.map((f) => Number(f.id)) }), t("common.saved"))
                  setSending(false)
                  if (ok) {
                    setText("")
                    setFiles([])
                    setKey((x) => x + 1)
                    onChanged()
                  }
                }}
              >
                <Send className="size-4" /> {t("sp.send")}
              </Button>
            </DialogFooter>
          </div>
        ))}
    </>
  )
}
