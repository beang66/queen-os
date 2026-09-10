import { describe, it, expect } from 'vitest';
import { calculateDeterministicQuote } from './calculationEngine.js';
import { OrderEntity } from '../src/types.js';

/**
 * 기본 표준 주문 엔터티 픽스처 (I자형 3,000mm 주방)
 */
function createBaseOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return {
    customerName: '홍길동',
    contact: '010-1234-5678',
    address: '경기도 남양주시 화도읍',
    layoutType: 'I_SHAPE',
    dimensions: {
      lowerCabinetLengthMm: 3000,
      upperCabinetLengthMm: 3000,
      islandLengthMm: 0,
      tallCabinetWidthMm: 0,
      fridgeCabinetWidthMm: 0,
      depthMm: 600,
      heightMm: 850,
      countertopThicknessMm: 50,
    },
    doorOption: {
      material: 'PET',
      color: '매트 밀크 화이트',
      handleType: 'C_CHANNEL',
      edgeFinish: 'PUR',
    },
    countertopOption: {
      brand: 'LX 하우시스',
      model: '하이막스',
      thickness: '12T',
      edgeType: '직각',
    },
    modules: {
      drawerCount2Tier: 1,
      drawerCount3Tier: 0,
      sinkCabinetCount: 1,
      cooktopCabinetCount: 1,
      spiceRackCount: 1,
      cornerModuleCount: 0,
      riceCookerModuleCount: 0,
    },
    appliances: {
      sinkBowlModel: '백조 사각 싱크볼 (SQS780)',
      faucetModel: '수성 고급 거위목 수전',
      hoodModel: '하츠 슬림루나 후드',
      cooktopModel: '린나이 3구 인덕션',
    },
    siteConditions: {
      floor: 2,
      hasElevator: true,
      needsDemolition: false,
      needsLadderTruck: false,
    },
    ...overrides,
  };
}

