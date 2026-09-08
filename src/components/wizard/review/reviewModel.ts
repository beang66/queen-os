import { OrderEntity, LayoutType, ReviewLineItem, ReviewItemStatus } from '../../../types';

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  I_SHAPE: 'ㅡ자형 (일자형)',
  L_SHAPE: 'ㄱ자형 주방',
  U_SHAPE: 'ㄷ자형 주방',
  ISLAND_PARALLEL: '아일랜드 대면형',
  CUSTOM: '커스텀 배치',
};

export const UNIT_OPTIONS = ['mm', 'm', 'm²', 'EA', '개', '세트', '식'];

export const STATUS_META: Record<ReviewItemStatus, { label: string; cls: string }> = {
  CONFIRMED: { label: '확인됨', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  NEEDS_PRICING: { label: '단가 연결 필요', cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  MANUAL: { label: '직접 입력', cls: 'text-sky-700 bg-sky-50 border-sky-200' },
};

/** 첨부 파일 (도면 / 이미지 / 메모) */
export interface AttachedFile {
  id: string;
  name: string;
  sizeLabel: string;
  uploadedAt: string;
  kind: '도면' | '이미지' | '메모';
  previewUrl: string | null;
}

export function classifyFile(file: File): AttachedFile['kind'] {
  if (file.type === 'application/pdf' || /\.(pdf|dwg)$/i.test(file.name)) return '도면';
  if (file.type.startsWith('image/')) return '이미지';
  return '메모';
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 필수 정보 10개 항목 충족 여부 */
export function getRequiredFields(o: OrderEntity) {
  return [
    { key: '고객명', ok: !!o.customerName?.trim() },
    { key: '연락처', ok: !!o.contact?.trim() },
    { key: '현장 주소', ok: !!o.address?.trim() },
    { key: '프로젝트명', ok: !!o.projectName?.trim() },
    { key: '상담일', ok: !!o.consultDate?.trim() },
    { key: '희망 시공일', ok: !!o.deliveryDate?.trim() },
    { key: '고객 유형', ok: !!o.customerType?.trim() },
    { key: '담당자', ok: !!o.manager?.trim() },
    { key: '하부장 길이', ok: o.dimensions.lowerCabinetLengthMm > 0 },
    { key: '도어 사양', ok: !!o.doorOption.material?.trim() },
  ];
}

/** OrderEntity에서 주방 구성 품목 라인 아이템 초기 목록을 생성 */
export function buildReviewItems(o: OrderEntity): ReviewLineItem[] {
  const items: ReviewLineItem[] = [];
  const push = (i: Omit<ReviewLineItem, 'id' | 'source' | 'linkedPricingId'>, source: 'AI' | 'MANUAL' = 'AI') =>
    items.push({ ...i, id: `RV-${items.length + 1}`, source, linkedPricingId: null });

  const d = o.dimensions;
  if (d.lowerCabinetLengthMm > 0)
    push({
      category: 'CARCASS',
      name: '하부장',
      spec: `${d.lowerCabinetLengthMm.toLocaleString()} mm (${LAYOUT_LABELS[o.layoutType]} 메인 주방)`,
      quantity: d.lowerCabinetLengthMm,
      unit: 'mm',
      status: 'CONFIRMED',
    });
  if (d.upperCabinetLengthMm > 0)
    push({
      category: 'CARCASS',
      name: '상부장',
      spec: `${d.upperCabinetLengthMm.toLocaleString()} mm`,
      quantity: d.upperCabinetLengthMm,
      unit: 'mm',
      status: 'CONFIRMED',
    });
  if (d.fridgeCabinetWidthMm && d.fridgeCabinetWidthMm > 0)
    push({
      category: 'CARCASS',
      name: '냉장고장',
      spec: `키친핏 ${d.fridgeCabinetWidthMm.toLocaleString()} mm`,
      quantity: d.fridgeCabinetWidthMm,
      unit: 'mm',
      status: 'CONFIRMED',
    });
  if (d.tallCabinetWidthMm && d.tallCabinetWidthMm > 0)
    push({
      category: 'CARCASS',
      name: '키큰장',
      spec: `${d.tallCabinetWidthMm.toLocaleString()} mm`,
      quantity: d.tallCabinetWidthMm,
      unit: 'mm',
      status: 'CONFIRMED',
    });
  if (d.islandLengthMm && d.islandLengthMm > 0)
    push({
      category: 'CARCASS',
      name: '아일랜드',
      spec: `${d.islandLengthMm.toLocaleString()} mm`,
      quantity: d.islandLengthMm,
      unit: 'mm',
      status: 'CONFIRMED',
    });

  push({ category: 'DOOR', name: 'PET 도어', spec: o.doorOption.material, quantity: 1, unit: '식', status: 'NEEDS_PRICING' });
  push({
    category: 'COUNTERTOP',
    name: '인조대리석 상판',
    spec: `${o.countertopOption.brand} ${o.countertopOption.model}`,
    quantity: 1,
    unit: '식',
    status: 'CONFIRMED',
  });
  push({ category: 'APPLIANCE', name: '싱크볼', spec: o.appliances.sinkBowlModel, quantity: 1, unit: '식', status: 'CONFIRMED' });

  if (o.siteConditions.needsDemolition)
    push({ category: 'LABOR', name: '철거', spec: '기존 싱크대 철거', quantity: 1, unit: '식', status: 'MANUAL' }, 'MANUAL');
  push({ category: 'LABOR', name: '운반·시공', spec: '운반 및 시공', quantity: 1, unit: '식', status: 'MANUAL' }, 'MANUAL');

  return items;
}

export function createBlankItem(index: number): ReviewLineItem {
  return {
    id: `RV-NEW-${index}-${Date.now().toString().slice(-4)}`,
    category: 'ACCESSORY',
    name: '',
    spec: '',
    quantity: 1,
    unit: '식',
    status: 'MANUAL',
    source: 'MANUAL',
    linkedPricingId: null,
  };
}
