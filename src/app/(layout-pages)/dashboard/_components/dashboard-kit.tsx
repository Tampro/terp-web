"use client"

import * as React from "react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Part } from "@/lib/dashboard/dashboard.service"
import { useT } from "@/lib/i18n"

/** Number card: label, big value, optional hint, icon on the right. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  testId,
}: {
  label: string
  value: string
  hint?: React.ReactNode
  icon: React.ElementType
  loading?: boolean
  testId?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-semibold" data-testid={testId}>
              {value}
            </p>
          )}
          {hint && !loading && <div className="text-muted-foreground text-xs">{hint}</div>}
        </div>
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  )
}

/** Card with a title, an optional "View all" link and a body; shows the part's error instead of the body. */
export function SectionCard({
  title,
  description,
  href,
  part,
  loading,
  empty,
  children,
}: {
  title: string
  description?: string
  href?: string
  part?: Part<unknown>
  loading?: boolean
  /** true = show "No data" */
  empty?: boolean
  children?: React.ReactNode
}) {
  const t = useT()
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {href && (
          <Link href={href} className="text-primary shrink-0 text-sm hover:underline">
            {t("common.viewAll")}
          </Link>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : part?.error ? (
          <PartError error={part.error} />
        ) : empty ? (
          <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

/** Why a card has no data: COMMON_004 = no permission, anything else = the service did not answer. */
export function PartError({ error }: { error: string }) {
  const t = useT()
  return (
    <p className="text-muted-foreground text-sm" role="note">
      {error === "COMMON_004" ? t("cdash.noPermission") : t("cdash.unavailable")}
    </p>
  )
}
