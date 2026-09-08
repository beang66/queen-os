import React, { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  UploadCloud,
  FileText,
  ClipboardCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  Save,
  ArrowRight,
  FilePenLine,
  Search,
  Loader2,
} from 'lucide-react';
import { OrderEntity, PricingItem, ReviewLineItem } from '../../types';
import { SAMPLE_ORDER_PRESETS } from '../../data/samplePresets';
import { CustomerSiteInfo } from './review/CustomerSiteInfo';
import { KitchenItemsTable } from './review/KitchenItemsTable';
import { DetailOptionsPanel } from './review/DetailOptionsPanel';
import { AttachedFile, classifyFile, formatFileSize, formatStamp, getRequiredFields } from './review/reviewModel';

const MEMO_MAX_LENGTH = 2000;

interface QuoteStep1InputProps {
  orderEntity: OrderEntity;
  setOrderEntity: React.Dispatch<React.SetStateAction<OrderEntity>>;
  promptText: string;
  setPromptText: (text: string) => void;
  attachedFiles: AttachedFile[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  reviewItems: ReviewLineItem[];
  setReviewItems: React.Dispatch<React.SetStateAction<ReviewLineItem[]>>;
  pricingItems: PricingItem[];
  aiParsingLoading: boolean;
  onLoadPreset: (index: number) => void;
  onParseAiOrder: () => void;
  onNextStep: () => void;
}

/**
 * 견적 마법사 1단계: 자료 입력
 * 좌측에서 도면·메모·사진을 올리고 AI로 정보를 추출하면, 우측에서 추출 결과를 바로 검수합니다.
 */
export const QuoteStep1Input: React.FC<QuoteStep1InputProps> = ({
  orderEntity,
  setOrderEntity,
  promptText,
  setPromptText,
  attachedFiles,
  setAttachedFiles,
  reviewItems,
  setReviewItems,
  pricingItems,
  aiParsingLoading,
  onLoadPreset,
  onParseAiOrder,
  onNextStep,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetQuery, setPresetQuery] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 필수 정보 및 단가 연결 검사
  const requiredFields = useMemo(() => getRequiredFields(orderEntity), [orderEntity]);
  const filledCount = requiredFields.filter((f) => f.ok).length;
  const missingCount = requiredFields.length - filledCount;
  const unlinkedCount = reviewItems.filter((i) => i.status === 'NEEDS_PRICING').length;
  const canProceed = missingCount === 0 && unlinkedCount === 0;

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const stamp = formatStamp(new Date());
    Array.from(files).forEach((file) => {
      const entry: AttachedFile = {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeLabel: formatFileSize(file.size),
        uploadedAt: stamp,
        kind: classifyFile(file),
        previewUrl: null,
      };
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () =>
          setAttachedFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, previewUrl: reader.result as string } : f)));
        reader.readAsDataURL(file);
      }
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = () => setPromptText(String(reader.result ?? '').slice(0, MEMO_MAX_LENGTH));
        reader.readAsText(file);
      }
      setAttachedFiles((prev) => [...prev, entry]);
    });
  };

  const handleTempSave = () => {
    const now = new Date();
    setSavedAt(`오늘 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const filteredPresets = SAMPLE_ORDER_PRESETS.map((p, i) => ({ ...p, index: i })).filter(
    (p) => !presetQuery.trim() || `${p.title} ${p.description} ${p.rawText}`.toLowerCase().includes(presetQuery.toLowerCase())
  );

  const kindBadge = (kind: AttachedFile['kind']) =>
    kind === '도면'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : kind === '이미지'
      ? 'text-purple-700 bg-purple-50 border-purple-200'
      : 'text-gray-600 bg-gray-100 border-gray-200';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── 좌측: 상담 자료 입력 ─────────────────────────────── */}
        <section className="lg:col-span-4 bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-4">
          <div className="flex items-start gap-2">
            <FileText className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-gray-800">상담 자료 입력</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">도면, 메모, 사진을 업로드하면 AI가 자동으로 정보를 추출합니다.</p>
            </div>
          </div>

          {/* 1. 업로드 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700">1. 도면 · 메모 · 사진 업로드</h4>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-4 py-7 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors ${
                isDragOver ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 bg-slate-50/50 hover:border-blue-300'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-gray-400 stroke-[1.5]" />
              <p className="text-xs font-medium text-gray-600">여기에 파일을 드래그하거나 클릭하여 업로드하세요</p>
              <p className="text-[11px] text-gray-400">도면 (PDF, JPG, PNG), 메모 (TXT), 사진 파일을 지원합니다.</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-colors"
              >
                파일 선택하기
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/plain"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* 첨부된 파일 목록 */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-700">첨부된 파일 ({attachedFiles.length})</h4>
              <ul className="space-y-2">
                {attachedFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 border border-gray-200 rounded-lg p-2">
                    <div className="w-11 h-11 shrink-0 rounded-md bg-slate-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {f.previewUrl ? (
                        <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{f.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {f.sizeLabel} <span className="text-gray-300">|</span> {f.uploadedAt}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${kindBadge(f.kind)}`}>{f.kind}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className="text-gray-300 hover:text-red-500 shrink-0"
                      title="첨부 삭제"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. 상담 메모 */}
          <div className="space-y-2 relative">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700">2. 상담 메모 / 카톡 문의</h4>
              <button
                type="button"
                onClick={() => setPresetOpen((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-md px-1.5 py-1 transition-colors"
              >
                <FilePenLine className="w-3.5 h-3.5" />
                예시 불러오기
              </button>
            </div>

            {/* 기존 고객·현장 및 실제 주문 사례 검색 팝오버 */}
            {presetOpen && (
              <div className="absolute right-0 top-7 z-20 w-full sm:w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 space-y-2">
                <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5 bg-slate-50/60">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    autoFocus
                    value={presetQuery}
                    onChange={(e) => setPresetQuery(e.target.value)}
                    placeholder="기존 고객·현장·주문 사례 검색"
                    className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <ul className="max-h-60 overflow-y-auto space-y-1">
                  {filteredPresets.map((p) => (
                    <li key={p.index}>
                      <button
                        type="button"
                        onClick={() => {
                          onLoadPreset(p.index);
                          setPresetOpen(false);
                        }}
                        className="w-full text-left rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 p-2 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                          {p.badge}
                        </span>
                        <p className="text-xs font-bold text-gray-800 mt-1 line-clamp-1">{p.title}</p>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{p.description}</p>
                      </button>
                    </li>
                  ))}
                  {filteredPresets.length === 0 && (
                    <li className="py-6 text-center text-[11px] text-gray-400">검색 결과가 없습니다.</li>
                  )}
                </ul>
              </div>
            )}

            <textarea
              rows={9}
              value={promptText}
              maxLength={MEMO_MAX_LENGTH}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="상담 메모, 카톡 문의 내용을 붙여넣으세요..."
              className="w-full bg-slate-50/70 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-none"
            />
            <div className="text-right text-[11px] font-mono text-gray-400">
              {promptText.length} / {MEMO_MAX_LENGTH}
            </div>
          </div>

          {/* AI 정보 추출 */}
          <button
            type="button"
            onClick={onParseAiOrder}
            disabled={aiParsingLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            {aiParsingLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI 정보 추출 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI 정보 추출</span>
              </>
            )}
          </button>
        </section>

        {/* ── 우측: 추출 결과 검수 ─────────────────────────────── */}
        <section className="lg:col-span-8 bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-gray-800">추출 결과 검수</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">AI가 추출한 정보를 검토하고, 필요한 항목을 수정하세요.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500">필수 정보</span>
                  <span className="text-xs font-mono font-bold text-blue-600">
                    {filledCount}/{requiredFields.length}
                  </span>
                </div>
                <div className="w-32 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${missingCount === 0 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${(filledCount / requiredFields.length) * 100}%` }}
                  />
                </div>
              </div>

              {missingCount > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1.5 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  확인 필요 {missingCount}건
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <CheckCircle2 className={`w-4 h-4 ${savedAt ? 'text-emerald-500' : 'text-gray-300'}`} />
                <div className="leading-tight">
                  <p className={`text-[11px] font-bold ${savedAt ? 'text-gray-700' : 'text-gray-400'}`}>
                    {savedAt ? '임시 저장됨' : '저장 전'}
                  </p>
                  {savedAt && <p className="text-[10px] text-gray-400 font-mono">{savedAt}</p>}
                </div>
              </div>
            </div>
          </div>

          <CustomerSiteInfo orderEntity={orderEntity} setOrderEntity={setOrderEntity} />
          <KitchenItemsTable items={reviewItems} setItems={setReviewItems} pricingItems={pricingItems} />
          <DetailOptionsPanel orderEntity={orderEntity} setOrderEntity={setOrderEntity} />
        </section>
      </div>

      {/* ── 하단 액션 바 ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleTempSave}
          className="w-full sm:w-auto border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <Save className="w-4 h-4 text-blue-500" />
          임시 저장
        </button>

        {!canProceed && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 text-center">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {missingCount > 0
              ? `필수 정보 ${missingCount}개를 확인하면 다음 단계로 이동할 수 있습니다.`
              : `미연결 단가 ${unlinkedCount}건 확인 필요`}
          </span>
        )}

        <button
          type="button"
          disabled={!canProceed}
          onClick={onNextStep}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-lg shadow-xs text-xs flex items-center justify-center gap-2 transition-colors"
        >
          규격 검수 완료 및 다음 단계
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
