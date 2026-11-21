"use client"

import { useAuthStore } from "@/lib/auth/auth.store"

import { AdminPlans } from "./_components/admin-plans"
import { CompanyPlans } from "./_components/company-plans"

/** §4.1 (Super Admin: manage plans) / §4.2 (company: compare and subscribe). */
export default function PlansPage() {
  const superAdmin = useAuthStore((s) => s.me?.superAdmin)
  return superAdmin ? <AdminPlans /> : <CompanyPlans />
}
