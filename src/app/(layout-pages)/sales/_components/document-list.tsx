"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Copy,
  Eye,
  FileOutput,
  GitBranchPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Stamp,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  salesDocuments,
  type DocumentDetail,
  type DocumentRow,
  type EDocumentKind,
  type EDocumentStatus,
  type StatusCounts,
} from "@/lib/sales/sales.service"

import { SalesDetailDialog, type DetailView } from "./document-detail-dialog"
import { DocumentFormDialog } from "./document-form-dialog"
import { SalesStatusBadge } from "./sales-status-badge"
import { useSalesLookups } from "./use-sales-lookups"

const PAGE_SIZE = 20
const ALL = "ALL"
const OVERDUE = "OVERDUE"
const STATUSES: Record<EDocumentKind, EDocumentStatus[]> = {
  QUOTATION: ["DRAFT", "SENT", "ACCEPTED", "REJECTED"],
  PROPOSAL: ["DRAFT", "SENT", "ACCEPTED", "REJECTED"],
  INVOICE: ["DRAFT", "POSTED", "PARTIAL", "PAID"],
}

type Pending = { action: "delete" | "post" | "reject" | "convert" | "duplicate"; row: DocumentRow }

/**
 * §6.1 proposals, §6.2 sales invoices, §6.4 quotations: one list for the three document kinds.
 * Actions follow the status (manual §6) and the permissions (SALES_* / QUOTATION_*); the backend re-checks both
 * (SAL_002..SAL_005, SAL_017).
 */
