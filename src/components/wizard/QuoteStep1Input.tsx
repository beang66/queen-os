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
import { OrderEntity, ReviewLineItem } from '../../types';
import { SAMPLE_ORDER_PRESETS } from '../../data/samplePresets';
import { AttachedFile, LAYOUT_LABELS, classifyFile, formatFileSize, formatStamp, getRequiredFields } from './review/reviewModel';

const MEMO_MAX_LENGTH = 2000;

/** 저장 시각을 HH:MM 으로 */
const savedTimeLabel = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface QuoteStep1InputProps {
  orderEntity: OrderEntity;
  promptText: string;
  setPromptText: (text: string) => void;
  attachedFiles: AttachedFile[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  reviewItems: ReviewLineItem[];
  aiParsingLoading: boolean;
  /** AI 정보 추출을 한 번이라도 성공했는지 (하단 버튼 문구 결정) */
  aiExtracted: boolean;
  /** 견적 초안을 서버에 즉시 저장 */
  onTempSave: () => void;
  tempSaving: boolean;
  /** 마지막 서버 저장 시각 (ISO) */
  lastSavedAt: string | null;
  onLoadPreset: (index: number) => void;
  onParseAiOrder: () => void;
  onNextStep: () => void;
}

/** 추출 결과 요약의 읽기 전용 항목 */
const SummaryField: React.FC<{ label: string; value?: string; required?: boolean }> = ({ label, value, required }) => {
  const filled = !!value?.trim();
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-500 mb-1">
        {label} {required && <span className="text-orange-500">*</span>}
      </p>
      <div
        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium min-h-[30px] flex items-center ${
          filled ? 'border-gray-200 bg-white text-gray-800' : 'border-orange-300 bg-orange-50/50 text-orange-600'
        }`}
      >
        <span className="truncate">{filled ? value : '확인 필요'}</span>
      </div>
    </div>
  );
};

/**
 * 견적 마법사 1단계: 자료 입력 (입력 전용)
 * 도면·메모·사진을 올리고 AI로 정보를 추출합니다.
 * 값의 수정·품목 확정·단가 DB 연결은 2단계 '규격 검수'에서 진행합니다.
 */
export const QuoteStep1Input: React.FC<QuoteStep1InputProps> = ({
  orderEntity,
  promptText,
  setPromptText,
  attachedFiles,
  setAttachedFiles,
  reviewItems,
  aiParsingLoading,
  aiExtracted,
  onTempSave,
  tempSaving,
  lastSavedAt,
  onLoadPreset,
  onParseAiOrder,
  onNextStep,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetQuery, setPresetQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 추출 현황 (여기서는 표시만 하고, 실제 보완은 2단계에서 합니다)
  const requiredFields = useMemo(() => getRequiredFields(orderEntity), [orderEntity]);
  const filledCount = requiredFields.filter((f) => f.ok).length;
  const missingCount = requiredFields.length - filledCount;
  const unlinkedCount = reviewItems.filter((i) => i.status === 'NEEDS_PRICING').length;

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

  const filteredPresets = SAMPLE_ORDER_PRESETS.map((p, i) => ({ ...p, index: i })).filter(
    (p) => !presetQuery.trim() || `${p.title} ${p.description} ${p.rawText}`.toLowerCase().includes(presetQuery.toLowerCase())
  );

  const kindBadge = (kind: AttachedFile['kind']) =>
    kind === '도면'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : kind === '이미지'
      ? 'text-purple-700 bg-purple-50 border-purple-200'
      : 'text-gray-600 bg-gray-100 border-gray-200';

  const d = orderEntity.dimensions;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── 좌측: 상담 자료 입력 ─────────────────────────────── */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-4">
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
              rows={12}
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

        {/* ── 우측: 추출 결과 요약 (읽기 전용) ─────────────────── */}
        <section className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-gray-800">추출 결과 요약</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {aiExtracted ? 'AI가 추출한 정보입니다. 수정은 다음 단계에서 합니다.' : '아직 추출하지 않았습니다.'}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded border shrink-0 ${
                aiExtracted ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-gray-500 bg-gray-100 border-gray-200'
              }`}
            >
              {aiExtracted ? 'AI 추출 완료' : '추출 전'}
            </span>
          </div>

          {/* 필수 정보 진행률 */}
          <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">필수 정보</span>
              <span className="text-xs font-mono font-bold text-blue-600">
                {filledCount}/{requiredFields.length}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${missingCount === 0 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${(filledCount / requiredFields.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <span className="text-[11px] text-gray-500">
                추출 품목 <b className="font-mono text-gray-700">{reviewItems.length}</b>건
              </span>
              {unlinkedCount > 0 && (
                <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                  미연결 단가 {unlinkedCount}건
                </span>
              )}
            </div>
          </div>

          {/* 고객 및 현장 정보 (읽기 전용) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700">고객 및 현장 정보</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <SummaryField label="고객명" required value={orderEntity.customerName} />
              <SummaryField label="연락처" required value={orderEntity.contact} />
              <div className="col-span-2">
                <SummaryField label="현장 주소" required value={orderEntity.address} />
              </div>
              <div className="col-span-2">
                <SummaryField label="프로젝트명" required value={orderEntity.projectName} />
              </div>
              <SummaryField label="상담일" required value={orderEntity.consultDate} />
              <SummaryField label="희망 시공일" required value={orderEntity.deliveryDate} />
              <SummaryField label="고객 유형" required value={orderEntity.customerType} />
              <SummaryField label="담당자" required value={orderEntity.manager} />
            </div>
          </div>

          {/* 주방 구성 (읽기 전용) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700">주방 구성</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <SummaryField label="주방 배치" value={LAYOUT_LABELS[orderEntity.layoutType]} />
              <SummaryField label="하부장 길이" required value={d.lowerCabinetLengthMm > 0 ? `${d.lowerCabinetLengthMm.toLocaleString()} mm` : ''} />
              <SummaryField label="상부장 길이" value={d.upperCabinetLengthMm > 0 ? `${d.upperCabinetLengthMm.toLocaleString()} mm` : '없음'} />
              <SummaryField label="상판" value={`${orderEntity.countertopOption.brand} ${orderEntity.countertopOption.model}`.trim()} />
              <div className="col-span-2">
                <SummaryField label="도어 사양" required value={orderEntity.doorOption.material} />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
            값 수정, 품목 추가·삭제, 단가 DB 연결은 다음 단계 <b className="text-gray-700">규격 검수</b>에서 진행합니다.
          </p>
        </section>
      </div>

      {/* ── 하단 액션 바 ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onTempSave}
          disabled={tempSaving}
          className="w-full sm:w-auto border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          {tempSaving ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          ) : (
            <Save className="w-4 h-4 text-blue-500" />
          )}
          {tempSaving ? '저장 중...' : '임시 저장'}
        </button>

        {/* 저장 상태와 누락 안내는 서로 배타적이지 않으므로 함께 표시한다. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-[11px]">
          {lastSavedAt && (
            <span className="flex items-center gap-1.5 font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              견적 관리에 저장됨{' '}
              <span className="font-mono font-normal text-gray-400">{savedTimeLabel(lastSavedAt)}</span>
            </span>
          )}
          {missingCount > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-gray-500">
              <AlertTriangle className="w-4 h-4 shrink-0 text-orange-400" />
              확인이 필요한 항목 {missingCount}건은 다음 단계에서 보완합니다.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextStep}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-xs text-xs flex items-center justify-center gap-2 transition-colors"
        >
          {aiExtracted ? '규격 검수로 이동' : '직접 입력으로 검수 시작'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
