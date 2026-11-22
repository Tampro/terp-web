"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlQuery } from "@/hooks/use-url-query"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT } from "@/lib/i18n"
import { StageService, type EStageKind, type StageDto } from "@/lib/project/project.service"

import { NameDialog } from "../../crm/_components/crm-kit"
import { attempt } from "../_components/project-kit"

export default function ProjectStagesPage() {
  return (
    <React.Suspense>
      <ProjectStages />
    </React.Suspense>
  )
}

/** §11.1 task stages (Todo, In Progress, Review, Done; the last one is the done stage) and bug stages, company-wide. */
function ProjectStages() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("PROJECT_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const kind: EStageKind = searchParams.get("kind") === "BUG" ? "BUG" : "TASK"
  const [stages, setStages] = React.useState<{ kind: EStageKind; list: StageDto[] }>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [naming, setNaming] = React.useState<{ stage?: StageDto } | null>(null)
  const [deleting, setDeleting] = React.useState<StageDto>()

  React.useEffect(() => {
    let cancelled = false
    StageService.list(kind)
      .then((list) => !cancelled && setStages({ kind, list }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [kind, reloadKey])

  const list = stages?.kind === kind ? stages.list : undefined
  const move = async (i: number, d: -1 | 1) => {
    if (!list) return
    const ids = list.map((s) => s.id!)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    if (await attempt(() => StageService.order(kind, ids), t("common.saved"))) reload()
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.projects.stages")} description={t("project.stage.subtitle")}>
        {manage && (
          <Button onClick={() => setNaming({})}>
            <Plus className="size-4" /> {t("project.stage.create")}
          </Button>
        )}
      </PageHeader>
      <Tabs value={kind} onValueChange={(v) => update({ kind: v === "BUG" ? "BUG" : "" })}>
        <TabsList>
          <TabsTrigger value="TASK">{t("project.tab.tasks")}</TabsTrigger>
          <TabsTrigger value="BUG">{t("project.tab.bugs")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent>
          {!list ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ol className="flex flex-col gap-2">
              {list.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground w-5 text-xs">{i + 1}</span>
                  <span className="flex-1">{s.name}</span>
                  {s.done && <Badge>{t("project.stage.doneStage")}</Badge>}
                  {manage && (
                    <>
                      <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} aria-label={t("crm.stage.up", { name: s.name ?? "" })} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" disabled={i === list.length - 1} aria-label={t("crm.stage.down", { name: s.name ?? "" })} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" aria-label={t("crm.editNamed", { name: s.name ?? "" })} onClick={() => setNaming({ stage: s })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" aria-label={t("crm.deleteNamed", { name: s.name ?? "" })} onClick={() => setDeleting(s)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <NameDialog
        open={!!naming}
        title={t(naming?.stage ? "crm.stage.rename" : "project.stage.create")}
        label={t("crm.name")}
        initial={naming?.stage?.name}
        onClose={() => setNaming(null)}
        onSave={async (name) => {
          const ok = await attempt(() => (naming?.stage ? StageService.rename(naming.stage.id!, name) : StageService.create(kind, name)), t("common.saved"))
          if (ok) reload()
          return ok
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("crm.confirm.deleteStage", { name: deleting?.name ?? "" })}
        description={t("project.stage.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => StageService.remove(deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}
