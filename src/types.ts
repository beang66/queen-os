export type ItemCategory =
  | 'CARCASS'     // 캐비닛/몸통 (하부장, 상부장, 키큰장, 냉장고장 등)
  | 'DOOR'        // 도어/마감재 (PET, 도장, LPM, 무늬목, EP마감 등)
  | 'COUNTERTOP'  // 상판/인조대리석 (하이막스, 칸스톤, 세라믹 등)
  | 'HARDWARE'    // 하드웨어 (힌지, 서랍레일, 인출망, 댐퍼 등)
  | 'APPLIANCE'   // 기기/싱크볼/수전/후드 (싱크볼, 수전, 후드, 쿡탑 등)
  | 'LABOR'       // 시공 및 가공비 (기본시공, 상판가공, 타공, 철거, 양중 등)
  | 'ACCESSORY';  // 부자재/기타 (걸레받이, 찬넬, 실리콘 등)

export interface PricingItem {
  id: string;
  code: string;               // 품목코드 (예: CAB-BASE-01, DOOR-PET-01)
  category: ItemCategory;
  name: string;               // 품목명 (예: 하부장 기본 바디 18T E0 PB)
  spec: string;               // 규격/스펙 (예: W600 x D580 x H820mm)
  material: string;           // 자재명/소재 (예: 한솔 18T E0 친환경 PB)
  unit: string;               // 단위 (EA, m, m², mm, 세트, 개, 식)
  costPrice: number;          // 매입원가 (VAT별도 원)
  sellingPrice: number;       // 기본출고가 (VAT별도 원)
  supplier: string;           // 공급업체/제조사
  stockStatus: 'INSTOCK' | 'ORDER_MADE' | 'DISCONTINUED';
  notes?: string;
  updatedAt: string;
}

export type LayoutType = 'I_SHAPE' | 'L_SHAPE' | 'U_SHAPE' | 'ISLAND_PARALLEL' | 'CUSTOM';

export interface OrderEntity {
  customerName: string;
  contact: string;
  address: string;
  deliveryDate?: string;         // 희망 시공일
  projectName?: string;          // 프로젝트명 (예: 서초 샘플아파트 주방 리모델링)
  consultDate?: string;          // 상담일
  customerType?: string;         // 고객 유형 (일반 고객 / 인테리어 업체 / 재시공 등)
  manager?: string;              // 담당자
  layoutType: LayoutType;
  dimensions: {
    lowerCabinetLengthMm: number;    // 하부장 길이 (mm)
    upperCabinetLengthMm: number;    // 상부장 길이 (mm)
    islandLengthMm?: number;         // 아일랜드 길이 (mm)
    tallCabinetWidthMm?: number;     // 키큰장 폭 (mm)
    fridgeCabinetWidthMm?: number;   // 냉장고장 폭 (mm)
    depthMm: number;                 // 기본 깊이 (표준 600mm)
    heightMm: number;                // 기본 높이 (표준 850~870mm)
    countertopThicknessMm: number;   // 상판 두께 (12T, 20T, 30T 등)
  };
  doorOption: {
    material: string;                // 예: PET 무광 매트 화이트 E0
    color: string;                   // 색상
    handleType: 'C_CHANNEL' | 'NECK_CHANNEL' | 'PUSH_OPEN' | 'HANDLE'; // 손잡이 방식
    edgeFinish: string;              // 엣지 마감 (1T PUR 방수엣지 등)
  };
  countertopOption: {
    brand: string;                   // 예: 현대 L&C 칸스톤, LG 하이막스
    model: string;                   // 예: 오로라 비앙코, 루나 화이트
    thickness: string;               // 12T / 20T / 30T
    edgeType: string;                // 빗각, 사각, 라운드 가공
  };
  modules: {
    drawerCount2Tier: number;        // 2단 서랍장 개수
    drawerCount3Tier: number;        // 3단 서랍장 개수
    sinkCabinetCount: number;        // 싱크 하부장
    cooktopCabinetCount: number;     // 쿡탑 하부장
    spiceRackCount: number;          // 양념망 인출장 개수
    cornerModuleCount: number;       // 코너 인출선반 개수
    riceCookerModuleCount: number;   // 밥솥/전자렌지 인출장
  };
  appliances: {
    sinkBowlModel: string;           // 싱크볼 모델 (예: 백조 그랜드 860 사각볼)
    faucetModel: string;             // 수전 모델 (예: 더죤테크 슈티에 거위목 니켈)
    hoodModel: string;               // 후드 모델 (예: 하츠 스퀘어 후드 DTR-90S)
    cooktopModel: string;            // 쿡탑 모델 (예: SK매직 3구 인덕션)
    customAppliances?: string;       // 고객 보유 기기 또는 추가 기기
  };
  siteConditions: {
    floor: number;                   // 층수
    hasElevator: boolean;            // 엘리베이터 여부
    needsDemolition: boolean;        // 기존 가구 철거 필요 여부
    needsLadderTruck: boolean;       // 사다리차 필요 여부
    distanceKm?: number;             // 거리 (운반비 산정)
    specialNotes?: string;           // 특이사항
  };
  rawPrompt?: string;                // 원본 고객 요청 텍스트/메모
}

