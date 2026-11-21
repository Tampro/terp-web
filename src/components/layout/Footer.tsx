"use client"

import { usePublicSettings } from "@/hooks/use-public-settings"

/** Footer text from Brand Settings (footerText), else "© <year> <title>". */
export default function Footer() {
  const brand = usePublicSettings()?.brand
  const title = brand?.titleText || "ERP"
  return (
    <footer className="border-t">
      <div className="text-muted-foreground bg-card/60 flex h-14 items-center px-4 text-sm">
        {brand?.footerText || `© ${new Date().getFullYear()} ${title}`}
      </div>
    </footer>
  )
}
