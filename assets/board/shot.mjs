// 把 render.mjs 產生的 HTML 截成 PNG：每份截 `.shot` 元素，2 倍解析度，檔名和 HTML 相同。
// 需要 Playwright 的 Chromium（`npm i -g playwright && npx playwright install chromium`），本機或全域安裝都可以。
// 用法：node assets/board/shot.mjs <render.mjs 的輸出資料夾> assets/board
import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const loadPlaywright = () => {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return createRequire(join(global, 'noop.js'))('playwright')
  }
}

const [from, to] = process.argv.slice(2).map(one => resolve(one))
const { chromium } = loadPlaywright()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
for (const file of readdirSync(from).filter(one => one.endsWith('.html')).sort()) {
  await page.goto(pathToFileURL(join(from, file)).href)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.shot').screenshot({ path: join(to, file.replace(/\.html$/, '.png')) })
  console.log(file.replace(/\.html$/, '.png'))
}
await browser.close()
