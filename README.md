<div align="center">
  <h1 align="center">
    Queen-OS
    <br />
    <br />
    <a href="https://queen-os-theta.vercel.app/">
      <img src="docs/screenshots/quote-step-1-input.png" alt="Queen-OS 자료 입력 화면" width="880">
    </a>
  </h1>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white" alt="Express API">
  <img src="https://img.shields.io/badge/Prisma-Supabase_PostgreSQL-2D3748?logo=prisma&logoColor=white" alt="Prisma Supabase PostgreSQL">
  <img src="https://img.shields.io/badge/Gemini-입력_보조-4285F4?logo=google&logoColor=white" alt="Gemini 입력 보조">
  <img src="https://img.shields.io/badge/Vitest-tests-6E9F18?logo=vitest&logoColor=white" alt="Vitest tests">
  <img src="https://img.shields.io/badge/status-prototype-lightgrey" alt="status prototype">
</p>

<p align="center"><a href="https://queen-os-theta.vercel.app/">라이브 데모</a> · <a href="https://github.com/user-attachments/files/32230893/OS_B2B.SaaS.Project.pdf">발표 자료</a> · <a href="docs/기술규격서.md">기술규격서</a> · <a href="docs/프로젝트-KPI-정의서.md">KPI 정의</a></p>

## Introduction

상담 자료를 검수 가능한 주문 정보로 바꾸고, 계산 근거와 버전이 남는 견적서를 발행하는 주방가구 B2B 운영 시스템입니다. 퀸주방가구에서 상담 · 견적 · 실측을 직접 맡으며 겪은 재입력, 수기 계산 오류, 견적 버전 혼선에서 시작했습니다.

- **AI는 입력만 돕습니다**

> 원본 자료와 AI 추출 결과를 한 화면에서 비교하고, 품목 · 규격 · 수량은 사람이 확정합니다. AI는 가격을 결정하지 않습니다.

- **금액은 규칙 엔진이 계산합니다**

> 단가표 DB와 명시된 규칙으로 원가와 판매가를 계산하고, 적용 단가와 계산 근거를 함께 보여 줍니다.

- **견적은 덮어쓰지 않습니다**

> 수정 견적은 V2 · V3로 보존하고, 발행 당시 주문 정보 · 계산 결과 · 단가 스냅샷을 함께 남깁니다.

## Installation

Node.js 20 이상과 PostgreSQL 연결 정보가 필요합니다.

```bash
npm install
npm run db:migrate:deploy
npm run dev:no-open
```

개발 서버와 API는 `http://localhost:3000`에서 실행됩니다. Gemini 키가 없으면 휴리스틱 파서로 전환됩니다.

```bash
npm test
npm run build
```

비밀번호, API 키, 관리자 인증 정보는 커밋하지 마세요. 배포 환경에서는 별도 비밀 변수로 관리해야 합니다.

## 프로젝트 개요

주방가구 견적은 고객 메모, 도면, 사진, PDF처럼 형식이 다른 자료에서 시작합니다. 담당자는 같은 정보를 다시 입력하고, 단가표와 현장 조건을 대조하고, 수정된 견적의 근거까지 관리해야 합니다.

Queen-OS는 이 과정을 네 단계로 연결합니다.

```text
자료 입력 → 규격 검수 → 원가 계산 → 견적서 발행
   AI 보조      사람 확정      규칙 기반       버전 보존
```

| 구분 | 내용 |
| --- | --- |
| 사용자 | 영업·설계·견적 실무자와 관리자 |
| 핵심 문제 | 재입력, 수기 계산 오류, 단가 변경 누락, 견적 버전 혼선 |
| 핵심 경험 | AI 입력 보조 → 사람의 규격 검수 → 결정론적 계산 → 근거가 남는 발행 |
| 기술 | React, TypeScript, Express, Prisma, Supabase PostgreSQL, Gemini, Zod, Vitest |
| 현재 단계 | 배포 가능한 프로토타입, 실제 운영 KPI 측정 전 |

### 현장 도입 원칙

기존 카톡·전화·손도면 사용을 한 번에 바꾸지 않습니다. 현장 직원은 익숙한 방식으로 자료를 전달하고, 관리자는 Queen-OS에서 정보를 정리합니다. 확정 주문 이후의 매입·매출·회계·재고는 이카운트가 담당하도록 경계를 나눴습니다.

## 견적 작성 흐름

### 1. 자료 입력

![원본 파일과 AI 추출 결과를 함께 보는 자료 입력 화면](docs/screenshots/quote-step-1-input.png)

