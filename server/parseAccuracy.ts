/**
 * AI 파싱 정확도 측정 로직 (순수 함수 계층)
 *
 * Gemini 가 뽑아준 OrderEntity 와, 사람이 규격 검수/발행 단계에서 확정한
 * OrderEntity 를 필드 단위로 대조해 "무엇을 얼마나 고쳤는지"를 계산합니다.
 *
 * 여기에는 DB·네트워크 의존이 없습니다. 판정 규칙이 곧 지표의 정의이므로
 * 단위 테스트(parseAccuracy.test.ts)로 고정해두고, 저장은 db.ts 가 맡습니다.
 */
import { OrderEntity, ParseFieldDiff, ParseFieldVerdict } from '../src/types.js';

/** 지표에 잡히는 필드 하나의 정의 */
export interface TrackedField {
  /** 점 표기 경로 (예: dimensions.lowerCabinetLengthMm) */
  path: string;
  /** 통계 화면에 그대로 노출되는 한글 이름 */
  label: string;
  /** 묶음 단위 집계용 그룹 */
  group: '고객정보' | '치수' | '도어' | '상판' | '모듈' | '기기' | '현장조건';
  /**
   * 값이 비어도 정상인 필드인지 (예: 아일랜드 길이, 담당자).
   * 양쪽 모두 비어 있으면 판정 대상에서 제외해 분모를 부풀리지 않습니다.
   */
  optional?: boolean;
}

/**
 * 정확도 추적 대상 필드.
 *
 * rawPrompt 처럼 AI 가 만들어내는 값이 아니거나, specialNotes 처럼 자유 서술이라
 * 문자열 대조가 무의미한 값은 일부러 제외했습니다.
 */
export const TRACKED_FIELDS: TrackedField[] = [
  { path: 'customerName', label: '고객명', group: '고객정보' },
  { path: 'contact', label: '연락처', group: '고객정보' },
  { path: 'address', label: '현장주소', group: '고객정보' },
  { path: 'deliveryDate', label: '희망 시공일', group: '고객정보', optional: true },
  { path: 'projectName', label: '프로젝트명', group: '고객정보', optional: true },
  { path: 'consultDate', label: '상담일', group: '고객정보', optional: true },
  { path: 'customerType', label: '고객 유형', group: '고객정보', optional: true },
  { path: 'manager', label: '담당자', group: '고객정보', optional: true },

  { path: 'layoutType', label: '주방 형태', group: '치수' },
  { path: 'dimensions.lowerCabinetLengthMm', label: '하부장 길이', group: '치수' },
  { path: 'dimensions.upperCabinetLengthMm', label: '상부장 길이', group: '치수' },
  { path: 'dimensions.islandLengthMm', label: '아일랜드 길이', group: '치수', optional: true },
  { path: 'dimensions.tallCabinetWidthMm', label: '키큰장 폭', group: '치수', optional: true },
  { path: 'dimensions.fridgeCabinetWidthMm', label: '냉장고장 폭', group: '치수', optional: true },
  { path: 'dimensions.depthMm', label: '하부장 깊이', group: '치수' },
  { path: 'dimensions.heightMm', label: '하부장 높이', group: '치수' },
  { path: 'dimensions.countertopThicknessMm', label: '상판 두께(mm)', group: '치수' },

  { path: 'doorOption.material', label: '도어 재질', group: '도어' },
  { path: 'doorOption.color', label: '도어 색상', group: '도어' },
  { path: 'doorOption.handleType', label: '손잡이 방식', group: '도어' },
  { path: 'doorOption.edgeFinish', label: '엣지 마감', group: '도어', optional: true },

  { path: 'countertopOption.brand', label: '상판 브랜드', group: '상판' },
  { path: 'countertopOption.model', label: '상판 모델', group: '상판' },
  { path: 'countertopOption.thickness', label: '상판 두께(표기)', group: '상판' },
  { path: 'countertopOption.edgeType', label: '상판 엣지 가공', group: '상판', optional: true },

  { path: 'modules.drawerCount2Tier', label: '2단 서랍장 수', group: '모듈' },
  { path: 'modules.drawerCount3Tier', label: '3단 서랍장 수', group: '모듈' },
  { path: 'modules.sinkCabinetCount', label: '싱크 하부장 수', group: '모듈' },
  { path: 'modules.cooktopCabinetCount', label: '쿡탑 하부장 수', group: '모듈' },
  { path: 'modules.spiceRackCount', label: '양념망장 수', group: '모듈' },
  { path: 'modules.cornerModuleCount', label: '코너선반 수', group: '모듈' },
  { path: 'modules.riceCookerModuleCount', label: '밥솥장 수', group: '모듈' },

  { path: 'appliances.sinkBowlModel', label: '싱크볼 모델', group: '기기' },
  { path: 'appliances.faucetModel', label: '수전 모델', group: '기기' },
  { path: 'appliances.hoodModel', label: '후드 모델', group: '기기' },
  { path: 'appliances.cooktopModel', label: '쿡탑 모델', group: '기기' },

  { path: 'siteConditions.floor', label: '층수', group: '현장조건' },
  { path: 'siteConditions.hasElevator', label: '엘리베이터 유무', group: '현장조건' },
  { path: 'siteConditions.needsDemolition', label: '철거 필요', group: '현장조건' },
  { path: 'siteConditions.needsLadderTruck', label: '사다리차 필요', group: '현장조건' },
];

