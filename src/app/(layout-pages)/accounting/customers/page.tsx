"use client"

import * as React from "react"

import { PartyPage } from "../_components/party-page"

/** §12.1 customers. */
export default function Page() {
  return (
    <React.Suspense>
      <PartyPage kind="customers" />
    </React.Suspense>
  )
}
