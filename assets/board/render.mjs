// 依 i18n.ts 的實際字串產生監看視窗示意圖的 HTML，一個語言兩份：
// - board.<語言>.html：Desktop 的監看視窗。用 headless Chrome 以 412×800、2 倍解析度截圖成 assets/board/board.<語言>.png
// - terminal.<語言>.html：終端機裡嵌在輸入框上方的監看視窗（80 欄）。以 2 倍解析度截 `.term` 元素，存成 assets/board/terminal.<語言>.png
// 用法：node assets/board/render.mjs . <輸出資料夾>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [repo, out] = process.argv.slice(2)
const { messagesOf } = await import(pathToFileURL(join(repo, 'agens-view/hooks/i18n.ts')).href)
const { displayWidth, usageBar } = await import(pathToFileURL(join(repo, 'agens-view/hooks/board.ts')).href)

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

// ── 終端機版 ──────────────────────────────────────────────────────────
// 依 register.tsx 在終端機上的排版（Box 的 gap、外框、paddingX，Button 畫成 [ label ]）排成等寬格，
// 中日韓字佔 2 格（board.ts 的 displayWidth）。每一格是固定寬度的 span，換字型也不會跑掉。

const COLUMNS = 80
// 引擎的外框和左右各一格內距：Pane 的 bodyColumns
const BODY = COLUMNS - 4

const seg = (text, cls = '') => ({ text, cls })
const widthOf = line => line.reduce((sum, one) => sum + displayWidth(one.text), 0)
const padTo = (line, width) => [...line, seg(' '.repeat(Math.max(0, width - widthOf(line))))]
/** 左右兩端對齊（justifyContent="space-between"） */
const spread = (left, right, width) => [...left, seg(' '.repeat(Math.max(1, width - widthOf(left) - widthOf(right)))), ...right]
/** 橫向排列、間隔 gap 格（flexDirection="row" gap） */
const row = (parts, gap = 1) => parts.flatMap((part, i) => (i === 0 ? part : [seg(' '.repeat(gap)), ...part]))
const BORDERS = { bold: '┏━┓┃┗┛', round: '╭─╮│╰╯' }
/** 外框加 paddingX={1}：外寬 width */
const framed = (lines, width, style, cls) => {
  const [tl, h, tr, v, bl, br] = BORDERS[style]
  return [
    [seg(`${tl}${h.repeat(width - 2)}${tr}`, cls)],
    ...lines.map(line => [seg(v, cls), seg(' '), ...padTo(line, width - 4), seg(' '), seg(v, cls)]),
    [seg(`${bl}${h.repeat(width - 2)}${br}`, cls)],
  ]
}

const terminalLines = (locale) => {
  const m = messagesOf(locale)
  const s = SAMPLE[locale]
  const inner = BODY - 4
  /** 標題列：▲ 標籤或狀態圖示、來源符號、標題；右邊是「目前」、背景任務徽章、時間 ▸ */
  const title = ({ chip, glyph, glyphCls, source, name, nameCls = 'b', right }, width) =>
    spread(
      row([chip ? [seg(`▲ ${chip} `, 'warn b')] : [seg(glyph, glyphCls)], [seg(source, 'dim')], [seg(name, nameCls)]]),
      row(right),
      width,
    )
  const go = [seg(`[ ${m.goHandle} ]`, 'btn')]
  const blank = [[]]

  return [
    spread([], [seg(`${m.view} ▸`, 'dim')], BODY),
    ...blank,
    ...framed(
      [
        [seg(`▲ ${m.status.needYou(2)}`, 'warn b')],
        [seg([`${m.kinds.approval} 1`, `${m.kinds.question} 1`, m.header.longestWait('3m')].join(' · '))],
      ],
      BODY, 'bold', 'warn',
    ),
    ...blank,
    ...framed(
      [
        title({ chip: m.kinds.approval, source: '❯', name: s.login, right: [[seg('3m ▸', 'dim')]] }, inner),
        [seg('$ npm install jsonwebtoken')],
        row([[seg('api-server · fix-login ±3', 'dim')], [seg(`${m.fields.context} 31%`, 'dim')]]),
        go,
      ],
      BODY, 'bold', 'warn',
    ),
    ...blank,
    ...framed(
      [
        title({ chip: m.kinds.question, source: '◧', name: s.chart, right: [[seg('1m ▸', 'dim')]] }, inner),
        [seg(m.asked(s.question), 'b')],
        [seg(s.options, 'dim')],
        row([[seg('dashboard', 'dim')], [seg(`${m.fields.context} 12%`, 'dim')]]),
        go,
      ],
      BODY, 'bold', 'warn',
    ),
    ...blank,
    [seg(`${m.groups.busy} 2`, 'b')],
    ...blank,
    ...framed(
      [
        title(
          {
            glyph: '◉', glyphCls: 'claude', source: '❯', name: s.dark,
            right: [[seg(m.current, 'dim')], [seg('⟳1')], [seg('12m ▸', 'dim')]],
          },
          inner,
        ),
        [seg(`3/5 · ${s.darkStep} · ✎ theme.css`)],
        row([
          [seg('web-app · dark-mode ↑2', 'dim')],
          row([[seg('+184', 'add')], [seg('−37', 'remove')]]),
          [seg(`${m.fields.context} 42%`, 'dim')],
          [seg('#12 ↗', 'success')],
        ]),
      ],
      BODY, 'round', 'line',
    ),
    ...blank,
    ...framed(
      [
        title({ glyph: '◉', glyphCls: 'claude', source: '◧', name: s.docs, right: [[seg('5m ▸', 'dim')]] }, inner),
        [seg(`2/4 · ${s.docsStep}`)],
        row([
          [seg('docs · readme-i18n', 'dim')],
          row([[seg('+620', 'add')], [seg('−0', 'remove')]]),
          [seg(`${m.fields.context} 18%`, 'dim')],
        ]),
      ],
      BODY, 'round', 'line',
    ),
    ...blank,
    spread([seg(`${m.groups.idle} 1`, 'dim b')], [seg('▾', 'dim')], BODY),
    ...blank,
    [seg(' '), ...title({ glyph: '○', glyphCls: 'dim', source: '✎', name: s.deps, nameCls: '', right: [[seg('2h ▸', 'dim')]] }, BODY - 2)],
    [seg(' '), seg(m.quoted(s.reply), 'dim i')],
    ...blank,
    ...framed(
      [
        [seg(m.account.title, 'dim b')],
        spread([seg(`${m.account.fiveHour} ${usageBar(34, 10)}`, 'dim')], [seg(m.account.resetsIn('2h'), 'dim')], inner),
        spread([seg(`${m.account.week} ${usageBar(58, 10)}`, 'dim')], [seg(m.account.resetsIn('3d'), 'dim')], inner),
      ],
      BODY, 'round', 'line',
    ),
  ]
}

