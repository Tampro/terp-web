"use client"

import { usePublicSettings } from "@/hooks/use-public-settings"
import { useBrandStore } from "@/store/brand.store"

/** Footer of the admin shell: Brand footerText (else "© <year> <title>"), plus the company mobile / address when set. */
export default function Footer() {
  const publicBrand = usePublicSettings()?.brand
  const brand = useBrandStore((s) => s.brand) ?? publicBrand
  const title = brand?.titleText || "ERP"
  const contact = [brand?.companyMobile, brand?.companyAddress].filter(Boolean).join(" · ")
  return (
    <footer className="border-t">
      <div className="text-muted-foreground bg-card/60 flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <span>{brand?.footerText || `© ${new Date().getFullYear()} ${title}`}</span>
        {contact && <span data-testid="brand-contact">{contact}</span>}
      </div>
    </footer>
  )
}
