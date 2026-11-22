"use client"

import * as React from "react"

import { PaymentPage } from "../_components/payment-page"

/** §12 vendor-payments. */
export default function Page() {
  return (
    <React.Suspense>
      <PaymentPage kind="vendor-payments" />
    </React.Suspense>
  )
}
