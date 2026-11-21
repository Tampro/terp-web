"use client"

import { ChevronsUpDownIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { UserMenuContent, getInitials, useCurrentUser } from "@/components/user-menu-content"

export function NavUser() {
  const { isMobile } = useSidebar()
  const user = useCurrentUser()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="rounded-lg border border-border bg-foreground/5 px-2 transition-colors hover:bg-primary/10 data-[state=open]:bg-primary/10 data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-0!"
            >
              <Avatar className="h-9 w-9 shrink-0 rounded-lg ring-2 ring-border">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <UserMenuContent user={user} side={isMobile ? "bottom" : "right"} align="end" />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
