"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarClock, Copy, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { ProjectService, type EProjectStatus, type ProjectDto, type ProjectStats } from "@/lib/project/project.service"

import { DuplicateDialog, ProjectFormDialog } from "./_components/project-dialogs"
import { attempt, People, ProjectStatusBadge } from "./_components/project-kit"
import { useProjectLookups, userLabel } from "./_components/use-project-lookups"

const PAGE_SIZE = 12
const ALL = "ALL"
const STATUSES: EProjectStatus[] = ["ONGOING", "ON_HOLD", "FINISHED"]

export default function ProjectsPage() {
  return (
    <React.Suspense>
      <Projects />
    </React.Suspense>
  )
}

/** §11.1 Projects: status tabs (Ongoing, On Hold, Finished), search, cards with team, budget, dates, overdue. */
function Projects() {
  const t = useT()
  const money = useMoney()
  const router = useRouter()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("PROJECT_MANAGE")
  const lookups = useProjectLookups()
  const { searchParams, update } = useUrlQuery()
  const status = searchParams.get("status") ?? ALL
  const q = searchParams.get("q") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<ProjectDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(q)
  const [editing, setEditing] = React.useState<{ project?: ProjectDto } | null>(null)
  const [duplicating, setDuplicating] = React.useState<ProjectDto>()
  const [deleting, setDeleting] = React.useState<ProjectDto>()
  const [stats, setStats] = React.useState<ProjectStats>()

  React.useEffect(() => {
    let cancelled = false
    ProjectService.stats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => undefined) // the cards are a summary: the list still works without them
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  React.useEffect(() => {
    let cancelled = false
    ProjectService.list({ status: status === ALL ? undefined : status, q: q || undefined, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [status, q, page, reloadKey])

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.projects")} description={t("project.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("project.create")}
          </Button>
        )}
      </PageHeader>
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="project-stats">
          {(
            [
              ["project.stats.total", stats.totalProjects, ""],
              ["project.status.ONGOING", stats.byStatus?.ONGOING, ""],
              ["project.status.ON_HOLD", stats.byStatus?.ON_HOLD, ""],
              ["project.status.FINISHED", stats.byStatus?.FINISHED, ""],
              ["project.stats.overdue", stats.overdueProjects, "text-destructive"],
            ] as const
          ).map(([label, value, tone]) => (
            <Card key={label} className="py-4">
              <CardContent className="px-4">
                <p className="text-muted-foreground text-sm">{t(label)}</p>
                <p className={`text-2xl font-semibold ${tone}`}>{value ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
          <TabsList>
            <TabsTrigger value={ALL}>{t("companies.tabAll")}</TabsTrigger>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {t(`project.status.${s}` as TranslationKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          className="flex min-w-60 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q: search.trim(), page: 0 })
          }}
        >
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("project.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">
            {t("common.search")}
          </Button>
        </form>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">{t("project.empty")}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7" aria-label={t("crm.actionsFor", { name: p.name ?? "" })}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/projects/${p.id}`)}>
                          <Eye className="size-4" /> {t("crm.action.view")}
                        </DropdownMenuItem>
                        {manage && (
                          <>
                            <DropdownMenuItem onClick={() => setEditing({ project: p })}>
                              <Pencil className="size-4" /> {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDuplicating(p)}>
                              <Copy className="size-4" /> {t("crm.action.duplicate")}
                            </DropdownMenuItem>
                            {STATUSES.filter((s) => s !== p.status).map((s) => (
                              <DropdownMenuItem key={s} onClick={async () => (await attempt(() => ProjectService.status(p.id!, s), t("common.saved"))) && reload()}>
                                <CalendarClock className="size-4" /> {t(`project.markAs.${s}` as TranslationKey)}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                              <Trash2 className="size-4" /> {t("common.delete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ProjectStatusBadge status={p.status} />
                    {p.overdue && <Badge variant="destructive">{t("sales.overdue")}</Badge>}
                  </div>
                  {p.description && <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p>}
                  <dl className="mt-auto grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs">{t("crm.startDate")}</dt>
                      <dd>{formatDate(p.startDate, language)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">{t("crm.endDate")}</dt>
                      <dd className={p.overdue ? "text-destructive" : undefined}>{formatDate(p.endDate, language)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">{t("project.budget")}</dt>
                      <dd>{p.budget == null ? "-" : money(p.budget)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">{t("project.team")}</dt>
                      <dd>
                        <People ids={p.userIds} name={(id) => userLabel(lookups.users, id)} />
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />

      <ProjectFormDialog state={editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={reload} />
      <DuplicateDialog project={duplicating} onClose={() => setDuplicating(undefined)} onDone={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("project.confirm.delete", { name: deleting?.name ?? "" })}
        description={t("project.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => ProjectService.remove(deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}
