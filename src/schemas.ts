import { z } from 'zod';
import type {
  DraftPayload,
  OrderEntity,
  PricingItem,
  QuoteCalculationResult,
  QuotePublishMeta,
  ReviewLineItem,
} from './types';

/**
 * API 경계를 넘나드는 데이터의 검증 스키마.
 *
 * 서버 라우트에서 요청 본문을 검증하고, 클라이언트에서도 같은 스키마를 재사용합니다.
 * 도메인 타입(types.ts)은 그대로 두고, 이 파일은 "그 타입에 맞는 값인지"를 런타임에
 * 확인하는 역할만 합니다. 두 정의가 어긋나면 파일 하단의 대조 검사에서 컴파일 오류가 납니다.
 */

// ---------------------------------------------------------------------------
// 공통 조각
// ---------------------------------------------------------------------------

export const ItemCategorySchema = z.enum([
  'CARCASS',
  'DOOR',
  'COUNTERTOP',
  'HARDWARE',
  'APPLIANCE',
  'LABOR',
  'ACCESSORY',
]);

export const LayoutTypeSchema = z.enum(['I_SHAPE', 'L_SHAPE', 'U_SHAPE', 'ISLAND_PARALLEL', 'CUSTOM']);

export const HandleTypeSchema = z.enum(['C_CHANNEL', 'NECK_CHANNEL', 'PUSH_OPEN', 'HANDLE']);

export const StockStatusSchema = z.enum(['INSTOCK', 'ORDER_MADE', 'DISCONTINUED']);

export const QuoteStatusSchema = z.enum([
  'DRAFT',
  'ISSUED',
  'NEGOTIATING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'COMPLETED',
  'CANCELLED',
]);

export const DraftStatusSchema = z.enum(['ACTIVE', 'PUBLISHED', 'ARCHIVED']);

export const ReviewItemStatusSchema = z.enum(['CONFIRMED', 'NEEDS_PRICING', 'MANUAL']);

/** 치수는 mm 정수. 음수는 계산을 망가뜨리므로 막습니다. */
const millimeters = z.number().int().min(0).max(20_000);

/** 금액은 원 단위 정수. */
const won = z.number().int().min(0);

// ---------------------------------------------------------------------------
// 주문 정보 (OrderEntity)
// ---------------------------------------------------------------------------

