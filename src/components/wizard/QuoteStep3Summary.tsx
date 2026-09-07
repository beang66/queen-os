import React, { useState } from 'react';
import {
  Printer,
  Download,
  Save,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { QuoteCalculationResult, OrderEntity, QuoteDocument } from '../../types';

interface QuoteStep3SummaryProps {
  orderEntity: OrderEntity;
  targetMarginRate: number;
  calculationResult: QuoteCalculationResult;
  quoteTitle: string;
  setQuoteTitle: (title: string) => void;
  savedQuote: QuoteDocument | null;
  saving: boolean;
  onSaveQuote: () => void;
  onPrevStep: () => void;
  onNavigateToHistory: () => void;
}

/**
 * 견적 마법사 Step 3: 완성된 정식 견적서 출력, 엑셀/PDF 다운로드 및 영구 저장 컴포넌트
 */
export const QuoteStep3Summary: React.FC<QuoteStep3SummaryProps> = ({
  orderEntity,
  targetMarginRate,
  calculationResult,
  quoteTitle,
  setQuoteTitle,
  savedQuote,
  saving,
  onSaveQuote,
  onPrevStep,
  onNavigateToHistory,
}) => {
  const [notes, setNotes] = useState<string>('상기 견적은 퀸 주방가구 정품 E0 친환경 자재 및 전문 시공팀 직영 기준입니다. (유효기간: 견적일로부터 15일)');

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = ['카테고리,품목명,수량,단가,총 원가,공급가\n'];
    const rows = (calculationResult.breakdowns || []).map(
      (b) => `"${b.category}","${b.name}",${b.quantity},${b.costUnitPrice},${b.costTotal},${b.sellingTotal}`
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers.concat(rows).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${quoteTitle || '퀸주방가구_견적서'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 견적서 저장 컨트롤 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-500 mb-1">견적서 대표 타이틀</label>
          <input
            type="text"
            value={quoteTitle}
            onChange={(e) => setQuoteTitle(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-bold text-gray-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV/Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>인쇄 / PDF</span>
          </button>
          <button
            type="button"
            onClick={onSaveQuote}
            disabled={saving || !!savedQuote}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-emerald-600 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedQuote ? '영구 저장 완료' : saving ? '저장 중...' : '견적서 DB 저장'}</span>
          </button>
        </div>
      </div>

      {/* 저장 완료 알림 메시지 */}
      {savedQuote && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">견적서 #{savedQuote.quoteNumber}가 영구 저장되었습니다!</span>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                견적 이력 탭에서 언제든지 관리 및 상태 변경(승인/계약)을 진행할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-emerald-700"
          >
            견적 이력 조회
          </button>
        </div>
      )}

      {/* A4 양식 프리뷰 견적서 (Print Ready) */}
      <div className="bg-white rounded-xl border border-gray-300 p-8 shadow-md max-w-4xl mx-auto text-gray-800 space-y-6 font-sans">
        {/* 견적서 상단 타이틀 & 제공자 정보 */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
          <div>
            <span className="text-xs font-extrabold text-blue-600 tracking-wider">QUEEN KITCHEN SYSTEM</span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">{quoteTitle}</h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              발행일자: {new Date().toLocaleDateString('ko-KR')} | 견적 번호: #{savedQuote?.quoteNumber || 'DRAFT-001'}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600 space-y-0.5 border-l border-slate-200 pl-4">
            <div className="font-bold text-slate-900">퀸 주방가구 (QUEEN KITCHEN)</div>
            <div>대표: 홍길동 | 사업자번호: 123-45-67890</div>
            <div>전화: 02-555-8274 | 팩스: 02-555-8275</div>
            <div>본사: 서울특별시 강남구 학동로 204</div>
          </div>
        </div>

        {/* 수신자 / 현장 정보 */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-medium">고객명 / 상호:</span>
            <span className="font-bold text-slate-800 ml-2">{orderEntity.customerName}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">연락처:</span>
            <span className="font-mono text-slate-800 ml-2">{orderEntity.contact}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 font-medium">시공 현장 주소:</span>
            <span className="font-medium text-slate-800 ml-2">{orderEntity.address}</span>
          </div>
        </div>

        {/* 견적 금액 요약 표 */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-lg p-4 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-300 font-medium">최종 합계 공급가액 (VAT 별도)</span>
            <div className="text-2xl font-black font-mono mt-0.5">
              ₩{(calculationResult.summary.totalSellingPrice || 0).toLocaleString()} 원
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-300 font-medium">부가세 포함 총액</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              ₩{(calculationResult.summary.finalGrandTotal || 0).toLocaleString()} 원
            </div>
          </div>
        </div>

        {/* 품목별 상세 명세표 */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">세부 견적 산출 내역</h3>
          <table className="w-full text-left text-xs border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2 px-3 border-r border-slate-200">구분</th>
                <th className="py-2 px-3 border-r border-slate-200">품목 및 사양</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">수량</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">단가</th>
                <th className="py-2 px-3 text-right">공급가액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {(calculationResult.breakdowns || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-800">{item.category}</td>
                  <td className="py-2 px-3 border-r border-slate-200 font-sans text-slate-900 font-medium">
                    {item.name}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-600">
                    ₩{(item.sellingUnitPrice || 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                    ₩{(item.sellingTotal || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 특기사항 및 참고 메모 */}
        <div className="space-y-1 pt-2">
          <label className="block text-xs font-bold text-slate-700">특기사항 및 약관 메모</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-xs text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* 이전 단계 버튼 */}
      <div className="flex justify-start pt-2">
        <button
          type="button"
          onClick={onPrevStep}
          className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>2단계: 마진율 및 원가 조정으로 이동</span>
        </button>
      </div>
    </div>
  );
};
