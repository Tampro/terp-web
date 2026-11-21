"use client"

import * as React from "react"

import { useAuthStore } from "@/lib/auth/auth.store"

import { AdminOrders } from "./_components/admin-orders"
import { CompanyOrders } from "./_components/company-orders"

/** §4.3 / §4.5 — Super Admin: every order (approve/reject); company: its own orders. */
export default function OrdersPage() {
  const superAdmin = useAuthStore((s) => s.me?.superAdmin)
  return superAdmin ? (
    <React.Suspense>
      <AdminOrders />
    </React.Suspense>
  ) : (
    <CompanyOrders />
  )
}
