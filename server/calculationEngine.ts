import {
  OrderEntity,
  PricingItem,
  QuoteBreakdownItem,
  QuoteCalculationResult,
  QuoteSummary,
  ValidationItem,
} from '../src/types.js';
import { db } from './db.js';

export function calculateDeterministicQuote(
  order: OrderEntity,
  customTargetMarginRate: number = 28
): QuoteCalculationResult {
  const allPricing = db.getPricingItems();
  const pricingMap = new Map<string, PricingItem>();
  allPricing.forEach((item) => {
    pricingMap.set(item.code, item);
  });

  const breakdowns: QuoteBreakdownItem[] = [];
  const validationReport: ValidationItem[] = [];
  const appliedPricingSnapshot: Record<string, PricingItem> = {};

  // Helper to lookup pricing item by code or category fallback
  const lookupItem = (
    code: string,
    fallbackCategory: string,
    fallbackName?: string
  ): PricingItem => {
    let item = pricingMap.get(code);
    if (!item && fallbackName) {
      item = allPricing.find(
        (p) =>
          p.name.toLowerCase().includes(fallbackName.toLowerCase()) ||
          fallbackName.toLowerCase().includes(p.name.toLowerCase())
      );
    }
    if (!item) {
      item = allPricing.find((p) => p.category === fallbackCategory);
    }

    if (item) {
      appliedPricingSnapshot[item.code] = { ...item };
      return item;
    }

    // If completely missing, generate placeholder and record validation warning
    validationReport.push({
      type: 'WARNING',
      field: code,
      message: `단가표에서 코드 '${code}' 또는 자재 '${fallbackName || fallbackCategory}'를 찾을 수 없어 임시 기본 단가를 적용했습니다.`,
      suggestion: '통합 단가표 DB에서 해당 자재를 등록하거나 코드를 매칭해주세요.',
    });

    const fallback: PricingItem = {
      id: `temp-${code}`,
      code,
      category: fallbackCategory as any,
      name: fallbackName || `임시 매칭 (${code})`,
      spec: '표준 규격',
      material: '표준 자재',
      unit: 'm',
      costPrice: 50000,
      sellingPrice: 80000,
      supplier: '퀸 퍼니처',
      stockStatus: 'INSTOCK',
      updatedAt: new Date().toISOString(),
    };
    appliedPricingSnapshot[fallback.code] = fallback;
    return fallback;
  };

  const { dimensions, doorOption, countertopOption, modules, appliances, siteConditions } = order;

  // 1. VALIDATION CHECKS ON INPUT ENTITY
  if (!order.customerName || order.customerName.trim() === '') {
    validationReport.push({
      type: 'ERROR',
      field: 'customerName',
      message: '고객명이 누락되었습니다.',
      suggestion: '고객명 또는 현장명을 입력해주세요.',
    });
  }

  if (dimensions.lowerCabinetLengthMm <= 0) {
    validationReport.push({
      type: 'ERROR',
      field: 'lowerCabinetLengthMm',
      message: '하부장 길이(mm)가 0 이하로 입력되었습니다.',
      suggestion: '하부장 가로 치수(예: 3000mm)를 입력해주세요.',
    });
  } else if (dimensions.lowerCabinetLengthMm < 1200) {
    validationReport.push({
      type: 'WARNING',
      field: 'lowerCabinetLengthMm',
      message: `하부장 길이(${dimensions.lowerCabinetLengthMm}mm)가 소형 원룸 규격(1,200mm 미만)입니다. 싱크볼과 쿡탑 간 이격 거리를 확인하세요.`,
    });
  }

  if (dimensions.depthMm && (dimensions.depthMm < 550 || dimensions.depthMm > 750)) {
    validationReport.push({
      type: 'WARNING',
      field: 'depthMm',
      message: `하부장 깊이(${dimensions.depthMm}mm)가 표준 규격(600mm) 범위를 벗어났습니다. 특수 가공비가 발생할 수 있습니다.`,
    });
  }

  // --- CALCULATION STEPS ---

  // A. CARCASS (몸통 자재비)
  // 1) 하부장 몸통 (mm -> m 환산)
  const lowerLenM = Number((dimensions.lowerCabinetLengthMm / 1000).toFixed(3));
  if (lowerLenM > 0) {
    const baseCarcass = lookupItem('CAB-BASE-STD', 'CARCASS', '하부장 기본 바디');
    const costTotal = Math.round(lowerLenM * baseCarcass.costPrice);
    const sellingTotal = Math.round(lowerLenM * baseCarcass.sellingPrice);
    breakdowns.push({
      id: 'bd-carcass-lower',
      category: 'CARCASS',
      code: baseCarcass.code,
      name: `${baseCarcass.name} (${dimensions.lowerCabinetLengthMm.toLocaleString()}mm)`,
      spec: baseCarcass.spec,
      formula: `하부장 길이 ${dimensions.lowerCabinetLengthMm.toLocaleString()}mm (${lowerLenM}m) × @${baseCarcass.sellingPrice.toLocaleString()}원`,
      unit: 'm',
      quantity: lowerLenM,
      costUnitPrice: baseCarcass.costPrice,
      costTotal,
      sellingUnitPrice: baseCarcass.sellingPrice,
      sellingTotal,
      marginRate: sellingTotal > 0 ? Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)) : 0,
      validationStatus: 'VALID',
    });
  }

  // 2) 상부장 몸통
  const upperLenM = Number(((dimensions.upperCabinetLengthMm || 0) / 1000).toFixed(3));
  if (upperLenM > 0) {
    const upperCarcass = lookupItem('CAB-UPPER-STD', 'CARCASS', '상부장 기본 바디');
    const costTotal = Math.round(upperLenM * upperCarcass.costPrice);
    const sellingTotal = Math.round(upperLenM * upperCarcass.sellingPrice);
    breakdowns.push({
      id: 'bd-carcass-upper',
      category: 'CARCASS',
      code: upperCarcass.code,
      name: `${upperCarcass.name} (${dimensions.upperCabinetLengthMm.toLocaleString()}mm)`,
      spec: upperCarcass.spec,
      formula: `상부장 길이 ${dimensions.upperCabinetLengthMm.toLocaleString()}mm (${upperLenM}m) × @${upperCarcass.sellingPrice.toLocaleString()}원`,
      unit: 'm',
      quantity: upperLenM,
      costUnitPrice: upperCarcass.costPrice,
      costTotal,
      sellingUnitPrice: upperCarcass.sellingPrice,
      sellingTotal,
      marginRate: sellingTotal > 0 ? Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)) : 0,
      validationStatus: 'VALID',
    });
  }

  // 3) 아일랜드 몸통
  const islandLenM = Number(((dimensions.islandLengthMm || 0) / 1000).toFixed(3));
  if (islandLenM > 0) {
    const islandCarcass = lookupItem('CAB-ISLAND-STD', 'CARCASS', '아일랜드');
    const costTotal = Math.round(islandLenM * islandCarcass.costPrice);
    const sellingTotal = Math.round(islandLenM * islandCarcass.sellingPrice);
    breakdowns.push({
      id: 'bd-carcass-island',
      category: 'CARCASS',
      code: islandCarcass.code,
      name: `${islandCarcass.name} (${dimensions.islandLengthMm?.toLocaleString()}mm)`,
      spec: islandCarcass.spec,
      formula: `아일랜드 길이 ${dimensions.islandLengthMm?.toLocaleString()}mm (${islandLenM}m) × @${islandCarcass.sellingPrice.toLocaleString()}원`,
      unit: 'm',
      quantity: islandLenM,
      costUnitPrice: islandCarcass.costPrice,
      costTotal,
      sellingUnitPrice: islandCarcass.sellingPrice,
      sellingTotal,
      marginRate: sellingTotal > 0 ? Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)) : 0,
      validationStatus: 'VALID',
    });
  }

  // 4) 키큰장 / 냉장고장 몸통
  if (dimensions.tallCabinetWidthMm && dimensions.tallCabinetWidthMm > 0) {
    const tallCount = Math.max(1, Math.round(dimensions.tallCabinetWidthMm / 600));
    const tallCarcass = lookupItem('CAB-TALL-600', 'CARCASS', '키큰 수납장');
    const costTotal = tallCount * tallCarcass.costPrice;
    const sellingTotal = tallCount * tallCarcass.sellingPrice;
    breakdowns.push({
      id: 'bd-carcass-tall',
      category: 'CARCASS',
      code: tallCarcass.code,
      name: `${tallCarcass.name} (W${dimensions.tallCabinetWidthMm}mm)`,
      spec: tallCarcass.spec,
      formula: `키큰장 수량 ${tallCount}개소 × @${tallCarcass.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: tallCount,
      costUnitPrice: tallCarcass.costPrice,
      costTotal,
      sellingUnitPrice: tallCarcass.sellingPrice,
      sellingTotal,
      marginRate: Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  if (dimensions.fridgeCabinetWidthMm && dimensions.fridgeCabinetWidthMm > 0) {
    const fridgeCount = Math.max(1, Math.round(dimensions.fridgeCabinetWidthMm / 1000));
    const fridgeCarcass = lookupItem('CAB-FRIDGE-1000', 'CARCASS', '냉장고장');
    const costTotal = fridgeCount * fridgeCarcass.costPrice;
    const sellingTotal = fridgeCount * fridgeCarcass.sellingPrice;
    breakdowns.push({
      id: 'bd-carcass-fridge',
      category: 'CARCASS',
      code: fridgeCarcass.code,
      name: `${fridgeCarcass.name} (W${dimensions.fridgeCabinetWidthMm}mm)`,
      spec: fridgeCarcass.spec,
      formula: `냉장고장 ${fridgeCount}세트 × @${fridgeCarcass.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: fridgeCount,
      costUnitPrice: fridgeCarcass.costPrice,
      costTotal,
      sellingUnitPrice: fridgeCarcass.sellingPrice,
      sellingTotal,
      marginRate: Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // B. DOOR & FINISH (도어 및 마감재)
  // 도어 면적 계산 (하부장 높이 0.72m + 상부장 높이 0.65m + 아일랜드 + 키큰장 도어)
  let doorAreaM2 = (lowerLenM * 0.72) + (upperLenM * 0.68) + (islandLenM * 0.72 * 1.5);
  if (dimensions.tallCabinetWidthMm) {
    doorAreaM2 += (dimensions.tallCabinetWidthMm / 1000) * 2.1;
  }
  if (dimensions.fridgeCabinetWidthMm) {
    doorAreaM2 += (dimensions.fridgeCabinetWidthMm / 1000) * 0.5; // 냉장고 상부 플랩도어
  }
  doorAreaM2 = Number(doorAreaM2.toFixed(2));

  // Determine Door Code from material name
  let doorCode = 'DOOR-PET-MATT';
  const doorMatStr = (doorOption.material || '').toLowerCase();
  if (doorMatStr.includes('도장') || doorMatStr.includes('우레탄') || doorMatStr.includes('paint')) {
    doorCode = 'DOOR-PAINT-URETHANE';
  } else if (doorMatStr.includes('무늬목') || doorMatStr.includes('원목') || doorMatStr.includes('veneer')) {
    doorCode = 'DOOR-VENEER-NATURAL';
  } else if (doorMatStr.includes('lpm')) {
    doorCode = 'DOOR-LPM-BASIC';
  }

  const doorItem = lookupItem(doorCode, 'DOOR', doorOption.material);
  const doorCostTotal = Math.round(doorAreaM2 * doorItem.costPrice);
  const doorSellingTotal = Math.round(doorAreaM2 * doorItem.sellingPrice);
  breakdowns.push({
    id: 'bd-door-main',
    category: 'DOOR',
    code: doorItem.code,
    name: `${doorItem.name} [${doorOption.color || '지정컬러'}]`,
    spec: `${doorOption.edgeFinish || 'PUR 엣지'} / ${doorOption.handleType || 'C찬넬'}`,
    formula: `도어 총 면적 ${doorAreaM2}m² × @${doorItem.sellingPrice.toLocaleString()}원/m²`,
    unit: 'm²',
    quantity: doorAreaM2,
    costUnitPrice: doorItem.costPrice,
    costTotal: doorCostTotal,
    sellingUnitPrice: doorItem.sellingPrice,
    sellingTotal: doorSellingTotal,
    marginRate: Number((((doorSellingTotal - doorCostTotal) / doorSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  // C. COUNTERTOP (상판 대리석)
  const topTotalLenM = Number((lowerLenM + islandLenM).toFixed(3));
  let topCode = 'TOP-ACRYLIC-LX';
  const topBrandStr = (countertopOption.brand + ' ' + countertopOption.model).toLowerCase();
  if (topBrandStr.includes('칸스톤') || topBrandStr.includes('엔지니어드') || topBrandStr.includes('quartz')) {
    topCode = 'TOP-STONE-KHAN';
  } else if (topBrandStr.includes('세라믹') || topBrandStr.includes('ceramic') || topBrandStr.includes('포슬린')) {
    topCode = 'TOP-CERAMIC-IT';
  }

  const topItem = lookupItem(topCode, 'COUNTERTOP', countertopOption.brand || countertopOption.model);
  const topCostTotal = Math.round(topTotalLenM * topItem.costPrice);
  const topSellingTotal = Math.round(topTotalLenM * topItem.sellingPrice);
  breakdowns.push({
    id: 'bd-top-main',
    category: 'COUNTERTOP',
    code: topItem.code,
    name: `${topItem.name} [${countertopOption.model || '기본패턴'}]`,
    spec: `${countertopOption.thickness || '12T/20T'} / ${countertopOption.edgeType || '기본가공'}`,
    formula: `상판 실측 연장길이 ${topTotalLenM}m × @${topItem.sellingPrice.toLocaleString()}원/m`,
    unit: 'm',
    quantity: topTotalLenM,
    costUnitPrice: topItem.costPrice,
    costTotal: topCostTotal,
    sellingUnitPrice: topItem.sellingPrice,
    sellingTotal: topSellingTotal,
    marginRate: Number((((topSellingTotal - topCostTotal) / topSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  // D. HARDWARE (경첩, 서랍, 인출망)
  // 1) 댐핑 경첩 (도어 면적당 약 4개소 환산)
  const hingePairCount = Math.max(4, Math.round(doorAreaM2 * 2.2));
  const hingeItem = lookupItem('HW-HINGE-BLUM', 'HARDWARE', '블룸');
  const hingeCostTotal = hingePairCount * hingeItem.costPrice;
  const hingeSellingTotal = hingePairCount * hingeItem.sellingPrice;
  breakdowns.push({
    id: 'bd-hw-hinge',
    category: 'HARDWARE',
    code: hingeItem.code,
    name: `${hingeItem.name}`,
    spec: hingeItem.spec,
    formula: `도어 연동 댐퍼 경첩 ${hingePairCount}조 × @${hingeItem.sellingPrice.toLocaleString()}원`,
    unit: '세트',
    quantity: hingePairCount,
    costUnitPrice: hingeItem.costPrice,
    costTotal: hingeCostTotal,
    sellingUnitPrice: hingeItem.sellingPrice,
    sellingTotal: hingeSellingTotal,
    marginRate: Number((((hingeSellingTotal - hingeCostTotal) / hingeSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  // 2) 3단/2단 서랍 시스템
  const drawerCount3T = modules.drawerCount3Tier || 0;
  if (drawerCount3T > 0) {
    const dr3Item = lookupItem('HW-DRAWER-BLUM-ANTARO', 'HARDWARE', '3단 서랍');
    const costTotal = drawerCount3T * dr3Item.costPrice;
    const sellingTotal = drawerCount3T * dr3Item.sellingPrice;
    breakdowns.push({
      id: 'bd-hw-dr3',
      category: 'HARDWARE',
      code: dr3Item.code,
      name: `${dr3Item.name}`,
      spec: dr3Item.spec,
      formula: `3단 텐덤박스 서랍 ${drawerCount3T}세트 × @${dr3Item.sellingPrice.toLocaleString()}원`,
      unit: '세트',
      quantity: drawerCount3T,
      costUnitPrice: dr3Item.costPrice,
      costTotal,
      sellingUnitPrice: dr3Item.sellingPrice,
      sellingTotal,
      marginRate: Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  const drawerCount2T = modules.drawerCount2Tier || 0;
  if (drawerCount2T > 0) {
    const dr2Item = lookupItem('HW-DRAWER-HEPO-2T', 'HARDWARE', '2단 서랍');
    const costTotal = drawerCount2T * dr2Item.costPrice;
    const sellingTotal = drawerCount2T * dr2Item.sellingPrice;
    breakdowns.push({
      id: 'bd-hw-dr2',
      category: 'HARDWARE',
      code: dr2Item.code,
      name: `${dr2Item.name}`,
      spec: dr2Item.spec,
      formula: `2단 대용량 서랍 ${drawerCount2T}세트 × @${dr2Item.sellingPrice.toLocaleString()}원`,
      unit: '세트',
      quantity: drawerCount2T,
      costUnitPrice: dr2Item.costPrice,
      costTotal,
      sellingUnitPrice: dr2Item.sellingPrice,
      sellingTotal,
      marginRate: Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 3) 양념망 인출장
  if (modules.spiceRackCount && modules.spiceRackCount > 0) {
    const spiceItem = lookupItem('HW-SPICE-RACK-150', 'HARDWARE', '양념망');
    const costTotal = modules.spiceRackCount * spiceItem.costPrice;
    const sellingTotal = modules.spiceRackCount * spiceItem.sellingPrice;
    breakdowns.push({
      id: 'bd-hw-spice',
      category: 'HARDWARE',
      code: spiceItem.code,
      name: `${spiceItem.name}`,
      spec: spiceItem.spec,
      formula: `양념망 인출장 ${modules.spiceRackCount}개소 × @${spiceItem.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: modules.spiceRackCount,
      costUnitPrice: spiceItem.costPrice,
      costTotal,
      sellingUnitPrice: spiceItem.sellingPrice,
      sellingTotal,
      marginRate: Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 4) 코너 인출선반
  if (modules.cornerModuleCount && modules.cornerModuleCount > 0) {
    const cornerItem = lookupItem('HW-CORNER-BASKET', 'HARDWARE', '코너');
    const costTotal = modules.cornerModuleCount * cornerItem.costPrice;
    const sellingTotal = modules.cornerModuleCount * cornerItem.sellingPrice;
    breakdowns.push({
      id: 'bd-hw-corner',
      category: 'HARDWARE',
      code: cornerItem.code,
      name: `${cornerItem.name}`,
      spec: cornerItem.spec,
      formula: `코너 매직선반 ${modules.cornerModuleCount}세트 × @${cornerItem.sellingPrice.toLocaleString()}원`,
      unit: '세트',
      quantity: modules.cornerModuleCount,
      costUnitPrice: cornerItem.costPrice,
      costTotal,
      sellingUnitPrice: cornerItem.sellingPrice,
      sellingTotal,
      marginRate: Number((((sellingTotal - costTotal) / sellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // E. APPLIANCE (싱크볼, 수전, 후드, 쿡탑)
  // 1) 싱크볼
  if (appliances.sinkBowlModel) {
    const sinkItem = lookupItem('APP-SINK-BAEKJO-860', 'APPLIANCE', appliances.sinkBowlModel);
    breakdowns.push({
      id: 'bd-app-sink',
      category: 'APPLIANCE',
      code: sinkItem.code,
      name: `${sinkItem.name} (${appliances.sinkBowlModel})`,
      spec: sinkItem.spec,
      formula: `싱크볼 1EA × @${sinkItem.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: 1,
      costUnitPrice: sinkItem.costPrice,
      costTotal: sinkItem.costPrice,
      sellingUnitPrice: sinkItem.sellingPrice,
      sellingTotal: sinkItem.sellingPrice,
      marginRate: Number((((sinkItem.sellingPrice - sinkItem.costPrice) / sinkItem.sellingPrice) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 2) 수전
  if (appliances.faucetModel) {
    const faucetItem = lookupItem('APP-FAUCET-SUITIE-NK', 'APPLIANCE', appliances.faucetModel);
    breakdowns.push({
      id: 'bd-app-faucet',
      category: 'APPLIANCE',
      code: faucetItem.code,
      name: `${faucetItem.name} (${appliances.faucetModel})`,
      spec: faucetItem.spec,
      formula: `주방 수전 1EA × @${faucetItem.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: 1,
      costUnitPrice: faucetItem.costPrice,
      costTotal: faucetItem.costPrice,
      sellingUnitPrice: faucetItem.sellingPrice,
      sellingTotal: faucetItem.sellingPrice,
      marginRate: Number((((faucetItem.sellingPrice - faucetItem.costPrice) / faucetItem.sellingPrice) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 3) 후드
  if (appliances.hoodModel) {
    const hoodItem = lookupItem('APP-HOOD-HAATZ-SQ90', 'APPLIANCE', appliances.hoodModel);
    breakdowns.push({
      id: 'bd-app-hood',
      category: 'APPLIANCE',
      code: hoodItem.code,
      name: `${hoodItem.name} (${appliances.hoodModel})`,
      spec: hoodItem.spec,
      formula: `렌지후드 1EA × @${hoodItem.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: 1,
      costUnitPrice: hoodItem.costPrice,
      costTotal: hoodItem.costPrice,
      sellingUnitPrice: hoodItem.sellingPrice,
      sellingTotal: hoodItem.sellingPrice,
      marginRate: Number((((hoodItem.sellingPrice - hoodItem.costPrice) / hoodItem.sellingPrice) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 4) 쿡탑
  if (appliances.cooktopModel) {
    const cookItem = lookupItem('APP-COOK-SK-IND3', 'APPLIANCE', appliances.cooktopModel);
    breakdowns.push({
      id: 'bd-app-cook',
      category: 'APPLIANCE',
      code: cookItem.code,
      name: `${cookItem.name} (${appliances.cooktopModel})`,
      spec: cookItem.spec,
      formula: `전기레인지/쿡탑 1EA × @${cookItem.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: 1,
      costUnitPrice: cookItem.costPrice,
      costTotal: cookItem.costPrice,
      sellingUnitPrice: cookItem.sellingPrice,
      sellingTotal: cookItem.sellingPrice,
      marginRate: Number((((cookItem.sellingPrice - cookItem.costPrice) / cookItem.sellingPrice) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // F. LABOR & PROCESSING (시공 및 가공비)
  // 1) 기본 직영 시공비
  const installLenM = Number((lowerLenM + (upperLenM * 0.7) + (islandLenM * 0.8)).toFixed(2));
  const laborInstall = lookupItem('LAB-INSTALL-BASIC', 'LABOR', '기본 시공비');
  const installCostTotal = Math.round(installLenM * laborInstall.costPrice);
  const installSellingTotal = Math.round(installLenM * laborInstall.sellingPrice);
  breakdowns.push({
    id: 'bd-labor-install',
    category: 'LABOR',
    code: laborInstall.code,
    name: `${laborInstall.name}`,
    spec: `가구 연장 총 ${installLenM}m 기준 정밀 시공`,
    formula: `시공 연장길이 ${installLenM}m × @${laborInstall.sellingPrice.toLocaleString()}원/m`,
    unit: 'm',
    quantity: installLenM,
    costUnitPrice: laborInstall.costPrice,
    costTotal: installCostTotal,
    sellingUnitPrice: laborInstall.sellingPrice,
    sellingTotal: installSellingTotal,
    marginRate: Number((((installSellingTotal - installCostTotal) / installSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  // 2) 대리석 접합/가공비
  const laborTop = lookupItem('LAB-TOP-PROCESS', 'LABOR', '대리석 현장 맞춤 접합');
  const topProcessCostTotal = Math.round(topTotalLenM * laborTop.costPrice);
  const topProcessSellingTotal = Math.round(topTotalLenM * laborTop.sellingPrice);
  breakdowns.push({
    id: 'bd-labor-top',
    category: 'LABOR',
    code: laborTop.code,
    name: `${laborTop.name}`,
    spec: laborTop.spec,
    formula: `상판 가공/접합 ${topTotalLenM}m × @${laborTop.sellingPrice.toLocaleString()}원/m`,
    unit: 'm',
    quantity: topTotalLenM,
    costUnitPrice: laborTop.costPrice,
    costTotal: topProcessCostTotal,
    sellingUnitPrice: laborTop.sellingPrice,
    sellingTotal: topProcessSellingTotal,
    marginRate: Number((((topProcessSellingTotal - topProcessCostTotal) / topProcessSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  // 3) 싱크볼 및 쿡탑 타공비
  let punchCount = 0;
  if (appliances.sinkBowlModel) punchCount++;
  if (appliances.cooktopModel) punchCount++;
  if (punchCount > 0) {
    const laborPunch = lookupItem('LAB-PUNCH-SINK-COOK', 'LABOR', '타공비');
    const punchCostTotal = punchCount * laborPunch.costPrice;
    const punchSellingTotal = punchCount * laborPunch.sellingPrice;
    breakdowns.push({
      id: 'bd-labor-punch',
      category: 'LABOR',
      code: laborPunch.code,
      name: `${laborPunch.name}`,
      spec: `싱크볼 언더가공 + 쿡탑 타공 (${punchCount}개소)`,
      formula: `정밀 타공 ${punchCount}개소 × @${laborPunch.sellingPrice.toLocaleString()}원`,
      unit: 'EA',
      quantity: punchCount,
      costUnitPrice: laborPunch.costPrice,
      costTotal: punchCostTotal,
      sellingUnitPrice: laborPunch.sellingPrice,
      sellingTotal: punchSellingTotal,
      marginRate: Number((((punchSellingTotal - punchCostTotal) / punchSellingTotal) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 4) 철거비
  if (siteConditions.needsDemolition) {
    const laborDemo = lookupItem('LAB-DEMOLITION-DISPOSE', 'LABOR', '철거 및 폐기물');
    breakdowns.push({
      id: 'bd-labor-demo',
      category: 'LABOR',
      code: laborDemo.code,
      name: `${laborDemo.name}`,
      spec: laborDemo.spec,
      formula: `기존 싱크대 철거 및 폐기물 반출 1식`,
      unit: '식',
      quantity: 1,
      costUnitPrice: laborDemo.costPrice,
      costTotal: laborDemo.costPrice,
      sellingUnitPrice: laborDemo.sellingPrice,
      sellingTotal: laborDemo.sellingPrice,
      marginRate: Number((((laborDemo.sellingPrice - laborDemo.costPrice) / laborDemo.sellingPrice) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // 5) 사다리차 / 양중비
  if (siteConditions.needsLadderTruck || (!siteConditions.hasElevator && siteConditions.floor >= 2)) {
    const laborLadder = lookupItem('LAB-LADDER-CARRY', 'LABOR', '사다리차');
    breakdowns.push({
      id: 'bd-labor-ladder',
      category: 'LABOR',
      code: laborLadder.code,
      name: `${laborLadder.name} (${siteConditions.floor}층)`,
      spec: laborLadder.spec,
      formula: `사다리차 장비 사용료 1회`,
      unit: '회',
      quantity: 1,
      costUnitPrice: laborLadder.costPrice,
      costTotal: laborLadder.costPrice,
      sellingUnitPrice: laborLadder.sellingPrice,
      sellingTotal: laborLadder.sellingPrice,
      marginRate: Number((((laborLadder.sellingPrice - laborLadder.costPrice) / laborLadder.sellingPrice) * 100).toFixed(1)),
      validationStatus: 'VALID',
    });
  }

  // G. ACCESSORY (찬넬 및 걸레받이)
  const channelLenM = Number((lowerLenM + islandLenM).toFixed(2));
  const accChannel = lookupItem('ACC-CHANNEL-C', 'ACCESSORY', 'C찬넬');
  const channelCostTotal = Math.round(channelLenM * accChannel.costPrice);
  const channelSellingTotal = Math.round(channelLenM * accChannel.sellingPrice);
  breakdowns.push({
    id: 'bd-acc-channel',
    category: 'ACCESSORY',
    code: accChannel.code,
    name: `${accChannel.name}`,
    spec: accChannel.spec,
    formula: `핸들리스 찬넬 프로파일 ${channelLenM}m × @${accChannel.sellingPrice.toLocaleString()}원/m`,
    unit: 'm',
    quantity: channelLenM,
    costUnitPrice: accChannel.costPrice,
    costTotal: channelCostTotal,
    sellingUnitPrice: accChannel.sellingPrice,
    sellingTotal: channelSellingTotal,
    marginRate: Number((((channelSellingTotal - channelCostTotal) / channelSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  const plinthLenM = Number((lowerLenM + islandLenM).toFixed(2));
  const accPlinth = lookupItem('ACC-PLINTH-KICK', 'ACCESSORY', '걸레받이');
  const plinthCostTotal = Math.round(plinthLenM * accPlinth.costPrice);
  const plinthSellingTotal = Math.round(plinthLenM * accPlinth.sellingPrice);
  breakdowns.push({
    id: 'bd-acc-plinth',
    category: 'ACCESSORY',
    code: accPlinth.code,
    name: `${accPlinth.name}`,
    spec: accPlinth.spec,
    formula: `방수 립 일체형 걸레받이 ${plinthLenM}m × @${accPlinth.sellingPrice.toLocaleString()}원/m`,
    unit: 'm',
    quantity: plinthLenM,
    costUnitPrice: accPlinth.costPrice,
    costTotal: plinthCostTotal,
    sellingUnitPrice: accPlinth.sellingPrice,
    sellingTotal: plinthSellingTotal,
    marginRate: Number((((plinthSellingTotal - plinthCostTotal) / plinthSellingTotal) * 100).toFixed(1)),
    validationStatus: 'VALID',
  });

  // --- SUMMARY CALCULATIONS ---
  const sumByCategory = (cat: string) => {
    const items = breakdowns.filter((b) => b.category === cat);
    const cost = items.reduce((acc, i) => acc + i.costTotal, 0);
    const selling = items.reduce((acc, i) => acc + i.sellingTotal, 0);
    return { cost, selling };
  };

  const carcassSum = sumByCategory('CARCASS');
  const doorSum = sumByCategory('DOOR');
  const topSum = sumByCategory('COUNTERTOP');
  const hwSum = sumByCategory('HARDWARE');
  const appSum = sumByCategory('APPLIANCE');
  const laborSum = sumByCategory('LABOR');
  const accSum = sumByCategory('ACCESSORY');

  const totalManufacturingCost =
    carcassSum.cost +
    doorSum.cost +
    topSum.cost +
    hwSum.cost +
    appSum.cost +
    laborSum.cost +
    accSum.cost;

  let totalSellingPrice =
    carcassSum.selling +
    doorSum.selling +
    topSum.selling +
    hwSum.selling +
    appSum.selling +
    laborSum.selling +
    accSum.selling;

  // If user passed a specific customTargetMarginRate, we can keep standard or compare
  const totalMarginAmount = totalSellingPrice - totalManufacturingCost;
  const averageMarginRate =
    totalSellingPrice > 0
      ? Number(((totalMarginAmount / totalSellingPrice) * 100).toFixed(1))
      : 0;
  const vatAmount = Math.round(totalSellingPrice * 0.1);
  const finalGrandTotal = totalSellingPrice + vatAmount;

  const summary: QuoteSummary = {
    carcassCost: carcassSum.cost,
    carcassSelling: carcassSum.selling,
    doorCost: doorSum.cost,
    doorSelling: doorSum.selling,
    countertopCost: topSum.cost,
    countertopSelling: topSum.selling,
    hardwareCost: hwSum.cost,
    hardwareSelling: hwSum.selling,
    applianceCost: appSum.cost,
    applianceSelling: appSum.selling,
    laborCost: laborSum.cost,
    laborSelling: laborSum.selling,
    accessoryCost: accSum.cost,
    accessorySelling: accSum.selling,
    totalManufacturingCost,
    totalSellingPrice,
    totalMarginAmount,
    averageMarginRate,
    vatAmount,
    finalGrandTotal,
  };

  return {
    breakdowns,
    summary,
    validationReport,
    appliedPricingSnapshot,
    calculatedAt: new Date().toISOString(),
  };
}
