"use client"

import * as React from "react"
import { Eye, MoreHorizontal, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { OrderStatusBadge } from "@/components/common/order-status-badge"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { MediaService } from "@/lib/media/media.service"
import { SubscriptionService, type OrderDto } from "@/lib/saas/saas.service"

import { METHOD_KEY, OrderDetailDialog } from "./admin-orders"

const PAGE_SIZE = 20
const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png"]
const RECEIPT_MAX = 5 * 1024 * 1024

/** §4.5 Orders of my company (read-only, except a PENDING order: upload receipt, cancel). */
export function CompanyOrders() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const canOrder = useAuthStore((s) => !!s.me?.permissions?.includes("SAAS_ORDER_CREATE"))
  const [page, setPage] = React.useState(0)
  const [data, setData] = React.useState<IPage<OrderDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [viewing, setViewing] = React.useState<OrderDto>()
  const [cancelling, setCancelling] = React.useState<OrderDto>()
  const [receiptFor, setReceiptFor] = React.useState<OrderDto>()
  const fileInput = React.useRef<HTMLInputElement>(null)
  // OrderDto carries planId only: names come from the plans offered to the company.
  const [planNames, setPlanNames] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    SubscriptionService.plans()
      .then((ps) => setPlanNames(Object.fromEntries((ps ?? []).map((p) => [p.id ?? "", p.name ?? ""]))))
      .catch(() => undefined)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    SubscriptionService.orders({ page, size: PAGE_SIZE })
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, reloadKey])

  async function uploadReceipt(file?: File) {
    const order = receiptFor
    setReceiptFor(undefined)
    if (!file || !order?.id) return
    if (!RECEIPT_TYPES.includes(file.type)) return void toast.error(t("subscription.receiptType"))
    if (file.size > RECEIPT_MAX) return void toast.error(t("subscription.receiptTooLarge"))
    try {
      const [uploaded] = (await MediaService.upload([file])) ?? []
      if (!uploaded?.id) throw new Error(t("subscription.receiptFailed"))
      await SubscriptionService.attachReceipt(order.id, Number(uploaded.id))
      toast.success(t("subscription.receiptAttached"))
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const rows = data?.content ?? []

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("orders.title")} description={t("orders.companySubtitle")} />
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".pdf,.jpg,.jpeg,.png"
        data-testid="receipt-input"
        onChange={(e) => {
          void uploadReceipt(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders.number")}</TableHead>
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
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      {t("orders.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((o) => {
                    const pending = o.status === "PENDING"
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.orderNumber ?? "-"}</TableCell>
                        <TableCell>
                          <div>{(o.planId && planNames[o.planId]) || "-"}</div>
                          <div className="text-muted-foreground text-xs">
                            {o.billingCycle ? t(o.billingCycle === "YEARLY" ? "plans.yearly" : "plans.monthly") : ""}
                          </div>
                        </TableCell>
                        <TableCell>{o.couponCode ?? "-"}</TableCell>
                        <TableCell className="text-right font-medium">{money(o.finalPrice)}</TableCell>
                        <TableCell>{o.paymentMethod ? t(METHOD_KEY[o.paymentMethod] ?? "orders.manual") : "-"}</TableCell>
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
                              <DropdownMenuItem onClick={() => setViewing(o)}>
                                <Eye className="size-4" /> {t("orders.view")}
                              </DropdownMenuItem>
                              {canOrder && pending && o.paymentMethod === "BANK_TRANSFER" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setReceiptFor(o)
                                    fileInput.current?.click()
                                  }}
                                >
                                  <Upload className="size-4" />
                                  {o.receiptFileId ? t("subscription.replaceReceipt") : t("subscription.uploadReceipt")}
                                </DropdownMenuItem>
                              )}
                              {canOrder && pending && (
                                <DropdownMenuItem variant="destructive" onClick={() => setCancelling(o)}>
                                  <XCircle className="size-4" /> {t("orders.cancel")}
                                </DropdownMenuItem>
                              )}
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
            onPage={setPage}
          />
        </CardContent>
      </Card>
      <OrderDetailDialog row={viewing ? { order: viewing, planName: (viewing.planId && planNames[viewing.planId]) || null } : undefined} onClose={() => setViewing(undefined)} />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(undefined)}
        title={t("orders.cancelTitle", { number: cancelling?.orderNumber ?? "" })}
        confirmLabel={t("orders.cancel")}
        onConfirm={async () => {
          if (!cancelling?.id) return
          try {
            await SubscriptionService.cancelOrder(cancelling.id)
            toast.success(t("orders.cancelled"))
            setReloadKey((k) => k + 1)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
