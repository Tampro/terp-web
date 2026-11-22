// @ts-check
/**
 * Form builder (manual §11.2). Spec sources: project-service FormController (FormForm {name, active, layout, fields}),
 * PublicFormController (GET / POST /public/forms/{token}, no sign-in), FormConvertService (ConvertForm {target,
 * mapping, values}; FRM_003 options, FRM_015 converted once, FRM_017 required target field); FORM_VIEW / FORM_MANAGE.
 */
import { expect, test } from "../fixtures/index.js"
import { fail, mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const FORM = { id: "3", name: "E2E Contact", active: true, layout: "TWO_COLUMN", publicToken: "tok123" }
const FIELDS = [
  { key: "full_name", label: "Full name", type: "TEXT", required: true },
  { key: "email", label: "Email", type: "EMAIL", required: true },
  { key: "topic", label: "Topic", type: "SELECT", required: true, options: ["Sales", "Support"] },
  { key: "message", label: "Message", type: "TEXTAREA", required: false },
]

test("FRM-001 tạo biểu mẫu: kiểu chọn cần lựa chọn (FRM_003), gửi FormForm @smoke", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["FORM_VIEW", "FORM_MANAGE"] })
  await mockApi(page, "/v1/forms", { method: "GET", body: pageOf([FORM]) })
  const create = await mockApi(page, "/v1/forms", { method: "POST", body: ok({ form: FORM, fields: FIELDS }) })
  await page.goto("/forms")
  await expect(page.getByRole("row").filter({ hasText: "E2E Contact" })).toContainText("Hai cột")
  await page.getByRole("button", { name: "Tạo biểu mẫu" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Tên").fill("E2E Survey")
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Thêm ít nhất một trường")).toBeVisible()
  await dialog.getByRole("button", { name: "Thêm trường" }).click()
  await dialog.getByLabel("Nhãn của trường 1").fill("Rating")
  await dialog.getByRole("combobox", { name: "Kiểu của trường 1" }).click()
  await page.getByRole("option", { name: "Chọn một" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect(dialog.getByText("Nhập ít nhất một lựa chọn")).toBeVisible()
  await dialog.getByLabel("Lựa chọn của trường 1").fill("Good\nBad\n")
  await dialog.getByRole("checkbox", { name: "Bắt buộc" }).click()
  await dialog.getByRole("button", { name: "Lưu" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create[0]).toEqual({
    name: "E2E Survey",
    active: true,
    layout: "SINGLE_COLUMN",
    fields: [{ label: "Rating", type: "RADIO", required: true, placeholder: null, options: ["Good", "Bad"] }],
  })
})

test("FRM-002 trang công khai (không đăng nhập): bắt buộc, gửi answers, lỗi backend hiện message", async ({ page }) => {
  await mockApi(page, "/v1/public/forms/tok123", { method: "GET", body: ok({ name: "E2E Contact", layout: "TWO_COLUMN", fields: FIELDS }) })
  const submit = await mockApi(page, "/v1/public/forms/tok123/responses", { method: "POST", status: 400, body: fail("FRM_005", "Trường \"Email\" phải là địa chỉ email hợp lệ.") })
  await page.goto("/f/tok123")
  await expect(page.getByText("E2E Contact", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/f\/tok123$/) // no redirect to /login
  await page.getByRole("button", { name: "Gửi" }).click()
  await expect(page.getByText("Bắt buộc")).toHaveCount(3)
  expect(submit).toHaveLength(0)
  await page.getByLabel("Full name").fill("E2E Mai")
  await page.getByLabel("Email").fill("mai@example")
  await page.getByRole("combobox", { name: "Topic" }).click()
  await page.getByRole("option", { name: "Sales" }).click()
  await page.getByRole("button", { name: "Gửi" }).click()
  await expect(page.getByText("Trường \"Email\" phải là địa chỉ email hợp lệ.")).toBeVisible()
  expect(submit[0]).toEqual({ answers: { full_name: "E2E Mai", email: "mai@example", topic: "Sales" } })
  expect(submit.requests[0].headers.authorization).toBeUndefined()

  await mockApi(page, "/v1/public/forms/tok123/responses", { method: "POST", body: ok(null) })
  await page.getByLabel("Email").fill("mai@example.com")
  await page.getByRole("button", { name: "Gửi" }).click()
  await expect(page.getByText("Cảm ơn bạn, câu trả lời đã được gửi.")).toBeVisible()
})

test("FRM-003 chuyển phản hồi thành Lead: trường bắt buộc phải có nguồn (FRM_017), gửi mapping + values", async ({ page }) => {
  await mockLoggedIn(page, { permissions: ["FORM_VIEW", "FORM_MANAGE"] })
  await mockApi(page, "/v1/forms/3", { method: "GET", body: ok({ form: FORM, fields: FIELDS }) })
  await mockApi(page, "/v1/forms/3/responses", {
    body: pageOf([
      { id: "7", createdDate: "2026-11-22T05:00:00Z", answers: [{ key: "full_name", label: "Full name", type: "TEXT", value: "E2E Mai" }, { key: "email", label: "Email", type: "EMAIL", value: "mai@example.com" }] },
      { id: "8", createdDate: "2026-11-21T05:00:00Z", convertedTargetType: "DEAL", convertedTargetId: "5", answers: [] },
    ]),
  })
  const convert = await mockApi(page, "/v1/forms/3/responses/7/convert", { method: "POST", body: ok({ targetType: "LEAD", targetId: "11" }) })
  await page.goto("/forms/3")
  await expect(page.getByText("Đã chuyển thành Deal CRM #5")).toBeVisible()
  await page.getByRole("button", { name: "Chuyển đổi" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Chuyển đổi" }).click()
  await expect(dialog.getByText("pipelineId cần một câu trả lời hoặc giá trị cố định")).toBeVisible()
  expect(convert).toHaveLength(0)

  /** @param {string} field @param {string|RegExp} option */
  const source = async (field, option) => {
    await dialog.getByRole("combobox", { name: `Nguồn của ${field}` }).click()
    await page.getByRole("option", { name: option }).click()
  }
  await source("pipelineId", "Giá trị cố định")
  await dialog.getByLabel("Giá trị của pipelineId").fill("6")
  await source("name", "Câu trả lời: Full name")
  await source("email", "Câu trả lời: Email")
  await source("subject", "Câu trả lời: Full name")
  await source("ownerUserId", "Giá trị cố định")
  await dialog.getByLabel("Giá trị của ownerUserId").fill("52")
  await dialog.getByRole("button", { name: "Chuyển đổi" }).click()
  await expect.poll(() => convert.length).toBe(1)
  expect(convert[0]).toEqual({
    target: "LEAD",
    mapping: { name: "full_name", email: "email", subject: "full_name" },
    values: { pipelineId: "6", ownerUserId: "52" },
  })
})