export const OrderEntitySchema = z.object({
  customerName: z.string(),
  contact: z.string(),
  address: z.string(),
  deliveryDate: z.string().optional(),
  projectName: z.string().optional(),
  consultDate: z.string().optional(),
  customerType: z.string().optional(),
  manager: z.string().optional(),
  layoutType: LayoutTypeSchema,
  dimensions: z.object({
    lowerCabinetLengthMm: millimeters,
    upperCabinetLengthMm: millimeters,
    islandLengthMm: millimeters.optional(),
    tallCabinetWidthMm: millimeters.optional(),
    fridgeCabinetWidthMm: millimeters.optional(),
    depthMm: millimeters,
    heightMm: millimeters,
    countertopThicknessMm: millimeters,
  }),
  doorOption: z.object({
    material: z.string(),
    color: z.string(),
    handleType: HandleTypeSchema,
    edgeFinish: z.string(),
  }),
  countertopOption: z.object({
    brand: z.string(),
    model: z.string(),
    thickness: z.string(),
    edgeType: z.string(),
  }),
  modules: z.object({
    drawerCount2Tier: z.number().int().min(0),
    drawerCount3Tier: z.number().int().min(0),
    sinkCabinetCount: z.number().int().min(0),
    cooktopCabinetCount: z.number().int().min(0),
    spiceRackCount: z.number().int().min(0),
    cornerModuleCount: z.number().int().min(0),
    riceCookerModuleCount: z.number().int().min(0),
  }),
  appliances: z.object({
    sinkBowlModel: z.string(),
    faucetModel: z.string(),
    hoodModel: z.string(),
    cooktopModel: z.string(),
    customAppliances: z.string().optional(),
  }),
  siteConditions: z.object({
    floor: z.number().int(),
    hasElevator: z.boolean(),
    needsDemolition: z.boolean(),
    needsLadderTruck: z.boolean(),
    distanceKm: z.number().min(0).optional(),
    specialNotes: z.string().optional(),
  }),
  rawPrompt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 단가표 (PricingItem)
// ---------------------------------------------------------------------------

/** 단가 등록 요청. id·updatedAt 은 서버가 채웁니다. */
export const PricingItemInputSchema = z.object({
  code: z.string().optional(),
  category: ItemCategorySchema.optional(),
  name: z.string().min(1, '품목명을 입력해주세요.'),
  spec: z.string().optional(),
  material: z.string().optional(),
  unit: z.string().min(1, '단위를 입력해주세요.'),
  costPrice: won,
  sellingPrice: won,
  supplier: z.string().optional(),
  stockStatus: StockStatusSchema.optional(),
  notes: z.string().optional(),
});

/** 단가 수정 요청 — 보낸 필드만 반영합니다. */
export const PricingItemUpdateSchema = z.object({
  code: z.string().optional(),
  category: ItemCategorySchema.optional(),
  name: z.string().min(1).optional(),
  spec: z.string().optional(),
  material: z.string().optional(),
  unit: z.string().min(1).optional(),
  costPrice: won.optional(),
  sellingPrice: won.optional(),
  supplier: z.string().optional(),
  stockStatus: StockStatusSchema.optional(),
  notes: z.string().optional(),
});

/** 일괄 등록. 이 경로는 code 가 반드시 있어야 기존 품목과 대조할 수 있습니다. */
export const PricingBulkSchema = z.object({
  items: z
    .array(PricingItemInputSchema.extend({ code: z.string().min(1, '품목코드가 필요합니다.') }))
    .min(1, '일괄 등록할 항목 목록이 비어있습니다.'),
});

// ---------------------------------------------------------------------------
// 계산 결과 (QuoteCalculationResult)
// ---------------------------------------------------------------------------

export const QuoteBreakdownItemSchema = z.object({
  id: z.string(),
  category: ItemCategorySchema,
  code: z.string(),
  name: z.string(),
  spec: z.string(),
  formula: z.string(),
  unit: z.string(),
  quantity: z.number(),
  costUnitPrice: z.number(),
  costTotal: z.number(),
  sellingUnitPrice: z.number(),
  sellingTotal: z.number(),
  marginRate: z.number(),
  validationStatus: z.enum(['VALID', 'WARNING', 'ERROR']),
  validationMessage: z.string().optional(),
});

export const QuoteSummarySchema = z.object({
  carcassCost: z.number(),
  carcassSelling: z.number(),
  doorCost: z.number(),
  doorSelling: z.number(),
  countertopCost: z.number(),
  countertopSelling: z.number(),
  hardwareCost: z.number(),
  hardwareSelling: z.number(),
  applianceCost: z.number(),
  applianceSelling: z.number(),
  laborCost: z.number(),
  laborSelling: z.number(),
  accessoryCost: z.number(),
  accessorySelling: z.number(),
  totalManufacturingCost: z.number(),
  totalSellingPrice: z.number(),
  totalMarginAmount: z.number(),
  averageMarginRate: z.number(),
  vatAmount: z.number(),
  finalGrandTotal: z.number(),
});

export const ValidationItemSchema = z.object({
  type: z.enum(['ERROR', 'WARNING', 'INFO']),
  field: z.string(),
  message: z.string(),
  suggestion: z.string().optional(),
});

export const PricingItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  category: ItemCategorySchema,
  name: z.string(),
  spec: z.string(),
  material: z.string(),
  unit: z.string(),
  costPrice: z.number(),
  sellingPrice: z.number(),
  supplier: z.string(),
  stockStatus: StockStatusSchema,
  notes: z.string().optional(),
  updatedAt: z.string(),
});

