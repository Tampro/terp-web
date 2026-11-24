"use client"

import * as React from "react"
import { CheckCheck, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { noteService, type ENoteKind, type ENoteStatus, type NoteDto } from "@/lib/accounting/accounting.service"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { PurchaseReturnService } from "@/lib/purchase/purchase.service"
import { SalesReturnService } from "@/lib/sales/sales.service"

import { AccStatusBadge, attempt, Field, PlainSelect, today, useUserNames } from "./acc-kit"

const PAGE_SIZE = 20
const ALL = "ALL"
const STATUSES: ENoteStatus[] = ["DRAFT", "APPROVED", "PARTIAL", "APPLIED"]

/**
 * §12.5 credit notes (CN-, from completed sales returns) and debit notes (DN-, from completed purchase returns):
 * Draft → Approved → Applied (Partial while partly used by payments). One note per return (ACC_064).
 */
export function NotePage({ kind }: { kind: ENoteKind }) {
  const t = useT()
  const userName = useUserNames()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const credit = kind === "credit-notes"
  const k = credit ? "creditNote" : "debitNote"
  const permissions = useAuthStore((s) => s.me?.permissions)
  const manage = !!permissions?.includes("NOTE_MANAGE")
  const approveRight = !!permissions?.includes("NOTE_APPROVE")
  const service = React.useMemo(() => noteService(kind), [kind])
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<NoteDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [creating, setCreating] = React.useState(false)
  const [pending, setPending] = React.useState<{ action: "approve" | "delete"; row: NoteDto }>()

  React.useEffect(() => {
    let cancelled = false
    service
      .list({ status: status === ALL ? undefined : status, from, to, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [service, status, from, to, page, reloadKey])

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t(`menu.acc.${kind}` as TranslationKey)} description={t(`acc.${k}.subtitle` as TranslationKey)}>
        {manage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t(`acc.${k}.create` as TranslationKey)}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={status} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
            <TabsList>
              <TabsTrigger value={ALL}>{t("companies.tabAll")}</TabsTrigger>
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {t(`acc.status.${s}` as TranslationKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-3">
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from ?? ""} onChange={(e) => update({ from: e.target.value, page: 0 })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to ?? ""} onChange={(e) => update({ to: e.target.value, page: 0 })} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.number")}</TableHead>
                  <TableHead>{t("acc.note.return")}</TableHead>
                  <TableHead>{t(credit ? "sales.customer" : "purchase.vendor")}</TableHead>
                  <TableHead>{t("pos.date")}</TableHead>
                  <TableHead className="text-right">{t("sales.total")}</TableHead>
                  <TableHead className="text-right">{t("sales.balance")}</TableHead>
                  <TableHead>{t("acc.approvedBy")}</TableHead>
                  <TableHead>{t("crm.status")}</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                      {t(`acc.${k}.empty` as TranslationKey)}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono text-xs">{n.number}</TableCell>
                      <TableCell className="font-mono text-xs">{n.returnNumber}</TableCell>
                      <TableCell>{n.partyName}</TableCell>
                      <TableCell>{formatDate(n.noteDate, language)}</TableCell>
                      <TableCell className="text-right">{money(n.total)}</TableCell>
                      <TableCell className="text-right font-medium">{money(n.balance)}</TableCell>
                      <TableCell>{userName(n.approvedBy)}</TableCell>
                      <TableCell>
                        <AccStatusBadge status={n.status} />
                      </TableCell>
                      <TableCell>
                        {n.status === "DRAFT" && (
                          <div className="flex justify-end gap-1">
                            {approveRight && (
                              <Button variant="ghost" size="icon" aria-label={t("acc.note.approveOf", { number: n.number ?? "" })} onClick={() => setPending({ action: "approve", row: n })}>
                                <CheckCheck className="size-4" />
                              </Button>
                            )}
                            {manage && (
                              <Button variant="ghost" size="icon" aria-label={t("crm.deleteNamed", { name: n.number ?? "" })} onClick={() => setPending({ action: "delete", row: n })}>
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="sm:max-w-md">{creating && <NoteForm kind={kind} onClose={() => setCreating(false)} onSaved={reload} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`acc.confirm.${pending?.action ?? "delete"}` as TranslationKey, { number: pending?.row.number ?? "" })}
        description={t(pending?.action === "approve" ? "acc.confirm.approveNoteDesc" : "acc.confirm.deleteDesc")}
        confirmLabel={t(pending?.action === "approve" ? "sales.action.approve" : "common.delete")}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          if (await attempt(() => (pending.action === "approve" ? service.approve(id) : service.remove(id)), t("common.saved"))) reload()
        }}
      />
    </div>
  )
}

function NoteForm({ kind, onClose, onSaved }: { kind: ENoteKind; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const money = useMoney()
  const credit = kind === "credit-notes"
  const [returns, setReturns] = React.useState<{ id?: string; number?: string; party?: string | null; total?: number }[]>()
  const [returnId, setReturnId] = React.useState("")
  const [date, setDate] = React.useState(today())
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    // only a completed return gives a note (ACC_063)
    const load = credit
      ? SalesReturnService.list({ status: "COMPLETED", size: 100 }).then((p) => (p.content ?? []).map((r) => ({ id: r.id, number: r.number, party: r.customerName, total: r.total })))
      : PurchaseReturnService.list({ status: "COMPLETED", size: 100 }).then((p) => (p.content ?? []).map((r) => ({ id: r.id, number: r.number, party: r.vendorName, total: r.total })))
    load.then((r) => !cancelled && setReturns(r)).catch((e: Error) => !cancelled && (setReturns([]), toast.error(e.message)))
    return () => {
      cancelled = true
    }
  }, [credit])
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t(credit ? "acc.creditNote.create" : "acc.debitNote.create")}</DialogTitle>
        <DialogDescription>{t(credit ? "acc.creditNote.formDesc" : "acc.debitNote.formDesc")}</DialogDescription>
      </DialogHeader>
      {!returns ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <Field id="nt-return" label={t("acc.note.return")} error={error}>
          <PlainSelect
            id="nt-return"
            label={t("acc.note.return")}
            value={returnId}
            onChange={(v) => (setReturnId(v), setError(undefined))}
            options={returns.map((r) => ({ value: r.id ?? "", label: `${r.number} · ${r.party ?? ""} · ${money(r.total)}` }))}
          />
          {returns.length === 0 && <p className="text-muted-foreground text-xs">{t("acc.note.noReturns")}</p>}
        </Field>
      )}
      <Field id="nt-date" label={t("pos.date")}>
        <Input id="nt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field id="nt-notes" label={t("crm.notes")}>
        <Textarea id="nt-notes" rows={2} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!returnId) return setError(t("project.v.required"))
            setBusy(true)
            const ok = await attempt(() => noteService(kind).create({ returnId: Number(returnId), noteDate: date || null, notes: notes.trim() || null }), t("common.saved"))
            setBusy(false)
            if (ok) {
              onSaved()
              onClose()
            }
          }}
        >
          {t("common.save")}
        </Button>
      </DialogFooter>
    </div>
  )
}
