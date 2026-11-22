"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Financial goals & budget (manual §14). Spec: accounting-service GoalController / GoalCategoryController (GOAL_VIEW /
// GOAL_MANAGE), BudgetPeriodController and BudgetController (BUDGET_VIEW / BUDGET_MANAGE; approve, activate and close a
// budget need BUDGET_APPROVE). Swagger merges the goal CategoryForm with the revenue one: the goal category form is
// {code ≤30, name ≤255, active} (GoalCategoryService). Goals: Draft → Active → Completed (ACC_082 / ACC_083). Budgets:
// Draft → Approved → Active → Closed (ACC_091 names the status an action needs); allocations only on expense accounts
// (ACC_093), total ≤ budget amount (ACC_094). A closed period is read-only (ACC_089). Every field optional.

const A = "/v1/accounting"
const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })
const put = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })
const del = (path: string) => request<void>(path, { method: "DELETE" })
const save = <T,>(base: string, id: string | undefined, body: unknown) => (id ? put<T>(`${base}/${id}`, body) : post<T>(base, body))
type Paging = { page?: number; size?: number }

export const GOAL_TYPES = ["SAVINGS", "DEBT_REDUCTION", "INVESTMENT", "REVENUE", "EXPENSE_REDUCTION", "OTHER"] as const
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const
export const BUDGET_TYPES = ["OPERATIONAL", "CAPITAL", "CASH_FLOW"] as const
export type EGoalType = (typeof GOAL_TYPES)[number]
export type EPriority = (typeof PRIORITIES)[number]
export type EBudgetType = (typeof BUDGET_TYPES)[number]
export type EGoalStatus = "DRAFT" | "ACTIVE" | "COMPLETED"
export type EBudgetStatus = "DRAFT" | "APPROVED" | "ACTIVE" | "CLOSED"
export type ETracking = "AHEAD" | "ON_TRACK" | "BEHIND" | "CRITICAL"

export interface GoalCategoryDto {
  id?: string
  code?: string
  name?: string
  active?: boolean
}
export interface GoalCategoryForm {
  code: string
  name: string
  active: boolean
}
export interface GoalDto {
  id?: string
  categoryId?: string | null
  name?: string
  type?: EGoalType
  priority?: EPriority | null
  targetAmount?: number
  startDate?: string
  targetDate?: string
  accountId?: string | null
  description?: string | null
  status?: EGoalStatus
  completedAt?: string | null
}
export interface GoalForm {
  name: string
  categoryId?: number
  type: EGoalType
  priority?: EPriority
  targetAmount: number
  startDate: string
  targetDate: string
  accountId?: number
  description?: string
}
export interface MilestoneDto {
  id?: string
  name?: string
  targetAmount?: number
  targetDate?: string
  status?: "PENDING" | "ACHIEVED"
  overdue?: boolean
}
export interface ContributionDto {
  id?: string
  date?: string
  amount?: number
  notes?: string | null
  type?: "MANUAL" | "AUTOMATIC"
}
export interface TrackingDto {
  targetAmount?: number
  manualAmount?: number
  automaticAmount?: number
  currentAmount?: number
  progressPercent?: number
  elapsedPercent?: number
  daysRemaining?: number
  projectedCompletionDate?: string | null
  trackingStatus?: ETracking
  milestones?: MilestoneDto[]
}

export interface PeriodDto {
  id?: string
  name?: string
  financialYear?: number
  startDate?: string
  endDate?: string
  status?: "ACTIVE" | "CLOSED"
  closedAt?: string | null
}
export interface PeriodForm {
  name: string
  financialYear: number
  startDate: string
  endDate: string
}
export interface BudgetDto {
  id?: string
  periodId?: string
  name?: string
  type?: EBudgetType
  amount?: number
  description?: string | null
  status?: EBudgetStatus
  approvedBy?: string | null
  approvedAt?: string | null
}
export interface BudgetForm {
  name: string
  periodId: number
  type: EBudgetType
  amount: number
  description?: string
}
export interface AllocationDto {
  id?: string
  accountId?: string
  accountCode?: string
  accountName?: string
  allocated?: number
  spent?: number
  remaining?: number
  variancePercent?: number
  overBudget?: boolean
  notes?: string | null
}
export interface MonitoringDto {
  budgetId?: string
  name?: string
  type?: EBudgetType
  status?: EBudgetStatus
  budgetAmount?: number
  allocated?: number
  spent?: number
  remaining?: number
  variancePercent?: number
  overBudget?: boolean
  lines?: AllocationDto[]
}
export interface PeriodMonitoringDto {
  allocated?: number
  spent?: number
  remaining?: number
  variancePercent?: number
  overBudget?: boolean
  budgets?: MonitoringDto[]
}

