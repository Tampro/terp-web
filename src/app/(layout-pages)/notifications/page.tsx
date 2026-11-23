"use client"

import * as React from "react"
import { RotateCw } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useUrlQuery } from "@/hooks/use-url-query"
import { CompanyService } from "@/lib/admin/admin.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { dayStart, DELIVERY_CHANNELS, DELIVERY_STATUSES, NotificationLogService, type Delivery } from "@/lib/notification/notification.service"

import { CrudSection, PlainSelect, useAuthStore, useOptions, type CrudConfig } from "../hrm/_components/crud-kit"

export default function NotificationLogPage() {
  return (
    <React.Suspense>
      <NotificationLog />
    </React.Suspense>
  )
}

/**
 * Notification delivery log (email, Slack, Telegram, webhook, SMS sent by notification-service). A company user with
 * NOTIFICATION_LOG_VIEW sees their company; the super admin picks a company first (NTF_001). Failed deliveries can be
 * sent again with NOTIFICATION_LOG_MANAGE.
 */
function NotificationLog() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const me = useAuthStore((s) => s.me)
  const admin = !!me?.superAdmin
  const manage = admin || !!me?.permissions?.includes("NOTIFICATION_LOG_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const companyId = searchParams.get("companyId") ?? ""
  const status = searchParams.get("status") ?? ""
  const channel = searchParams.get("channel") ?? ""
  const eventType = searchParams.get("eventType") ?? ""
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const companies = useOptions("ntf:companies", () => CompanyService.list({ size: 200 }).then((p) => (p.content ?? []).map((c) => ({ id: c.id, name: c.name }))), admin)
  const [viewing, setViewing] = React.useState<Delivery>()
  const when = (v?: string | null) => (v ? formatDate(v, language, true) : "-")

  const filters = (
    <>
      {admin && (
        <PlainSelect label={t("ntf.company")} className="w-52" value={companyId} onChange={(v) => update({ companyId: v, page: 0 })} none={t("ntf.chooseCompany")} options={companies.map((c) => ({ value: String(c.id), label: String(c.name) }))} />
      )}
      <PlainSelect label={t("ntf.status")} className="w-40" value={status} onChange={(v) => update({ status: v, page: 0 })} none={t("ntf.allStatuses")} options={DELIVERY_STATUSES.map((x) => ({ value: x, label: t(`ntf.st.${x}` as TranslationKey) }))} />
      <PlainSelect label={t("ntf.channel")} className="w-36" value={channel} onChange={(v) => update({ channel: v, page: 0 })} none={t("ntf.allChannels")} options={DELIVERY_CHANNELS.map((c) => ({ value: c, label: t(`ntf.ch.${c}` as TranslationKey) }))} />
      <Input aria-label={t("ntf.event")} placeholder={t("ntf.eventPlaceholder")} className="w-52" defaultValue={eventType} onBlur={(e) => e.target.value.trim() !== eventType && update({ eventType: e.target.value.trim(), page: 0 })} onKeyDown={(e) => e.key === "Enter" && update({ eventType: e.currentTarget.value.trim(), page: 0 })} />
      <Input type="date" aria-label={t("ntf.from")} className="w-40" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value, page: 0 })} />
      <Input type="date" aria-label={t("ntf.to")} className="w-40" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value, page: 0 })} />
    </>
  )
  const cfg: CrudConfig = {
    id: `ntf-${companyId}-${status}-${channel}-${eventType}-${from}-${to}`,
    load: NotificationLogService.list as CrudConfig["load"],
    query: {
      companyId: companyId || undefined,
      status: status || undefined,
      channel: channel || undefined,
      eventType: eventType || undefined,
      from: from ? dayStart(from) : undefined,
      to: to ? dayStart(to, true) : undefined,
    },
    manage,
    rowName: (r) => `${r.eventType ?? ""} · ${r.target ?? ""}`,
    emptyLabel: "ntf.empty",
    onRowClick: (r) => setViewing(r as Delivery),
    toolbar: filters,
    columns: [
      { label: "ntf.created", render: (r) => <span className="whitespace-nowrap">{when(r.createdDate as string)}</span> },
      { label: "ntf.event", path: "eventType", kind: "mono" },
      { label: "ntf.channel", render: (r) => <Badge variant="outline">{t(`ntf.ch.${r.channel}` as TranslationKey)}</Badge> },
      { label: "ntf.target", render: (r) => <span className="line-clamp-1 max-w-56 break-all text-xs">{String(r.target ?? "-")}</span> },
      { label: "ntf.status", render: (r) => <DeliveryStatus status={r.status as string} /> },
      { label: "ntf.attempts", path: "attempts" },
      { label: "ntf.error", render: (r) => (r.lastErrorCode ? <code className="text-destructive text-xs">{String(r.lastErrorCode)}</code> : "-") },
    ],
    actions: [
      {
        key: "retry",
        label: "ntf.retry",
        icon: <RotateCw />,
        when: (r) => r.status === "FAILED",
        confirmDesc: "ntf.retryConfirm",
        run: (r) => NotificationLogService.retry(String(r.id)),
      },
    ],
  }
  return (
    <div className="grid gap-4">
      <PageHeader title={t("menu.notificationLog")} description={t("ntf.subtitle")} />
      {admin && !companyId ? (
        <>
          <div className="flex flex-wrap gap-2">{filters}</div>
          <Alert>
            <AlertDescription>{t("ntf.pickCompany")}</AlertDescription>
          </Alert>
        </>
      ) : (
        <CrudSection config={cfg} />
      )}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{viewing?.eventType}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="ntf-detail">
              <dt className="text-muted-foreground">{t("ntf.status")}</dt>
              <dd>
                <DeliveryStatus status={viewing.status} />
              </dd>
              <dt className="text-muted-foreground">{t("ntf.channel")}</dt>
              <dd>{t(`ntf.ch.${viewing.channel}` as TranslationKey)}</dd>
              <dt className="text-muted-foreground">{t("ntf.target")}</dt>
              <dd className="break-all">{viewing.target ?? "-"}</dd>
              <dt className="text-muted-foreground">{t("ntf.attempts")}</dt>
              <dd>{viewing.attempts ?? 0}</dd>
              <dt className="text-muted-foreground">{t("ntf.error")}</dt>
              <dd className="font-mono">{viewing.lastErrorCode ?? "-"}</dd>
              <dt className="text-muted-foreground">{t("ntf.created")}</dt>
              <dd>{when(viewing.createdDate)}</dd>
              <dt className="text-muted-foreground">{t("ntf.sentAt")}</dt>
              <dd>{when(viewing.sentAt)}</dd>
              <dt className="text-muted-foreground">{t("ntf.nextAttempt")}</dt>
              <dd>{when(viewing.nextAttemptAt)}</dd>
              <dt className="text-muted-foreground">{t("ntf.eventId")}</dt>
              <dd className="font-mono text-xs break-all">{viewing.eventId ?? "-"}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// delivery wording of its own: the shared HR labels read "awaiting approval" / "not achieved" for PENDING / FAILED
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = { SENT: "default", PENDING: "secondary", FAILED: "destructive", SKIPPED: "outline" }
function DeliveryStatus({ status }: { status?: string }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{t(`ntf.st.${status}` as TranslationKey)}</Badge>
}
