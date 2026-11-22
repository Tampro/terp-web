"use client"

import * as React from "react"

import { VoucherPage } from "../_components/voucher-page"

/** §12.2 expenses. */
export default function Page() {
  return (
    <React.Suspense>
      <VoucherPage kind="expenses" />
    </React.Suspense>
  )
}
