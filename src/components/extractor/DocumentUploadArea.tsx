import React from 'react';
import { Upload, Sparkles, FileSpreadsheet, FileCheck } from 'lucide-react';

interface DocumentUploadAreaProps {
  analyzing: boolean;
  onFileUpload: (file: File) => void;
  onSampleSelect: (type: 'pricing' | 'order') => void;
}

/**
 * AI 문서 파서: 엑셀/이미지/PDF 파일 드롭 및 AI OCR 분석 실행 영역
 */
export const DocumentUploadArea: React.FC<DocumentUploadAreaProps> = ({
  analyzing,
  onFileUpload,
  onSampleSelect,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-6 shadow-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <h2 className="text-base font-bold">AI 비구조화 문서 파서 & OCR 엔티티 추출기</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            타사 엑셀 단가표, PDF 수주서, 카카오톡 텍스트, 도면 스캔본을 AI로 분석하여 데이터베이스로 적재합니다.
          </p>
        </div>

        {/* 데모 샘플 선택 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSampleSelect('pricing')}
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
            <span>샘플 엑셀 단가표 파싱</span>
          </button>
          <button
            type="button"
            onClick={() => onSampleSelect('order')}
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>샘플 주방 주문서 파싱</span>
          </button>
        </div>
      </div>

      {/* 파일 드롭존 */}
      <div className="border-2 border-dashed border-slate-700 bg-slate-800/40 rounded-xl p-6 text-center hover:border-blue-500 transition-colors relative">
        {analyzing ? (
          <div className="py-4 space-y-2">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-200">
              Gemini 3.7 AI Vision & Document Parser 실행 중...
            </p>
            <p className="text-[11px] text-slate-400">문서 내 항목, 규격, 단가를 구조화하고 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-200">
              분석할 엑셀(.xlsx), PDF, 이미지 문서 파일 드래그 & 드롭
            </p>
            <p className="text-[11px] text-slate-400">또는 PC에서 직접 파일을 선택하세요</p>
            <label className="inline-block mt-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">
              파일 선택하여 업로드
              <input
                type="file"
                accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
