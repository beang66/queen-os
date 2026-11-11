import { describe, it, expect } from 'vitest';
import {
  diffOrderEntity,
  normalizeValue,
  summarizeParseLogs,
  TRACKED_FIELDS,
} from './parseAccuracy.js';
import { OrderEntity } from '../src/types.js';

/** AI 가 뽑아낸 기준 주문 엔터티 (I자형 3,400mm) */
function createParsedOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return {
    customerName: '김예시 고객님',
    contact: '010-0000-0001',
    address: '서울시 서초구 예시로 100',
    deliveryDate: '2026-09-20',
    layoutType: 'I_SHAPE',
    dimensions: {
      lowerCabinetLengthMm: 3400,
      upperCabinetLengthMm: 3400,
      islandLengthMm: 0,
      tallCabinetWidthMm: 0,
      fridgeCabinetWidthMm: 1050,
      depthMm: 600,
      heightMm: 850,
      countertopThicknessMm: 12,
    },
    doorOption: {
      material: '한솔 E0 PET 무광 매트 화이트',
      color: '매트 화이트',
      handleType: 'C_CHANNEL',
      edgeFinish: '1.2T 방수 PUR 엣지',
    },
    countertopOption: {
      brand: 'LX 하이막스',
      model: '오로라 비앙코 12T',
      thickness: '12T',
      edgeType: '사각 빗각 가공',
    },
    modules: {
      drawerCount2Tier: 1,
      drawerCount3Tier: 1,
      sinkCabinetCount: 1,
      cooktopCabinetCount: 1,
      spiceRackCount: 1,
      cornerModuleCount: 0,
      riceCookerModuleCount: 0,
    },
    appliances: {
      sinkBowlModel: '백조 그랜드 860 사각싱크볼',
      faucetModel: '더죤테크 슈티에 거위목 수전 (니켈)',
      hoodModel: '하츠 스퀘어 후드 900 (DTR-90S)',
      cooktopModel: 'SK매직 3구 인덕션',
    },
    siteConditions: {
      floor: 8,
      hasElevator: true,
      needsDemolition: true,
      needsLadderTruck: false,
    },
    rawPrompt: '반포 샘플아파트 주방 견적 문의드립니다',
    ...overrides,
  };
}

describe('normalizeValue', () => {
  it('앞뒤·중복 공백은 수정으로 보지 않는다', () => {
    expect(normalizeValue('  매트  화이트 ')).toBe('매트 화이트');
  });

  it('숫자를 문자열로 받은 경우도 같은 값으로 본다', () => {
    expect(normalizeValue('3400')).toBe(normalizeValue(3400));
  });

  it('빈 문자열과 미입력은 모두 빈 값이다', () => {
    expect(normalizeValue('   ')).toBeNull();
    expect(normalizeValue(undefined)).toBeNull();
    expect(normalizeValue(null)).toBeNull();
  });
});

