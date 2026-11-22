// @ts-check
/**
 * Recruitment (manual §17). Spec sources: recruitment-service PostingController (PostingForm; /publish, /close; REC_008
 * min ≤ max), InterviewController (InterviewForm; /interview-rounds/options needs jobPostingId, so rounds come from the
 * list and are filtered by the candidate's job; FeedbackForm scores are all required in practice), OfferController
 * (/approval {approvalStatus}, /status {status}, /letter PDF, /convert-to-employee ConvertForm), CareerSettingsService
 * (slug REC_051), PublicCareerController (multipart apply: `application` JSON + `resume`; /track trackingId + email).
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf, publicSettings, LANGUAGES, fail } from "../utils/mock-api.js"

const ALL = ["RECRUITMENT_VIEW", "RECRUITMENT_MANAGE", "EMPLOYEE_VIEW", "ORG_VIEW"]

/** @param {import('@playwright/test').Page} page */
async function base(page) {
  await mockLoggedIn(page, { permissions: ALL })
  await mockApi(page, "/v1/employees", { method: "GET", body: pageOf([{ id: "35", employeeNo: "EMP000001", fullName: "E2E An" }]) })
  await mockApi(page, "/v1/org/branches/options", { body: ok([]) })
  await mockApi(page, "/v1/org/departments/options", { body: ok([]) })
  await mockApi(page, "/v1/org/designations/options", { body: ok([]) })
  await mockApi(page, "/v1/recruitment/job-types/options", { body: ok([{ id: "1", name: "E2E Full time" }]) })
  await mockApi(page, "/v1/recruitment/job-locations/options", { body: ok([{ id: "2", name: "E2E HCM" }]) })
  await mockApi(page, "/v1/recruitment/custom-questions/options", { body: ok([{ id: "3", question: "E2E Certificate?" }]) })
  await mockApi(page, "/v1/recruitment/job-postings/options", { body: ok([{ id: "10", jobCode: "JOB-0001", title: "E2E Accountant" }, { id: "11", jobCode: "JOB-0002", title: "E2E Developer" }]) })
}
/** @param {import('@playwright/test').Page} page @param {string} name */
const menu = (page, name) => page.getByRole("button", { name: `Thao tác cho ${name}` })