/** 규격 검수 단계의 주방 구성 품목 라인 아이템 */
export type ReviewItemStatus = 'CONFIRMED' | 'NEEDS_PRICING' | 'MANUAL';

export interface ReviewLineItem {
  id: string;
  category: ItemCategory;
  name: string;                  // 품목
  spec: string;                  // 규격 / 산출 기준
  quantity: number;              // 수량
  unit: string;                  // 단위
  status: ReviewItemStatus;      // 확인됨 / 단가 연결 필요 / 직접 입력
  linkedPricingId?: string | null; // 연결된 단가 DB 품목 id
  source: 'AI' | 'MANUAL';       // AI 추출 / 직접 입력
}

export interface QuoteBreakdownItem {
  id: string;
  category: ItemCategory;
  code: string;
  name: string;
  spec: string;
  formula: string;                   // 산출 공식 설명 (예: "하부장 3,200mm / 1,000mm × 180,000원")
  unit: string;
  quantity: number;
  costUnitPrice: number;             // 매입단가
  costTotal: number;                 // 매입원가 합계
  sellingUnitPrice: number;          // 출고단가
  sellingTotal: number;              // 판매금액 합계
  marginRate: number;                // 항목별 마진율 (%)
  validationStatus: 'VALID' | 'WARNING' | 'ERROR';
  validationMessage?: string;
}

export interface QuoteSummary {
  carcassCost: number;
  carcassSelling: number;
  doorCost: number;
  doorSelling: number;
  countertopCost: number;
  countertopSelling: number;
  hardwareCost: number;
  hardwareSelling: number;
  applianceCost: number;
  applianceSelling: number;
  laborCost: number;
  laborSelling: number;
  accessoryCost: number;
  accessorySelling: number;

  totalManufacturingCost: number;    // 총 제조원가 (VAT 별도)
  totalSellingPrice: number;         // 총 공급가액 (VAT 별도)
  totalMarginAmount: number;         // 총 마진금액
  averageMarginRate: number;         // 평균 마진율 (%)
  vatAmount: number;                 // 부가세 (10%)
  finalGrandTotal: number;           // 최종 견적 총액 (VAT 포함)
}

export interface ValidationItem {
  type: 'ERROR' | 'WARNING' | 'INFO';
  field: string;
  message: string;
  suggestion?: string;
}

export interface QuoteCalculationResult {
  breakdowns: QuoteBreakdownItem[];
  summary: QuoteSummary;
  validationReport: ValidationItem[];
  appliedPricingSnapshot: Record<string, PricingItem>;
  calculatedAt: string;
}

export type QuoteStatus = 'DRAFT' | 'ISSUED' | 'NEGOTIATING' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

