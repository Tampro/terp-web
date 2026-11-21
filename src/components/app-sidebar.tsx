"use client"

import * as React from "react"
import { Building2, CircleUserRound, House, Images, Settings } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar"
import { usePublicSettings } from "@/hooks/use-public-settings"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT } from "@/lib/i18n"

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const t = useT()
  const brand = usePublicSettings()?.brand?.titleText || "ERP"
  const superAdmin = useAuthStore((s) => s.me?.superAdmin)
  // Super Admin menu (manual §3); the backend re-checks every call.
  const navMain = [
    { title: t("menu.dashboard"), url: "/dashboard", icon: House },
    ...(superAdmin
      ? [
          { title: t("menu.companies"), url: "/companies", icon: Building2 },
          { title: t("menu.media"), url: "/media", icon: Images },
          { title: t("menu.settings"), url: "/settings", icon: Settings },
        ]
      : []),
    { title: t("menu.profile"), url: "/profile", icon: CircleUserRound },
  ]

  return (
    <Sidebar collapsible="icon" className="sidebar-hover-glass z-50" {...props}>
      <SidebarHeader className="h-16 justify-center border-b">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg font-semibold">
            {brand.charAt(0)}
          </div>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">{brand}</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex min-h-full flex-col px-2">
            <NavMain items={navMain} />
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="h-16 justify-center border-t">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