test("RC-001 tin tuyển dụng: 3 bước, lương tối đa ≥ tối thiểu, kỹ năng tách dấu phẩy, gửi PostingForm; Đăng tuyển @smoke", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/recruitment/job-postings", { method: "GET", body: pageOf([{ id: "10", title: "E2E Accountant", jobCode: "JOB-0001", status: "DRAFT" }]) })
  const save = await mockApi(page, "/v1/recruitment/job-postings", { method: "POST", body: ok({ id: "12" }) })
  const publish = await mockApi(page, "/v1/recruitment/job-postings/10/publish", { method: "PUT", body: ok({}) })
  await page.goto("/recruitment/jobs")
  await page.getByRole("button", { name: "Tạo tin tuyển dụng" }).click()
  const d = page.getByRole("dialog")
  const next = d.getByRole("button", { name: "Tiếp" })
  await d.getByLabel("Tiêu đề *").fill("E2E Tester")
  await expect(next).toBeDisabled()
  await d.getByRole("combobox", { name: "Loại" }).click()
  await page.getByRole("option", { name: "E2E Full time" }).click()
  await d.getByRole("combobox", { name: "Địa điểm" }).click()
  await page.getByRole("option", { name: "E2E HCM" }).click()
  await d.getByRole("combobox", { name: "Nhận hồ sơ" }).click()
  await page.getByRole("option", { name: "Qua link bên ngoài" }).click()
  await expect(d.getByLabel("Link ứng tuyển")).toBeVisible()
  await expect(next).toBeDisabled()
  await d.getByRole("combobox", { name: "Nhận hồ sơ" }).click()
  await page.getByRole("option", { name: "Trên trang tuyển dụng của công ty" }).click()
  await d.getByLabel("Kỹ năng (cách nhau bằng dấu phẩy)").fill("QA, Playwright ,")
  await next.click()
  await d.getByLabel("Lương tối thiểu").fill("20000000")
  await d.getByLabel("Lương tối đa").fill("10000000")
  await expect(d.getByText("Không nhỏ hơn mức tối thiểu")).toBeVisible()
  await d.getByLabel("Lương tối đa").fill("30000000")
  await next.click()
  await d.getByRole("checkbox", { name: "E2E Certificate?" }).check()
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({
    title: "E2E Tester",
    jobTypeId: 1,
    locationId: 2,
    priority: "MEDIUM",
    positions: 1,
    applicationType: "EXISTING",
    skills: ["QA", "Playwright"],
    featured: false,
    minSalary: 20000000,
    maxSalary: 30000000,
    customQuestionIds: [3],
    askGender: false,
    askDateOfBirth: false,
    showCoverLetter: true,
    showTerms: true,
  })
  await menu(page, "E2E Accountant").click()
  await page.getByRole("menuitem", { name: "Đăng tuyển" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Đăng tuyển" }).click()
  await expect.poll(() => publish.requests.length).toBe(1)
})

test("RC-010 phỏng vấn: vòng lọc theo vị trí của ứng viên; phản hồi cần đủ 4 điểm, gửi FeedbackForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/recruitment/candidates", { method: "GET", body: pageOf([{ id: "5", fullName: "E2E Mai", email: "mai@example.com", job: { id: "10" } }]) })
  await mockApi(page, "/v1/recruitment/interview-rounds", {
    method: "GET",
    body: pageOf([
      { id: "3", name: "E2E Technical", sequenceNumber: 1, job: { id: "10" } },
      { id: "4", name: "E2E Other job", sequenceNumber: 1, job: { id: "11" } },
    ]),
  })
  await mockApi(page, "/v1/recruitment/interview-types/options", { body: ok([{ id: "7", name: "E2E In person" }]) })
  const iv = { id: "9", candidate: { id: "5", fullName: "E2E Mai" }, round: { id: "3", name: "E2E Technical" }, interviewType: { name: "E2E In person" }, date: "2026-11-25", startTime: "09:30:00", durationMinutes: 60, status: "COMPLETED", interviewers: [{ employeeId: "35", name: "E2E An" }] }
  await mockApi(page, "/v1/recruitment/interviews", { method: "GET", body: pageOf([iv]) })
  const create = await mockApi(page, "/v1/recruitment/interviews", { method: "POST", body: ok({ id: "10" }) })
  await mockApi(page, "/v1/recruitment/interviews/9", { method: "GET", body: ok({ ...iv, feedback: [], feedbackSummary: { count: 0 } }) })
  const feedback = await mockApi(page, "/v1/recruitment/interviews/9/feedback", { method: "POST", body: ok({}) })
  await page.goto("/recruitment/interviews")
  await page.getByRole("button", { name: "Lên lịch phỏng vấn" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Ứng viên" }).click()
  await page.getByRole("option", { name: "E2E Mai · mai@example.com" }).click()
  await d.getByRole("combobox", { name: "Vòng" }).click()
  await expect(page.getByRole("option")).toHaveCount(1)
  await page.getByRole("option", { name: "1. E2E Technical" }).click()
  await d.getByRole("combobox", { name: "Loại" }).click()
  await page.getByRole("option", { name: "E2E In person" }).click()
  await d.getByLabel("Ngày *").fill("2026-11-25")
  await d.getByLabel("Bắt đầu *").fill("09:30")
  await d.getByRole("checkbox", { name: "E2E An (EMP000001)" }).check()
  await d.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({ candidateId: 5, roundId: 3, interviewTypeId: 7, date: "2026-11-25", startTime: "09:30", durationMinutes: 60, interviewerIds: [35] })

  await page.getByRole("button", { name: "E2E Mai", exact: true }).click()
  await page.getByRole("button", { name: "Thêm phản hồi" }).click()
  const f = page.getByRole("dialog").last()
  await f.getByRole("combobox", { name: "Đề xuất" }).click()
  await page.getByRole("option", { name: "Nên tuyển", exact: true }).click()
  await f.getByRole("combobox", { name: "Tổng thể" }).click()
  await page.getByRole("option", { name: "★★★★", exact: true }).click()
  const submit = f.getByRole("button", { name: "Lưu thay đổi" })
  await expect(submit).toBeDisabled()
  for (const s of ["Chuyên môn", "Giao tiếp", "Phù hợp văn hóa"]) {
    await f.getByRole("combobox", { name: s }).click()
    await page.getByRole("option", { name: "★★★", exact: true }).click()
  }
  await submit.click()
  await expect.poll(() => feedback.length).toBe(1)
  expect(feedback[0]).toEqual({ employeeId: 35, recommendation: "HIRE", overallScore: 4, technicalScore: 3, communicationScore: 3, culturalFitScore: 3 })
})

test("RC-020 offer: chỉ gửi được khi đã duyệt; chấp nhận rồi chuyển thành nhân viên gửi ConvertForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/recruitment/candidates", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/recruitment/offer-templates", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/recruitment/offers", {
    method: "GET",
    body: pageOf([
      { id: "1", candidate: { fullName: "E2E Draft" }, salary: 1, status: "DRAFT", approvalStatus: "PENDING" },
      { id: "2", candidate: { fullName: "E2E Accepted" }, salary: 1, status: "ACCEPTED", approvalStatus: "APPROVED" },
    ]),
  })
  const approval = await mockApi(page, "/v1/recruitment/offers/1/approval", { method: "PUT", body: ok({}) })
  const convert = await mockApi(page, "/v1/recruitment/offers/2/convert-to-employee", { method: "POST", body: ok({}) })
  await page.goto("/recruitment/offers")
  await menu(page, "E2E Draft").click()
  await expect(page.getByRole("menuitem", { name: "Gửi" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Duyệt" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt" }).click()
  await expect.poll(() => approval.length).toBe(1)
  expect(approval[0]).toEqual({ approvalStatus: "APPROVED" })
  await menu(page, "E2E Accepted").click()
  await page.getByRole("menuitem", { name: "Chuyển thành nhân viên" }).click()
  const d = page.getByRole("dialog")
  await d.getByRole("combobox", { name: "Loại hình" }).click()
  await page.getByRole("option", { name: "Toàn thời gian" }).click()
  await d.getByLabel("Ngày vào làm").fill("2026-12-01")
  await d.getByRole("button", { name: "Chuyển thành nhân viên" }).click()
  await expect.poll(() => convert.length).toBe(1)
  expect(convert[0]).toEqual({ employmentType: "FULL_TIME", dateOfJoining: "2026-12-01" })
})

