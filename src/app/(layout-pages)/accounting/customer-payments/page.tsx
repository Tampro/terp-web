"use client"

import * as React from "react"

import { PaymentPage } from "../_components/payment-page"

/** §12 customer-payments. */
export default function Page() {
  return (
    <React.Suspense>
      <PaymentPage kind="customer-payments" />
    </React.Suspense>
  )
}
