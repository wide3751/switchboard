<p align="center">
  <img src="assets/logo.svg" width="440" alt="switchboard">
</p>

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8H028VWRF)

# switchboard: Claude Code 세션 모니터 창 (Claude Code mod)

**Claude Code mods**로 만든 **Claude Code 플러그인**입니다. Claude Code 세션을 여러 개 동시에 열어 둘 때, 로컬의 모든 세션을 **모니터 창** 하나에 모아 보여 줍니다. 어떤 세션이 작업 중이고, 어떤 세션이 유휴 상태이며, 어떤 세션이 **나를 기다리는지** 한눈에 알 수 있고, 클릭 한 번으로 바로 가서 처리할 수 있습니다.

Claude Desktop Code 탭의 세션과 iTerm, Terminal.app, VS Code 터미널의 `claude`가 모두 같은 목록에 표시됩니다. Desktop과 터미널을 똑같이 지원하므로 둘 중 하나만 써도 모든 기능을 쓸 수 있습니다.

<p align="center">
  <img src="assets/board/board.ko.png" alt="switchboard 모니터 창: 확인 필요 2개, 작업 중 2개, 유휴 1개(예시 이미지)" width="444">
</p>

<p align="center"><sub>예시 이미지: 확인이 필요한 세션 2개(승인 대기, 응답 대기. 각각 번호가 붙은 「처리하러 가기」 버튼), 작업 중 2개, 유휴 1개. 맨 아래는 계정 사용량입니다.</sub></p>

교환원이 어느 회선에 불이 들어왔는지 보듯이, switchboard는 각 세션이 자기 상태를 직접 보고하게 하고 나를 기다리는 세션을 맨 위에 둡니다:

| 상태 | 의미 | 예 |
|---|---|---|
| **▲ 확인 필요** | 내가 보지 않으면 진행되지 않음 | `npm install` 권한 확인에서 멈춤, 선택형 질문, Desktop 턴 끝의 질문 상자, API 오류로 멈춘 턴 |
| **◉ 작업 중** | Claude가 턴을 실행 중 | 생각하기, 도구 호출, 서브에이전트 실행. 턴은 끝났지만 백그라운드 작업(백그라운드 서브에이전트, Bash)이 아직 실행 중. 실행 중인 백그라운드 작업은 카드 아래에 한 줄씩 제목을 표시 |
| **○ 유휴** | 턴이 끝났고 막힌 것이 없음 | 끝나고 다음 지시를 기다리는 중, 직접 중단한 턴 |
| **종료** | 세션이 닫혔거나 프로세스가 종료됨 | 목록에서 즉시 사라짐 |

확인 필요는 명확한 신호에만 반응하므로, 켜졌을 때는 정말로 나를 기다리는 것입니다. Claude가 일반 텍스트로 질문하면 유휴로 처리되며, 해당 행의 마지막 응답 미리보기로 알아챌 수 있습니다.

## 빠른 시작

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

이어서 Claude Code를 쓰는 곳에 맞춰 둘 중 하나를 따르세요(둘 다 해도 됩니다):

**Desktop**: Claude Desktop을 다시 시작하고 Code 탭의 세션을 아무거나 엽니다. 오른쪽에 모니터 창이 저절로 나타나고, 이후에는 모든 Desktop 세션에서 자동으로 열립니다. 나타나지 않으면 `/switchboard:open`을 입력하세요.

**터미널**: `claude`를 다시 시작하면 입력창 위에 **▦ 모니터 창 열기** 버튼이 나타납니다. 버튼을 클릭하거나 `/switchboard:open`을 입력하면 열립니다. 매번 자동으로 열리게 하려면 모니터 창의 **설정 ▸ › 일반**에서 「모니터 창 자동으로 열기」의 **CLI 세션**을 체크하세요(터미널 너비가 144열 이상이어야 합니다).

설치 전부터 열려 있던 세션도 목록에 표시되지만 기본 상태만 보입니다. 전체 정보를 보려면 해당 세션을 다시 시작하세요.

다음 문장을 Claude Code나 다른 코딩 에이전트에 붙여 넣어 설치를 맡길 수도 있습니다:

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## 사용법

| 명령 | 설명 |
|---|---|
| `/switchboard:open` | 이 세션에서 모니터 창을 엽니다. Desktop과 터미널 모두 가능합니다 |

<p align="center">
  <img src="assets/board/terminal.ko.png" alt="터미널 안의 switchboard 모니터 창: Claude Code 입력창 위에 표시(예시 이미지)" width="560">