원본 자료와 AI 추출 결과를 한 화면에서 비교합니다. 필수 값이 비어 있으면 `확인 필요`로 표시해 누락이 다음 단계로 넘어가지 않게 합니다.

### 2. 규격 검수

![주방 규격과 옵션을 검수하는 화면](docs/screenshots/quote-step-2-review.png)

품목, 규격, 수량, 마감, 현장 조건을 사람이 확정합니다. AI는 입력을 보조하지만 가격을 결정하지 않습니다.

### 3. 원가 계산

![단가와 계산 근거를 확인하는 원가 계산 화면](docs/screenshots/quote-step-3-cost.png)

[`server/calculationEngine.ts`](server/calculationEngine.ts)가 단가표 DB와 명시된 규칙으로 원가와 판매가를 계산합니다. 결과뿐 아니라 적용 단가와 계산 근거를 함께 보여 줍니다.

### 4. 견적서 발행

![최종 견적을 검토하고 발행하는 화면](docs/screenshots/quote-step-4-publish.png)

수정 후 다시 발행하면 기존 문서를 덮어쓰지 않고 `V2`, `V3`로 보존합니다. 발행 당시 주문 정보, 계산 결과, 단가 스냅샷을 함께 남깁니다.

## 신뢰를 만드는 설계

| 설계 | 사용자에게 주는 가치 |
| --- | --- |
| AI 결과를 확정값과 분리 | 추출 오류가 견적에 바로 반영되지 않음 |
| 결정론적 계산 엔진 사용 | 같은 입력과 단가표에서 같은 결과 재현 |
| 계산 근거와 단가 노출 | 최종 금액을 역으로 검토 가능 |
| 1.5초 후 자동 저장, 최대 15초 간격 저장 | 작성 중 데이터 손실 완화 |
| 충돌 감지와 최근 20개 이력 | 다른 탭의 변경을 덮어쓰지 않고 복구 가능 |
| 발행 버전과 단가 스냅샷 보존 | 과거 견적의 판단 근거 재현 |
| ADMIN·ESTIMATOR·VIEWER 권한 분리 | 단가와 운영 정보의 접근 범위 통제 |

## 검증 상태

현재 검증은 제품 동작과 데이터 정합성을 대상으로 합니다. 실제 견적 작성 시간, 마진 준수율, AI 수정률 같은 운영 성과는 아직 측정하지 않았습니다.

- 단위·통합 테스트와 프로덕션 빌드로 주요 흐름 확인
- 입력 스키마와 API 응답을 Zod로 검증
- 가격 계산은 AI 응답이 아닌 서버 계산 엔진에서 수행
- KPI의 정의, 산식, 데이터 출처는 [KPI 정의서](docs/프로젝트-KPI-정의서.md)에 명시

## 시스템 구조

```text
React + TypeScript
  ├─ 견적 작성·검수·이력 UI
  └─ TanStack Query
          │ REST API
Express + Zod
  ├─ Gemini 문서 추출
  ├─ 결정론적 계산 엔진
  └─ 인증·권한·감사 이력
          │ Prisma
Supabase PostgreSQL
```

## 문서 안내

README는 제품을 빠르게 이해하기 위한 시작점입니다. 세부 규칙은 목적에 따라 분리했습니다.

| 문서 | 용도 |
| --- | --- |
| [기술규격서](docs/기술규격서.md) | 기능, API, 권한, 비기능 요구사항 |
| [프로젝트 KPI 정의서](docs/프로젝트-KPI-정의서.md) | 지표 정의, 산식, 측정 계획 |
| [데이터 계층 전환 계획](docs/데이터-계층-전환-계획.md) | 저장 구조와 마이그레이션 계획 |
| [발표 자료](docs/주방가구%20주문,견적%20관리%20B2B%20SaaS%20프로젝트_260911.pdf) | 문제 정의와 프로젝트 전반 |

## 현재 한계

- 실제 현장 운영 데이터와 사용자 성과는 아직 없습니다.
- AI 추출 품질은 문서 형식과 입력 상태에 영향을 받습니다.
- 자동 저장과 충돌 복구는 장시간 다중 사용자 환경에서 추가 검증이 필요합니다.
- 견적서 출력과 외부 ERP 연동 범위는 운영 환경에 맞춰 확정해야 합니다.

## Author

안정빈 — 기획 · 업무 흐름 · 데이터 구조 설계, AI 코딩 도구 기반 구현. 12년차 백엔드 개발자가 코드를 검수했습니다.
