// @ts-check
/** Fake Super Admin data (obviously fake names; one row with nulls and one with awkward text). */

export const COMPANIES = [
  {
    id: "101",
    code: "E2E_ACME",
    name: "E2E Acme Co., Ltd",
    email: "contact@acme.example",
    status: "ACTIVE",
    subscriptionStatus: "ACTIVE",
    planName: "E2E Pro",
    planExpiresAt: "2027-01-31T00:00:00Z",
    createdDate: "2026-11-01T03:00:00Z",
  },
  {
    id: "102",
    code: "E2E_OBRIEN",
    name: "Công ty TNHH Thương mại Dịch vụ O'Brien Việt Nam",
    email: "obrien@example.com",
    status: "SUSPENDED",
    planName: null,
    planExpiresAt: null,
    createdDate: "2026-11-10T03:00:00Z",
  },
  // all-null row: the list must still render ("-")
  { id: "103", code: null, name: null, email: null, status: null, planName: null, createdDate: null },
]

export const COUNTS = { all: 3, active: 1, inactive: 2 }

export const DASHBOARD = {
  totalRevenue: 12345.5,
  totalCompanies: 3,
  activeCompanies: 1,
  activePlans: 2,
  totalUsers: 17,
  pendingRequests: 4,
  monthlyGrowthPercent: 50,
  recentCompanies: [{ id: "101", name: "E2E Acme Co., Ltd", email: "contact@acme.example", createdDate: "2026-11-01T03:00:00Z", status: "ACTIVE" }],
  topPlans: [{ planId: "1", name: "E2E Pro", subscribers: 2, revenue: 999 }],
  year: 2026,
  newCompaniesByMonth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0],
  revenueByMonth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12345.5, 0],
}

export const LOGINS = [
  {
    id: "9",
    username: "e2e.superadmin",
    userType: "SUPER_ADMIN",
    ipAddress: "10.0.0.9",
    browser: "Chrome",
    os: "Windows",
    loginAt: "2026-11-21T01:02:00Z",
  },
  { id: "8", username: "acme.admin", userType: "COMPANY_USER", ipAddress: "10.0.0.8", browser: null, os: null, loginAt: null },
]