export const QuoteCalculationResultSchema = z.object({
  breakdowns: z.array(QuoteBreakdownItemSchema),
  summary: QuoteSummarySchema,
  validationReport: z.array(ValidationItemSchema),
  appliedPricingSnapshot: z.record(z.string(), PricingItemSchema),
  calculatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// 견적서 발행 (QuoteDocument)
// ---------------------------------------------------------------------------

export const QuotePublishMetaSchema = z.object({
  validUntilDays: z.number().int().min(0),
  paymentTerms: z.string(),
  exclusions: z.string(),
  specialTerms: z.string(),
  internalMemo: z.string(),
  hiddenBreakdownIds: z.array(z.string()),
});

export const SaveQuoteSchema = z.object({
  title: z.string().optional(),
  status: QuoteStatusSchema.optional(),
  targetMarginRate: z.coerce.number().optional(),
  orderEntity: OrderEntitySchema,
  calculationResult: QuoteCalculationResultSchema,
  notes: z.string().optional(),
  quoteNumber: z.string().optional(),
  version: z.coerce.number().int().min(1).optional(),
  parentQuoteId: z.string().optional(),
  publishMeta: QuotePublishMetaSchema.optional(),
  draftId: z.string().optional(),
});

export const UpdateQuoteSchema = z.object({
  title: z.string().optional(),
  status: QuoteStatusSchema.optional(),
  notes: z.string().optional(),
  publishMeta: QuotePublishMetaSchema.optional(),
});

// ---------------------------------------------------------------------------
// 견적 초안 (Draft)
// ---------------------------------------------------------------------------

export const ReviewLineItemSchema = z.object({
  id: z.string(),
  category: ItemCategorySchema,
  name: z.string(),
  spec: z.string(),
  quantity: z.number(),
  unit: z.string(),
  status: ReviewItemStatusSchema,
  linkedPricingId: z.string().nullable().optional(),
  source: z.enum(['AI', 'MANUAL']),
});

export const AttachedFileMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  sizeLabel: z.string(),
  uploadedAt: z.string(),
  kind: z.enum(['도면', '이미지', '메모']),
});

export const DraftPayloadSchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  promptText: z.string(),
  attachedFiles: z.array(AttachedFileMetaSchema),
  orderEntity: OrderEntitySchema,
  reviewItems: z.array(ReviewLineItemSchema),
  targetMarginRate: z.number(),
  calculationResult: QuoteCalculationResultSchema.nullable(),
  quoteTitle: z.string(),
  publishMeta: QuotePublishMetaSchema,
});

export const CreateDraftSchema = z.object({
  payload: DraftPayloadSchema,
  editorId: z.string().optional(),
});

export const SaveDraftSchema = z.object({
  revision: z.number().int().min(1, 'revision 이 필요합니다.'),
  payload: DraftPayloadSchema,
  label: z.string().optional(),
  editorId: z.string().optional(),
});

export const RestoreDraftSchema = z.object({
  revision: z.coerce.number().int().min(1),
  editorId: z.string().optional(),
});

export const DraftListQuerySchema = z.object({
  status: z.union([DraftStatusSchema, z.literal('ALL')]).optional().default('ACTIVE'),
});

// ---------------------------------------------------------------------------
// 원가 계산
// ---------------------------------------------------------------------------

export const CalculateQuoteSchema = z.object({
  orderEntity: OrderEntitySchema,
});

// ---------------------------------------------------------------------------
// AI 파싱
// ---------------------------------------------------------------------------

