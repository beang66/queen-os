# 퀸 주방가구 견적 및 원가 자동화 시스템 (Queen-OS)

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
npm run dev      # Vite 개발 서버
npm run build    # dist/ 로 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

백엔드 API(`/api/*`)는 [server.ts](server.ts)의 Express 서버가 제공합니다. Gemini 파싱을 쓰려면 `.env.example`을 참고해 `.env`에 `GEMINI_API_KEY`를 설정하세요.

## 구조

```
src/
  App.tsx                     탭 라우팅 · API 호출
  types.ts                    도메인 타입 (PricingItem / OrderEntity / QuoteDocument)
  components/
    QuoteWizard.tsx           4단계 마법사 컨테이너
    wizard/                   단계별 화면 + review·calc 하위 모듈
    pricing/ · history/       단가표 DB · 견적 이력
server/
  calculationEngine.ts        결정론적 원가 산출
  db.ts                       JSON 파일 기반 저장소 (data/db.json)
  geminiService.ts            AI 문서·자연어 파싱
```

## 데이터 저장

`data/db.json` 단일 파일에 단가표와 견적서를 보관합니다(`server/db.ts`의 `Store`). 발행된 견적서는 덮어쓰지 않고 `-V2`, `-V3` 번호로 새 문서를 만듭니다.
