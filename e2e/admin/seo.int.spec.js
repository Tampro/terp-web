// @ts-check
/**
 * §3.7 SEO against the REAL backend, read-only: /site and a custom page carry the SEO tags in the server HTML (seen by
 * crawlers without JavaScript), built from GET /v1/settings/public and the page's meta title / description.
 */
import { expect, test } from "@playwright/test"

/** @param {string} html @param {RegExp} re */
const pick = (html, re) => html.match(re)?.[1]

test("INT-SEO-001 HTML của /site và trang tùy chỉnh có thẻ SEO từ server", async ({ request }) => {
  const settings = (await (await request.get("/api/v1/settings/public")).json()).data
  const brand = settings.brand?.titleText || "ERP"
  const html = await (await request.get("/site")).text()
  expect(pick(html, /<title>([^<]*)<\/title>/)).toBe(brand)
  expect(html).toContain('<meta name="robots" content="index, follow"/>')
  if (settings.seo?.metaDescription) expect(pick(html, /<meta name="description" content="([^"]*)"/)).toBe(settings.seo.metaDescription)
  const pages = (await (await request.get("/api/v1/public/site/pages")).json()).data ?? []
  test.skip(!pages.length, "no published custom page")
  const page = (await (await request.get(`/api/v1/public/site/pages/${pages[0].slug}`)).json()).data
  const pageHtml = await (await request.get(`/site/${pages[0].slug}`)).text()
  expect(pick(pageHtml, /<title>([^<]*)<\/title>/)).toBe(`${page.metaTitle || page.title} | ${brand}`)
})