/** 견적서 발행 단계에서 편집하는 문서 메타데이터 */
export interface QuotePublishMeta {
  validUntilDays: number;         // 유효기간 (발행일로부터 N일)
  paymentTerms: string;           // 결제 조건
  exclusions: string;             // 제외 사항
  specialTerms: string;           // 특약 사항
  internalMemo: string;           // 내부 메모 (고객 견적서에 노출되지 않음)
  hiddenBreakdownIds: string[];   // 고객 견적서에서 숨길 품목 id 목록
}

export interface QuoteDocument {
  id: string;
  quoteNumber: string;               // 견적번호 (예: QN-20260831-001)
  title: string;                     // 견적명 (예: 서초 샘플아파트 34평형 주방 가구 제작 및 시공 견적서)
  createdAt: string;
  updatedAt: string;
  status: QuoteStatus;
  targetMarginRate: number;          // 적용 목표 마진율 (%)
  version?: number;                  // 발행 버전 (V1, V2, V3 ...)
  parentQuoteId?: string;            // 최초 버전 문서 id (버전 체인)
  publishMeta?: QuotePublishMeta;    // 발행 메타데이터
  orderEntity: OrderEntity;
  calculationResult: QuoteCalculationResult;
  appliedPricingSnapshot?: PricingItem[];
  notes?: string;
  companyInfo: {
    name: string;
    representative: string;
    bizNumber: string;
    address: string;
    phone: string;
    email: string;
  };
}

// ---------------------------------------------------------------------------
// 견적 초안 (Draft) — 신규 견적 작성 시작 시 생성되어 모든 단계 변경사항을 담는다.
// ---------------------------------------------------------------------------

/** 첨부 파일 메타데이터 (미리보기 base64 는 저장하지 않는다) */
export interface AttachedFileMeta {
  id: string;
  name: string;
  sizeLabel: string;
  uploadedAt: string;
  kind: '도면' | '이미지' | '메모';
}

/** 마법사 4단계 전체의 작업 상태 스냅샷 */
export interface DraftPayload {
  step: 1 | 2 | 3 | 4;
  promptText: string;
  attachedFiles: AttachedFileMeta[];
  orderEntity: OrderEntity;
  reviewItems: ReviewLineItem[];
  targetMarginRate: number;
  calculationResult: QuoteCalculationResult | null;
  quoteTitle: string;
  publishMeta: QuotePublishMeta;
  /**
   * 이 초안의 주문 정보를 만들어낸 AI 파싱 로그 id.
   * 초안을 나중에 이어서 작성해도 "AI 결과를 사람이 얼마나 고쳤는지"를
   * 같은 로그에 이어 기록하기 위해 payload 에 함께 보관합니다.
   */
  parseLogId?: string | null;
}

/** 초안의 과거 저장 시점 (변경 이력 및 복구용) */
export interface QuoteDraftRevision {
  revision: number;
  savedAt: string;
  label: string;          // 저장 사유 (자동 저장 / 수동 임시 저장 / 단계 이동 등)
  payload: DraftPayload;
}

export type DraftStatus = 'ACTIVE' | 'PUBLISHED' | 'ARCHIVED';

export interface QuoteDraft {
  id: string;                  // draft-...
  revision: number;            // 낙관적 잠금 카운터 (동시 편집 충돌 감지)
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  lastEditorId: string;        // 마지막으로 저장한 창(탭) 식별자
  payload: DraftPayload;
  history: QuoteDraftRevision[];
  /** 계산 시점의 단가표 지문 — 이후 단가가 바뀌었는지 판별 */
  pricingFingerprint: string | null;
  publishedQuoteIds: string[];
}

/** 초안 목록에 쓰는 경량 요약 (payload 제외) */
export interface QuoteDraftSummary {
  id: string;
  revision: number;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  step: 1 | 2 | 3 | 4;
  customerName: string;
  projectName: string;
  quoteTitle: string;
  itemCount: number;
  totalAmount: number | null;
  publishedQuoteIds: string[];
}

export interface ParsedPriceItem {
  code?: string;
  category: ItemCategory;
  name: string;
  spec: string;
  material: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
  notes?: string;
  confidenceScore?: number;
}

