/**
 * Excel export is ALWAYS built from a persisted server-side quote, not the caller's JSON.
 * Customer output is a demo-only preview until real business identity is configured.
 */
import * as XLSX from 'xlsx';
import type { QuoteDocument } from '../src/types.js';

export type QuoteExcelAudience = 'customer' | 'internal';
type Cell = string | number;

export function safeExcelCell(value: Cell): Cell {
  if (typeof value !== 'string') return value;
  // Prevent spreadsheet formula injection from customer names, specifications and notes.
  return /^[=+@\-\t\r\n]/.test(value) ? '\'' + value : value;
}

export function quoteExcelRows(quote: QuoteDocument, audience: QuoteExcelAudience): Cell[][] {
  const { orderEntity: order, calculationResult: result } = quote;
  const rows: Cell[][] = [
    [audience === 'customer' ? '고객용 견적 미리보기 (검증용 · 대외 발송 금지)' : '내부용 원가·마진 상세 견적서'],
    ['견적번호', quote.quoteNumber, '발행일자', new Date(quote.createdAt).toLocaleDateString('ko-KR')],
    ['고객명', order.customerName, '연락처', order.contact],
    ['현장주소', order.address, '가구형태', order.layoutType],
    [],
  ];
  if (audience === 'customer') {
    rows.push(['순번','구분','품목명 및 사양','산식/규격','단위','수량','공급단가','공급가액']);
    result.breakdowns.forEach((it, idx) => rows.push([
      idx + 1,it.category,it.name,it.formula,it.unit,it.quantity,it.sellingUnitPrice,it.sellingTotal,
    ]));
    rows.push([],['총 공급가액 (VAT 별도)',result.summary.totalSellingPrice],
      ['부가가치세',result.summary.vatAmount],['최종 견적 총액',result.summary.finalGrandTotal]);
  } else {
    rows.push(['순번','구분','품목코드','품목명 및 사양','산식/규격','단위','수량','제조원가(단가)','제조원가(합계)','공급단가','공급가액(합계)','마진율(%)']);
    result.breakdowns.forEach((it, idx) => rows.push([
      idx + 1,it.category,it.code,it.name,it.formula,it.unit,it.quantity,
      it.costUnitPrice,it.costTotal,it.sellingUnitPrice,it.sellingTotal,it.marginRate,
    ]));
    rows.push([],['총 제조원가 (VAT 별도)',result.summary.totalManufacturingCost],
      ['총 공급가액 (VAT 별도)',result.summary.totalSellingPrice],
      ['총 마진액',result.summary.totalMarginAmount],
      ['평균 마진율',result.summary.averageMarginRate],
      ['부가가치세',result.summary.vatAmount],['최종 견적 총액',result.summary.finalGrandTotal]);
  }
  return rows.map(row => row.map(safeExcelCell));
}

export function createQuoteExcel(quote: QuoteDocument, audience: QuoteExcelAudience): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(quoteExcelRows(quote, audience));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, audience === 'customer' ? '고객용_검증미리보기' : '내부용_원가상세');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