const FIELD_BY_PATH = new Map(TRACKED_FIELDS.map((f) => [f.path, f]));

/**
 * 필드 한 건의 판정 결과.
 * MATCHED: AI 값을 그대로 채택 / CORRECTED: 사람이 다른 값으로 고침 /
 * MISSING: AI 가 비워둔 자리를 사람이 채움
 */
export type FieldVerdict = ParseFieldVerdict;

/** 화면·API 로 나가는 모양은 types.ts 의 ParseFieldDiff 와 같습니다. */
export interface FieldDiff extends ParseFieldDiff {
  group: TrackedField['group'];
}

export interface ParseDiffResult {
  /** 판정 대상 필드 수 (양쪽 다 빈 선택 필드는 제외) */
  trackedCount: number;
  matchedCount: number;
  correctedCount: number;
  missingCount: number;
  /** 수정률 = 고친 필드 / 판정 대상 필드 */
  correctionRate: number;
  /** 정확도 = 그대로 채택한 필드 / 판정 대상 필드 */
  accuracyRate: number;
  /** MATCHED 가 아닌 필드만 (원인 분석용) */
  diffs: FieldDiff[];
}

export function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), source);
}

/**
 * 비교 전 값 정규화.
 *
 * 사람이 실제로 고치지 않았는데도 수정으로 잡히는 잡음(앞뒤 공백, 중복 공백,
 * 숫자를 문자열로 받은 경우)을 걷어냅니다. 대소문자는 제품명 구분에 의미가
 * 있어 그대로 둡니다.
 */
export function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (trimmed === '') return null;
    // "3400" 과 3400 을 같은 값으로 본다.
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }
  return JSON.stringify(value);
}

/** 값이 사실상 비어 있는지 (null / undefined / 빈 문자열) */
function isBlank(value: string | number | boolean | null): boolean {
  return value === null;
}

/**
 * AI 파싱 결과와 사람이 확정한 값을 대조합니다.
 *
 * 판정 규칙:
 * - 두 값이 같으면 MATCHED
 * - AI 가 값을 냈는데 다르면 CORRECTED (= 수정률에 잡히는 지점)
 * - AI 가 비웠는데 사람이 채웠으면 MISSING (미추출. 오답과 구분해 셉니다)
 * - 선택 필드에서 양쪽 다 비었으면 판정 대상에서 제외
 */
export function diffOrderEntity(
  parsed: Partial<OrderEntity> | null | undefined,
  confirmed: Partial<OrderEntity> | null | undefined
): ParseDiffResult {
  const diffs: FieldDiff[] = [];
  let trackedCount = 0;
  let matchedCount = 0;
  let correctedCount = 0;
  let missingCount = 0;

  for (const field of TRACKED_FIELDS) {
    const parsedValue = normalizeValue(getByPath(parsed, field.path));
    const confirmedValue = normalizeValue(getByPath(confirmed, field.path));

    // 양쪽 모두 비어 있는 선택 필드는 애초에 다룬 적 없는 값이므로 분모에서 뺀다.
    if (field.optional && isBlank(parsedValue) && isBlank(confirmedValue)) continue;

    trackedCount += 1;

    if (parsedValue === confirmedValue) {
      matchedCount += 1;
      continue;
    }

    const verdict: FieldVerdict = isBlank(parsedValue) ? 'MISSING' : 'CORRECTED';
    if (verdict === 'MISSING') missingCount += 1;
    else correctedCount += 1;

    diffs.push({
      path: field.path,
      label: field.label,
      group: field.group,
      verdict,
      parsed: getByPath(parsed, field.path) ?? null,
      confirmed: getByPath(confirmed, field.path) ?? null,
    });
  }

  const rate = (n: number) => (trackedCount === 0 ? 0 : Math.round((n / trackedCount) * 1000) / 1000);

  return {
    trackedCount,
    matchedCount,
    correctedCount,
    missingCount,
    correctionRate: rate(correctedCount),
    accuracyRate: rate(matchedCount),
    diffs,
  };
}

