# ThreeLight Kit

> This page covers manual module assembly. For runnable `create` presets and current verification evidence, see the [English README](README.md#cli-usage).

**TypeScript, React/Vite, 데스크톱 프로젝트를 직접 구성하고 검사할 때 재사용하는 프로젝트 설정 모듈입니다.**

[English](README.md) · [모듈 경계](README.md#module-boundaries) · [React/Vite 구성 예제](README.md#example-assemble-a-reactvite-project)

[StateCarry](https://github.com/ThreeLightStudio/statecarry)의 설정에서 제품 전용 항목을 걷어낸 구성입니다. 이 문서는 공개 모듈 README의 수동 적용 절차를 다룹니다. 설정 파일을 복사하고 패키지 조각을 병합한 뒤 경로를 맞춰, 적용 대상 프로젝트에서 검증합니다. npm 배포나 완성된 앱의 준비 상태를 입증하는 문서는 아닙니다. 확인한 공개 기준에는 GitHub 릴리스나 Kit 자체 워크플로 실행이 없었습니다.

## React/Vite 프로젝트를 직접 구성하는 예

**입력:** `index.html`, `src/main.tsx`, `package.json`, 프로젝트 테스트가 있는 React/Vite 앱입니다. 앱 진입 파일과 테스트는 대상 프로젝트에서 마련합니다. [React/Vite 모듈](modules/react-vite/README.md)은 설정과 의존성을 제공합니다.

**구성:** `quality + typescript + react-vite`를 선택해 공개 파일과 패키지 조각을 직접 적용합니다.

| 모듈                                       | 복사·병합할 자료                                                                                                                                                     | 단일 앱에서 맞출 부분                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [quality](modules/quality/README.md)       | [Oxfmt](modules/quality/files/.oxfmtrc.json), [Oxlint](modules/quality/files/.oxlintrc.json), [패키지 조각](modules/quality/package.json.snippet)                    | 스크립트와 도구 버전을 병합하고, 기존 설정을 교체하기 전에 차이를 확인합니다.                    |
| [typescript](modules/typescript/README.md) | [tsconfig](modules/typescript/files/tsconfig.json), [Vitest 설정](modules/typescript/files/vitest.config.ts), [패키지 조각](modules/typescript/package.json.snippet) | `@/*`는 `./src/*`, Vitest의 정확한 `@`는 `./src`로 맞추고 `include`도 앱·테스트 경로에 맞춥니다. |
| [react-vite](modules/react-vite/README.md) | [Vite 설정](modules/react-vite/files/vite.config.ts), [패키지 조각](modules/react-vite/package.json.snippet)                                                         | 설정을 앱 루트에 두면 `@`는 그 위치의 `src`를 가리킵니다.                                        |

의존성 종류별로 병합하고 같은 이름의 스크립트가 충돌하면 의도를 확인해 선택합니다. quality 조각의 기준은 pnpm 10.33.2, Node ≥24.14.1이며, 대상 프로젝트와 CI 요구에 맞춰 함께 조정합니다.

**결과:** Vite·TypeScript·Vitest의 경로가 일치하도록 수동으로 구성한 앱입니다. 조각을 병합한 뒤 **대상 프로젝트에서** 설치와 검사를 실행합니다.

```sh
pnpm install
pnpm run verify
pnpm exec vite build
```

[quality 조각](modules/quality/package.json.snippet)의 `verify`는 포맷 검사 → lint → 타입 검사 → 테스트 순서입니다. 테스트 명령에 `--passWithNoTests`가 있으므로 테스트 없는 통과는 동작 검증이 아닙니다. 프로젝트에 필요한 테스트를 마련해야 합니다. 위 절차는 공개 파일에서 확인한 명령이며, 이 예제를 실행했다는 보고가 아닙니다.

## 모듈마다 맡는 범위

quality는 포맷·lint·검사 도구와 스크립트를, typescript는 루트 tsconfig와 Vitest 별칭을, react-vite는 Vite 설정과 React 의존성을 맡습니다. 타입 검사는 프로젝트 tsconfig가 필요하고, TypeScript 모듈의 Vitest 설정은 quality가 제공하는 Vitest를 필요로 하므로 함께 적용하는 것이 기본입니다. [전체 모듈 표](README.md#module-boundaries)

선택 모듈도 경계가 있습니다. [git](modules/git/)의 검증 워크플로는 quality가 필요하지만 ignore 파일은 따로 쓸 수 있습니다. [workspace](modules/workspace/)는 quality를 전제로 pnpm·Turbo 설정과 실행 래퍼를 제공하고 루트에서 도구를 관리합니다. [electrobun](modules/electrobun/)은 React/Vite를 전제로 macOS·Apple Silicon 데스크톱 설정을 제공합니다. [agents](modules/agents/)는 에이전트 안내와 결정 기록 문서 템플릿입니다.

## 확인할 설계 선택

**관심사를 모듈별로 나눕니다.** `files/`의 설정, 패키지 조각, README의 적용 절차를 구분해 기존 프로젝트와 충돌하는 부분을 직접 확인하게 합니다. [quality 절차](modules/quality/README.md) · [React/Vite 절차](modules/react-vite/README.md)

**도구가 같은 소스를 보도록 경로를 맞춥니다.** Vitest는 TypeScript paths에서 별칭을 만들고 정확한 `@`를 따로 추가합니다. Vite는 설정 파일 위치를 앱 루트로 삼습니다. 워크스페이스 설정을 단일 앱에 적용할 때 세 경로를 함께 맞춰야 합니다. [TypeScript 계약](modules/typescript/README.md) · [Vite 설정](modules/react-vite/files/vite.config.ts)

**검증 결과는 적용 대상 프로젝트에서 얻습니다.** quality는 직접 검사 명령을, workspace는 일부 스크립트를 바꾸는 Turbo 래퍼를, git은 CI 템플릿을 제공합니다. 조각이 있다는 사실만으로 대상 앱의 동작이 검증되지는 않습니다. [workspace 병합 규칙](modules/workspace/README.md) · [CI 템플릿](modules/git/files/.github/workflows/verify.yml)

[MIT 라이선스](LICENSE)