</p>

<p align="center"><sub>예시 이미지: 80열 터미널에서 입력창 위에 표시된 모니터 창. 내용은 Desktop과 같습니다.</sub></p>

**모니터 창 구성:**

- **헤더**: 나를 기다리는 세션이 있으면 `▲ 2개 확인 필요`, 다음 줄에 종류별 개수와 최장 대기 시간(예: `승인 1 · 답변 1 · 최장 3m`)이 표시됩니다. 없으면 `✓ 확인할 항목이 없습니다`가 표시됩니다.
- **섹션**: 확인 필요 → 작업 중 → 유휴. 확인 필요는 오래 기다린 순서라 가장 오래 기다린 세션이 맨 위에 옵니다. 유휴는 섹션 제목을 클릭하면 접을 수 있습니다.
- **카드**: 첫 줄은 상태와 제목, 둘째 줄은 가장 중요한 한 가지만 보여 줍니다. 실행하려는 명령, 질문과 선택지, 현재 진행 상황, 또는 유휴 세션의 마지막 응답입니다. 마지막 줄은 폴더, 브랜치, 변경 줄 수, `ctx 31%`, PR 같은 항목입니다.
- **처리하러 가기**: 확인 필요 카드 오른쪽 아래에 **1 처리하러 가기 →**가 있습니다. 클릭하거나, 모니터 창에 포커스가 있을 때 `1`–`9`를 누르면 그 세션으로 이동합니다.
- **제목을 클릭**: 해당 세션으로 이동합니다. Desktop 세션은 Claude Desktop의 해당 세션으로, iTerm·Terminal.app은 해당 탭으로 전환됩니다.
- **시간과 `▸`를 클릭**(예: `3m ▸`): 카드를 펼쳐 브랜치와 비교 기준, 컨텍스트 사용량 막대, 커넥터, 전체 경로, 백그라운드 작업을 보여 줍니다.
- **계정 사용량**: 구독 요금제는 5시간·주간 사용 한도를, API 과금은 총 비용을 표시합니다. 사용량이 95%에 이르면 헤더 아래로 올라와 알려 줍니다.
- **모니터 창이 닫혀 있을 때**: 입력창 위 버튼에 확인 필요 개수가 붙습니다(예: **▲2 확인 필요 · ▦ 열기**). 클릭하면 바로 열립니다.

<p align="center">
  <img src="assets/board/states.ko.png" alt="모니터 창의 다른 상태: 오류로 중단, 기다리는 세션 없이 카드 하나의 세부 정보를 펼침, 상태를 확인할 수 없음(예시 이미지)" width="872">
</p>

<p align="center"><sub>예시 이미지: 왼쪽 위는 오류로 중단(빨간 굵은 테두리), 오른쪽은 기다리는 세션이 없고 카드 하나를 펼친 상태, 왼쪽 아래는 상태를 확인할 수 없을 때의 경고 카드입니다.</sub></p>

**터미널 키보드 조작**(터미널이 마우스 클릭을 전달하지 않을 때):

| 키 | 동작 |
|---|---|
| `ctrl+x tab` | 입력창에서 모니터 창으로 이동 |
| `tab`／`shift+tab` | 버튼과 제목 사이를 이동 |
| `enter` | 선택한 버튼이나 제목을 누름 |
| `1`–`9` | 해당 번호의 **처리하러 가기 →**를 누름 |
| `esc` | 모니터 창을 연 채로 입력창으로 돌아감 |
| `ctrl+x x` | 모니터 창 닫기 |

**설정**(헤더 오른쪽 끝의 **설정 ▸**을 클릭. 모든 세션이 공유):

- **카드 내용**: 확인 필요, 작업 중, 유휴마다 표시할 항목을 따로 고르거나, 간단히·표준·자세히 중에서 바로 고릅니다
- **모니터 창 자동으로 열기**: Desktop 세션은 기본으로 켜져 있고 CLI 세션은 꺼져 있으며, 따로 설정할 수 있습니다
- **언어**: 자동, English, 日本語, 한국어, 简体中文, 繁體中文
- **요금제**: 자동, 구독(사용 한도 표시), API(비용 표시)

**알림**: switchboard는 자체 알림을 보내지 않고 Claude Code와 Claude Desktop의 알림에 맡깁니다. 터미널은 `claude`에서 `/config`를 입력해 알림 방식을 설정하고, Desktop은 「시스템 설정 › 알림」에서 Claude의 알림을 허용하세요.