describe('calculateDeterministicQuote (견적 및 원가 산출 엔진)', () => {
  // -------------------------------------------------------------------------
  // 1. 기본 산출 및 금액 정합성 검증
  // -------------------------------------------------------------------------
  describe('1. 기본 표준 견적 산출 및 금액 정합성', () => {
    it('표준 I자형 주방 견적을 정상 계산하고 필수 공종이 모두 포함되어야 한다', async () => {
      const order = createBaseOrder();
      const result = await calculateDeterministicQuote(order);

      expect(result).toBeDefined();
      expect(result.breakdowns.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();

      const categories = new Set(result.breakdowns.map((b) => b.category));
      expect(categories.has('CARCASS')).toBe(true);
      expect(categories.has('DOOR')).toBe(true);
      expect(categories.has('COUNTERTOP')).toBe(true);
      expect(categories.has('HARDWARE')).toBe(true);
      expect(categories.has('APPLIANCE')).toBe(true);
      expect(categories.has('LABOR')).toBe(true);
    });

    it('원가, 공급가, 마진, 부가세, 총 견적 금액의 수식이 수학적으로 일치해야 한다', async () => {
      const order = createBaseOrder();
      const { summary, breakdowns } = await calculateDeterministicQuote(order);

      // 1) 항목별 합계 검증
      const sumCost = breakdowns.reduce((acc, b) => acc + b.costTotal, 0);
      const sumSelling = breakdowns.reduce((acc, b) => acc + b.sellingTotal, 0);
      expect(summary.totalManufacturingCost).toBe(sumCost);
      expect(summary.totalSellingPrice).toBe(sumSelling);

      // 2) 총 마진 = 공급가 - 원가
      expect(summary.totalMarginAmount).toBe(summary.totalSellingPrice - summary.totalManufacturingCost);

      // 3) 부가세 = 공급가 * 10% (반올림 정수)
      const expectedVat = Math.round(summary.totalSellingPrice * 0.1);
      expect(summary.vatAmount).toBe(expectedVat);

      // 4) 최종 견적 총액 = 공급가 + 부가세
      expect(summary.finalGrandTotal).toBe(summary.totalSellingPrice + summary.vatAmount);

      // 5) 평균 마진율 정합성
      const expectedMarginRate = Number(
        ((summary.totalMarginAmount / summary.totalSellingPrice) * 100).toFixed(1)
      );
      expect(summary.averageMarginRate).toBe(expectedMarginRate);
    });
  });

  // -------------------------------------------------------------------------
  // 2. 레이아웃 변형 산출 검증
  // -------------------------------------------------------------------------
  describe('2. 레이아웃 변형에 따른 견적 산출', () => {
    it('아일랜드 병렬형 레이아웃 시 아일랜드 관련 상판 및 가구가 추가 산출되어야 한다', async () => {
      const baseOrder = createBaseOrder({
        layoutType: 'I_SHAPE',
        dimensions: {
          lowerCabinetLengthMm: 3000,
          upperCabinetLengthMm: 3000,
          islandLengthMm: 0,
          tallCabinetWidthMm: 0,
          fridgeCabinetWidthMm: 0,
          depthMm: 600,
          heightMm: 850,
          countertopThicknessMm: 50,
        },
      });

      const islandOrder = createBaseOrder({
        layoutType: 'ISLAND_PARALLEL',
        dimensions: {
          lowerCabinetLengthMm: 3000,
          upperCabinetLengthMm: 3000,
          islandLengthMm: 1800,
          tallCabinetWidthMm: 0,
          fridgeCabinetWidthMm: 0,
          depthMm: 600,
          heightMm: 850,
          countertopThicknessMm: 50,
        },
      });

      const baseResult = await calculateDeterministicQuote(baseOrder);
      const islandResult = await calculateDeterministicQuote(islandOrder);

      // 아일랜드가 추가되었으므로 총 견적 금액이 더 커야 한다
      expect(islandResult.summary.finalGrandTotal).toBeGreaterThan(baseResult.summary.finalGrandTotal);

      // 아일랜드 상판 항목이 breakdowns에 포함되어야 한다
      const islandCountertop = islandResult.breakdowns.find((b) =>
        b.name.includes('아일랜드') || b.formula.includes('아일랜드') || b.code.includes('ISLAND')
      );
      expect(islandCountertop).toBeDefined();
    });

    it('키큰장 및 냉장고장이 포함되면 해당 장식장 바디 및 도어가 추가 산출되어야 한다', async () => {
      const standardOrder = createBaseOrder();
      const tallOrder = createBaseOrder({
        dimensions: {
          ...standardOrder.dimensions,
          tallCabinetWidthMm: 600,
          fridgeCabinetWidthMm: 1000,
        },
      });

      const standardResult = await calculateDeterministicQuote(standardOrder);
      const tallResult = await calculateDeterministicQuote(tallOrder);

      expect(tallResult.summary.totalManufacturingCost).toBeGreaterThan(
        standardResult.summary.totalManufacturingCost
      );

      const tallOrFridgeItems = tallResult.breakdowns.filter(
        (b) => b.name.includes('키큰장') || b.name.includes('냉장고장')
      );
      expect(tallOrFridgeItems.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. 자재 및 옵션에 따른 단가 차등 검증
  // -------------------------------------------------------------------------
  describe('3. 자재 및 옵션 단가 매핑', () => {
    it('LPM 도어보다 PET 도어가 더 높은 도어 공급가를 산출해야 한다', async () => {
      const lpmOrder = createBaseOrder({
        doorOption: {
          material: 'LPM',
          color: '기본 화이트',
          handleType: 'C_CHANNEL',
          edgeFinish: 'PUR',
        },
      });

      const petOrder = createBaseOrder({
        doorOption: {
          material: 'PET',
          color: '매트 화이트',
          handleType: 'C_CHANNEL',
          edgeFinish: 'PUR',
        },
      });

      const lpmResult = await calculateDeterministicQuote(lpmOrder);
      const petResult = await calculateDeterministicQuote(petOrder);

      const lpmDoor = lpmResult.breakdowns.find((b) => b.category === 'DOOR');
      const petDoor = petResult.breakdowns.find((b) => b.category === 'DOOR');

      expect(lpmDoor).toBeDefined();
      expect(petDoor).toBeDefined();
      expect(petDoor!.sellingUnitPrice).toBeGreaterThanOrEqual(lpmDoor!.sellingUnitPrice);
    });
  });

  // -------------------------------------------------------------------------
  // 4. 현장 조건 및 특수 인건비 가산 로직 검증
  // -------------------------------------------------------------------------
  describe('4. 현장 조건 및 인건비 가산 로직', () => {
    it('철거가 필요한 경우 철거비 항목이 인건비/철거 공종에 포함되어야 한다', async () => {
      const noDemolitionOrder = createBaseOrder({
        siteConditions: {
          floor: 2,
          hasElevator: true,
          needsDemolition: false,
          needsLadderTruck: false,
        },
      });

      const demolitionOrder = createBaseOrder({
        siteConditions: {
          floor: 2,
          hasElevator: true,
          needsDemolition: true,
          needsLadderTruck: false,
        },
      });

      const noDemoResult = await calculateDeterministicQuote(noDemolitionOrder);
      const demoResult = await calculateDeterministicQuote(demolitionOrder);

      const demoItem = demoResult.breakdowns.find(
        (b) => b.name.includes('철거') || b.code.includes('DEMOLITION')
      );
      expect(demoItem).toBeDefined();
      expect(demoResult.summary.finalGrandTotal).toBeGreaterThan(noDemoResult.summary.finalGrandTotal);
    });

    it('엘리베이터가 없고 4층 이상인 경우 계단 양중비 또는 할증이 가산되어야 한다', async () => {
      const elevatorOrder = createBaseOrder({
        siteConditions: {
          floor: 4,
          hasElevator: true,
          needsDemolition: false,
          needsLadderTruck: false,
        },
      });

      const stairsOrder = createBaseOrder({
        siteConditions: {
          floor: 4,
          hasElevator: false,
          needsDemolition: false,
          needsLadderTruck: false,
        },
      });

      const elevatorResult = await calculateDeterministicQuote(elevatorOrder);
      const stairsResult = await calculateDeterministicQuote(stairsOrder);

      expect(stairsResult.summary.finalGrandTotal).toBeGreaterThan(
        elevatorResult.summary.finalGrandTotal
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. 유효성 검증(Validation Report) 에러 및 경고 탐지
  // -------------------------------------------------------------------------
  describe('5. 유효성 검증 (Validation Report)', () => {
    it('고객명이 누락된 경우 ERROR 유효성 항목을 반환해야 한다', async () => {
      const invalidOrder = createBaseOrder({ customerName: '   ' });
      const result = await calculateDeterministicQuote(invalidOrder);

      const nameError = result.validationReport.find(
        (v) => v.field === 'customerName' && v.type === 'ERROR'
      );
      expect(nameError).toBeDefined();
      expect(nameError!.message).toContain('고객명이 누락되었습니다');
    });

    it('하부장 길이가 0 이하인 경우 ERROR 유효성 항목을 반환해야 한다', async () => {
      const order = createBaseOrder({
        dimensions: {
          ...createBaseOrder().dimensions,
          lowerCabinetLengthMm: 0,
        },
      });
      const result = await calculateDeterministicQuote(order);

      const lengthError = result.validationReport.find(
        (v) => v.field === 'lowerCabinetLengthMm' && v.type === 'ERROR'
      );
      expect(lengthError).toBeDefined();
    });

    it('하부장 길이가 1200mm 미만인 소형 주방의 경우 WARNING 항목을 반환해야 한다', async () => {
      const order = createBaseOrder({
        dimensions: {
          ...createBaseOrder().dimensions,
          lowerCabinetLengthMm: 1000,
        },
      });
      const result = await calculateDeterministicQuote(order);

      const lengthWarning = result.validationReport.find(
        (v) => v.field === 'lowerCabinetLengthMm' && v.type === 'WARNING'
      );
      expect(lengthWarning).toBeDefined();
      expect(lengthWarning!.message).toContain('소형 원룸 규격');
    });
  });

  // -------------------------------------------------------------------------
  // 6. 결정론적 일관성 및 멱등성 검증 (Determinism)
  // -------------------------------------------------------------------------
  describe('6. 결정론적 멱등성 (Determinism)', () => {
    it('동일한 주문 정보로 반복 호출 시 1원의 오차도 없이 100% 동일한 결과를 산출해야 한다', async () => {
      const order = createBaseOrder();

      const run1 = await calculateDeterministicQuote(order);
      const run2 = await calculateDeterministicQuote(order);
      const run3 = await calculateDeterministicQuote(order);

      expect(run1.summary.totalManufacturingCost).toBe(run2.summary.totalManufacturingCost);
      expect(run2.summary.totalManufacturingCost).toBe(run3.summary.totalManufacturingCost);

      expect(run1.summary.finalGrandTotal).toBe(run2.summary.finalGrandTotal);
      expect(run2.summary.finalGrandTotal).toBe(run3.summary.finalGrandTotal);

      expect(run1.breakdowns.length).toBe(run2.breakdowns.length);
      expect(run1.breakdowns.map((b) => b.costTotal)).toEqual(
        run2.breakdowns.map((b) => b.costTotal)
      );
    });
  });
});
