"use client"

import * as React from "react"
import { Check, Search, X, XCircle } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DecisionDialog } from "@/components/common/decision-dialog"
import { OrderStatusBadge } from "@/components/common/order-status-badge"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  AdminPlanRequestService,
  SubscriptionService,
  type EOrderStatus,
  type PlanRequestDto,
  type StatusCounts,
} from "@/lib/saas/saas.service"

const PAGE_SIZE = 20
const TABS: { value: "ALL" | EOrderStatus; label: TranslationKey; count: keyof StatusCounts }[] = [
  { value: "ALL", label: "companies.tabAll", count: "all" },
  { value: "PENDING", label: "saas.status.PENDING", count: "pending" },
  { value: "APPROVED", label: "saas.status.APPROVED", count: "approved" },
  { value: "REJECTED", label: "saas.status.REJECTED", count: "rejected" },
  { value: "CANCELLED", label: "saas.status.CANCELLED", count: "cancelled" },
]

/** Plan requests (no online payment): Super Admin approves/rejects; a company sees and cancels its own. */
export default function PlanRequestsPage() {
  const superAdmin = useAuthStore((s) => s.me?.superAdmin)
  return (
    <React.Suspense>
      <PlanRequests admin={!!superAdmin} />
    </React.Suspense>
  )
}

function PlanRequests({ admin }: { admin: boolean }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const canOrder = useAuthStore((s) => !!s.me?.permissions?.includes("SAAS_ORDER_CREATE"))
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const status = (searchParams.get("status") as EOrderStatus | null) ?? "ALL"
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<PlanRequestDto>>()
  const [counts, setCounts] = React.useState<StatusCounts>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [search, setSearch] = React.useState(keyword)
  const [deciding, setDeciding] = React.useState<{ row: PlanRequestDto; decision: "approve" | "reject" } | null>(null)
  const [cancelling, setCancelling] = React.useState<PlanRequestDto>()

  React.useEffect(() => {
    let cancelled = false
    const load = admin
      ? Promise.all([
          AdminPlanRequestService.list({ keyword: keyword || undefined, status: status === "ALL" ? undefined : status, page, size: PAGE_SIZE }),
          AdminPlanRequestService.counts({ keyword: keyword || undefined }),
        ])
      : Promise.all([SubscriptionService.requests({ page, size: PAGE_SIZE }), Promise.resolve(undefined)])
    load
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
  }, [admin, keyword, status, page, reloadKey])

  const rows = data?.content ?? []
  const cols = admin ? 7 : 6

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("planRequests.title")} description={admin ? t("planRequests.adminSubtitle") : t("planRequests.companySubtitle")} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          {admin && (
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={status} onValueChange={(v) => update({ status: v, page: 0 })}>
                <TabsList className="flex-wrap">
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {t(tab.label)}
                      {counts?.[tab.count] !== undefined && <span className="text-muted-foreground ml-1 text-xs">({counts[tab.count]})</span>}
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
                    placeholder={t("planRequests.searchPlaceholder")}
                    aria-label={t("common.search")}
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  {t("common.search")}
                </Button>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {admin && <TableHead>{t("orders.company")}</TableHead>}
                  <TableHead>{t("orders.plan")}</TableHead>
                  <TableHead>{t("planRequests.message")}</TableHead>
                  <TableHead>{t("orders.status")}</TableHead>
                  <TableHead>{t("orders.date")}</TableHead>
                  <TableHead>{t("saas.notes")}</TableHead>
                  <TableHead className="w-24">
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
                      {t("planRequests.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => {
                    const pending = r.status === "PENDING"
                    return (
                      <TableRow key={r.id}>
                        {admin && (
                          <TableCell>
                            <div className="font-medium">{r.companyName ?? "-"}</div>
                            <div className="text-muted-foreground text-xs">{r.companyEmail ?? ""}</div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div>{r.planName ?? "-"}</div>
                          <div className="text-muted-foreground text-xs">
                            {r.billingCycle ? t(r.billingCycle === "YEARLY" ? "plans.yearly" : "plans.monthly") : ""}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-64 truncate" title={r.message ?? undefined}>
                          {r.message || "-"}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>{formatDate(r.createdDate, language)}</TableCell>
                        <TableCell className="max-w-48 truncate" title={r.notes ?? undefined}>
                          {r.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {admin && pending && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={t("planRequests.approveFor", { name: r.companyName ?? "" })}
                                  onClick={() => setDeciding({ row: r, decision: "approve" })}
                                >
                                  <Check className="size-4 text-emerald-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={t("planRequests.rejectFor", { name: r.companyName ?? "" })}
                                  onClick={() => setDeciding({ row: r, decision: "reject" })}
                                >
                                  <X className="text-destructive size-4" />
                                </Button>
                              </>
                            )}
                            {!admin && canOrder && pending && (
                              <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
                                <XCircle className="size-4" /> {t("orders.cancel")}
                              </Button>
                            )}
                          </div>
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

      <DecisionDialog
        decision={deciding?.decision ?? null}
        title={
          deciding?.decision === "reject"
            ? t("planRequests.rejectTitle", { name: deciding.row.companyName ?? "" })
            : t("planRequests.approveTitle", { name: deciding?.row.companyName ?? "" })
        }
        description={deciding?.decision === "approve" ? t("planRequests.approveDesc") : undefined}
        onClose={() => setDeciding(null)}
        onConfirm={async (notes) => {
          const id = deciding?.row.id
          if (!id) return
          try {
            if (deciding.decision === "approve") await AdminPlanRequestService.approve(id, notes)
            else await AdminPlanRequestService.reject(id, notes)
            toast.success(deciding.decision === "approve" ? t("orders.approved") : t("orders.rejected"))
            setReloadKey((k) => k + 1)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
            throw e
          }
        }}
      />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(undefined)}
        title={t("planRequests.cancelTitle")}
        confirmLabel={t("orders.cancel")}
        onConfirm={async () => {
          if (!cancelling?.id) return
          try {
            await SubscriptionService.cancelRequest(cancelling.id)
            setReloadKey((k) => k + 1)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