모든 항목, 기호, 정렬 규칙과 터미널별 세부 사항은 [전체 사용 설명서](docs/guide/usage.ko.md)를 참고하세요.

## 지원 환경

| `claude` 실행 위치 | 목록에 표시 | 모니터 창 열기 | 제목 클릭으로 이동 | 실제 확인 |
|---|---|---|---|---|
| Claude Desktop의 Code 탭 | ✓ | ✓ | ✓ | ✓ |
| iTerm | ✓ | ✓ | ✓ | ✓ |
| Terminal.app | ✓ | ✓ | ✓ | ✓ |
| VS Code 통합 터미널 | ✓ | ✓ | 폴더 표시 | 아직 |
| 기타 터미널(Warp, Ghostty 등)과 tmux | ✓ | ✓ | 폴더 표시 | 일부 |
| VS Code 확장(그래픽 UI) | — | ✕ | — | 아직 |

iTerm이나 Terminal.app으로 처음 이동할 때 macOS가 제어를 허용할지 물으면 허용을 누르세요.

## 개인정보와 보안

switchboard는 **전부 사용자의 컴퓨터에서 실행**되며, 자체 서비스로 데이터를 보내지 않습니다.

**읽는 것**

- Claude Code 자체의 세션 기록(`~/.claude/sessions/*.json`). 어떤 세션이 있는지 알기 위해 읽습니다
- switchboard가 직접 기록한 상태 보고서
- **다른 세션의 대화 기록은 읽지 않습니다**

**기록하는 것**

- 세션마다 상태 보고서 하나를 `~/.claude/switchboard/reports/`에 저장합니다. 평문 JSON 파일이라 언제든 열어 볼 수 있습니다
- 제목(첫 프롬프트의 앞 약 40자), 모델, 브랜치, 현재 작업, 승인 요청 요약, 마지막 응답의 짧은 발췌, 컨텍스트 사용량 등을 담습니다
- 기록하기 전에 비밀로 보이는 부분(`Bearer …`, `token=…`, `sk-…`, `ghp_…` 등)을 `•••`로 바꿉니다. 최선의 노력일 뿐 모두 잡아낸다는 보장은 없습니다
- 세션이 끝나면 오래된 보고서는 자동으로 삭제됩니다

**실행하는 명령**

- `ps`(Windows에서는 `tasklist`): 살아 있는 세션 확인
- `git`: 각 세션의 폴더에서 브랜치와 변경 읽기
- `gh pr view`: PR 조회. 내 `gh` 로그인을 씁니다. 네트워크에 연결하는 유일한 명령이며, `gh`가 없으면 연결하지 않습니다
- `open`, `osascript`(Windows에서는 `rundll32`): 클릭했을 때만 실행하며, 해당 세션이나 탭으로 전환하거나 브라우저에서 PR을 엽니다

자기 보고서를 정리하는 것 외에는 파일이나 저장소를 전혀 수정하지 않습니다. 코드는 모두 오픈 소스(MIT)라 직접 확인할 수 있습니다. 항목별 설명은 [개인정보와 데이터](docs/guide/privacy.ko.md)를 참고하세요.

## 요구 사항

