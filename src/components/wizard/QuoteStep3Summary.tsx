import React, { useMemo } from 'react';
import {
  Printer,
  Save,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Eye,
  EyeOff,
  Send,
  GitBranch,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { QuoteCalculationResult, OrderEntity, QuoteDocument, QuotePublishMeta } from '../../types';

interface QuoteStep3SummaryProps {
  orderEntity: OrderEntity;
  calculationResult: QuoteCalculationResult;
  targetMarginRate: number;
  quoteTitle: string;
  setQuoteTitle: (title: string) => void;
  publishMeta: QuotePublishMeta;
  setPublishMeta: React.Dispatch<React.SetStateAction<QuotePublishMeta>>;
  savedQuote: QuoteDocument | null;
  publishedVersions: QuoteDocument[];
  saving: boolean;
  /** 견적 초안을 서버에 즉시 저장 */
  onTempSave: () => void;
  tempSaving: boolean;
  lastSavedAt: string | null;
  onSaveQuote: () => void;
  onStartNewVersion: () => void;
  onPrevStep: () => void;
  onNavigateToHistory: () => void;
}

const won = (n: number) => `₩${Math.round(n || 0).toLocaleString()}`;

/**
 * 견적 마법사 4단계: 견적서 발행
 * 좌측에서 발행 조건(유효기간·결제·제외·특약·내부메모·품목 노출)을 설정하고,
 * 우측 고객용 A4 미리보기로 확인한 뒤 발행합니다. 발행 후에는 V2·V3 버전으로만 수정됩니다.
 */
export const QuoteStep3Summary: React.FC<QuoteStep3SummaryProps> = ({
  orderEntity,
  calculationResult,
  targetMarginRate,
  quoteTitle,
  setQuoteTitle,
  publishMeta,
  setPublishMeta,
  savedQuote,
  publishedVersions,
  saving,
  onTempSave,
  tempSaving,
  lastSavedAt,
  onSaveQuote,
  onStartNewVersion,
  onPrevStep,
  onNavigateToHistory,
}) => {
  const published = !!savedQuote;
  const nextVersion = publishedVersions.length + 1;
  const isRevision = publishedVersions.length > 0 && !published;

  const set = (patch: Partial<QuotePublishMeta>) => setPublishMeta((m) => ({ ...m, ...patch }));

  const breakdowns = calculationResult.breakdowns || [];
  const hidden = new Set(publishMeta.hiddenBreakdownIds);
  const visibleRows = breakdowns.filter((b) => !hidden.has(b.id));

  const summary = calculationResult.summary;
  const visibleSupply = useMemo(
    () => visibleRows.reduce((a, b) => a + b.sellingTotal, 0),
    [visibleRows]
  );
  const supply = hidden.size > 0 ? visibleSupply : summary.totalSellingPrice;
  const vat = Math.round(supply * 0.1);
  const grand = supply + vat;

  const issueDate = savedQuote ? new Date(savedQuote.createdAt) : new Date();
  const validUntil = new Date(issueDate);
  validUntil.setDate(validUntil.getDate() + publishMeta.validUntilDays);
  const fmt = (d: Date) => d.toLocaleDateString('ko-KR');

  const quoteNo = savedQuote?.quoteNumber ?? (nextVersion > 1 ? `DRAFT-V${nextVersion}` : 'DRAFT-001');

  /** 저장 시각을 HH:MM 으로 */
  const savedTimeLabel = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none';
  const areaCls = `${inputCls} font-normal leading-relaxed resize-none`;

  return (
    <div className="space-y-4">
      {/* 상단 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-gray-800">견적서 발행</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              견적번호 <span className="font-mono font-semibold text-gray-700">#{quoteNo}</span>
              {(published || nextVersion > 1) && (
                <span className="ml-1.5 inline-block text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded px-1">
                  V{savedQuote?.version ?? nextVersion}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTempSave}
            disabled={tempSaving}
            className="border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            {tempSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            ) : (
              <Save className="w-3.5 h-3.5 text-blue-500" />
            )}
            {tempSaving ? '저장 중...' : lastSavedAt ? `저장됨 ${savedTimeLabel(lastSavedAt)}` : '임시 저장'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF 미리보기
          </button>
          {published ? (
            <button
              type="button"
              onClick={onStartNewVersion}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <GitBranch className="w-3.5 h-3.5" />
              새 버전으로 수정
            </button>
          ) : (
            <button
              type="button"
              onClick={onSaveQuote}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {saving ? '발행 중...' : isRevision ? `V${nextVersion} 발행` : '견적서 발행'}
            </button>
          )}
        </div>
      </div>

      {/* 발행 완료 배너 + 버전 이력 */}
      {published && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">견적서 #{savedQuote!.quoteNumber} (V{savedQuote!.version ?? 1}) 가 발행되었습니다.</span>
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  발행된 문서는 덮어쓰지 않습니다. 수정이 필요하면 '새 버전으로 수정'으로 V{nextVersion + 1} 을 만드세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
            >
              견적 이력 조회
            </button>
          </div>
          {publishedVersions.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-emerald-200">
              {publishedVersions.map((v) => (
                <span key={v.id} className="text-[10px] font-mono font-semibold text-emerald-700 bg-white border border-emerald-200 rounded px-1.5 py-0.5">
                  V{v.version ?? 1} · #{v.quoteNumber} · {new Date(v.createdAt).toLocaleDateString('ko-KR')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── 좌: 발행 조건 편집 ─────────────────── */}
        <div className={`lg:col-span-5 space-y-4 ${published ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-800">견적서 정보</h3>
            <label className="block">
              <span className="text-[11px] font-medium text-gray-500">견적서 제목</span>
              <input className={`${inputCls} mt-1 font-semibold`} value={quoteTitle} onChange={(e) => setQuoteTitle(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-medium text-gray-500">견적번호</span>
                <input className={`${inputCls} mt-1 font-mono bg-slate-50`} value={quoteNo} readOnly />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-gray-500">유효기간 (발행일 + N일)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number" min={1} max={90}
                    className={`${inputCls} w-16 text-right font-mono`}
                    value={publishMeta.validUntilDays}
                    onChange={(e) => set({ validUntilDays: Math.max(1, Number(e.target.value)) })}
                  />
                  <span className="text-[11px] text-gray-400">~ {fmt(validUntil)}</span>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-800">결제 조건 · 제외 사항 · 특약</h3>
            <label className="block">
              <span className="text-[11px] font-medium text-gray-500">결제 조건</span>
              <textarea rows={2} className={`${areaCls} mt-1`} value={publishMeta.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-gray-500">제외 사항</span>
              <textarea rows={2} className={`${areaCls} mt-1`} value={publishMeta.exclusions} onChange={(e) => set({ exclusions: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-gray-500">특약 사항</span>
              <textarea rows={2} className={`${areaCls} mt-1`} value={publishMeta.specialTerms} onChange={(e) => set({ specialTerms: e.target.value })} />
            </label>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              내부 메모
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1">고객 견적서 미노출</span>
            </h3>
            <textarea
              rows={3}
              className={`${areaCls} bg-white`}
              placeholder="담당자 간 공유용 메모 (마진 근거, 협상 여지, 내부 원가 이슈 등)"
              value={publishMeta.internalMemo}
              onChange={(e) => set({ internalMemo: e.target.value })}
            />
            <p className="text-[10px] text-amber-700">적용 목표 마진율 {targetMarginRate}% · 총 제조원가 {won(summary.totalManufacturingCost)}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-gray-800">품목별 노출 여부</h3>
            <p className="text-[11px] text-gray-500">체크 해제한 품목은 고객 견적서 명세에서 제외되고 금액도 합산되지 않습니다.</p>
            <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100">
              {breakdowns.map((b) => {
                const shown = !hidden.has(b.id);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded text-blue-600 shrink-0"
                        checked={shown}
                        onChange={(e) => {
                          const nextHidden = new Set(hidden);
                          if (e.target.checked) nextHidden.delete(b.id);
                          else nextHidden.add(b.id);
                          set({ hiddenBreakdownIds: [...nextHidden] });
                        }}
                      />
                      <span className={`truncate ${shown ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {b.name}
                      </span>
                    </label>
                    <span className="flex items-center gap-1.5 shrink-0 font-mono text-gray-500">
                      {won(b.sellingTotal)}
                      {shown ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* ── 우: 고객용 A4 미리보기 ─────────────────── */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-gray-300 shadow-md p-7 text-gray-800 space-y-5 print:shadow-none print:border-0">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-blue-600 tracking-wider">QUEEN KITCHEN SYSTEM</span>
                <h1 className="text-xl font-black text-slate-900 mt-1">{quoteTitle}</h1>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  발행일 {fmt(issueDate)} · 유효기간 {fmt(validUntil)} · 견적번호 #{quoteNo}
                  {(savedQuote?.version ?? nextVersion) > 1 && ` (V${savedQuote?.version ?? nextVersion})`}
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-600 space-y-0.5 border-l border-slate-200 pl-3">
                <div className="font-bold text-slate-900">퀸 주방가구</div>
                <div>대표 김대표 · 123-45-67890</div>
                <div>031-000-0000</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div><span className="text-slate-500">고객명</span> <b className="ml-1.5">{orderEntity.customerName}</b></div>
              <div><span className="text-slate-500">연락처</span> <span className="ml-1.5 font-mono">{orderEntity.contact}</span></div>
              <div className="col-span-2"><span className="text-slate-500">현장</span> <span className="ml-1.5">{orderEntity.address}</span></div>
            </div>

            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-lg p-4 flex justify-between items-end">
              <div>
                <span className="text-[11px] text-slate-300">공급가액 (VAT 별도)</span>
                <div className="text-xl font-black font-mono mt-0.5">{won(supply)}</div>
              </div>
              <div className="text-right text-[11px]">
                <div className="text-slate-300">부가세 <span className="font-mono text-white">{won(vat)}</span></div>
                <div className="text-emerald-400 font-bold mt-0.5">합계 <span className="font-mono">{won(grand)}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">견적 명세</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border border-slate-200 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="py-1.5 px-2 border-r border-slate-200">구분</th>
                      <th className="py-1.5 px-2 border-r border-slate-200">품목 · 사양</th>
                      <th className="py-1.5 px-2 border-r border-slate-200 text-right">수량</th>
                      <th className="py-1.5 px-2 border-r border-slate-200 text-right">단가</th>
                      <th className="py-1.5 px-2 text-right">공급가액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {visibleRows.map((b) => (
                      <tr key={b.id}>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-sans">{b.category}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-sans font-medium text-slate-900">{b.name}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right">{b.quantity} {b.unit}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right text-slate-600">{won(b.sellingUnitPrice)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-slate-900">{won(b.sellingTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <dl className="text-[11px] text-slate-600 space-y-1.5">
              <div><dt className="font-bold text-slate-700 inline">결제 조건 </dt><dd className="inline">{publishMeta.paymentTerms}</dd></div>
              <div><dt className="font-bold text-slate-700 inline">제외 사항 </dt><dd className="inline">{publishMeta.exclusions}</dd></div>
              <div><dt className="font-bold text-slate-700 inline">특약 사항 </dt><dd className="inline">{publishMeta.specialTerms}</dd></div>
              <div className="text-slate-400">본 견적은 발행일로부터 {publishMeta.validUntilDays}일간 유효합니다.</div>
            </dl>
          </div>
        </div>
      </div>

      {/* 하단 네비 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={onPrevStep}
          className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          3단계: 원가 계산으로
        </button>

        {published ? (
          <button
            type="button"
            onClick={onStartNewVersion}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-2"
          >
            <GitBranch className="w-4 h-4" />
            새 버전으로 수정 (V{nextVersion + 1})
          </button>
        ) : (
          <button
            type="button"
            onClick={onSaveQuote}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {saving ? '발행 중...' : isRevision ? `V${nextVersion} 발행` : '견적서 발행'}
          </button>
        )}
      </div>
    </div>
  );
};