// ---------------------------------------------------------------------------
// 여러 건의 파싱 로그를 모아 보는 집계
// ---------------------------------------------------------------------------

/** 집계 입력 — DB row 든 메모리 값이든 이 모양이면 됩니다. */
export interface ParseLogSample {
  engine: string;
  trackedCount: number;
  matchedCount: number;
  correctedCount: number;
  missingCount: number;
  diffs: FieldDiff[];
}

export interface FieldStat {
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

export interface ParseAccuracyStats {
  sampleCount: number;
  trackedCount: number;
  matchedCount: number;
  correctedCount: number;
  missingCount: number;
  correctionRate: number;
  accuracyRate: number;
  /** 엔진별(GEMINI / HEURISTIC) 비교 — 폴백이 얼마나 자주 도는지도 함께 드러납니다. */
  byEngine: Array<{ engine: string; sampleCount: number; correctionRate: number; accuracyRate: number }>;
  /** 손이 많이 간 필드부터 — 프롬프트를 어디부터 고칠지 정하는 목록 */
  worstFields: FieldStat[];
}

export function summarizeParseLogs(samples: ParseLogSample[]): ParseAccuracyStats {
  const totals = { tracked: 0, matched: 0, corrected: 0, missing: 0 };
  const engineMap = new Map<string, { tracked: number; matched: number; corrected: number; samples: number }>();
  const fieldMap = new Map<string, { corrected: number; missing: number }>();

  for (const s of samples) {
    totals.tracked += s.trackedCount;
    totals.matched += s.matchedCount;
    totals.corrected += s.correctedCount;
    totals.missing += s.missingCount;

    const engine = engineMap.get(s.engine) ?? { tracked: 0, matched: 0, corrected: 0, samples: 0 };
    engine.tracked += s.trackedCount;
    engine.matched += s.matchedCount;
    engine.corrected += s.correctedCount;
    engine.samples += 1;
    engineMap.set(s.engine, engine);

    for (const d of s.diffs ?? []) {
      const stat = fieldMap.get(d.path) ?? { corrected: 0, missing: 0 };
      if (d.verdict === 'CORRECTED') stat.corrected += 1;
      else if (d.verdict === 'MISSING') stat.missing += 1;
      fieldMap.set(d.path, stat);
    }
  }

  const rate = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 1000);

  // 필드별 분모는 표본 수로 둔다. 필수 필드는 항상 판정되므로 정확하고,
  // 선택 필드는 분모가 다소 크게 잡혀 수정률이 보수적으로(낮게) 나온다.
  const worstFields: FieldStat[] = [...fieldMap.entries()]
    .map(([path, stat]) => {
      const def = FIELD_BY_PATH.get(path);
      return {
        path,
        label: def?.label ?? path,
        group: def?.group ?? '기타',
        observed: samples.length,
        corrected: stat.corrected,
        missing: stat.missing,
        correctionRate: rate(stat.corrected, samples.length),
        missingRate: rate(stat.missing, samples.length),
      };
    })
    .sort((a, b) => b.corrected + b.missing - (a.corrected + a.missing));

  return {
    sampleCount: samples.length,
    trackedCount: totals.tracked,
    matchedCount: totals.matched,
    correctedCount: totals.corrected,
    missingCount: totals.missing,
    correctionRate: rate(totals.corrected, totals.tracked),
    accuracyRate: rate(totals.matched, totals.tracked),
    byEngine: [...engineMap.entries()].map(([engine, v]) => ({
      engine,
      sampleCount: v.samples,
      correctionRate: rate(v.corrected, v.tracked),
      accuracyRate: rate(v.matched, v.tracked),
    })),
    worstFields,
  };
}
