"use client"

import * as React from "react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import type { EMilestoneStatus, EPriority, EProjectStatus } from "@/lib/project/project.service"
import { useT, type TranslationKey } from "@/lib/i18n"

export const today = () => new Date().toLocaleDateString("en-CA")
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Runs a call, toasts the backend message on failure; returns whether it succeeded. */
export async function attempt(fn: () => Promise<unknown>, success?: string) {
  try {
    await fn()
    if (success) toast.success(success)
    return true
  } catch (e) {
    toast.error(errorMessage(e))
    return false
  }
}

export function Field({ id, label, error, children, className }: { id: string; label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

const STATUS_VARIANT: Record<EProjectStatus, "default" | "secondary" | "outline"> = { ONGOING: "default", ON_HOLD: "outline", FINISHED: "secondary" }
export function ProjectStatusBadge({ status }: { status?: EProjectStatus }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={STATUS_VARIANT[status]}>{t(`project.status.${status}` as TranslationKey)}</Badge>
}

const PRIORITY_CLASS: Record<EPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  HIGH: "bg-red-500/15 text-red-700 dark:text-red-400",
}
export function PriorityBadge({ priority }: { priority?: EPriority }) {
  const t = useT()
  if (!priority) return null
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_CLASS[priority]}`}>{t(`project.priority.${priority}` as TranslationKey)}</span>
}

const MILESTONE_VARIANT: Record<EMilestoneStatus, "default" | "secondary" | "outline"> = { COMPLETE: "default", ONGOING: "secondary", INCOMPLETE: "outline" }
export function MilestoneStatusBadge({ status }: { status?: EMilestoneStatus }) {
  const t = useT()
  if (!status) return <span>-</span>
  return <Badge variant={MILESTONE_VARIANT[status]}>{t(`project.milestone.status.${status}` as TranslationKey)}</Badge>
}

/** Initials avatars for user ids, named through the lookup. */
export function People({ ids, name }: { ids?: string[]; name: (id: string) => string }) {
  if (!ids?.length) return <span className="text-muted-foreground">-</span>
  return (
    <div className="flex -space-x-1.5">
      {ids.slice(0, 5).map((id) => {
        const n = name(id)
        return (
          <span key={id} title={n} className="bg-primary/15 text-primary ring-background flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2">
            {n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        )
      })}
      {ids.length > 5 && <span className="text-muted-foreground pl-2 text-xs">+{ids.length - 5}</span>}
    </div>
  )
}