export function DocumentList({ kind }: { kind: EDocumentKind }) {
  const t = useT()
  const money = useMoney()
  const router = useRouter()
  const language = useLanguageStore((s) => s.language)
  const permissions = useAuthStore((s) => s.me?.permissions)
  const can = (p: string) => !!permissions?.includes(p)
  const manage = kind === "QUOTATION" ? can("QUOTATION_MANAGE") : can("SALES_MANAGE")
  const canPost = can("SALES_POST")
  const canConvert = kind === "QUOTATION" ? can("QUOTATION_MANAGE") && can("SALES_MANAGE") : can("SALES_MANAGE")
  const k = kind.toLowerCase() as "quotation" | "proposal" | "invoice"
  const service = React.useMemo(() => salesDocuments(kind), [kind])
  const lookups = useSalesLookups()

  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const tab = searchParams.get("status") ?? ALL
  const customerId = searchParams.get("customerId") ?? undefined
  const warehouseId = searchParams.get("warehouseId") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const viewParam = searchParams.get("view") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<DocumentRow>>()
  const [counts, setCounts] = React.useState<StatusCounts>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ detail?: DocumentDetail } | null>(null)
  const [pending, setPending] = React.useState<Pending>()

  React.useEffect(() => {
    let cancelled = false
    const filter = { keyword: keyword || undefined, customerId, warehouseId, from, to }
    Promise.all([
      service.list({
        ...filter,
        status: tab === ALL || tab === OVERDUE ? undefined : tab,
        overdue: tab === OVERDUE ? true : undefined,
        page,
        size: PAGE_SIZE,
      }),
      service.counts(filter),
    ])
      .then(([list, c]) => {
        if (cancelled) return
        setData(list)
        setCounts(c)
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [service, keyword, tab, customerId, warehouseId, from, to, page, reloadKey])

  async function run(fn: () => Promise<unknown>, done: TranslationKey) {
    try {
      await fn()
      toast.success(t(done))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function openEdit(row: DocumentRow) {
    if (!row.id) return
    try {
      setEditing({ detail: await service.get(row.id) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirmPending() {
    if (!pending?.row.id) return
    const id = pending.row.id
    if (pending.action === "delete") await run(() => service.remove(id), "sales.done.deleted")
    if (pending.action === "post") await run(() => service.post(id), "sales.done.posted")
    if (pending.action === "reject") await run(() => service.reject(id), "sales.done.rejected")
    if (pending.action === "duplicate") await run(() => service.duplicate(id), "sales.done.duplicated")
    if (pending.action === "convert") {
      try {
        const invoice = await service.convert(id)
        toast.success(t("sales.done.converted", { number: invoice.document?.number ?? "" }))
        reload()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    }
  }

  const loadDetail = React.useCallback((id: string) => service.get(id), [service])
  const customerName = (row: DocumentRow) =>
    row.customerName ?? lookups.customers.find((c) => c.id === row.customerId)?.companyName ?? "-"
  const detailView = (d: DocumentDetail): DetailView => {
    const doc = d.document ?? {}
    return {
      title: `${doc.number ?? "-"}${doc.versionNo && doc.versionNo > 1 ? ` · v${doc.versionNo}` : ""}`,
      status: doc.status,
      flags: [
        ...(doc.overdue ? [t("sales.overdue")] : []),
        ...(doc.expired ? [t("sales.expired")] : []),
      ],
      fields: [
        { label: t("sales.customer"), value: customerName(doc) },
        { label: t(`sales.${k}.date` as TranslationKey), value: formatDate(doc.docDate, language) },
        { label: t(kind === "INVOICE" ? "sales.dueDate" : "sales.validUntil"), value: formatDate(doc.dueDate, language) },
        ...(kind === "INVOICE"
          ? [{ label: t("sales.invoiceType"), value: doc.invoiceType ? t(`sales.type.${doc.invoiceType}` as TranslationKey) : "-" }]
          : []),
        {
          label: t("sales.warehouse"),
          value: lookups.warehouses.find((w) => w.id === doc.warehouseId)?.name ?? (doc.warehouseId ? `#${doc.warehouseId}` : "-"),
        },
        { label: t("sales.paymentTerms"), value: d.paymentTerms || "-" },
        ...(kind === "INVOICE" ? [{ label: t("sales.syncGoogle"), value: t(d.syncToGoogleCalendar ? "sales.yes" : "sales.no") }] : []),
      ],
      lines: d.lines,
      totals: [
        { label: t("sales.subtotal"), value: money(doc.subtotal) },
        { label: t("sales.discount"), value: doc.discount ? `-${money(doc.discount)}` : money(0) },
        { label: t("sales.tax"), value: money(doc.tax) },
        { label: t("sales.total"), value: money(doc.total), strong: true },
        ...(kind !== "QUOTATION" ? [{ label: t("sales.balance"), value: money(doc.balance) }] : []),
      ],
      notes: d.notes,
    }
  }

  const statuses = STATUSES[kind]
  const total = statuses.reduce((s, x) => s + (counts?.[x] ?? 0), 0)
  const tabs = [
    { value: ALL, label: t("companies.tabAll"), count: counts ? total : undefined },
    ...statuses.map((s) => ({ value: s, label: t(`sales.status.${s}` as TranslationKey), count: counts?.[s] })),
    ...(kind === "INVOICE" ? [{ value: OVERDUE, label: t("sales.overdue"), count: undefined }] : []),
  ]
  const rows = data?.content ?? []
  const withBalance = kind !== "QUOTATION"
  const cols = withBalance ? 10 : 9

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t(`menu.sales.${k}` as TranslationKey)} description={t(`sales.${k}.subtitle` as TranslationKey)}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t(`sales.${k}.create` as TranslationKey)}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(v) => update({ status: v, page: 0 })}>
            <TabsList className="flex-wrap">
              {tabs.map((x) => (
                <TabsTrigger key={x.value} value={x.value}>
                  {x.label}
                  {x.count !== undefined && <span className="text-muted-foreground ml-1 text-xs">({x.count})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-end gap-3">
            <Select value={customerId ?? ALL} onValueChange={(v) => update({ customerId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-52" aria-label={t("sales.customer")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("sales.allCustomers")}</SelectItem>
                {lookups.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id ?? ""}>
                    {c.companyName ?? c.customerCode ?? "-"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kind === "INVOICE" && (
              <Select value={warehouseId ?? ALL} onValueChange={(v) => update({ warehouseId: v === ALL ? "" : v, page: 0 })}>
                <SelectTrigger className="w-44" aria-label={t("sales.warehouse")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("sales.allWarehouses")}</SelectItem>
                  {lookups.warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id ?? ""}>
                      {w.name ?? "-"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="date"
              className="w-40"
              aria-label={t("sales.from")}
              value={from ?? ""}
              onChange={(e) => update({ from: e.target.value, page: 0 })}
            />
            <Input
              type="date"
              className="w-40"
              aria-label={t("sales.to")}
              value={to ?? ""}
              onChange={(e) => update({ to: e.target.value, page: 0 })}
            />
            <form
              className="flex min-w-60 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                update({ keyword: search.trim(), page: 0 })
              }}
            >
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("sales.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.number")}</TableHead>
                  <TableHead>{t("sales.customer")}</TableHead>
                  <TableHead>{t(`sales.${k}.date` as TranslationKey)}</TableHead>
                  <TableHead>{t(kind === "INVOICE" ? "sales.dueDate" : "sales.validUntil")}</TableHead>
                  <TableHead className="text-right">{t("sales.subtotal")}</TableHead>
                  <TableHead className="text-right">{t("sales.tax")}</TableHead>
                  <TableHead className="text-right">{t("sales.total")}</TableHead>
                  {withBalance && <TableHead className="text-right">{t("sales.balance")}</TableHead>}
                  <TableHead>{t("orders.status")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={cols}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={cols} className="text-muted-foreground h-24 text-center">
                      {t(`sales.${k}.empty` as TranslationKey)}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{row.number ?? "-"}</div>
                        <div className="text-muted-foreground text-xs">
                          {kind === "INVOICE" && row.invoiceType ? t(`sales.type.${row.invoiceType}` as TranslationKey) : ""}
                          {kind === "QUOTATION" && row.versionNo && row.versionNo > 1 ? `v${row.versionNo}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>{customerName(row)}</TableCell>
                      <TableCell>{formatDate(row.docDate, language)}</TableCell>
                      <TableCell>
                        <span className={row.overdue || row.expired ? "text-destructive" : undefined}>
                          {formatDate(row.dueDate, language)}
                        </span>
                        {row.overdue && <Badge variant="destructive" className="ml-2">{t("sales.overdue")}</Badge>}
                        {row.expired && <Badge variant="destructive" className="ml-2">{t("sales.expired")}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{money(row.subtotal)}</TableCell>
                      <TableCell className="text-right">{money(row.tax)}</TableCell>
                      <TableCell className="text-right font-medium">{money(row.total)}</TableCell>
                      {withBalance && <TableCell className="text-right">{money(row.balance)}</TableCell>}
                      <TableCell>
                        <SalesStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        <RowActions
                          kind={kind}
                          row={row}
                          manage={manage}
                          canPost={canPost}
                          canConvert={canConvert}
                          onView={() => row.id && update({ view: row.id })}
                          onEdit={() => openEdit(row)}
                          onSend={() => row.id && run(() => service.send(row.id!), "sales.done.sent")}
                          onAccept={() => row.id && run(() => service.accept(row.id!), "sales.done.accepted")}
                          onVersion={() => row.id && run(() => service.newVersion(row.id!), "sales.done.versioned")}
                          onViewInvoice={() =>
                            row.convertedInvoiceId && router.push(`/sales/invoices?view=${row.convertedInvoiceId}`)
                          }
                          onPending={(action) => setPending({ action, row })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={data?.totalElements ?? 0}
            totalPages={data?.totalPages ?? 0}
            onPage={(p) => update({ page: p })}
          />
        </CardContent>
      </Card>

      <DocumentFormDialog kind={kind} state={editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={reload} />
      <SalesDetailDialog docLabel={t(`menu.sales.${k}` as TranslationKey)} id={viewParam} load={loadDetail} view={detailView} onClose={() => update({ view: "" })} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(`sales.confirm.${pending?.action ?? "delete"}` as TranslationKey, { number: pending?.row.number ?? "" })}
        description={t(`sales.confirm.${pending?.action ?? "delete"}Desc` as TranslationKey)}
        confirmLabel={t(`sales.action.${pending?.action ?? "delete"}` as TranslationKey)}
        onConfirm={confirmPending}
      />
    </div>
  )
}

/** The row's menu: only what the status allows (manual §6.1, §6.2, §6.4) and the user may do. */
function RowActions({
  kind,
  row,
  manage,
  canPost,
  canConvert,
  onView,
  onEdit,
  onSend,
  onAccept,
  onVersion,
  onViewInvoice,
  onPending,
}: {
  kind: EDocumentKind
  row: DocumentRow
  manage: boolean
  canPost: boolean
  canConvert: boolean
  onView: () => void
  onEdit: () => void
  onSend: () => void
  onAccept: () => void
  onVersion: () => void
  onViewInvoice: () => void
  onPending: (a: Pending["action"]) => void
}) {
  const t = useT()
  const s = row.status
  const quotation = kind === "QUOTATION"
  const invoice = kind === "INVOICE"
  const draft = s === "DRAFT"
  const items: React.ReactNode[] = []
  const item = (key: string, label: TranslationKey, icon: React.ElementType, onClick: () => void, destructive = false) => {
    const Icon = icon
    items.push(
      <DropdownMenuItem key={key} variant={destructive ? "destructive" : "default"} onClick={onClick}>
        <Icon className="size-4" /> {t(label)}
      </DropdownMenuItem>
    )
  }

  item("view", "sales.action.view", Eye, onView)
  if (manage && draft) item("edit", "common.edit", Pencil, onEdit)
  if (manage && draft && !invoice) item("send", "sales.action.send", Send, onSend)
  if (canPost && draft && invoice) item("post", "sales.action.post", Stamp, () => onPending("post"))
  if (manage && s === "SENT" && !invoice) {
    item("accept", "sales.action.accept", Check, onAccept)
    item("reject", "sales.action.reject", X, () => onPending("reject"))
  }
  if (s === "ACCEPTED" && !invoice) {
    if (row.convertedInvoiceId) item("viewInvoice", "sales.action.viewInvoice", FileOutput, onViewInvoice)
    else if (canConvert) item("convert", "sales.action.convert", FileOutput, () => onPending("convert"))
  }
  if (quotation && manage) {
    item("duplicate", "sales.action.duplicate", Copy, () => onPending("duplicate"))
    if (s === "SENT" || s === "ACCEPTED" || s === "REJECTED") item("version", "sales.action.version", GitBranchPlus, onVersion)
  }
  const destructive = manage && draft

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("sales.actionsFor", { number: row.number ?? "" })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items}
        {destructive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onPending("delete")}>
              <Trash2 className="size-4" /> {t("common.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
