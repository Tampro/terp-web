"use client"

import * as React from "react"
import { Check, Eye, FileText, MoreHorizontal, Search, X } from "lucide-react"
import { toast } from "sonner"

import { DecisionDialog } from "@/components/common/decision-dialog"
import { OrderStatusBadge } from "@/components/common/order-status-badge"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"
import { AdminOrderService, type AdminOrderDto, type EOrderStatus, type StatusCounts } from "@/lib/saas/saas.service"

const PAGE_SIZE = 20
const TABS: { value: "ALL" | EOrderStatus; label: TranslationKey; count: keyof StatusCounts }[] = [
  { value: "ALL", label: "companies.tabAll", count: "all" },
  { value: "PENDING", label: "saas.status.PENDING", count: "pending" },
  { value: "APPROVED", label: "saas.status.APPROVED", count: "approved" },
  { value: "REJECTED", label: "saas.status.REJECTED", count: "rejected" },
  { value: "CANCELLED", label: "saas.status.CANCELLED", count: "cancelled" },
]

export const METHOD_KEY: Record<string, TranslationKey> = {
  BANK_TRANSFER: "subscription.bankTransfer",
  STRIPE: "subscription.stripe",
  MANUAL: "orders.manual",
}

/** §4.3 bank transfer requests + §4.5 orders (Super Admin) — GET /saas/admin/orders, approve/reject while PENDING. */
export function AdminOrders() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update, reset } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const status = (searchParams.get("status") as EOrderStatus | null) ?? "ALL"
  const dateFrom = searchParams.get("dateFrom") ?? ""
  const dateTo = searchParams.get("dateTo") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<AdminOrderDto>>()
  const [counts, setCounts] = React.useState<StatusCounts>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [search, setSearch] = React.useState(keyword)
  const [viewing, setViewing] = React.useState<AdminOrderDto>()
  const [deciding, setDeciding] = React.useState<{ row: AdminOrderDto; decision: "approve" | "reject" } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const filter = { keyword: keyword || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
    Promise.all([
      AdminOrderService.list({ ...filter, status: status === "ALL" ? undefined : status, page, size: PAGE_SIZE }),
      AdminOrderService.counts(filter),
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
  }, [keyword, status, dateFrom, dateTo, page, reloadKey])

  const rows = data?.content ?? []

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("orders.title")} description={t("orders.adminSubtitle")} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={status} onValueChange={(v) => update({ status: v, page: 0 })}>
              <TabsList className="flex-wrap">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {t(tab.label)}
                    {counts?.[tab.count] !== undefined && (
                      <span className="text-muted-foreground ml-1 text-xs">({counts[tab.count]})</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
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
                  placeholder={t("orders.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
            <div className="flex items-center gap-2">
              <Input type="date" className="w-40" aria-label={t("orders.dateFrom")} value={dateFrom} onChange={(e) => update({ dateFrom: e.target.value, page: 0 })} />
              <span className="text-muted-foreground">–</span>
              <Input type="date" className="w-40" aria-label={t("orders.dateTo")} value={dateTo} onChange={(e) => update({ dateTo: e.target.value, page: 0 })} />
            </div>
            {(keyword || dateFrom || dateTo || status !== "ALL") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("")
                  reset()
                }}
              >
                {t("common.reset")}
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders.number")}</TableHead>
                  <TableHead>{t("orders.company")}</TableHead>
                  <TableHead>{t("orders.plan")}</TableHead>
                  <TableHead>{t("orders.coupon")}</TableHead>
                  <TableHead className="text-right">{t("orders.amount")}</TableHead>
                  <TableHead>{t("orders.method")}</TableHead>
                  <TableHead>{t("orders.status")}</TableHead>
                  <TableHead>{t("orders.date")}</TableHead>
                  <TableHead className="w-12">
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
                      {t("orders.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => {
                    const o = r.order ?? {}
                    const pending = o.status === "PENDING"
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.orderNumber ?? "-"}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.companyName ?? "-"}</div>
                          <div className="text-muted-foreground text-xs">{r.companyEmail ?? ""}</div>
                        </TableCell>
                        <TableCell>
                          <div>{r.planName ?? "-"}</div>
                          <div className="text-muted-foreground text-xs">
                            {o.billingCycle ? t(o.billingCycle === "YEARLY" ? "plans.yearly" : "plans.monthly") : ""}
                          </div>
                        </TableCell>
                        <TableCell>{o.couponCode ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{money(o.finalPrice)}</div>
                          {!!o.discountAmount && <div className="text-muted-foreground text-xs line-through">{money(o.originalPrice)}</div>}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {o.paymentMethod ? t(METHOD_KEY[o.paymentMethod] ?? "orders.manual") : "-"}
                            {o.receiptFileId && <FileText className="text-primary size-4" aria-label={t("orders.hasReceipt")} />}
                          </span>
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={o.status} />
                        </TableCell>
                        <TableCell>{formatDate(o.createdDate, language)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t("orders.actionsFor", { number: o.orderNumber ?? "" })}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(r)}>
                                <Eye className="size-4" /> {t("orders.view")}
                              </DropdownMenuItem>
                              {/* Approve / reject only while PENDING (SAAS_009) */}
                              <DropdownMenuItem disabled={!pending} onClick={() => setDeciding({ row: r, decision: "approve" })}>
                                <Check className="size-4" /> {t("saas.approve")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={!pending}
                                onClick={() => setDeciding({ row: r, decision: "reject" })}
                              >
                                <X className="size-4" /> {t("saas.reject")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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

      <OrderDetailDialog row={viewing} onClose={() => setViewing(undefined)} />
      <DecisionDialog
        decision={deciding?.decision ?? null}
        title={
          deciding?.decision === "reject"
            ? t("orders.rejectTitle", { number: deciding.row.order?.orderNumber ?? "" })
            : t("orders.approveTitle", { number: deciding?.row.order?.orderNumber ?? "" })
        }
        description={deciding?.decision === "approve" ? t("orders.approveDesc") : undefined}
        onClose={() => setDeciding(null)}
        onConfirm={async (notes) => {
          const id = deciding?.row.order?.id
          if (!id) return
          try {
            if (deciding.decision === "approve") await AdminOrderService.approve(id, notes)
            else await AdminOrderService.reject(id, notes)
            toast.success(deciding.decision === "approve" ? t("orders.approved") : t("orders.rejected"))
            setReloadKey((k) => k + 1)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
            throw e
          }
        }}
      />
    </div>
  )
}

/** Order details; the receipt opens through a fresh media link (GET /media/files/{id}, valid a few minutes). */
export function OrderDetailDialog({ row, onClose }: { row?: AdminOrderDto; onClose: () => void }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const o = row?.order
  const [opening, setOpening] = React.useState(false)

  async function openReceipt() {
    if (!o?.receiptFileId) return
    // Open the tab inside the click (popup blockers refuse window.open after an await), then point it at the
    // fresh signed link once it arrives.
    const tab = window.open("", "_blank")
    if (tab) tab.opener = null
    setOpening(true)
    try {
      const f = await MediaService.file(o.receiptFileId)
      const url = f?.viewUrl ?? f?.downloadUrl
      if (tab && url && /^https?:\/\//.test(url)) tab.location.href = url
      else tab?.close()
    } catch (e) {
      tab?.close()
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(false)
    }
  }

  const items: [string, React.ReactNode][] = [
    [t("orders.company"), row?.companyName ?? "-"],
    [t("orders.plan"), `${row?.planName ?? "-"}${o?.billingCycle ? ` · ${t(o.billingCycle === "YEARLY" ? "plans.yearly" : "plans.monthly")}` : ""}`],
    [t("orders.coupon"), o?.couponCode ?? "-"],
    [t("subscription.price"), money(o?.originalPrice)],
    [t("subscription.discount"), o?.discountAmount ? `-${money(o.discountAmount)}` : "-"],
    [t("subscription.total"), money(o?.finalPrice)],
    [t("orders.method"), o?.paymentMethod ? t(METHOD_KEY[o.paymentMethod] ?? "orders.manual") : "-"],
    [t("subscription.transferContent"), o?.bankTransfer?.transferContent ?? "-"],
    [t("orders.status"), <OrderStatusBadge key="s" status={o?.status} />],
    [t("orders.date"), formatDate(o?.createdDate, language, true)],
    [t("orders.processedAt"), formatDate(o?.processedAt, language, true)],
    [t("saas.notes"), o?.notes ?? "-"],
  ]

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("orders.detailTitle", { number: o?.orderNumber ?? "-" })}</DialogTitle>
          <DialogDescription>{row?.companyEmail ?? ""}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {items.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        {o?.receiptFileId ? (
          <Button variant="outline" disabled={opening} onClick={openReceipt}>
            <FileText className="size-4" /> {t("orders.viewReceipt")}
          </Button>
        ) : (
          o?.paymentMethod === "BANK_TRANSFER" && <p className="text-muted-foreground text-sm">{t("orders.noReceipt")}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