describe('diffOrderEntity', () => {
  it('사람이 손대지 않으면 수정률 0, 정확도 1', () => {
    const parsed = createParsedOrder();
    const result = diffOrderEntity(parsed, parsed);

    expect(result.correctedCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.correctionRate).toBe(0);
    expect(result.accuracyRate).toBe(1);
    expect(result.diffs).toHaveLength(0);
  });

  it('값을 고친 필드만 CORRECTED 로 잡는다', () => {
    const parsed = createParsedOrder();
    const confirmed = createParsedOrder({
      dimensions: { ...parsed.dimensions, lowerCabinetLengthMm: 3600 },
      layoutType: 'L_SHAPE',
    });

    const result = diffOrderEntity(parsed, confirmed);

    expect(result.correctedCount).toBe(2);
    expect(result.missingCount).toBe(0);
    expect(result.diffs.map((d) => d.path).sort()).toEqual([
      'dimensions.lowerCabinetLengthMm',
      'layoutType',
    ]);
    expect(result.diffs.every((d) => d.verdict === 'CORRECTED')).toBe(true);
  });

  it('AI 가 비운 자리를 사람이 채우면 수정이 아니라 미추출(MISSING)로 센다', () => {
    const parsed = createParsedOrder({ deliveryDate: '' });
    const confirmed = createParsedOrder({ deliveryDate: '2026-10-05' });

    const result = diffOrderEntity(parsed, confirmed);

    expect(result.missingCount).toBe(1);
    expect(result.correctedCount).toBe(0);
    expect(result.diffs[0]).toMatchObject({ path: 'deliveryDate', verdict: 'MISSING' });
  });

  it('양쪽 모두 비어 있는 선택 필드는 분모에서 뺀다', () => {
    const withOptional = diffOrderEntity(
      createParsedOrder({ manager: '김주임' }),
      createParsedOrder({ manager: '김주임' })
    );
    const withoutOptional = diffOrderEntity(
      createParsedOrder({ manager: '' }),
      createParsedOrder({ manager: '' })
    );

    expect(withoutOptional.trackedCount).toBe(withOptional.trackedCount - 1);
  });

  it('공백 차이만 있으면 수정으로 세지 않는다', () => {
    const parsed = createParsedOrder();
    const confirmed = createParsedOrder({ customerName: ' 김예시  고객님 ' });

    expect(diffOrderEntity(parsed, confirmed).correctedCount).toBe(0);
  });

  it('폴백 결과가 통째로 틀린 경우에도 필드 수만큼만 집계된다', () => {
    const result = diffOrderEntity(createParsedOrder(), {} as OrderEntity);

    expect(result.trackedCount).toBeLessThanOrEqual(TRACKED_FIELDS.length);
    expect(result.matchedCount + result.correctedCount + result.missingCount).toBe(
      result.trackedCount
    );
  });
});

describe('summarizeParseLogs', () => {
  it('여러 건을 합쳐 전체 수정률과 엔진별 지표를 낸다', () => {
    const stats = summarizeParseLogs([
      {
        engine: 'GEMINI',
        trackedCount: 10,
        matchedCount: 9,
        correctedCount: 1,
        missingCount: 0,
        diffs: [
          { path: 'layoutType', label: '주방 형태', group: '치수', verdict: 'CORRECTED', parsed: 'I_SHAPE', confirmed: 'L_SHAPE' },
        ],
      },
      {
        engine: 'HEURISTIC',
        trackedCount: 10,
        matchedCount: 4,
        correctedCount: 5,
        missingCount: 1,
        diffs: [
          { path: 'layoutType', label: '주방 형태', group: '치수', verdict: 'CORRECTED', parsed: 'I_SHAPE', confirmed: 'U_SHAPE' },
          { path: 'contact', label: '연락처', group: '고객정보', verdict: 'MISSING', parsed: '', confirmed: '010-0000-0000' },
        ],
      },
    ]);

    expect(stats.sampleCount).toBe(2);
    expect(stats.correctionRate).toBe(0.3); // 6 / 20
    expect(stats.accuracyRate).toBe(0.65); // 13 / 20

    const gemini = stats.byEngine.find((e) => e.engine === 'GEMINI');
    const heuristic = stats.byEngine.find((e) => e.engine === 'HEURISTIC');
    expect(gemini?.correctionRate).toBe(0.1);
    expect(heuristic?.correctionRate).toBe(0.5);

    // 손이 가장 많이 간 필드가 맨 앞에 온다.
    expect(stats.worstFields[0].path).toBe('layoutType');
    expect(stats.worstFields[0].corrected).toBe(2);
  });

  it('표본이 없으면 0으로 떨어진다 (0 나눗셈 방지)', () => {
    const stats = summarizeParseLogs([]);
    expect(stats.correctionRate).toBe(0);
    expect(stats.accuracyRate).toBe(0);
    expect(stats.worstFields).toEqual([]);
  });
});