const cells = line =>
  line
    .map(one =>
      [...one.text]
        .map(char => `<span class="c${displayWidth(char) === 2 ? ' w' : ''}${/[─-╿]/.test(char) ? ' bx' : ''}${one.cls ? ` ${one.cls}` : ''}">${char === ' ' ? '&nbsp;' : esc(char)}</span>`)
        .join(''),
    )
    .join('')

const terminal = (locale) => {
  // 引擎畫的 Pane 外框（右上角是關閉標記），下面是 Claude Code 的輸入框
  const pane = [
    [seg(`╭${'─'.repeat(COLUMNS - 6)} ✕ ─╮`, 'frame')],
    ...terminalLines(locale).map(line => [seg('│', 'frame'), seg(' '), ...padTo(line, BODY), seg(' '), seg('│', 'frame')]),
    [seg(`╰${'─'.repeat(COLUMNS - 2)}╯`, 'frame')],
  ]
  const prompt = [[seg('─'.repeat(COLUMNS), 'frame')], [seg('> ', 'dim'), seg(' ', 'cursor')], [seg('─'.repeat(COLUMNS), 'frame')]]
  const cjk = locale === 'ja' ? '"IPAGothic", "Hiragino Sans"' : locale === 'ko' ? '"Apple SD Gothic Neo", "WenQuanYi Zen Hei Mono"' : '"PingFang TC", "WenQuanYi Zen Hei Mono"'

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
  :root { --cw: 8px; --lh: 18px; --bg:#1f1e1d; --bar:#2b2a28; --text:#e8e6dc; --dim:#8f8d86; --line:#5c5a55;
    --warn:#e8a33d; --claude:#d97757; --success:#7bbf6a; --add:#7bbf6a; --remove:#e5736b; }
  * { box-sizing: border-box; margin: 0; }
  body { background: #faf9f5; padding: 16px; display: inline-block; }
  .term { display: inline-block; background: var(--bg); border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.18); }
  .bar { background: var(--bar); height: 28px; display: flex; align-items: center; gap: 7px; padding: 0 11px; font: 12px -apple-system, "DejaVu Sans", sans-serif; color: var(--dim); }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: #5c5a55; }
  .bar .name { flex: 1; text-align: center; margin-right: 50px; }
  .screen { padding: 10px 12px 12px; font: 13px/var(--lh) Menlo, "DejaVu Sans Mono", ${cjk}, monospace; color: var(--text); }
  .r { height: var(--lh); white-space: nowrap; }
  .c { display: inline-block; width: var(--cw); text-align: center; overflow: visible; }
  .c.w { width: calc(var(--cw) * 2); font-size: 15px; }
  /* 框線字拉高到整列，上下列的直線才接得起來 */
  .c.bx { transform: scaleY(1.4); }
  .b { font-weight: 700; } .i { font-style: italic; } .dim { color: var(--dim); }
  .warn { color: var(--warn); } .claude { color: var(--claude); } .success { color: var(--success); }
  .add { color: var(--add); } .remove { color: var(--remove); } .line, .frame { color: var(--line); }
  .btn { color: var(--text); } .cursor { background: var(--text); }
  </style></head><body><div class="term">
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="name">web-app — claude</span></div>
  <div class="screen">${[...pane, [], ...prompt].map(line => `<div class="r">${cells(line)}</div>`).join('')}</div>
  </div></body></html>`
}

mkdirSync(out, { recursive: true })
for (const locale of Object.keys(SAMPLE)) {
  writeFileSync(join(out, `board.${locale}.html`), page(locale))
  writeFileSync(join(out, `terminal.${locale}.html`), terminal(locale))
}
console.log('ok')
