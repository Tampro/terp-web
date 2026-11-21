"use client"

import * as React from "react"
import { Eye, MoreHorizontal, Pencil, Plus, Power, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
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
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { CouponService, type CouponDto, type ECouponType } from "@/lib/saas/saas.service"

import { CouponDetailDialog, CouponFormDialog } from "./_components/coupon-dialogs"

const PAGE_SIZE = 20

export default function CouponsPage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <Coupons />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/** §4.4 Coupons (Super Admin) — /saas/admin/coupons. Tabs = active / inactive; filter by type; search name/code. */
function Coupons() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const tab = searchParams.get("active") ?? "ALL" // "true" | "false" | ALL
  const type = (searchParams.get("type") as ECouponType | null) ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<CouponDto>>()
  const [counts, setCounts] = React.useState<{ all?: number; active?: number; inactive?: number }>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ coupon?: CouponDto } | null>(null)
  const [viewing, setViewing] = React.useState<string>()
  const [deleting, setDeleting] = React.useState<CouponDto>()

  React.useEffect(() => {
    let cancelled = false
    const filter = { keyword: keyword || undefined, type }
    Promise.all([
      CouponService.list({ ...filter, active: tab === "ALL" ? undefined : tab === "true", page, size: PAGE_SIZE }),
      CouponService.counts(filter),
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
  }, [keyword, tab, type, page, reloadKey])

  async function toggle(c: CouponDto) {
    if (!c.id) return
    try {
      await CouponService.setEnabled(c.id, !c.enabled)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const discount = (c: CouponDto) =>
    c.type === "PERCENTAGE" ? `${formatNumber(c.discountValue, language, 2)}%` : money(c.discountValue)
  const limit = (n?: number | null) => (n === null || n === undefined ? "∞" : formatNumber(n, language))
  const rows = data?.content ?? []
  const tabs = [
    { value: "ALL", label: t("companies.tabAll"), count: counts?.all },
    { value: "true", label: t("plans.active"), count: counts?.active },
    { value: "false", label: t("plans.inactive"), count: counts?.inactive },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("coupons.title")} description={t("coupons.subtitle")}>
        <Button onClick={() => setEditing({})}>
          <Plus className="size-4" /> {t("coupons.create")}
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => update({ active: v, page: 0 })}>
              <TabsList>
                {tabs.map((x) => (
                  <TabsTrigger key={x.value} value={x.value}>
                    {x.label}
                    {x.count !== undefined && <span className="text-muted-foreground ml-1 text-xs">({x.count})</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Select value={type ?? "ALL"} onValueChange={(v) => update({ type: v, page: 0 })}>
              <SelectTrigger className="w-44" aria-label={t("coupons.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("coupons.allTypes")}</SelectItem>
                <SelectItem value="PERCENTAGE">{t("coupons.percentage")}</SelectItem>
                <SelectItem value="FLAT">{t("coupons.flat")}</SelectItem>
              </SelectContent>
            </Select>
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
                  placeholder={t("coupons.searchPlaceholder")}
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
                  <TableHead>{t("coupons.name")}</TableHead>
                  <TableHead>{t("coupons.code")}</TableHead>
                  <TableHead>{t("coupons.discount")}</TableHead>
                  <TableHead>{t("coupons.used")}</TableHead>
                  <TableHead>{t("coupons.expiry")}</TableHead>
                  <TableHead>{t("orders.status")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                      {t("coupons.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name ?? "-"}</div>
                        <div className="text-muted-foreground text-xs">
                          {c.type === "PERCENTAGE" ? t("coupons.percentage") : c.type === "FLAT" ? t("coupons.flat") : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.code ?? "-"}</TableCell>
                      <TableCell>{discount(c)}</TableCell>
                      <TableCell>
                        {formatNumber(c.timesUsed ?? 0, language)} / {limit(c.useLimitTotal)}
                      </TableCell>
                      <TableCell>{c.expiryDate ? formatDate(c.expiryDate, language) : t("coupons.noExpiry")}</TableCell>
                      <TableCell>
                        <Badge variant={c.enabled ? "secondary" : "outline"}>{c.enabled ? t("plans.active") : t("plans.inactive")}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("coupons.actionsFor", { code: c.code ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewing(c.id)}>
                              <Eye className="size-4" /> {t("coupons.viewUsage")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditing({ coupon: c })}>
                              <Pencil className="size-4" /> {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggle(c)}>
                              <Power className="size-4" /> {c.enabled ? t("plans.disable") : t("plans.enable")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}>
                              <Trash2 className="size-4" /> {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      <CouponFormDialog state={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <CouponDetailDialog couponId={viewing} onClose={() => setViewing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("coupons.deleteTitle", { code: deleting?.code ?? "" })}
        description={t("coupons.deleteDesc")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await CouponService.remove(deleting.id)
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