test("RC-030 trang tuyển dụng: slug chữ thường/số/gạch ngang, gửi SettingsForm", async ({ page }) => {
  await base(page)
  await mockApi(page, "/v1/recruitment/job-types", { method: "GET", body: pageOf([]) })
  await mockApi(page, "/v1/recruitment/career-settings", { method: "GET", body: ok(null) })
  const save = await mockApi(page, "/v1/recruitment/career-settings", { method: "PUT", body: ok({ slug: "e2e-co", enabled: true, displayName: "E2E Co" }) })
  await page.goto("/recruitment/setup?tab=portal")
  await page.getByLabel("Địa chỉ (slug)").fill("e2e_co")
  await expect(page.getByText("Chữ thường, số và dấu gạch ngang đơn, 3–50 ký tự")).toBeVisible()
  await page.getByLabel("Địa chỉ (slug)").fill("e2e-co")
  await page.getByLabel("Tên công ty hiển thị").fill("E2E Co")
  await page.getByRole("switch", { name: "Công khai trang" }).click()
  await page.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => save.length).toBe(1)
  expect(save[0]).toEqual({ slug: "e2e-co", enabled: true, displayName: "E2E Co" })
})

/** @param {import('@playwright/test').Page} page */
async function publicBase(page) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 599, contentType: "application/json", body: JSON.stringify(fail("E2E_UNMOCKED", route.request().url())) }))
  await mockApi(page, "/v1/settings/public", { body: publicSettings() })
  await mockApi(page, "/v1/languages", { body: LANGUAGES })
  await mockApi(page, "/v1/public/career/e2e-co", { body: ok({ slug: "e2e-co", displayName: "E2E Co", headline: "E2E Join us", openJobs: 1 }) })
  await mockApi(page, "/v1/public/career/e2e-co/filters", { body: ok({ locations: [], jobTypes: [] }) })
  await mockApi(page, "/v1/public/career/e2e-co/jobs", { body: ok([{ id: "10", title: "E2E Accountant", skills: ["Excel"], location: { name: "E2E HCM" }, jobType: { name: "E2E Full time" } }]) })
}