export const ParseOrderSchema = z.object({
  prompt: z.string().optional().default(''),
  base64Image: z.string().optional(),
  mimeType: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 응답 스키마
//
// 클라이언트가 서버 응답을 이 스키마로 검증합니다. 지금까지는
// `fetchJson<{ data: QuoteDraft }>` 처럼 제네릭만 적어 두었는데, 그 제네릭은
// 서버가 실제로 무엇을 돌려주는지와 무관하게 컴파일을 통과했습니다.
// (실제로 클라이언트·서버 라우트가 어긋나 404 가 났던 적이 있습니다.)
// ---------------------------------------------------------------------------

export const CompanyInfoSchema = z.object({
  name: z.string(),
  representative: z.string(),
  bizNumber: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
});

export const QuoteDocumentSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: QuoteStatusSchema,
  targetMarginRate: z.number(),
  version: z.number().optional(),
  parentQuoteId: z.string().optional(),
  publishMeta: QuotePublishMetaSchema.optional(),
  orderEntity: OrderEntitySchema,
  calculationResult: QuoteCalculationResultSchema,
  appliedPricingSnapshot: z.array(PricingItemSchema).optional(),
  notes: z.string().optional(),
  companyInfo: CompanyInfoSchema,
});

export const QuoteDraftRevisionSchema = z.object({
  revision: z.number(),
  savedAt: z.string(),
  label: z.string(),
  payload: DraftPayloadSchema,
});

export const QuoteDraftSchema = z.object({
  id: z.string(),
  revision: z.number(),
  status: DraftStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastEditorId: z.string(),
  payload: DraftPayloadSchema,
  history: z.array(QuoteDraftRevisionSchema),
  pricingFingerprint: z.string().nullable(),
  publishedQuoteIds: z.array(z.string()),
});

export const QuoteDraftSummarySchema = z.object({
  id: z.string(),
  revision: z.number(),
  status: DraftStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  customerName: z.string(),
  projectName: z.string(),
  quoteTitle: z.string(),
  itemCount: z.number(),
  totalAmount: z.number().nullable(),
  publishedQuoteIds: z.array(z.string()),
});

/** 모든 성공 응답은 `{ success: true, data }` 봉투에 담겨 옵니다. */
const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.literal(true), data });

export const PricingListResponse = envelope(z.array(PricingItemSchema)).extend({
  count: z.number().optional(),
});
export const PricingItemResponse = envelope(PricingItemSchema);
export const PricingFingerprintResponse = envelope(z.object({ fingerprint: z.string() }));
export const QuoteListResponse = envelope(z.array(QuoteDocumentSchema)).extend({
  count: z.number().optional(),
});
export const QuoteResponse = envelope(QuoteDocumentSchema);
export const CalculationResponse = envelope(QuoteCalculationResultSchema);
export const OrderEntityResponse = envelope(OrderEntitySchema);
export const DraftListResponse = envelope(z.array(QuoteDraftSummarySchema));
export const DraftResponse = envelope(QuoteDraftSchema).extend({
  meta: z
    .object({
      currentPricingFingerprint: z.string(),
      pricingChanged: z.boolean(),
    })
    .optional(),
});
export const SuccessResponse = z.object({ success: z.boolean() });

// ---------------------------------------------------------------------------
// 스키마 ↔ 도메인 타입 대조
//
// 아래 줄들은 런타임에 아무 일도 하지 않습니다. 스키마가 통과시킨 값이
// types.ts 의 타입으로 그대로 쓰일 수 있는지를 컴파일 시점에 확인할 뿐입니다.
// 한쪽만 고치면 여기서 타입 오류가 나므로 두 정의가 어긋난 채로 배포되지 않습니다.
// ---------------------------------------------------------------------------

type AssertAssignable<Target, _Source extends Target> = true;

export type _OrderEntityMatches = AssertAssignable<OrderEntity, z.infer<typeof OrderEntitySchema>>;
export type _PricingItemMatches = AssertAssignable<PricingItem, z.infer<typeof PricingItemSchema>>;
export type _ReviewLineItemMatches = AssertAssignable<ReviewLineItem, z.infer<typeof ReviewLineItemSchema>>;
export type _PublishMetaMatches = AssertAssignable<QuotePublishMeta, z.infer<typeof QuotePublishMetaSchema>>;
export type _CalculationResultMatches = AssertAssignable<
  QuoteCalculationResult,
  z.infer<typeof QuoteCalculationResultSchema>
>;
export type _DraftPayloadMatches = AssertAssignable<DraftPayload, z.infer<typeof DraftPayloadSchema>>;