- macOS, Linux 또는 Windows(세션으로 이동은 macOS와 Windows의 Claude Desktop 세션만 지원)
- 다음 중 하나의 Claude Code(둘 다 써도 됩니다):
  - [Claude Desktop](https://claude.ai/download) 앱의 Code 탭
  - 터미널의 `claude`(iTerm, Terminal.app, VS Code 통합 터미널 등)
- mods를 지원하는 Claude Code 버전: **v2.1.299**에서 개발·테스트했습니다. Desktop은 Code 탭에서 `/status`, 터미널은 `claude --version`으로 확인하세요. Desktop에 내장된 Claude Code는 터미널의 것과 버전이 다를 수 있으니 각각 확인하세요
- 선택: `git`(브랜치와 변경 정보), 로그인된 [`gh`](https://cli.github.com/)(PR 정보)

## 업데이트, 비활성화, 제거

**업데이트**(이미 설치된 플러그인에 `install`을 다시 실행해도 업그레이드되지 않습니다):

```bash
claude plugin marketplace update switchboard
claude plugin update switchboard@switchboard
```

**잠시 끄기**(설치는 유지하며 나중에 `enable`로 다시 켤 수 있습니다):

```bash
claude plugin disable switchboard@switchboard
```

**완전히 제거**:

```bash
claude plugin uninstall switchboard@switchboard
claude plugin marketplace remove switchboard
rm -rf ~/.claude/switchboard
```

- 마지막 줄은 상태 보고서를 지웁니다. 플러그인을 제거해도 저절로 지워지지 않습니다. `CLAUDE_CONFIG_DIR`을 설정했다면 대신 `$CLAUDE_CONFIG_DIR/switchboard`를 지우세요. Windows에서는 `%USERPROFILE%\.claude\switchboard`를 지우세요
- 업데이트, 비활성화, 제거 모두 Claude Desktop과 열려 있는 `claude`를 다시 시작해야 반영됩니다

## 제한 사항

- **이동은 macOS와 Windows의 Desktop 세션만 지원**: Windows에서는 Claude Desktop 세션을 클릭하면 그 세션으로 이동하지만, 터미널의 CLI 세션으로는 아직 이동할 수 없습니다. Linux에서는 세션 상태를 확인할 수 있지만, 제목을 클릭해도 해당 세션으로 이동하지 않습니다.
- **CLI 세션 이동은 iTerm과 Terminal.app만 지원**: 다른 터미널에서는 세션이 있는 폴더만 보여 줍니다.
- **터미널이 좁으면 자동으로 열리지 않음**: 144열 이상이어야 합니다. 그보다 좁을 때는 입력창 위의 버튼을 누르면 너비와 상관없이 열립니다.
- **3초마다 갱신**: 상태 변화가 즉시가 아니라 몇 초 안에 반영됩니다.
- **설치 전부터 열려 있던 세션은 기본 상태만 표시**: 오류 중단, 승인 요청 요약, 마지막 응답이 없습니다. 다시 시작하면 됩니다.
- **로컬 세션만 표시**: 서브에이전트와 클라우드 세션은 표시하지 않습니다.

## 문제 해결

세션 상태를 확인할 수 없을 때 모니터 창 경고 카드의 「문제 해결 ↗」 링크가 이곳으로 연결됩니다.

| 증상 | 해결 방법 |
|---|---|
| 행에 `switchboard 미로드, 기본 상태만`이 표시됨 | 설치 전부터 열려 있던 세션입니다. 다시 시작하세요 |
| `/switchboard:open`이 hooks가 로드되지 않았다고 응답 | Claude Code 버전이 mods를 지원하는지 확인하고 이 세션을 다시 시작하세요. 그래도 안 되면 `claude --debug`로 시작해 로그에서 `hooks module switchboard`를 찾아보세요 |
| `⚠ 지금은 세션 상태를 확인할 수 없습니다`가 뜨고, 세션 기록이 하나도 없다고 표시됨 | Claude Code 버전이 너무 오래되었거나, `CLAUDE_CONFIG_DIR`이 Claude Code가 실제로 쓰는 폴더가 아닌 곳을 가리킵니다 |
| `⚠ 지금은 세션 상태를 확인할 수 없습니다`가 뜨고, 아래에 빨간 글자가 이어짐 | 빨간 글자는 원래 오류 메시지입니다. 3초마다 자동으로 다시 시도하므로 일시적인 오류라면 저절로 사라집니다. 계속 보이면 `claude --debug`로 확인하세요 |
| `⚠ 지금은 세션 상태를 확인할 수 없습니다`가 뜨고, 폴더를 읽을 수 없다고 표시됨 | 그 폴더가 있는지, 읽기 권한이 있는지 확인하세요 |
| Windows에서 표시된 폴더가 `/.claude/sessions`임 | 0.10.0 이전 버전은 Windows에서 홈 폴더를 찾지 못합니다. switchboard를 업데이트한 뒤 새 세션을 여세요 |
| PR이 표시되지 않음 | `gh`를 설치하고 `gh auth login`을 실행하세요. 폴더가 GitHub 저장소여야 합니다 |
| CLI 세션을 클릭해도 이동되지 않음 | 이동은 iTerm과 Terminal.app만 지원합니다. 이 둘에서도 이동되지 않으면 「시스템 설정 › 개인정보 보호 및 보안 › 자동화」에서 제어를 허용하세요 |

그 밖의 경우는 [전체 문제 해결](docs/guide/troubleshooting.ko.md)을 참고하세요.

## 기여하기

Issue와 Pull Request를 환영합니다. 동작을 바꾸기 전에 [GLOSSARY.md](GLOSSARY.md)의 용어와 [docs/adr/](docs/adr/)의 결정 사항(모두 중국어)을 읽어 주세요. UI 문자열을 추가하거나 바꿀 때는 [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts)의 5개 언어를 모두 업데이트해 주세요.

## 라이선스

[MIT](LICENSE)
