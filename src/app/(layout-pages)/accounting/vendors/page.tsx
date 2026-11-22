"use client"

import * as React from "react"

import { PartyPage } from "../_components/party-page"

/** §12.1 vendors. */
export default function Page() {
  return (
    <React.Suspense>
      <PartyPage kind="vendors" />
    </React.Suspense>
  )
}
