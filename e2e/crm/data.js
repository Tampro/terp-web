// @ts-check
/** Mock data for §7 (crm-service DTOs). Names start with "E2E", no real PII. */

export const CRM_ALL = ["CRM_VIEW", "CRM_MANAGE", "CRM_CONTRACT_VIEW", "CRM_CONTRACT_MANAGE"]

export const PIPELINES = [
  {
    id: "1",
    name: "E2E Pipeline",
    leadStages: [
      { id: "11", pipelineId: "1", kind: "LEAD", name: "New", position: 1 },
      { id: "12", pipelineId: "1", kind: "LEAD", name: "Qualified", position: 2 },
    ],
    dealStages: [
      { id: "21", pipelineId: "1", kind: "DEAL", name: "Proposal", position: 1 },
      { id: "22", pipelineId: "1", kind: "DEAL", name: "Won", position: 2 },
    ],
  },
]
export const LABELS = [{ id: "31", pipelineId: "1", name: "E2E Hot", color: "#dc2626" }]
export const SOURCES = [{ id: "41", name: "E2E Website" }]
export const USERS = [{ id: "9001", username: "e2e.admin", fullName: "E2E Admin", email: "e2e.admin@example.com" }]
export const CUSTOMERS = [
  { id: "501", customerCode: "C-01", companyName: "E2E O'Brien & Sons" },
  { id: "502", customerCode: "C-02", companyName: "E2E 한빛 무역" },
]
export const ITEMS = [{ id: "601", name: "E2E Keyboard", sku: "KB-01", type: "PRODUCT", salePrice: 100000 }]

export const LEADS = [
  {
    id: "101",
    pipelineId: "1",
    stageId: "11",
    stageName: "New",
    name: "E2E Lan",
    email: "lan@example.com",
    subject: "E2E rollout",
    followUpDate: "2026-11-01",
    followUpOverdue: true,
    ownerUserId: "9001",
    tasksTotal: 2,
    tasksDone: 1,
    labels: [{ refId: "31", name: "E2E Hot" }],
    position: 1,
    convertedDealId: null,
  },
  {
    id: "102",
    pipelineId: "1",
    stageId: "12",
    stageName: "Qualified",
    name: "E2E Minh",
    email: "minh@example.com",
    subject: "E2E renewal",
    followUpDate: null,
    followUpOverdue: false,
    ownerUserId: "9001",
    tasksTotal: 0,
    tasksDone: 0,
    labels: [],
    position: 1,
    convertedDealId: "201",
  },
]
export const LEAD_BOARD = [
  { stageId: "11", name: "New", leads: [LEADS[0]] },
  { stageId: "12", name: "Qualified", leads: [LEADS[1]] },
]
export const LEAD_DETAIL = {
  lead: LEADS[0],
  notes: "E2E note",
  activity: {
    members: [{ refId: "9001", name: "E2E Admin" }],
    labels: [{ refId: "31", name: "E2E Hot" }],
    sources: [],
    products: [],
    tasks: [{ id: "701", name: "E2E Call back", date: "2026-11-25", time: "09:30:00", priority: "HIGH", status: "OPEN" }],
    calls: [],
    discussions: [{ id: "801", type: "DISCUSSION", body: "E2E comment", authorName: "e2e.admin", createdDate: "2026-11-21T02:00:00Z" }],
    emails: [],
    files: [],
    activity: [{ id: "901", type: "ACTIVITY", title: "Lead created", body: "E2E Lan", createdDate: "2026-11-21T02:00:00Z" }],
  },
}

export const DEALS = [
  {
    id: "201",
    pipelineId: "1",
    stageId: "21",
    stageName: "Proposal",
    name: "E2E License deal",
    price: 250000000,
    status: "ACTIVE",
    tasksTotal: 1,
    tasksDone: 0,
    clients: [{ refId: "501", name: "E2E O'Brien & Sons" }],
    labels: [],
    position: 1,
    fromLeadId: "102",
  },
  {
    id: "202",
    pipelineId: "1",
    stageId: "22",
    stageName: "Won",
    name: "E2E Training deal",
    price: 30000000,
    status: "WON",
    tasksTotal: 0,
    tasksDone: 0,
    clients: [],
    labels: [],
    position: 1,
  },
]
export const DEAL_BOARD = [
  { stageId: "21", name: "Proposal", count: 1, total: 250000000, deals: [DEALS[0]] },
  { stageId: "22", name: "Won", count: 1, total: 30000000, deals: [DEALS[1]] },
]

export const TYPES = [
  { id: "51", name: "E2E Service", active: true, contractCount: 3 },
  { id: "52", name: "E2E Old type", active: false, contractCount: 0 },
]
export const CONTRACTS = [
  {
    id: "301",
    number: "CON0001",
    subject: "E2E Annual support",
    customerId: "501",
    customerName: "E2E O'Brien & Sons",
    contractTypeId: "51",
    value: 60000000,
    startDate: "2026-05-01",
    endDate: "2027-05-01",
    status: "ACTIVE",
    progressPercent: 55,
    daysLeft: 160,
    ownerId: "u-1",
    ownerName: "E2E Nguyễn Văn An",
  },
  {
    id: "302",
    number: "CON0002",
    subject: "E2E Old hosting",
    customerId: "502",
    customerName: "E2E 한빛 무역",
    contractTypeId: "52",
    value: null,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "CLOSED",
    progressPercent: 100,
    daysLeft: 0,
  },
]
export const CONTRACT_COUNTS = { total: 2, active: 1, pending: 0, closed: 1, declined: 0 }
export const CONTRACT_DETAIL = {
  contract: CONTRACTS[0],
  contractTypeName: "E2E Service",
  description: "E2E agreement text",
  renewals: [],
  comments: [{ id: "1", message: "E2E signed", authorName: "e2e.admin", createdDate: "2026-11-21T02:00:00Z" }],
  notes: [],
  attachments: [],
}
export const SETTING = { companyId: "1", prefix: "CON", nextNumber: 3, nextContractNumber: "CON0003" }
