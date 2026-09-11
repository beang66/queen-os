# 퀸 주방가구 견적 및 원가 자동화 시스템 (Queen-OS)
링크: https://queen-os.onrender.com/
설명서: [주방가구 주문,견적 관리 B2B SaaS 프로젝트_260911.pdf](https://github.com/user-attachments/files/32091336/B2B.SaaS._260911.pdf)

상담 자료(메모·도면·사진·PDF)에서 주문 정보를 추출하고, 단가표 DB를 기준으로 결정론적으로 원가를 산출해 견적서를 발행하는 시스템입니다.

## 견적 작성 흐름

```
1. 자료 입력  →  2. 규격 검수  →  3. 원가 계산  →  4. 견적서 발행
```

| 단계 | 화면 | 하는 일 |
|---|---|---|
| 1 | 자료 입력 | 도면·메모·사진 업로드, AI 정보 추출, 추출 결과 검수 |
| 2 | 규격 검수 | 고객·현장 정보 확인, 품목 확정, 단가 DB 연결, 누락 검사 |
| 3 | 원가 계산 | 품목별 산출 근거, 로스율·목표 마진율·할인·부가세 적용 |
| 4 | 견적서 발행 | 고객용 A4 미리보기, 유효기간·결제조건·특약 설정, V1/V2/V3 버전 발행 |

AI는 입력을 돕는 수단이며, 원가 계산은 단가표 DB 기반의 결정론적 엔진([server/calculationEngine.ts](server/calculationEngine.ts))이 담당합니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 → http://localhost:3000 (브라우저 자동 실행)
npm run build    # dist/ 로 프로덕션 빌드
npm start        # 빌드 결과를 프로덕션 모드로 서빙
```

**반드시 `npm run dev` 로 실행하고 :3000 으로 접속하세요.** [server.ts](server.ts) 하나가
Express(API `/api/*`) + Vite(프론트엔드·HMR)를 **:3000 한 포트에서** 함께 띄웁니다.
브라우저는 서버가 응답을 시작한 뒤 한 번만 자동으로 열립니다(코드 수정으로 서버가
재시작돼도 새 탭이 열리지 않습니다). 자동 실행을 원치 않으면 `npm run dev:no-open`.

개발 서버는 **한 번에 하나만** 실행하세요. `npm run dev` 는 시작 전에 :3000 을 검사해
이미 실행 중이면 중복 기동을 거부합니다. (여러 개가 동시에 뜨면 포트를 두고 경쟁하다
브라우저가 몇 초마다 새로고침됩니다.) 종료는 실행한 터미널에서 `Ctrl+C`.

`vite` 를 단독 실행하면 :5173 이 뜨는데, 이때는 API 서버가 없어 AI 추출·원가 계산이
동작하지 않습니다. (안전장치로 `/api` 를 :3000 으로 프록시해 두었으므로, :3000 서버가
함께 켜져 있으면 :5173 에서도 동작합니다.)

Gemini 파싱을 쓰려면 `.env.example`을 참고해 `.env`에 `GEMINI_API_KEY`를 설정하세요.
키가 없어도 휴리스틱 파서로 자동 폴백합니다.

## 구조

```
src/
  App.tsx                     탭 라우팅 · API 호출
  types.ts                    도메인 타입 (PricingItem / OrderEntity / QuoteDocument)
  components/
    QuoteWizard.tsx           4단계 마법사 컨테이너
    wizard/                   단계별 화면 + review·calc 하위 모듈
    pricing/ · history/       단가표 DB · 견적 이력
  schemas.ts                  API 입출력 검증 스키마 (zod) — 서버·클라이언트 공용
  lib/api.ts                  fetch 래퍼 + 응답 스키마 검증
server/
  calculationEngine.ts        결정론적 원가 산출
  db.ts                       Prisma/Supabase PostgreSQL 저장소
  validate.ts                 요청 본문·쿼리 검증 헬퍼
  geminiService.ts            AI 문서·자연어 파싱
prisma/
  schema.prisma                PricingItem / Quote / Draft / QuoteDraftRevision (PostgreSQL / snake_case 매핑)
  migrations/                  스키마 변경 이력 (git 추적됨)
scripts/
  supabase-init.sql            Supabase SQL Editor DDL (snake_case)
```

## 견적 초안 (자동 저장)

신규 견적 작성을 시작하는 순간 **견적 초안**이 만들어지고, 이후 4단계 전체의 변경사항이
같은 초안 id 로 자동 저장됩니다. 다른 메뉴에 다녀오거나 브라우저를 닫아도 이어서 작성할 수 있습니다.

- **자동 저장** — 입력이 멈추고 1.5초 뒤, 계속 입력 중이어도 최대 15초마다 한 번은 저장
- **상태 표시** — 화면 상단에 `변경됨 / 저장 중 / 저장됨 / 저장 실패 / 충돌 발생` 과 마지막 저장 시각
- **저장 실패 시** — 브라우저(localStorage)에 임시 백업 후 안내, 복구되면 [임시 저장]으로 재전송
- **동시 편집 충돌** — 같은 초안을 두 창에서 열면 낙관적 잠금(revision)으로 감지해
  덮어쓰지 않고 `최신본 불러오기 / 이 창 내용으로 덮어쓰기` 를 선택
- **변경 이력** — 초안마다 최근 20개 저장 시점을 보관, [견적 관리] 탭에서 이전 상태로 복구
- **단가 변경 감지** — 계산 시점의 단가표 지문과 현재 지문을 비교해 다르면 재계산을 안내
- **보관·폐기** — 30일간 수정이 없으면 보관(ARCHIVED), 보관 후 90일이 더 지나면 삭제.
  발행 이력이 있는 초안은 삭제하지 않습니다. (서버 기동 시 실행)

견적서를 발행하면 초안은 `PUBLISHED` 로 바뀌고 발행 문서와 연결됩니다.
초안 목록과 복구는 **견적 관리** 탭 상단에서 다룹니다.

## API 계약 (zod)

요청과 응답이 [src/schemas.ts](src/schemas.ts) 한 곳에 정의되어 있고, 서버와 클라이언트가
같은 스키마를 씁니다.

- **서버** — 라우트가 요청 본문을 검증하고, 틀리면 400 과 함께 어느 필드가 왜 틀렸는지 알려줍니다.
  `요청 값이 올바르지 않습니다. orderEntity.dimensions.lowerCabinetLengthMm: expected number, received string`
- **클라이언트** — `fetchValidated(스키마, url)` 로 호출해 응답이 약속한 모양인지 확인합니다.
  기존 `fetchJson<{ data: QuoteDraft }>` 의 제네릭은 타입 주장일 뿐이라 서버가 다른 모양을
  보내도 통과했고, 그 어긋남은 화면 어딘가에서 `undefined` 로 뒤늦게 드러났습니다.
- **드리프트 방지** — `schemas.ts` 하단에서 각 스키마의 추론 타입이 [src/types.ts](src/types.ts) 의
  도메인 타입에 대입 가능한지 컴파일 시점에 확인합니다. 한쪽만 고치면 `tsc` 가 막습니다.

이 검증이 성립하려면 `strictNullChecks` 가 필요해 [tsconfig.json](tsconfig.json) 에서 켰습니다
(켠 시점에 기존 오류 0건).

## 데이터 저장

**Prisma + Supabase PostgreSQL** (`scripts/supabase-init.sql`)에 단가표(`pricing_item`)·견적서(`quote`)·견적 초안(`draft`)·초안 이력(`quote_draft_revision`)을 보관합니다.
발행된 견적서는 덮어쓰지 않고 `-V2`, `-V3` 번호로 새 문서를 만듭니다.

```bash
# Supabase 초기 설정: scripts/supabase-init.sql 복사 → Supabase 대시보드 SQL Editor에서 Run
npm run db:migrate:deploy   # Supabase 마이그레이션 배포 적용 (DIRECT_URL)
npm run db:studio           # Prisma Studio — 데이터를 GUI로 열람·수정
```

- 모든 테이블과 컬럼은 PostgreSQL 표준 `snake_case` 네이밍 규칙(`pricing_item`, `quote`, `draft`, `quote_draft_revision`, `cost_price`, `selling_price`, `quote_number`, `order_entity` 등)을 준수하며, Prisma 스키마에서 `@map` 및 `@@map`으로 도메인 객체와 1:1 매핑됩니다.
- 초안의 변경 이력은 `quote_draft_revision` **별도 테이블**에 행 단위로 쌓입니다.
  자동 저장 1회가 파일 전체가 아니라 행 하나만 기록하므로, 데이터가 늘어도 저장 비용이 일정합니다.
- 초안 revision에는 `applied_pricing_snapshot`(단가표 전체 복사본)을 넣지 않습니다.
  발행된 견적서에만 스냅샷으로 보관합니다.
- `revision` 낙관적 잠금과 이력 정리가 한 트랜잭션 안에서 처리됩니다.
- 연결 정보는 `.env` 의 `DATABASE_URL` (Supabase Pooler 6543 포트) 및 `DIRECT_URL` (Supabase 직접 연결 5432 포트)입니다.

### 기존 JSON 저장소에서 이관

`data/db.json` 을 쓰던 버전에서 올라온 경우 한 번만 실행하세요.

```bash
npm run db:migrate-legacy-json
```

단가표·견적서·초안과 모든 revision 이력을 옮기고, 원본은 `db.json.migrated-<timestamp>`
로 이름만 바꿔 보존합니다. SQLite에 이미 데이터가 있으면 중복 이관을 막기 위해 중단합니다.