export interface DocumentExtractionResponse {
  success: boolean;
  documentType: string;
  rawTextSummary: string;
  extractedItems: ParsedPriceItem[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// AI 파싱 정확도 추적 (AI Parse Log)
//
// 파싱 1회마다 로그 한 건이 생기고, 사람이 규격 검수/발행 단계에서 값을 확정하면
// 그 로그에 "무엇을 고쳤는지"가 덧씌워집니다. 수정률·미추출률이 여기서 나옵니다.
// ---------------------------------------------------------------------------

/** ORDER: 고객 주문 파싱 / DOCUMENT: 단가표·견적서 문서 파싱 */
export type ParseLogKind = 'ORDER' | 'DOCUMENT';

/** GEMINI: 모델 응답 / HEURISTIC: 모델 실패로 규칙 기반 폴백이 돈 경우 */
export type ParseEngine = 'GEMINI' | 'HEURISTIC';

/** 사람이 값을 확정한 시점 */
export type ParseConfirmStage = 'REVIEW' | 'PUBLISH';

/** 필드 한 건의 판정: 채택 / 수정 / AI 미추출 */
export type ParseFieldVerdict = 'MATCHED' | 'CORRECTED' | 'MISSING';

export interface ParseFieldDiff {
  path: string;
  label: string;
  group: string;
  verdict: ParseFieldVerdict;
  parsed: unknown;
  confirmed: unknown;
}

// ---------------------------------------------------------------------------
// 사용자 · 인증
// ---------------------------------------------------------------------------

/**
 * ADMIN     : 전체 기능 + 사용자·단가표 관리
 * ESTIMATOR : 견적 작성·발행, 원가 열람 가능. 단가표 수정 불가
 * VIEWER    : 발행된 견적서 열람만. 원가·마진은 보이지 않음
 */
export type UserRole = 'ADMIN' | 'ESTIMATOR' | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'DISABLED';

/** 로그인한 사용자 (화면·요청 컨텍스트에서 쓰는 최소 정보) */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** 관리자가 발급한 초기 비밀번호를 아직 바꾸지 않은 상태 */
  mustChangePassword: boolean;
}

/** 사용자 관리 화면에서 쓰는 계정 정보 (비밀번호 해시는 절대 나가지 않습니다) */
export interface AppUser extends AuthUser {
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
}

/** 필드 한 개의 누적 성적 */
export interface ParseFieldStat {
  path: string;
  label: string;
  group: string;
  /** 이 필드가 판정 대상이 된 파싱 건수 */
  observed: number;
  corrected: number;
  missing: number;
  correctionRate: number;
  missingRate: number;
}

/** 기간별 AI 파싱 정확도 집계 */
export interface ParseAccuracyStats {
  periodDays: number;
  /** 사람이 확정까지 마쳐 지표에 반영된 파싱 건수 */
  sampleCount: number;
  trackedCount: number;
  matchedCount: number;
  correctedCount: number;
  missingCount: number;
  correctionRate: number;
  accuracyRate: number;
  /** 확정 여부와 무관한 전체 파싱 호출 수 */
  totalParseCount: number;
  fallbackCount: number;
  fallbackRate: number;
  pendingConfirmCount: number;
  averageLatencyMs: number;
  byEngine: Array<{
    engine: string;
    sampleCount: number;
    correctionRate: number;
    accuracyRate: number;
  }>;
  worstFields: ParseFieldStat[];
}

/** 파싱 이력 목록에 쓰는 경량 요약 (스냅샷 제외) */
export interface AiParseLogSummary {
  id: string;
  kind: ParseLogKind;
  engine: ParseEngine;
  model: string;
  latencyMs: number;
  promptChars: number;
  hasAttachment: boolean;
  errorMessage?: string;
  itemCount?: number;
  confirmStage?: ParseConfirmStage;
  trackedCount?: number;
  correctedCount?: number;
  missingCount?: number;
  correctionRate?: number;
  accuracyRate?: number;
  confirmedAt?: string;
  createdAt: string;
}
