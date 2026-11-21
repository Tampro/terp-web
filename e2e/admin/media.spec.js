// @ts-check
/**
 * Super Admin › Media library (manual §3.6).
 * Spec sources: media-service MediaController — GET /media/stats, /media/folders, /media/files (folderId, keyword, page,
 * size 24), POST /media/files (multipart field "files", folderId), PUT /media/files/{id} (full replacement:
 * displayName + folderId), DELETE /media/files/{id}, POST/PUT/DELETE /media/folders.
 */
import { expect, test } from "../fixtures/index.js"
import { mockApi, mockLoggedIn, ok, pageOf } from "../utils/mock-api.js"

const FOLDERS = [{ id: "3", name: "Logos", fileCount: 1 }]
const FILES = [
  {
    id: "55",
    folderId: "3",
    originalName: "acme-logo.png",
    displayName: "Acme logo",
    mimeType: "image/png",
    kind: "IMAGE",
    sizeBytes: 2048,
    uploadedAt: "2026-11-20T02:00:00Z",
    viewUrl: null,
    downloadUrl: null,
  },
]

/** @param {import('@playwright/test').Page} page */
async function openMedia(page) {
  await mockLoggedIn(page, { superAdmin: true })
  await mockApi(page, "/v1/media/stats", { body: ok({ files: 1, storageBytes: 1536 * 1024, images: 1 }) })
  const folders = await mockApi(page, "/v1/media/folders", { method: "GET", body: ok(FOLDERS) })
  const files = await mockApi(page, "/v1/media/files", { method: "GET", body: pageOf(FILES, { size: 24 }) })
  await page.goto("/media")
  await expect(page.getByRole("button", { name: "Acme logo" })).toBeVisible()
  return { folders, files }
}

test("MED-001 thẻ thống kê, thư mục, tệp; chọn thư mục gửi folderId @smoke", async ({ page }) => {
  const { files } = await openMedia(page)
  await expect(page.getByText("1.5 MB")).toBeVisible()
  await page.getByRole("button", { name: /Logos/ }).first().click() // the folder row button (rename/delete have their own names)
  await expect.poll(() => files.requests.at(-1)?.url.searchParams.get("folderId")).toBe("3")
})

test("MED-002 tải lên gửi multipart 'files' kèm folderId đang chọn", async ({ page }) => {
  const { files } = await openMedia(page)
  const upload = await mockApi(page, "/v1/media/files", { method: "POST", body: ok([{ id: "56" }]) })
  await page.getByRole("button", { name: /Logos/ }).first().click()
  await expect.poll(() => files.requests.at(-1)?.url.searchParams.get("folderId")).toBe("3")

  await page.getByTestId("media-file-input").setInputFiles({ name: "e2e.txt", mimeType: "text/plain", buffer: Buffer.from("e2e") })

  await expect(page.getByText("Đã tải lên 1 tệp")).toBeVisible()
  const req = upload.requests[0]
  expect(req.url.searchParams.get("folderId")).toBe("3")
  expect(req.headers["content-type"]).toContain("multipart/form-data")
  expect(String(req.body)).toContain('name="files"; filename="e2e.txt"')
})

test("MED-003 đổi tên hiển thị giữ nguyên thư mục (PUT thay thế toàn bộ)", async ({ page }) => {
  await openMedia(page)
  const update = await mockApi(page, "/v1/media/files/55", { method: "PUT", body: ok(FILES[0]) })
  await page.getByRole("button", { name: "Acme logo" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("image/png")
  await dialog.getByLabel("Tên hiển thị").fill("Acme logo 2026")
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect(dialog).toBeHidden()
  expect(update).toEqual([{ displayName: "Acme logo 2026", folderId: 3 }])
})

test("MED-004 xóa tệp sau khi xác nhận", async ({ page }) => {
  await openMedia(page)
  const del = await mockApi(page, "/v1/media/files/55", { method: "DELETE", body: ok(null) })
  await page.getByRole("button", { name: "Acme logo" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Xóa" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Tệp sẽ bị xóa vĩnh viễn.")
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click()
  await expect.poll(() => del.requests.length).toBe(1)
})

test("MED-005 tạo thư mục mới gửi name", async ({ page }) => {
  await openMedia(page)
  const create = await mockApi(page, "/v1/media/folders", { method: "POST", body: ok({ id: "4", name: "E2E Docs" }) })
  await page.getByRole("button", { name: "Thư mục mới" }).click()
  await page.getByRole("dialog").getByLabel("Tên thư mục").fill("  E2E Docs ")
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi" }).click()
  await expect.poll(() => create.length).toBe(1)
  expect(create).toEqual([{ name: "E2E Docs" }])
})
