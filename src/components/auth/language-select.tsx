"use client"

import { Check, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguages } from "@/hooks/use-public-settings"
import { useLanguageStore, useT } from "@/lib/i18n"

/** Language selector shown on every page (manual §2). The UI texts exist for vi/en/ko; others fall back to English. */
export function LanguageSelect({ className }: { className?: string }) {
  const t = useT()
  const languages = useLanguages()
  const { language, setLanguage } = useLanguageStore()
  const current = languages.find((l) => l.code === language)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className} aria-label={t("common.language")}>
          <Globe className="size-4" />
          <span>{current?.name ?? language.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        {languages.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => l.code && setLanguage(l.code)}>
            <span className="flex-1">{l.name}</span>
            {l.code === language && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
