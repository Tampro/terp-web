"use client"

import * as React from "react"

import { CrmUserService, type CrmUserOption } from "@/lib/crm/crm.service"
import { SalesLookupService, type CustomerOption } from "@/lib/sales/sales.service"

export interface ProjectLookups {
  users: CrmUserOption[]
  customers: CustomerOption[]
  loading: boolean
}

/** Company accounts (IAM, team members / assignees) and accounting customers (clients). */
export function useProjectLookups(): ProjectLookups {
  const [state, setState] = React.useState<ProjectLookups>({ users: [], customers: [], loading: true })
  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      CrmUserService.users().then((p) => p.content ?? []).catch(() => []),
      SalesLookupService.customers().then((p) => p.content ?? []).catch(() => []),
    ]).then(([users, customers]) => !cancelled && setState({ users, customers, loading: false }))
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export const userLabel = (users: CrmUserOption[], id?: string | null) => {
  if (!id) return "-"
  const u = users.find((x) => x.id === id)
  return u ? u.fullName || u.username || `#${id}` : `#${id}`
}
