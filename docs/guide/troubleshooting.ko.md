[English](troubleshooting.md) | [繁體中文](troubleshooting.zh-TW.md) | [简体中文](troubleshooting.zh-CN.md) | [日本語](troubleshooting.ja.md) | 한국어

# 문제 해결

[← README로 돌아가기](../../README.ko.md)

| 증상 | 해결 방법 |
|---|---|
| `/switchboard:open`이 hooks가 로드되지 않았다고 응답 | 1. 사용 중인 Claude Code가 mods를 지원하는지 확인하고, 지원하지 않으면 업데이트하세요. 2. 이 세션을 다시 시작하세요(설치 전부터 열려 있던 세션은 로드하지 않습니다). 3. 그래도 안 되면 `claude --debug`로 시작해 디버그 로그에서 `hooks module switchboard` 오류를 확인하세요 |
| 여기서는 모니터 창을 표시할 수 없다는 응답 | VS Code 확장의 그래픽 UI에서 실행했습니다. Desktop의 Code 탭이나 터미널의 Claude Code에서 입력하세요 |
| 상단에 `⚠ 지금은 세션 상태를 확인할 수 없습니다`가 뜨고, 세션 기록이 하나도 없다(이 세션의 기록도 없음)고 표시됨 | Claude Code 버전이 너무 오래되어 아직 세션 기록을 남기지 않거나, `CLAUDE_CONFIG_DIR`이 Claude Code가 실제로 쓰는 폴더가 아닌 곳을 가리킵니다 |
| 상단에 `⚠ 지금은 세션 상태를 확인할 수 없습니다`가 뜨고, `switchboard가 상태를 읽지 못했습니다:` 뒤에 빨간 글자가 이어짐 | 빨간 글자는 원래 오류 메시지입니다. 모니터 창은 3초마다 자동으로 다시 시도하므로 일시적인 오류라면 저절로 사라집니다. 계속 보이면 `claude --debug`로 시작해 디버그 로그에서 `hooks module switchboard` 오류를 확인하세요 |
| 상단에 `⚠ 지금은 세션 상태를 확인할 수 없습니다`가 뜨고, 폴더를 읽을 수 없다고 표시됨 | 그 폴더가 있는지, 읽기 권한이 있는지 확인하세요. `CLAUDE_CONFIG_DIR`을 설정했다면 Claude Code가 실제로 쓰는 폴더를 가리키는지 확인하세요 |
| 행에 `switchboard 미로드, 기본 상태만`이 표시됨 | 설치 전에 열려 있던 세션입니다. 다시 시작하세요 |
| PR이 표시되지 않음 | `gh`를 설치하고 `gh auth login`을 실행하세요. 세션 폴더가 GitHub 저장소여야 합니다 |
| CLI 세션을 클릭하면 경로만 표시됨 | 이동은 iTerm과 Terminal.app만 지원합니다. 다른 터미널은 직접 전환하세요. iTerm·Terminal.app에서도 이동되지 않으면 안내에 따라 「시스템 설정 › 개인정보 보호 및 보안 › 자동화」에서 제어를 허용하거나 해당 세션을 다시 시작하세요(0.6.0 이전에 연 세션은 터미널을 기록하지 않았습니다) |
| 「모니터 창 자동으로 열기 › CLI 세션」을 체크했는데 터미널에 모니터 창이 나타나지 않음 | 터미널이 너무 좁아서(144열 미만) 자동으로 연 패널이 그려지지 않았습니다. 입력창 위의 **▦ 모니터 창 열기**를 누르거나 `/switchboard:open`을 입력하거나 터미널을 넓히세요 |
| 코드를 수정해도 반영되지 않음 | 설치된 사본은 `plugin.json`의 `version`으로 캐시됩니다. 개발 중에는 대신 프로젝트 폴더에서 `claude --plugin-dir ./agens-view`로 시작하면 수정할 때마다 핫 리로드됩니다. 설치된 사본이 새 버전을 받지 못하면 `claude plugin marketplace update switchboard`와 `claude plugin update switchboard@switchboard`를 실행한 뒤 다시 시작하세요 |
