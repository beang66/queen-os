import React from 'react';
import {
  FileText,
  Sparkles,
  Database,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  Layers,
  Cpu,
  Lock,
  Workflow,
  Search,
} from 'lucide-react';

export const SystemDiagram: React.FC = () => {
  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Introduction Card */}
      <div className="bg-[#1e293b] border border-gray-700 rounded-lg p-4 text-white shadow-md">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded text-blue-300">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-blue-300 font-bold font-mono">System Architecture</span>
            <h2 className="text-base font-bold mt-0.5 text-white tracking-tight">
              퀸 주방가구 견적 및 원가 자동화 시스템 구조 & 파이프라인
            </h2>
            <p className="text-gray-300 text-xs mt-1 leading-relaxed">
              본 시스템은 <strong>멀티모달 AI 비정형 파싱</strong>과 <strong>100% 결정론적(Deterministic) 수식 계산 엔진</strong>을
              철저히 분리 결합하여, AI 환각 없이 실시간 자재비, 가공비, 시공비, 마진율을 오차 0원으로 정확하게 산출하고
              단가 스냅샷을 영구 보존하는 주방가구 전문 제조/견적 플랫폼입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 1. End-to-End Data Pipeline Flowchart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3 border-b border-gray-100 pb-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">5단계 데이터 처리 파이프라인 (Data Pipeline)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          {/* Step 1 */}
          <div className="bg-gray-50 rounded border border-gray-200 p-2.5 flex flex-col justify-between hover:border-blue-400 transition text-xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded bg-[#1e293b] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  01
                </span>
                <span className="text-[9px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded uppercase">Multimodal</span>
              </div>
              <h4 className="font-bold text-xs text-gray-900 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                비정형 문서 파싱
              </h4>
              <p className="text-[11px] text-gray-600 leading-normal">
                수기 견적서, 공급사 단가표 PDF/엑셀, 도면 텍스트를 Gemini Flash에 입력
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
              <span className="font-bold text-gray-700">OUTPUT:</span> JSON Schema
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-gray-50 rounded border border-gray-200 p-2.5 flex flex-col justify-between hover:border-blue-400 transition text-xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded bg-[#1e293b] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  02
                </span>
                <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded uppercase">Database</span>
              </div>
              <h4 className="font-bold text-xs text-gray-900 mb-1 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                통합 단가표 DB
              </h4>
              <p className="text-[11px] text-gray-600 leading-normal">
                몸통/도어/상판/철물/기기/시공 7대 카테고리별 원가·출고단가 적재 및 조회
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
              <span className="font-bold text-gray-700">FEATURE:</span> 실시간 단가 매칭
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-gray-50 rounded border border-gray-200 p-2.5 flex flex-col justify-between hover:border-blue-400 transition text-xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded bg-[#1e293b] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  03
                </span>
                <span className="text-[9px] font-mono font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded uppercase">Entity AI</span>
              </div>
              <h4 className="font-bold text-xs text-gray-900 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                주문 엔티티 추출
              </h4>
              <p className="text-[11px] text-gray-600 leading-normal">
                치수/도면/옵션(가로·세로·높이 mm, 도어, 상판, 수납장, 기기) 구조화
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
              <span className="font-bold text-gray-700">RESULT:</span> OrderEntity
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-blue-50/50 rounded border border-blue-200 p-2.5 flex flex-col justify-between hover:border-blue-400 transition text-xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  04
                </span>
                <span className="text-[9px] font-mono font-bold bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded uppercase">100% Math</span>
              </div>
              <h4 className="font-bold text-xs text-gray-900 mb-1 flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-blue-700" />
                결정론적 계산 엔진
              </h4>
              <p className="text-[11px] text-gray-700 leading-normal">
                AI 산출 배제, 코드 산식(mm×단가, 도어 면적, 힌지/레일)으로 원가/마진 수치 계산
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-blue-200 text-[10px] text-blue-900 font-mono font-bold">
              <span>VALIDATION:</span> 오차 0원 검증
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-gray-50 rounded border border-gray-200 p-2.5 flex flex-col justify-between hover:border-blue-400 transition text-xs">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded bg-[#1e293b] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  05
                </span>
                <span className="text-[9px] font-mono font-bold bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded uppercase">Audit Trail</span>
              </div>
              <h4 className="font-bold text-xs text-gray-900 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-orange-600" />
                저장 & 단가 스냅샷
              </h4>
              <p className="text-[11px] text-gray-600 leading-normal">
                최종 견적서 영구 저장 및 해당 시점의 적용 자재 단가 스냅샷 동결
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-gray-200 text-[10px] text-gray-500 font-mono">
              <span className="font-bold text-gray-700">OUTPUT:</span> PDF / Excel
            </div>
          </div>
        </div>
      </div>

      {/* 2. UI Layout & Screen Structure Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Left: 화면 구조 (UI Architecture) */}
        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 border-b border-gray-100 pb-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">화면 구조 (UI Layout Structure)</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-gray-700">
            <li className="flex items-start gap-2">
              <div className="w-4 h-4 rounded bg-[#1e293b] text-white font-bold flex items-center justify-center shrink-0 text-[10px] font-mono">
                A
              </div>
              <div>
                <strong className="text-gray-900 block font-semibold text-xs">
                  1. 신규 견적 산출 마법사 (Quote Engine)
                </strong>
                3단계 플로우: [주문 분석 & 치수 입력] → [결정론적 원가 산출표 & 마진 시뮬레이터] → [공식 견적서 발행 & PDF/엑셀 내보내기].
              </div>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-4 h-4 rounded bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px] font-mono">
                B
              </div>
              <div>
                <strong className="text-gray-900 block font-semibold text-xs">
                  2. 비정형 문서 AI 파싱기 (Data Extraction)
                </strong>
                수기 메모, 공급사 카탈로그 이미지, 엑셀 텍스트를 드래그 앤 드롭하여 Gemini로 정형 데이터 추출 후, 1-클릭으로 DB에 병합.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-4 h-4 rounded bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px] font-mono">
                C
              </div>
              <div>
                <strong className="text-gray-900 block font-semibold text-xs">
                  3. 통합 단가표 DB 관리기 (Pricing DB Manager)
                </strong>
                7대 카테고리별 자재·가공·시공 단가 검색, 수정, 일괄 인상/인하 시뮬레이션, 표준 단가표 카탈로그 복원.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-4 h-4 rounded bg-orange-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px] font-mono">
                D
              </div>
              <div>
                <strong className="text-gray-900 block font-semibold text-xs">
                  4. 견적 이력 및 단가 감사실 (Audit & History)
                </strong>
                발행된 모든 견적서의 파이프라인 관리, 과거 견적서의 적용 단가 스냅샷 역추적 및 마진율 분석.
              </div>
            </li>
          </ul>
        </div>

        {/* Right: 견적 산식 및 검증 엔진 원리 (Deterministic Math Rules) */}
        <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 border-b border-gray-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">결정론적 견적 산식 (Deterministic Formula)</h3>
          </div>
          <div className="space-y-1.5 text-xs text-gray-600 font-mono bg-gray-50 p-2.5 rounded border border-gray-200 text-[11px]">
            <div className="text-gray-800">
              <span className="text-blue-700 font-bold">1. 몸통비</span> = (하부장m × @단가) + (상부장m × @단가) + (키큰장EA × @단가)
            </div>
            <div className="text-gray-800">
              <span className="text-blue-700 font-bold">2. 도어비</span> = 도어 총 면적(m²) × @도어면적당단가 + 마감판넬
            </div>
            <div className="text-gray-800">
              <span className="text-purple-700 font-bold">3. 상판비</span> = 상판길이m × @대리석단가 + 타공/접합 가공비
            </div>
            <div className="text-gray-800">
              <span className="text-emerald-700 font-bold">4. 철물/기기</span> = 힌지/레일 + 싱크볼·수전·후드·쿡탑 확정가
            </div>
            <div className="text-gray-800">
              <span className="text-rose-700 font-bold">5. 시공/양중</span> = (연장길이 × @시공비) + 철거비 + 사다리차비
            </div>
            <div className="pt-1.5 border-t border-gray-200 text-gray-900 font-bold text-xs">
              총 공급가 = 제조원가합계 ÷ (1 - 마진율) or 원가 + 마진금액
            </div>
          </div>
          <div className="mt-2.5 text-[11px] text-gray-600 leading-relaxed font-sans">
            <strong className="text-gray-800">예외 검증 규칙:</strong> 하부장 길이 미입력(오류), 비표준 깊이(경고), 단가표 미등록 자재 자동 탐지 및 대체 자재 제안.
          </div>
        </div>
      </div>
    </div>
  );
};
