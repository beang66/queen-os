import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { QuoteDocument } from '../src/types.js';
import { createQuoteExcel, quoteExcelRows, safeExcelCell } from './quoteExcel.js';

const synthetic = {
  quoteNumber: 'QN-20261117-001',
  createdAt: '2026-11-17T03:00:00.000Z',
  orderEntity: {
    customerName: '=HYPERLINK("https://bad.invalid","click")',
    contact: '000-0000-0000',
    address: '테스트 주소',
    layoutType: 'I_SHAPE',
  },
  calculationResult: {
    breakdowns: [{
      category: 'CARCASS', code: 'CAB-01', name: '+주문 품목', formula: '=1+2',
      unit: 'm', quantity: 1, costUnitPrice: 75000, costTotal: 75000,
      sellingUnitPrice: 110000, sellingTotal: 110000, marginRate: 31.8,
    }],
    summary: {
      totalManufacturingCost: 75000, totalSellingPrice: 110000,
      totalMarginAmount: 35000, averageMarginRate: 31.8,
      vatAmount: 11000, finalGrandTotal: 121000,
    },
  },
} as unknown as QuoteDocument;

describe('견적서 Excel 고객용/내부용 분리', () => {
  it('고객용에는 원가, 마진, 원가 단가표가 나오지 않는다', () => {
    const rows = quoteExcelRows(synthetic, 'customer');
    const str = JSON.stringify(rows);
    expect(str).not.toContain('제조원가');
    expect(str).not.toContain('마진');
    expect(str).not.toContain('75000');
    expect(str).not.toContain('31.8');
    expect(str).toContain('121000');
  });
  it('내부용에는 원가와 마진 정보가 포함된다', () => {
    const str=JSON.stringify(quoteExcelRows(synthetic,'internal'));
    expect(str).toContain('제조원가');
    expect(str).toContain('마진');
    expect(str).toContain('75000');
  });
  it('문자열 수식 공격을 텍스트로 격리한다', () => {
    for (const p of ['=SUM(A1:A3)', '+1+2', '-1+2', '@foo','\t=SUM(1,1)']) {
      expect(String(safeExcelCell(p)).startsWith("'")).toBe(true);
    }
    expect(safeExcelCell('정상 이름')).toBe('정상 이름');
  });
  it('생성된 고객용 xlsx 파일은 검증용 미리보기 표기가 있고 읽을 수 있다', () => {
    const file = createQuoteExcel(synthetic,'customer');
    const wb = XLSX.read(file,{type:'buffer'});
    const table = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1}) as string[][];
    expect(table[0][0]).toContain('대외 발송 금지');
    expect(String(table[2][1]).startsWith("'")).toBe(true);
    expect(JSON.stringify(table)).not.toContain('제조원가');
  });
});
