// 依 i18n.ts 的實際字串產生監看視窗示意圖的 HTML，一個語言一份。
// 用法：node assets/board/render.mjs . <輸出資料夾>，再用 headless Chrome 以 412×800、2 倍解析度截圖成 assets/board/board.<語言>.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [repo, out] = process.argv.slice(2)
const { messagesOf } = await import(pathToFileURL(join(repo, 'agens-view/hooks/i18n.ts')).href)

// 示意內容（Session 標題、問題、待辦等），依語言翻譯
const SAMPLE = {
  en: {
    login: 'Fix login 401', chart: 'Pick a chart library', question: 'Which chart library should we use?',
    options: 'Recharts / Chart.js / D3', dark: 'Add dark mode', darkStep: 'Update theme tokens',
    docs: 'Translate the README', docsStep: 'Japanese version', deps: 'Upgrade dependencies',
    reply: 'All tests pass after the upgrade.',
  },
  'zh-TW': {
    login: '修正登入 401', chart: '選擇圖表套件', question: '要用哪一個圖表套件？',
    options: 'Recharts / Chart.js / D3', dark: '加入深色模式', darkStep: '更新主題色票',
    docs: '翻譯 README', docsStep: '日文版', deps: '升級相依套件', reply: '升級後測試全部通過。',
  },
  'zh-CN': {
    login: '修复登录 401', chart: '选择图表库', question: '要用哪个图表库？',
    options: 'Recharts / Chart.js / D3', dark: '添加深色模式', darkStep: '更新主题色板',
    docs: '翻译 README', docsStep: '日文版', deps: '升级依赖', reply: '升级后测试全部通过。',
  },
  ja: {
    login: 'ログインの 401 を修正', chart: 'チャートライブラリを選ぶ', question: 'どのチャートライブラリを使いますか？',
    options: 'Recharts / Chart.js / D3', dark: 'ダークモードを追加', darkStep: 'テーマトークンを更新',
    docs: 'README を翻訳', docsStep: '日本語版', deps: '依存関係を更新', reply: '更新後、テストはすべて通りました。',
  },
  ko: {
    login: '로그인 401 수정', chart: '차트 라이브러리 고르기', question: '어떤 차트 라이브러리를 쓸까요?',
    options: 'Recharts / Chart.js / D3', dark: '다크 모드 추가', darkStep: '테마 토큰 업데이트',
    docs: 'README 번역', docsStep: '일본어판', deps: '의존성 업그레이드', reply: '업그레이드 후 테스트가 모두 통과했습니다.',
  },
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const bar = (percent, cells = 10) => {
  const filled = Math.round((percent / 100) * cells)
  return `${'▰'.repeat(filled)}${'▱'.repeat(cells - filled)} ${percent}%`
}

const page = (locale) => {
  const m = messagesOf(locale)
  const s = SAMPLE[locale]
  const title = (glyph, chip, text, right, cls = '') => `
    <div class="title ${cls}">
      <span class="left">${chip ? `<b class="chip">${esc(`▲ ${chip}`)}</b>` : `<span class="glyph">${glyph}</span>`}<span class="name">${esc(text)}</span></span>
      <span class="right">${right}</span>
    </div>`
  const go = `<div><span class="go">${esc(m.goHandle)}</span></div>`

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
  :root { --bg:#faf9f5; --pane:#ffffff; --text:#141413; --dim:#87867f; --line:#e3e1d9;
    --warning:#b8650f; --warning-bg:#fdf6ec; --success:#3f7d3a; --claude:#d97757; --error:#c0392b;
    --add:#3f7d3a; --remove:#c0392b; --merged:#7c4dbc; }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); padding: 16px; font: 13px/1.45 -apple-system, "PingFang TC", "Hiragino Sans", "Apple SD Gothic Neo", sans-serif; color: var(--text); }
  .pane { width: 380px; background: var(--pane); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.06); }
  .bar { display:flex; justify-content:space-between; padding: 9px 14px; border-bottom: 1px solid var(--line); font-weight: 600; }
  .bar .x { color: var(--dim); font-weight: 400; }
  .body { padding: 10px 12px 14px; display:flex; flex-direction:column; gap: 10px; }
  .toolbar { display:flex; justify-content:flex-end; color: var(--dim); font-size: 12px; }
  .card { border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; display:flex; flex-direction:column; gap: 3px; }
  .card.bold { border: 2px solid var(--warning); }
  .card.status { border: 2px solid var(--warning); background: var(--warning-bg); }
  .count { color: var(--warning); font-weight: 700; }
  .caption { font-size: 11.5px; }
  .dim { color: var(--dim); }
  .account-title { font-size: 12px; font-weight: 600; color: var(--dim); }
  .row { display:flex; justify-content:space-between; font-size: 11.5px; }
  .meter { color: var(--dim); font-family: ui-monospace, Menlo, monospace; letter-spacing: -0.5px; }
  .title { display:flex; justify-content:space-between; align-items:center; gap: 8px; }
  .title .left { display:flex; gap: 6px; align-items:center; min-width: 0; }
  .title .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .title.idle .name { font-weight: 400; }
  .title .right { display:flex; gap: 6px; font-size: 11.5px; color: var(--dim); white-space: nowrap; }
  .chip { color: var(--warning); white-space: nowrap; }
  .glyph.busy { color: var(--claude); } .glyph.idle { color: var(--dim); }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .footnote { font-size: 12px; }
  .meta { display:flex; flex-wrap: wrap; column-gap: 8px; font-size: 11.5px; color: var(--dim); }
  .add { color: var(--add); } .remove { color: var(--remove); } .pr { color: var(--success); }
  .go { display:inline-block; margin-top: 3px; padding: 3px 10px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; background: #f5f4ee; }
  .section { display:flex; justify-content:space-between; font-size: 12px; font-weight: 600; }
  .section.idle { color: var(--dim); }
  .idle-row { padding: 0 10px; display:flex; flex-direction:column; gap: 2px; }
  .reply { font-size: 12px; color: var(--dim); font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge { color: var(--text); }
  </style></head><body><div class="pane">
  <div class="bar"><span>Switchboard · 2</span><span class="x">✕</span></div>
  <div class="body">
    <div class="toolbar">${esc(m.view)} ▸</div>

    <div class="card status">
      <div class="count">${esc(`▲ ${m.status.needYou(2)}`)}</div>
      <div class="caption">${esc([`${m.kinds.approval} 1`, `${m.kinds.question} 1`, m.status.longest('3m')].join(' · '))}</div>
    </div>

    <div class="card">
      <div class="account-title">${esc(m.account.title)}</div>
      <div class="row"><span class="meter">${esc(`${m.account.fiveHour} ${bar(34)}`)}</span><span class="dim">${esc(m.account.resetsIn('2h'))}</span></div>
      <div class="row"><span class="meter">${esc(`${m.account.week} ${bar(58)}`)}</span><span class="dim">${esc(m.account.resetsIn('3d'))}</span></div>
    </div>

    <div class="card bold">
      ${title('', m.kinds.approval, s.login, '3m ▸')}
      <div class="mono">$ npm install jsonwebtoken</div>
      <div class="meta"><span>api-server · fix-login ±3</span><span>ctx 31%</span></div>
      ${go}
    </div>

    <div class="card bold">
      ${title('', m.kinds.question, s.chart, '1m ▸')}
      <div class="footnote" style="font-weight:500">${esc(`？ ${s.question}`)}</div>
      <div class="caption dim">${esc(s.options)}</div>
      <div class="meta"><span>dashboard</span><span>ctx 12%</span></div>
      ${go}
    </div>

    <div class="section"><span>${esc(m.groups.busy)} 2</span></div>

    <div class="card">
      ${title('<span class="glyph busy">◉</span>', null, s.dark, `<span>${esc(m.current)}</span><span class="badge">⟳1</span><span>12m ▸</span>`).replace('<span class="glyph"><span class="glyph busy">◉</span></span>', '<span class="glyph busy">◉</span>')}
      <div class="footnote">${esc(`3/5 · ${s.darkStep} · ✎ theme.css`)}</div>
      <div class="meta"><span>web-app · dark-mode ↑2</span><span class="add">+184</span><span class="remove">−37</span><span>ctx 42%</span><span class="pr">#12 ↗</span></div>
    </div>

    <div class="card">
      ${title('<span class="glyph busy">◉</span>', null, s.docs, '<span>5m ▸</span>').replace('<span class="glyph"><span class="glyph busy">◉</span></span>', '<span class="glyph busy">◉</span>')}
      <div class="footnote">${esc(`2/4 · ${s.docsStep}`)}</div>
      <div class="meta"><span>docs · readme-i18n</span><span class="add">+620</span><span class="remove">−0</span><span>ctx 18%</span></div>
    </div>

    <div class="section idle"><span>${esc(m.groups.idle)} 1</span><span>▾</span></div>
    <div class="idle-row">
      ${title('<span class="glyph idle">○</span>', null, s.deps, '<span>2h ▸</span>', 'idle').replace('<span class="glyph"><span class="glyph idle">○</span></span>', '<span class="glyph idle">○</span>')}
      <div class="reply">${esc(`「${s.reply}」`)}</div>
    </div>
  </div></div></body></html>`
}

mkdirSync(out, { recursive: true })
for (const locale of Object.keys(SAMPLE)) writeFileSync(join(out, `board.${locale}.html`), page(locale))
console.log('ok')
