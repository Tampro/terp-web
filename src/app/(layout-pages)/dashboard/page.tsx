"use client"

import { useAuthStore } from "@/lib/auth/auth.store"

import { CompanyDashboard } from "./_components/company-dashboard"
import type { DashboardModule } from "./_components/module-dashboards"
import { StaffDashboard } from "./_components/staff-dashboard"
import { SuperAdminDashboard } from "./_components/super-admin-dashboard"

const HRM_PERMISSIONS = ["EMPLOYEE_VIEW", "ATTENDANCE_VIEW", "LEAVE_VIEW"]
/** module dashboards (manual 5.1, 5.2, 5.5, 5.6, 5.7) and the permissions that open them (own-only views included) */
const MODULE_PERMISSIONS: [DashboardModule, string[]][] = [
  ["project", ["PROJECT_VIEW", "PROJECT_VIEW_OWN"]],
  ["account", ["ACCOUNTING_REPORT_VIEW"]],
  ["pos", ["POS_REPORT", "POS_VIEW"]],
  ["crm", ["CRM_VIEW", "CRM_VIEW_OWN"]],
  ["support", ["SUPPORT_TICKET_VIEW", "SUPPORT_TICKET_VIEW_OWN"]],
]

/**
 * Landing page after login: Super Admin dashboard (§3.1); company HRM / Recruitment dashboards by permission (§5);
 * otherwise the Staff view. The backend re-checks every card.
 */
export default function DashboardPage() {
  const me = useAuthStore((s) => s.me)
  if (me?.superAdmin) return <SuperAdminDashboard />
  const permissions = me?.permissions ?? []
  const hrm = HRM_PERMISSIONS.some((p) => permissions.includes(p))
  const recruitment = permissions.includes("RECRUITMENT_VIEW")
  const modules = MODULE_PERMISSIONS.filter(([, perms]) => perms.some((p) => permissions.includes(p))).map(([m]) => m)
  if (hrm || recruitment || modules.length) return <CompanyDashboard hrm={hrm} recruitment={recruitment} modules={modules} />
  return <StaffDashboard />
}
