"use client"

import { useAuthStore } from "@/lib/auth/auth.store"

import { CompanyDashboard } from "./_components/company-dashboard"
import { StaffDashboard } from "./_components/staff-dashboard"
import { SuperAdminDashboard } from "./_components/super-admin-dashboard"

const HRM_PERMISSIONS = ["EMPLOYEE_VIEW", "ATTENDANCE_VIEW", "LEAVE_VIEW"]

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
  if (hrm || recruitment) return <CompanyDashboard hrm={hrm} recruitment={recruitment} />
  return <StaffDashboard />
}
