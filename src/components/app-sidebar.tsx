"use client"

import * as React from "react"
import {
  Building2,
  CircleUserRound,
  FileCheck2,
  FilePen,
  FileText,
  House,
  Images,
  Inbox,
  Layers,
  Receipt,
  Settings,
  TicketPercent,
  Undo2,
  ChartColumn,
  FileSignature,
  Handshake,
  Shapes,
  UserRoundSearch,
  Workflow,
  ShoppingCart,
  PackageMinus,
  Warehouse,
  ArrowLeftRight,
  Package,
  Tags,
  Store,
  ReceiptText,
  Barcode,
  ChartPie,
  FolderKanban,
  Columns3,
  ClipboardList,
  CalendarDays,
  Video,
  Timer,
  Contact,
  Truck,
  TrendingUp,
  TrendingDown,
  Landmark,
  HandCoins,
  Banknote,
  FileMinus,
  FilePlus,
  ChartNoAxesCombined,
  BookOpen,
  NotebookPen,
  PiggyBank,
  UsersRound,
  CalendarCheck,
  CalendarOff,
  Wallet,
  FolderOpen,
  Megaphone,
  PartyPopper,
  Award,
  ShieldAlert,
  ArrowRightLeft,
  Wrench,
  TrendingUpDown,
  GraduationCap,
  BriefcaseBusiness,
  UserSearch,
  CalendarClock,
  ListChecks,
  SlidersHorizontal,
  Headset,
  Globe,
  BellRing,
  MailPlus,
  LifeBuoy,
  LibraryBig,
  MailOpen,
  Settings2,
  MessagesSquare,
  UserCog,
  Building,
  Target,
  Scale,
  Sheet,
} from "lucide-react"

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
  const permissions = useAuthStore((s) => s.me?.permissions)
  const can = (code: string) => !!permissions?.includes(code)
  // Super Admin menu (manual §3–4) and company SaaS menu (SAAS_* permissions); the backend re-checks every call.
  const navMain = [
    { title: t("menu.dashboard"), url: "/dashboard", icon: House },
    ...(superAdmin
      ? [
          { title: t("menu.companies"), url: "/companies", icon: Building2 },
          { title: t("menu.plans"), url: "/plans", icon: Layers },
          { title: t("menu.orders"), url: "/orders", icon: Receipt },
          { title: t("menu.planRequests"), url: "/plan-requests", icon: Inbox },
          { title: t("menu.coupons"), url: "/coupons", icon: TicketPercent },
          { title: t("menu.helpdesk"), url: "/helpdesk", icon: Headset },
          { title: t("menu.website"), url: "/website", icon: Globe },
          { title: t("menu.emailTemplates"), url: "/email-templates", icon: MailPlus },
          { title: t("menu.notificationLog"), url: "/notifications", icon: BellRing },
          { title: t("menu.media"), url: "/media", icon: Images },
          { title: t("menu.settings"), url: "/settings", icon: Settings },
        ]
      : [
          // §6 Sales & revenue (commerce-service): SALES_VIEW for proposals, invoices, returns; QUOTATION_VIEW for quotations
          ...(can("QUOTATION_VIEW") ? [{ title: t("menu.sales.quotation"), url: "/sales/quotations", icon: FilePen }] : []),
          ...(can("SALES_VIEW")
            ? [
                { title: t("menu.sales.proposal"), url: "/sales/proposals", icon: FileText },
                { title: t("menu.sales.invoice"), url: "/sales/invoices", icon: FileCheck2 },
                { title: t("menu.sales.return"), url: "/sales/returns", icon: Undo2 },
              ]
            : []),
          // §10 POS (commerce-service): POS_SELL checkout + barcodes, POS_VIEW orders, POS_REPORT reports
          ...(can("POS_SELL") ? [{ title: t("menu.pos.checkout"), url: "/pos", icon: Store }] : []),
          ...(can("POS_VIEW") ? [{ title: t("menu.pos.orders"), url: "/pos/orders", icon: ReceiptText }] : []),
          ...(can("POS_SELL") ? [{ title: t("menu.pos.barcodes"), url: "/pos/barcodes", icon: Barcode }] : []),
          ...(can("POS_REPORT") ? [{ title: t("menu.pos.reports"), url: "/pos/reports", icon: ChartPie }] : []),
          // §12 Accounting (accounting-service), each entry by its own permission
          ...(can("CUSTOMER_VIEW") ? [{ title: t("menu.acc.customers"), url: "/accounting/customers", icon: Contact }] : []),
          ...(can("VENDOR_VIEW") ? [{ title: t("menu.acc.vendors"), url: "/accounting/vendors", icon: Truck }] : []),
          ...(can("REVENUE_VIEW") ? [{ title: t("menu.acc.revenues"), url: "/accounting/revenues", icon: TrendingUp }] : []),
          ...(can("EXPENSE_VIEW") ? [{ title: t("menu.acc.expenses"), url: "/accounting/expenses", icon: TrendingDown }] : []),
          ...(can("BANK_VIEW") ? [{ title: t("menu.acc.banking"), url: "/accounting/banking", icon: Landmark }] : []),
          ...(can("PAYMENT_VIEW")
            ? [
                { title: t("menu.acc.customer-payments"), url: "/accounting/customer-payments", icon: HandCoins },
                { title: t("menu.acc.vendor-payments"), url: "/accounting/vendor-payments", icon: Banknote },
              ]
            : []),
          ...(can("NOTE_VIEW")
            ? [
                { title: t("menu.acc.credit-notes"), url: "/accounting/credit-notes", icon: FileMinus },
                { title: t("menu.acc.debit-notes"), url: "/accounting/debit-notes", icon: FilePlus },
              ]
            : []),
          ...(can("ACCOUNTING_REPORT_VIEW") ? [{ title: t("menu.acc.reports"), url: "/accounting/reports", icon: ChartNoAxesCombined }] : []),
          ...(can("COA_VIEW") ? [{ title: t("menu.acc.coa"), url: "/accounting/chart-of-accounts", icon: BookOpen }] : []),
          // §13 Double entry
          ...(can("LEDGER_VIEW") ? [{ title: t("menu.le.journal"), url: "/accounting/journal-entries", icon: NotebookPen }] : []),
          ...(can("LEDGER_REPORT_VIEW") ? [{ title: t("menu.le.reports"), url: "/accounting/ledger", icon: Sheet }] : []),
          ...(can("LEDGER_REPORT_VIEW") || can("LEDGER_CLOSE") ? [{ title: t("menu.le.closing"), url: "/accounting/balance-sheets", icon: Scale }] : []),
          // §14 Financial goals & budget
          ...(can("GOAL_VIEW") ? [{ title: t("menu.bg.goals"), url: "/accounting/goals", icon: Target }] : []),
          ...(can("BUDGET_VIEW") ? [{ title: t("menu.bg.budgets"), url: "/accounting/budgets", icon: PiggyBank }] : []),
          // §15 HRM, each page by its own permission
          ...(can("EMPLOYEE_VIEW") ? [{ title: t("menu.hr.employees"), url: "/hrm/employees", icon: UsersRound }] : []),
          ...(can("ATTENDANCE_VIEW") ? [{ title: t("menu.hr.attendance"), url: "/hrm/attendance", icon: CalendarCheck }] : []),
          ...(can("LEAVE_VIEW") ? [{ title: t("menu.hr.leave"), url: "/hrm/leave", icon: CalendarOff }] : []),
          ...(can("PAYROLL_VIEW") ? [{ title: t("menu.hr.payroll"), url: "/hrm/payroll", icon: Wallet }] : []),
          ...(can("DOCUMENT_VIEW") ? [{ title: t("menu.hr.documents"), url: "/hrm/documents", icon: FolderOpen }] : []),
          ...(can("ANNOUNCEMENT_VIEW") ? [{ title: t("menu.hr.announcements"), url: "/hrm/announcements", icon: Megaphone }] : []),
          ...(can("EVENT_VIEW") ? [{ title: t("menu.hr.events"), url: "/hrm/events", icon: PartyPopper }] : []),
          ...(can("LIFECYCLE_VIEW")
            ? [
                { title: t("menu.hr.recognition"), url: "/hrm/recognition", icon: Award },
                { title: t("menu.hr.issues"), url: "/hrm/issues", icon: ShieldAlert },
                { title: t("menu.hr.career"), url: "/hrm/career", icon: ArrowRightLeft },
              ]
            : []),
          // §16 Performance & training
          ...(can("PERFORMANCE_VIEW") ? [{ title: t("menu.pf.performance"), url: "/hrm/performance", icon: TrendingUpDown }] : []),
          ...(can("TRAINING_VIEW") ? [{ title: t("menu.tr.training"), url: "/hrm/training", icon: GraduationCap }] : []),
          // §19 Company system settings
          ...(can("IAM_USER_VIEW") || can("IAM_ROLE_VIEW") ? [{ title: t("menu.co.access"), url: "/company/access", icon: UserCog }] : []),
          ...(can("IAM_SETTINGS_MANAGE") || can("NOTIFICATION_SETTINGS_UPDATE") ? [{ title: t("menu.co.settings"), url: "/company/settings", icon: Building }] : []),
          // §18 Support & communication
          ...(can("SUPPORT_TICKET_VIEW") ? [{ title: t("menu.sp.tickets"), url: "/support/tickets", icon: LifeBuoy }] : []),
          ...(can("SUPPORT_KB_VIEW") ? [{ title: t("menu.sp.knowledge"), url: "/support/knowledge", icon: LibraryBig }] : []),
          ...(can("SUPPORT_CONTACT_VIEW") ? [{ title: t("menu.sp.contacts"), url: "/support/contacts", icon: MailOpen }] : []),
          ...(can("SUPPORT_SETTINGS_MANAGE") ? [{ title: t("menu.sp.setup"), url: "/support/setup", icon: Settings2 }] : []),
          ...(can("MESSENGER_USE") ? [{ title: t("menu.sp.messenger"), url: "/messenger", icon: MessagesSquare }] : []),
          // §17 Recruitment
          ...(can("RECRUITMENT_VIEW")
            ? [
                { title: t("menu.rc.jobs"), url: "/recruitment/jobs", icon: BriefcaseBusiness },
                { title: t("menu.rc.candidates"), url: "/recruitment/candidates", icon: UserSearch },
                { title: t("menu.rc.interviews"), url: "/recruitment/interviews", icon: CalendarClock },
                { title: t("menu.rc.offers"), url: "/recruitment/offers", icon: FileSignature },
                { title: t("menu.rc.onboarding"), url: "/recruitment/onboarding", icon: ListChecks },
                { title: t("menu.rc.setup"), url: "/recruitment/setup", icon: SlidersHorizontal },
              ]
            : []),
          ...(can("ORG_VIEW") ? [{ title: t("menu.hr.setup"), url: "/hrm/setup", icon: Wrench }] : []),
          // §11 Projects & productivity: PROJECT_VIEW, FORM_VIEW, calendar (any signed-in user; kinds by permission),
          // ZOOM_VIEW (video meetings), ATTENDANCE_VIEW (timesheets)
          ...(can("PROJECT_VIEW")
            ? [
                { title: t("menu.projects"), url: "/projects", icon: FolderKanban },
                { title: t("menu.projects.stages"), url: "/projects/stages", icon: Columns3 },
              ]
            : []),
          ...(can("FORM_VIEW") ? [{ title: t("menu.forms"), url: "/forms", icon: ClipboardList }] : []),
          { title: t("menu.calendar"), url: "/calendar", icon: CalendarDays },
          ...(can("ZOOM_VIEW") ? [{ title: t("menu.meetings"), url: "/meetings", icon: Video }] : []),
          ...(can("ATTENDANCE_VIEW") ? [{ title: t("menu.timesheets"), url: "/timesheets", icon: Timer }] : []),
          // §8 Purchase & inventory: PURCHASE_VIEW (commerce-service), INVENTORY_VIEW (inventory-service)
          ...(can("PURCHASE_VIEW")
            ? [
                { title: t("menu.purchase.invoices"), url: "/purchase/invoices", icon: ShoppingCart },
                { title: t("menu.purchase.returns"), url: "/purchase/returns", icon: PackageMinus },
              ]
            : []),
          ...(can("INVENTORY_VIEW")
            ? [
                { title: t("menu.inventory.items"), url: "/inventory/items", icon: Package },
                { title: t("menu.inventory.warehouses"), url: "/inventory/warehouses", icon: Warehouse },
                { title: t("menu.inventory.transfers"), url: "/inventory/transfers", icon: ArrowLeftRight },
                { title: t("menu.inventory.setup"), url: "/inventory/setup", icon: Tags },
              ]
            : []),
          // §7 CRM & contracts (crm-service): CRM_VIEW for pipelines, leads, deals, reports; CRM_CONTRACT_VIEW for contracts
          ...(can("CRM_VIEW")
            ? [
                { title: t("menu.crm.leads"), url: "/crm/leads", icon: UserRoundSearch },
                { title: t("menu.crm.deals"), url: "/crm/deals", icon: Handshake },
                { title: t("menu.crm.reports"), url: "/crm/reports", icon: ChartColumn },
                { title: t("menu.crm.setup"), url: "/crm/setup", icon: Workflow },
              ]
            : []),
          ...(can("CRM_CONTRACT_VIEW") || can("CRM_CONTRACT_MANAGE")
            ? [
                { title: t("menu.crm.contracts"), url: "/crm/contracts", icon: FileSignature },
                { title: t("menu.crm.contractTypes"), url: "/crm/contract-types", icon: Shapes },
              ]
            : []),
          ...(can("HELPDESK_VIEW") ? [{ title: t("menu.helpdesk"), url: "/helpdesk", icon: Headset }] : []),
          ...(can("NOTIFICATION_LOG_VIEW") ? [{ title: t("menu.notificationLog"), url: "/notifications", icon: BellRing }] : []),
          ...(can("SAAS_SUBSCRIPTION_VIEW") ? [{ title: t("menu.plans"), url: "/plans", icon: Layers }] : []),
          ...(can("SAAS_ORDER_VIEW")
            ? [
                { title: t("menu.orders"), url: "/orders", icon: Receipt },
                { title: t("menu.planRequests"), url: "/plan-requests", icon: Inbox },
              ]
            : []),
        ]),
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