test("RC-040 cổng công khai: bắt buộc CV + điều khoản + câu hỏi; nộp multipart nhận mã tra cứu; tra cứu theo mã + email", async ({ page }) => {
  await publicBase(page)
  await mockApi(page, "/v1/public/career/e2e-co/jobs/10", {
    body: ok({ job: { id: "10", title: "E2E Accountant" }, applicationType: "EXISTING", showTerms: true, showCoverLetter: false, questions: [{ id: "3", question: "E2E Years of Excel?", type: "NUMBER", required: true }] }),
  })
  const apply = await mockApi(page, "/v1/public/career/e2e-co/jobs/10/apply", { method: "POST", body: ok({ jobTitle: "E2E Accountant", trackingId: "E2ETRACK01" }) })
  await mockApi(page, "/v1/public/career/e2e-co/track", { body: ok({ jobTitle: "E2E Accountant", applicationDate: "2026-11-22", status: "SCREENING" }) })
  await page.goto("/careers/e2e-co")
  await expect(page.getByRole("heading", { name: "E2E Join us" })).toBeVisible()
  await page.getByText("E2E Accountant").click()
  await page.getByLabel("Tên *").fill("Mai")
  await page.getByLabel("Họ *").fill("E2E Tran")
  await page.getByLabel("Email *").fill("mai@example.com")
  await page.getByRole("button", { name: "Nộp hồ sơ" }).click()
  await expect(page.getByText("Đính kèm CV dạng PDF, DOC hoặc DOCX")).toBeVisible()
  await expect(page.getByText("Cần đồng ý điều khoản để ứng tuyển")).toBeVisible()
  expect(apply.length).toBe(0)
  await page.getByLabel("E2E Years of Excel? *").fill("4")
  await page.getByLabel("CV (PDF, DOC, DOCX) *").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") })
  await page.getByRole("checkbox", { name: /Tôi đồng ý điều khoản/ }).click()
  await page.getByRole("button", { name: "Nộp hồ sơ" }).click()
  await expect(page.getByTestId("tracking-id")).toHaveText("E2ETRACK01")
  const req = apply.requests[0]
  expect(req.headers["content-type"]).toContain("multipart/form-data")
  expect(String(req.body)).toContain('"answers":[{"questionId":3,"answer":"4"}]')
  expect(String(req.body)).toContain('name="resume"; filename="cv.pdf"')
  expect(req.headers.authorization).toBeUndefined()

  await page.getByRole("tab", { name: "Tra cứu hồ sơ" }).click()
  await page.getByLabel("Mã tra cứu").fill("E2ETRACK01")
  await page.getByLabel("Email").fill("mai@example.com")
  await page.getByRole("button", { name: "Xem trạng thái" }).click()
  await expect(page.getByTestId("track-result")).toContainText("Đang xem xét")
})
