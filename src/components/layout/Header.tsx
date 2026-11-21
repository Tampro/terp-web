"use client"

import { useEffect, useState } from "react"

import { LanguageSelect } from "@/components/auth/language-select"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserDropdown } from "@/components/UserDropdown"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export default function Header() {
    const [scrolled, setScrolled] = useState(false)

    // Header background on scroll
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10)
        onScroll()
        window.addEventListener("scroll", onScroll)
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    return (
        <header
            className={cn(
                "px-4 sticky top-0 z-40 flex h-16 w-full shrink-0 items-center gap-2 transition-all duration-200 border-b",
                scrolled
                    ? "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md"
                    : "bg-transparent"
            )}
        >
            <div className="flex items-center gap-1">
                <SidebarTrigger className="-ml-1 rounded-lg h-9 w-9 [&_svg]:!size-5 transition-colors" />
            </div>

            <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <LanguageSelect className="hidden sm:inline-flex" />
                <UserDropdown />
            </div>
        </header>
    )
}