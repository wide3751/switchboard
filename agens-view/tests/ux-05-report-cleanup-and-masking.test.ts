import { expect, mock, test } from 'claude-code/testing'

import { maskSecrets } from '../hooks/board'
import { DIR, REPORTS, T0, fakeWorld, put, report } from './world'

test('沒開過監看視窗的 Session 啟動時，也會刪掉已結束 Session 留下的回報', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 401, 'idle')
  report(world, 401, {})
  put(world, 402, 'idle', false) // 程序已結束，但紀錄還在
  report(world, 402, {})
  world.files.set(`${REPORTS}/s-gone.json`, JSON.stringify({ sessionId: 's-gone', reportedAt: 1 }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(world.opened).toEqual([])
  expect(world.removed).toEqual([`${REPORTS}/s-gone.json`])
  expect(world.files.has(`${REPORTS}/s-401.json`)).toBe(true)
  expect(world.files.has(`${REPORTS}/s-402.json`)).toBe(true)
  expect(world.files.has(`${REPORTS}/me.json`)).toBe(true)
})

test('讀不到 session 紀錄時，啟動時不刪任何回報', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.files.set(`${REPORTS}/s-gone.json`, JSON.stringify({ sessionId: 's-gone', reportedAt: 1 }))
  world.unreadable.add(DIR)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(world.removed).toEqual([])
})

test('遮罩：疑似機密的片段換成 •••', () => {
  for (const [raw, masked] of [
    ['curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc-def" https://api.example.com', 'curl -H "Authorization: Bearer •••" https://api.example.com'],
    ['curl "https://api.example.com/v1?token=abc123&page=2"', 'curl "https://api.example.com/v1?token=•••&page=2"'],
    ['vercel deploy --token abc123 --prod', 'vercel deploy --token ••• --prod'],
    ['npm publish --token=abc123', 'npm publish --token=•••'],
    ['OPENAI_API_KEY=abc123 npm start', 'OPENAI_API_KEY=••• npm start'],
    ['export CLIENT_SECRET=hunter2', 'export CLIENT_SECRET=•••'],
    ["PGPASSWORD='p@ss w0rd' psql -h db", 'PGPASSWORD=••• psql -h db'],
    ['echo sk-ant-api03-AbCdEf1234567890', 'echo •••'],
    ['echo ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789 | gh auth login --with-token', 'echo ••• | gh auth login --with-token'],
    ['GITHUB_TOKEN=ghp_AbCdEfGhIjKlMnOpQrSt gh pr list', 'GITHUB_TOKEN=••• gh pr list'],
    ['git clone https://oauth2:glpat-AbCdEf123456@gitlab.com/o/r.git', 'git clone https://oauth2:•••@gitlab.com/o/r.git'],
  ]) {
    expect(maskSecrets(raw)).toBe(masked)
  }
})

test('遮罩：一般指令和文字不受影響', () => {
  for (const text of [
    'npm test',
    'git commit -m "fix token parsing"',
    'grep -rn apiKey src/',
    'pytest -k test_password_reset',
    'ls --sort=time',
    'pip install scikit-learn sk-learn',
    'cd ~/work/monkey=1 && make',
    'echo $PWD',
    'docker login --password-stdin',
    'node bench.js max_tokens=1000',
    '要用 Bearer token 還是 cookie？',
  ]) {
    expect(maskSecrets(text)).toBe(text)
  }
})

test('核准請求摘要寫進狀態回報之前先遮罩', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.check', () => ({ decision: 'ask' as const }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.check({ tool: 'Bash', input: { command: 'curl -H "Authorization: Bearer abcdef123456" https://x.dev' } })

  const written = JSON.parse(world.files.get(`${REPORTS}/me.json`) ?? '{}')
  expect(written.approval).toBe('$ curl -H "Authorization: Bearer •••" https://x.dev')
})

test('執行中的指令與提問寫進狀態回報之前先遮罩', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const mine = `${REPORTS}/me.json`
  let seen: Record<string, unknown> = {}
  on('tool.call', () => {
    seen = JSON.parse(world.files.get(mine) ?? '{}')
    return { result: '' }
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'STRIPE_SECRET=sk_live_x1 node pay.js' })
  expect(seen.activity).toBe('$ STRIPE_SECRET=••• node pay.js')

  await $.tool.call({
    tool: 'AskUserQuestion',
    tool_use_id: 'q1',
    questions: [
      { question: '要沿用 GITHUB_TOKEN=ghp_AbCdEfGhIjKlMnOpQrSt 嗎？', options: [{ label: '沿用' }, { label: '換新的' }] },
    ],
  })
  expect(seen.question).toEqual({ text: '要沿用 GITHUB_TOKEN=••• 嗎？', options: ['沿用', '換新的'], more: 0 })
})
