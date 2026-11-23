"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Bot, Eye, HelpCircle, Monitor, Search, Smartphone, Tablet, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { CompanyService, LoginHistoryService, type CompanyDto, type EUserType, type LoginDto } from "@/lib/admin/admin.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

const PAGE_SIZE = 20
const DEVICE_ICON = { DESKTOP: Monitor, MOBILE: Smartphone, TABLET: Tablet, BOT: Bot, UNKNOWN: HelpCircle } as const

export default function LoginHistoryPage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <LoginHistoryList />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/**
 * §3.2 Login History — GET /iam/login-history (super admin: every login). Filters: keyword (username or IP, contains),
 * ipAddress (exact; a click on an IP sets it), companyId, userType. Rows carry device type, language, timezone and the
 * role at login; city / country / ISP stay null until the backend has a GeoIP source. Details = GET /{id} (User-Agent).
 */
function LoginHistoryList() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update: updateQuery, reset } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const ipAddress = searchParams.get("ipAddress") ?? ""
  const companyId = searchParams.get("companyId") ?? ""
  const userType = (searchParams.get("userType") as EUserType | null) ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<LoginDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [search, setSearch] = React.useState(keyword)
  const [deleting, setDeleting] = React.useState<LoginDto>()
  const [viewing, setViewing] = React.useState<LoginDto>()
  const [companies, setCompanies] = React.useState<CompanyDto[]>([])

  React.useEffect(() => {
    let cancelled = false
    CompanyService.list({ size: 200 })
      .then((p) => !cancelled && setCompanies(p.content ?? []))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    LoginHistoryService.list({
      keyword: keyword || undefined,
      ipAddress: ipAddress || undefined,
      companyId: companyId || undefined,
      userType,
      page,
      size: PAGE_SIZE,
    })
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, ipAddress, companyId, userType, page, reloadKey])

  const openDetails = async (r: LoginDto) => {
    setViewing(r)
    if (!r.id) return
    try {
      setViewing(await LoginHistoryService.get(r.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const rows = data?.content ?? []
  const companyName = (id?: string | null) => (id ? (companies.find((c) => c.id === id)?.name ?? `#${id}`) : null)
  const place = (r: LoginDto) => [r.city, r.country].filter(Boolean).join(", ")
  const deviceLabel = (r: LoginDto) => t(`loginHistory.device.${r.deviceType ?? "UNKNOWN"}` as TranslationKey)
  const filtered = !!(keyword || ipAddress || companyId || userType)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("loginHistory.title")} description={t("loginHistory.subtitle")}>
        <Button variant="outline" asChild>
          <Link href="/companies">
            <ArrowLeft className="size-4" /> {t("companies.title")}
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <form
              className="flex min-w-60 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                updateQuery({ keyword: search.trim(), page: 0 })
              }}
            >
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("loginHistory.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
            <Select value={companyId || "ALL"} onValueChange={(v) => updateQuery({ companyId: v === "ALL" ? "" : v, page: 0 })}>
              <SelectTrigger className="w-52" aria-label={t("loginHistory.company")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("loginHistory.allCompanies")}</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userType ?? "ALL"} onValueChange={(v) => updateQuery({ userType: v === "ALL" ? "" : v, page: 0 })}>
              <SelectTrigger className="w-48" aria-label={t("loginHistory.userType")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("loginHistory.allUsers")}</SelectItem>
                <SelectItem value="SUPER_ADMIN">{t("loginHistory.superAdmin")}</SelectItem>
                <SelectItem value="COMPANY_USER">{t("loginHistory.companyUser")}</SelectItem>
              </SelectContent>
            </Select>
            {ipAddress && (
              <Badge variant="secondary" className="gap-1 font-mono" data-testid="ip-filter">
                IP = {ipAddress}
                <button type="button" aria-label={t("loginHistory.clearIp")} onClick={() => updateQuery({ ipAddress: "", page: 0 })}>
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {filtered && (
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
                  <TableHead>{t("loginHistory.user")}</TableHead>
                  <TableHead>{t("loginHistory.ip")}</TableHead>
                  <TableHead>{t("loginHistory.location")}</TableHead>
                  <TableHead>{t("loginHistory.deviceCol")}</TableHead>
                  <TableHead>{t("loginHistory.languageZone")}</TableHead>
                  <TableHead>{t("loginHistory.time")}</TableHead>
                  <TableHead className="w-20">
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
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => {
                    const Icon = DEVICE_ICON[r.deviceType ?? "UNKNOWN"] ?? HelpCircle
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.username ?? "-"}</div>
                          <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                            <Badge variant="outline">{r.userType === "SUPER_ADMIN" ? t("loginHistory.superAdmin") : r.userType ? t("loginHistory.companyUser") : "-"}</Badge>
                            {r.roleAtLogin && <span>{r.roleAtLogin}</span>}
                            {companyName(r.companyId) && <span>· {companyName(r.companyId)}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.ipAddress ? (
                            <button type="button" className="font-mono text-xs hover:underline" title={t("loginHistory.filterIp")} onClick={() => updateQuery({ ipAddress: r.ipAddress, page: 0 })}>
                              {r.ipAddress}
                            </button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {place(r) || <span className="text-muted-foreground">{t("loginHistory.noGeo")}</span>}
                          {r.isp && <div className="text-muted-foreground">{r.isp}</div>}
                        </TableCell>
                        <TableCell className="text-xs" title={r.userAgent ?? undefined}>
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-4 shrink-0" aria-label={deviceLabel(r)} />
                            <span>{[r.browser, r.os].filter(Boolean).join(" · ") || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.language || "-"}
                          {r.timezone && <div className="text-muted-foreground">{r.timezone}</div>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(r.loginAt, language, true)}</TableCell>
                        <TableCell>
                          <div className="flex">
                            <Button variant="ghost" size="icon" aria-label={t("loginHistory.details", { user: r.username ?? "" })} onClick={() => openDetails(r)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={t("loginHistory.deleteRow", { user: r.username ?? "" })} onClick={() => setDeleting(r)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => updateQuery({ page: p })} />
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("loginHistory.detailsTitle", { user: viewing?.username ?? "" })}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="login-detail">
              <dt className="text-muted-foreground">{t("loginHistory.time")}</dt>
              <dd>{formatDate(viewing.loginAt, language, true)}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.company")}</dt>
              <dd>{companyName(viewing.companyId) ?? "-"}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.role")}</dt>
              <dd>{viewing.roleAtLogin || "-"}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.ip")}</dt>
              <dd className="font-mono">{viewing.ipAddress ?? "-"}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.location")}</dt>
              <dd>{place(viewing) || t("loginHistory.noGeo")}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.isp")}</dt>
              <dd>{viewing.isp || "-"}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.deviceType")}</dt>
              <dd>{deviceLabel(viewing)}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.device")}</dt>
              <dd>{[viewing.browser, viewing.os].filter(Boolean).join(" · ") || "-"}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.lang")}</dt>
              <dd>{viewing.language || "-"}</dd>
              <dt className="text-muted-foreground">{t("loginHistory.timezone")}</dt>
              <dd>{viewing.timezone || "-"}</dd>
              <dt className="text-muted-foreground">User-Agent</dt>
              <dd className="font-mono text-xs break-all">{viewing.userAgent || "-"}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("loginHistory.deleteTitle")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await LoginHistoryService.remove(deleting.id)
            setReloadKey((k) => k + 1)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
