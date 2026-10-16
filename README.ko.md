[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어

# switchboard: Claude Code 세션 모니터 창 (Claude Code mod)

**Claude Code mods**로 만든 **Claude Code 플러그인**입니다. 로컬의 모든 Claude Code 세션을 Claude Desktop의 **모니터 창** 패널 하나에 모아 보여 주어, 어떤 세션이 작업 중이고, 어떤 세션이 유휴 상태이며, 어떤 세션이 **나를 기다리는지** 한눈에 알 수 있습니다. Desktop Code 탭의 세션과 iTerm, Terminal.app, VS Code 터미널의 세션이 모두 같은 목록에 표시됩니다.

<p align="center">
  <img src="assets/board/board.ko.png" alt="switchboard 모니터 창: 확인 필요 2개, 작업 중 2개, 유휴 1개(예시 이미지)" width="412">
</p>

<p align="center"><sub>예시 이미지: 확인이 필요한 세션 2개(승인 대기, 응답 대기), 작업 중 2개, 유휴 1개.</sub></p>

교환원이 어느 회선에 불이 들어왔는지 보듯이, switchboard는 각 세션이 자기 상태를 직접 보고하게 하고 나를 기다리는 세션을 맨 위에 둡니다:

| 상태 | 의미 | 예 |
|---|---|---|
| **확인 필요** | 내가 보지 않으면 진행되지 않음 | `npm install` 권한 확인에서 멈춤, 선택형 질문, API 오류로 멈춘 턴 |
| **작업 중** | Claude가 턴을 실행 중 | 생각하기, 도구 호출, 서브에이전트 실행 |
| **유휴** | 턴이 끝났고 막힌 것이 없음 | 끝나고 다음 지시를 기다리는 중, 직접 중단한 턴 |
| **종료** | 세션이 닫혔거나 프로세스가 종료됨 | 목록에서 즉시 사라짐 |

**텍스트로 한 질문은 왜 유휴인가요?** 확인 필요는 명확한 신호(권한 확인, 선택형 질문, 오류)에만 반응하므로, 켜졌을 때는 정말로 나를 기다리는 것입니다. Claude가 일반 텍스트로 질문하면 유휴로 처리되며, 해당 행의 마지막 응답 미리보기로 알아챌 수 있습니다.

## 빠른 시작

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

Claude Desktop을 다시 시작한 뒤 Code 탭에서:

1. `/switchboard:on` 입력
2. 오른쪽에 모니터 창이 열리고, 상단에 `▲ 2개 확인 필요` 같은 줄이 표시됩니다

이후에는 기본적으로 모든 Desktop 세션에서 모니터 창이 자동으로 열립니다. 자세한 내용은 [설치](#설치)와 [사용법](#사용법)을 참고하세요.

## AI 에이전트로 설치

다음 문장을 Claude Code나 다른 코딩 에이전트에 붙여 넣으세요:

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## 요구 사항

- macOS
- Code 탭이 있는 [Claude Desktop](https://claude.ai/download) 앱. 모니터 창은 여기에서만 열립니다
- mods를 지원하는 Claude Code(**v2.1.299**에서 개발·테스트. Code 탭에서 `/status`를 입력해 버전 확인)
- 선택: `git`(브랜치와 변경 정보), 로그인된 [`gh`](https://cli.github.com/)(Pull Request 정보)

## 설치

1. 마켓플레이스를 추가하고 설치합니다. 방법은 두 가지이며 **GitHub를 권장**합니다:

   **방법 A: GitHub에서(권장)** 프로젝트를 내려받을 필요가 없습니다:

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

   나중에 새 버전으로 업데이트하려면 마켓플레이스, 플러그인 순으로 업데이트한 뒤 Claude Desktop을 다시 시작하세요(이미 설치된 플러그인에 `install`을 다시 실행해도 업그레이드되지 않습니다):

```bash
claude plugin marketplace update switchboard
claude plugin update switchboard@switchboard
```

   **방법 B: 로컬 폴더에서** 프로젝트를 clone해서 직접 수정한 버전을 설치하려는 경우:

```bash
git clone https://github.com/wide3751/switchboard.git ~/Projects/switchboard
claude plugin marketplace add ~/Projects/switchboard
claude plugin install switchboard@switchboard
```

2. Claude Desktop을 다시 시작하고 Code 탭에서 `/switchboard:on`을 입력해 모니터 창이 열리는지 확인합니다.

설치 전에 이미 열려 있던 세션은 mod를 로드하지 않습니다. 모니터 창에는 표시되지만 기본 상태만 보이므로, 전체 정보를 보려면 해당 세션을 다시 시작하세요.

## 사용법

| 명령 | 설명 |
|---|---|
| `/switchboard:on` | 이 Desktop 세션에서 모니터 창을 엽니다. CLI 세션에서는 Desktop에서 열라는 안내만 표시합니다 |

**모니터 창 구성:**

- **상단**: 나를 기다리는 세션 수와 가장 오래 기다린 시간. 같은 숫자가 패널 제목에도 표시됩니다(예: `Switchboard · 2`)
- **계정 사용량**: 구독 요금제는 5시간·주간 사용 한도 사용률과 초기화까지 남은 시간, API 과금은 모든 세션의 총 비용
- **섹션**: 확인 필요 → 작업 중 → 유휴. 같은 섹션 안에서는 최근 활동 순. 유휴 세션은 오래 지나도 자동으로 사라지지 않으며, 유휴 섹션은 접을 수 있습니다
- **제목을 클릭** 하면 Claude Desktop의 해당 세션으로 이동합니다. 확인 필요 행에는 **처리하러 가기 →**도 있습니다
- 각 행의 **펼치기 ▾**로 나머지 정보를 봅니다
- **보기**로 아래 설정을 엽니다

어떤 세션에서 모니터 창을 닫으면, `/switchboard:on`을 다시 실행할 때까지 그 세션에서는 자동으로 열리지 않습니다.

**설정**(**보기** 패널. 전역으로 저장되어 모든 세션이 공유):

| 이름 | 기본값 | 값 |
|---|---|---|
| 모든 Desktop 세션에 표시 | 켜기 | 켜기: Desktop 세션이 시작되거나 턴이 끝날 때 자동으로 열려 세션을 바꿔도 계속 보입니다. 끄기: `/switchboard:on`을 실행한 세션에만 표시 |
| 언어 | 자동 | 자동(macOS 언어), EN, 日本語, 한국어, 简中, 繁中 |
| 요금제 | 자동 | 자동, 구독(사용 한도 표시), API(비용 표시) |
| 설정 대상 | 작업 중 | 아래 밀도와 항목을 적용할 섹션: 확인 필요, 작업 중, 유휴 |
| 밀도 | 섹션별 | 간단히, 표준, 자세히. 항목을 직접 고르면 사용자 지정이 됩니다 |

각 행에 표시할 수 있는 **항목**:

| 항목 | 표시 내용 |
|---|---|
| 시간 | 현재 상태가 지속된 시간 |
| 위치 | 프로젝트 폴더 |
| 브랜치 | git 브랜치, ahead/behind, 커밋하지 않은 파일 수 |
| 변경 줄 수 | 기준 브랜치 대비 추가/삭제 줄 수(Desktop의 Changes와 동일) |
| PR | 이 브랜치의 Pull Request. Desktop 세션에 푸시하지 않은 변경이 있고 PR이 없으면 **PR 만들기 ↗**로 해당 세션으로 이동 |
| 진행률 | 할 일 목록 진행률과 현재 항목 |
| 현재 작업 | 진행 중인 도구 호출 |
| 백그라운드 작업 | 실행 중인 서브에이전트와 백그라운드 셸 명령 |
| 컨텍스트 | 컨텍스트 창 사용률 |
| 커넥터 | 연결된 MCP 커넥터와 인증이 필요한 커넥터 |
| 마지막 응답 | Claude의 최근 응답 요약 |
| 모델 | 사용 중인 모델. 작업 중인 세션이 다른 세션과 다른 모델을 쓰면 항상 표시 |
| 사용량 | 턴 수. API 과금이면 비용도 표시 |
| 환경 | Worktree 또는 Remote |
| 출처 | CLI 세션이 실행 중인 터미널 |
| 전체 경로 | 작업 디렉터리 전체 경로 |

확인 필요 행에는 승인 요청 요약(실행하려는 명령), 질문과 선택지, 또는 턴을 멈춘 오류가 항상 표시됩니다.

### 예시

세션 세 개가 실행 중입니다. 하나는 권한 확인에서 멈췄고, 하나는 작업 중이며, 하나는 끝났습니다. 모니터 창 상단에는 다음과 같이 표시됩니다:

```
▲ 1개 확인 필요
승인 1 · 최장 3m
```

해당 행에는 실행하려는 명령(예: `$ npm install jsonwebtoken`)과 **처리하러 가기 →**가 표시됩니다.

기다리는 세션이 없을 때:

```
✓ 확인할 항목이 없습니다
작업 중 1 · 유휴 2
```

## 제한 사항

- **macOS와 Claude Desktop 전용**: CLI 세션은 목록에 표시되고 상태도 보고하지만, 자체 UI는 표시하지 않습니다.
- **CLI 세션으로 이동은 아직 미지원**: 클릭하면 해당 세션의 폴더를 보여 줍니다.
- **폴링으로 갱신**: 3초마다 갱신하므로 변화가 즉시가 아니라 몇 초 안에 반영됩니다. 모니터 창을 표시하는 세션마다 각자 스캔합니다.
- **mod가 로드되지 않은 세션은 기본 상태만 표시**: 오류 중단, 승인 요청 요약, 마지막 응답이 없습니다(설치 전에 열려 있던 세션 등).
- **로컬 세션만 표시**: 서브에이전트와 클라우드 세션은 표시하지 않습니다.

## 문제 해결

| 증상 | 해결 방법 |
|---|---|
| `/switchboard:on`이 hooks가 로드되지 않았다고 응답 | `claude --debug` 또는 디버그 로그에서 `hooks module switchboard` 오류를 확인 |
| 모니터 창은 Claude Desktop에서만 열린다는 응답 | CLI 세션에서 실행했습니다. Desktop의 Code 탭에서 입력하세요 |
| 행에 `switchboard 미로드, 기본 상태만`이 표시됨 | 설치 전에 열려 있던 세션입니다. 다시 시작하세요 |
| PR이 표시되지 않음 | `gh`를 설치하고 `gh auth login`을 실행하세요. 세션 폴더가 GitHub 저장소여야 합니다 |
| CLI 세션을 클릭하면 경로만 표시됨 | 현재 정상 동작입니다. 해당 터미널로 직접 전환하세요 |
| 코드를 수정해도 반영되지 않음 | 설치된 사본은 `plugin.json`의 `version`으로 캐시됩니다. 버전을 올리고 `claude plugin update switchboard@switchboard`를 실행한 뒤 다시 시작하세요 |

## 개인정보와 데이터

switchboard는 전부 Mac에서 실행되며, 자체 서비스로 데이터를 보내지 않습니다.

- **로컬에 기록**: 각 세션의 상태 보고서(`<Claude 설정 디렉터리>/switchboard/reports/<sessionId>.json`). 모델, 브랜치, 할 일 진행률, 현재 작업, 승인 요청 요약, 질문, 오류, 마지막 응답 요약, 백그라운드 작업, 사용 한도, 커넥터, Pull Request를 담습니다. 더 이상 존재하지 않는 세션의 보고서는 삭제됩니다
- **로컬에서 읽음**: Claude Code 자체의 `~/.claude/sessions/*.json` 기록과 이 보고서. 다른 세션의 `.jsonl` 대화 기록은 읽지 않습니다
- **실행하는 명령**: `git`(브랜치와 변경), `gh pr view`(Pull Request. 내 `gh` 로그인으로 GitHub에 연결), `ps`(살아 있는 세션 확인), `defaults read -g AppleLanguages`(UI 언어), `open`(세션으로 이동)

## 동작 원리

모든 세션이 mod를 로드하며, mod는 두 가지 역할을 합니다:

1. **Reporter**: 자기 세션의 이벤트(`session.start`, `turn.start`, `tool.call`, `turn.complete` 등)를 받아 상태 보고서를 기록합니다.
2. **모니터 창**: 모니터 창을 표시하는 세션에서만 동작합니다. 3초마다 보고서와 Claude Code의 세션 기록을 합치고, 프로세스가 없는 세션을 제외한 뒤 목록을 그립니다.

세션의 존재 여부는 Claude Code 자체 기록과 프로세스 생존 여부로만 판단하므로, 오래된 보고서가 남아 있어도 종료된 세션이 목록에 남지 않습니다. 두 출처가 다르면 더 최신 정보를 따릅니다.

## 기여하기

Issue와 Pull Request를 환영합니다. 동작을 바꾸기 전에 [CONTEXT.md](CONTEXT.md)의 용어와 [docs/adr/](docs/adr/)의 결정 사항(모두 중국어)을 읽어 주세요. UI 문자열을 추가하거나 바꿀 때는 [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts)의 5개 언어를 모두 업데이트해 주세요.

## 문서

- [CONTEXT.md](CONTEXT.md): 용어(세션, 확인 필요, 모니터 창, 상태 보고서…)
- [docs/adr/](docs/adr/): 아키텍처 결정 사항

## 라이선스

[MIT](LICENSE)