const G = `${A}/goals`
export const GoalService = {
  list: (f: { categoryId?: string; status?: string; type?: string } & Paging) => request<IPage<GoalDto>>(withQuery(G, { ...f })),
  save: (id: string | undefined, body: GoalForm) => save<GoalDto>(G, id, body),
  remove: (id: string) => del(`${G}/${id}`),
  activate: (id: string) => post<GoalDto>(`${G}/${id}/activate`),
  complete: (id: string) => post<GoalDto>(`${G}/${id}/complete`),
  tracking: (id: string) => request<TrackingDto>(`${G}/${id}/tracking`),
  milestones: (id: string) => request<MilestoneDto[]>(`${G}/${id}/milestones`),
  saveMilestone: (id: string, milestoneId: string | undefined, body: { name: string; targetAmount: number; targetDate: string }) =>
    save<MilestoneDto>(`${G}/${id}/milestones`, milestoneId, body),
  removeMilestone: (id: string, milestoneId: string) => del(`${G}/${id}/milestones/${milestoneId}`),
  contributions: (id: string) => request<ContributionDto[]>(`${G}/${id}/contributions`),
  contribute: (id: string, body: { date?: string; amount: number; notes?: string }) => post<ContributionDto>(`${G}/${id}/contributions`, body),
  removeContribution: (id: string, contributionId: string) => del(`${G}/${id}/contributions/${contributionId}`),
  categories: (f: { active?: boolean } & Paging) => request<IPage<GoalCategoryDto>>(withQuery(`${A}/goal-categories`, { ...f })),
  saveCategory: (id: string | undefined, body: GoalCategoryForm) => save<GoalCategoryDto>(`${A}/goal-categories`, id, body),
  removeCategory: (id: string) => del(`${A}/goal-categories/${id}`),
}

const P = `${A}/budget-periods`
const B = `${A}/budgets`
export const BudgetService = {
  periods: (f: { status?: string; financialYear?: number } & Paging) => request<IPage<PeriodDto>>(withQuery(P, { ...f })),
  savePeriod: (id: string | undefined, body: PeriodForm) => save<PeriodDto>(P, id, body),
  removePeriod: (id: string) => del(`${P}/${id}`),
  closePeriod: (id: string) => post<PeriodDto>(`${P}/${id}/close`),
  periodMonitoring: (id: string) => request<PeriodMonitoringDto>(`${P}/${id}/monitoring`),
  list: (f: { periodId?: string; status?: string; type?: string } & Paging) => request<IPage<BudgetDto>>(withQuery(B, { ...f })),
  save: (id: string | undefined, body: BudgetForm) => save<BudgetDto>(B, id, body),
  remove: (id: string) => del(`${B}/${id}`),
  approve: (id: string) => post<BudgetDto>(`${B}/${id}/approve`),
  activate: (id: string) => post<BudgetDto>(`${B}/${id}/activate`),
  close: (id: string) => post<BudgetDto>(`${B}/${id}/close`),
  monitoring: (id: string) => request<MonitoringDto>(`${B}/${id}/monitoring`),
  saveAllocation: (id: string, allocationId: string | undefined, body: { accountId: number; allocated: number; notes?: string }) =>
    save<AllocationDto>(`${B}/${id}/allocations`, allocationId, body),
  removeAllocation: (id: string, allocationId: string) => del(`${B}/${id}/allocations/${allocationId}`),
}
