import React from 'react';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  Layers,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { OrderEntity, LayoutType } from '../../types';
import { SAMPLE_ORDER_PRESETS } from '../../data/samplePresets';

interface QuoteStep1InputProps {
  orderEntity: OrderEntity;
  setOrderEntity: React.Dispatch<React.SetStateAction<OrderEntity>>;
  promptText: string;
  setPromptText: (text: string) => void;
  imagePreview: string | null;
  aiParsingLoading: boolean;
  isDragOver: boolean;
  extractionSuccessMsg: string | null;
  onImageSelect: (file: File) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onParseAiOrder: () => void;
  onNextStep: () => void;
}

/**
 * 견적 마법사 Step 1: 고객 정보, 치수, 모듈, 자재 선택 및 AI 도면/텍스트 파싱 컴포넌트
 */
export const QuoteStep1Input: React.FC<QuoteStep1InputProps> = ({
  orderEntity,
  setOrderEntity,
  promptText,
  setPromptText,
  imagePreview,
  aiParsingLoading,
  isDragOver,
  extractionSuccessMsg,
  onImageSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onParseAiOrder,
  onNextStep,
}) => {
  // 프리셋 로드 핸들러
  const handleLoadPreset = (index: number) => {
    const preset = SAMPLE_ORDER_PRESETS[index];
    if (!preset) return;
    setPromptText(preset.rawText);

    if (index === 0) {
      setOrderEntity({
        customerName: '박지은 고객님',
        contact: '010-3829-1940',
        address: '서울시 서초구 반포대로 120 래미안 104동 802호',
        deliveryDate: '2026-09-20',
        layoutType: 'I_SHAPE',
        dimensions: {
          lowerCabinetLengthMm: 3400,
          upperCabinetLengthMm: 3400,
          islandLengthMm: 0,
          tallCabinetWidthMm: 0,
          fridgeCabinetWidthMm: 1050,
          depthMm: 600,
          heightMm: 850,
          countertopThicknessMm: 12,
        },
        doorOption: {
          material: '한솔 E0 PET 무광 매트 화이트',
          color: '매트 화이트',
          handleType: 'C_CHANNEL',
          edgeFinish: '1.2T 방수 PUR 엣지',
        },
        countertopOption: {
          brand: 'LX 하이막스',
          model: '오로라 비앙코 12T',
          thickness: '12T',
          edgeType: '사각 빗각 가공',
        },
        modules: {
          drawerCount2Tier: 1,
          drawerCount3Tier: 1,
          sinkCabinetCount: 1,
          cooktopCabinetCount: 1,
          spiceRackCount: 1,
          cornerModuleCount: 0,
          riceCookerModuleCount: 0,
        },
        appliances: {
          sinkBowlModel: '백조 그랜드 860 사각싱크볼',
          faucetModel: '더존테크 슈티에 거위목 수전 (니켈)',
          hoodModel: '하츠 스퀘어 후드 900 (DTR-90S)',
          cooktopModel: 'SK매직 3구 인덕션',
        },
        siteConditions: {
          floor: 8,
          hasElevator: true,
          needsDemolition: true,
          needsLadderTruck: false,
          specialNotes: '8층 엘리베이터 진입 가능, 기존 싱크대 철거 폐기물 수거',
        },
        rawPrompt: preset.rawText,
      });
    } else if (index === 1) {
      setOrderEntity({
        customerName: '이현우 소장',
        contact: '010-9281-5541',
        address: '경기도 성남시 분당구 운중로 45번길 12',
        deliveryDate: '2026-10-05',
        layoutType: 'U_SHAPE',
        dimensions: {
          lowerCabinetLengthMm: 4200,
          upperCabinetLengthMm: 3600,
          islandLengthMm: 2400,
          tallCabinetWidthMm: 1200,
          fridgeCabinetWidthMm: 1000,
          depthMm: 900,
          heightMm: 880,
          countertopThicknessMm: 20,
        },
        doorOption: {
          material: '우레탄 6면 도장 (벤자민무어 샌드베이지)',
          color: '샌드베이지',
          handleType: 'C_CHANNEL',
          edgeFinish: '우레탄 라운딩 마감',
        },
        countertopOption: {
          brand: '현대 칸스톤',
          model: '마르퀴나 블랙 20T',
          thickness: '20T',
          edgeType: '빗각 엣지 가공',
        },
        modules: {
          drawerCount2Tier: 2,
          drawerCount3Tier: 3,
          sinkCabinetCount: 1,
          cooktopCabinetCount: 1,
          spiceRackCount: 1,
          cornerModuleCount: 1,
          riceCookerModuleCount: 1,
        },
        appliances: {
          sinkBowlModel: '백조 그랜드 860 사각싱크볼',
          faucetModel: '더존테크 슈티에 거위목 수전 (니켈)',
          hoodModel: '천장 아일랜드 침니 후드',
          cooktopModel: '수입 인덕션 타공',
        },
        siteConditions: {
          floor: 2,
          hasElevator: false,
          needsDemolition: false,
          needsLadderTruck: false,
          specialNotes: '2층 단독주택 양중',
        },
        rawPrompt: preset.rawText,
      });
    } else if (index === 2) {
      setOrderEntity({
        customerName: '최민수 건물주',
        contact: '010-4412-8821',
        address: '서울시 마포구 망원로 32 원룸 201호',
        deliveryDate: '2026-09-10',
        layoutType: 'I_SHAPE',
        dimensions: {
          lowerCabinetLengthMm: 2100,
          upperCabinetLengthMm: 2100,
          islandLengthMm: 0,
          tallCabinetWidthMm: 0,
          fridgeCabinetWidthMm: 0,
          depthMm: 600,
          heightMm: 850,
          countertopThicknessMm: 12,
        },
        doorOption: {
          material: 'LPM 가성비 도어 (화이트 E0 18T)',
          color: '화이트',
          handleType: 'C_CHANNEL',
          edgeFinish: '1.0T PVC 엣지',
        },
        countertopOption: {
          brand: '보급형 인조대리석',
          model: '크림화이트 12T',
          thickness: '12T',
          edgeType: '기본 라운드',
        },
        modules: {
          drawerCount2Tier: 1,
          drawerCount3Tier: 0,
          sinkCabinetCount: 1,
          cooktopCabinetCount: 1,
          spiceRackCount: 0,
          cornerModuleCount: 0,
          riceCookerModuleCount: 0,
        },
        appliances: {
          sinkBowlModel: '기본 포켓 싱크볼',
          faucetModel: '보급형 원홀 수전',
          hoodModel: '슬라이딩 후드 600',
          cooktopModel: '빌트인 2구 하이라이트',
        },
        siteConditions: {
          floor: 2,
          hasElevator: false,
          needsDemolition: true,
          needsLadderTruck: false,
          specialNotes: '철거 필요',
        },
        rawPrompt: preset.rawText,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 알림 메시지 */}
      {extractionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{extractionSuccessMsg}</span>
        </div>
      )}

      {/* 상단: 실제 주문 시나리오 프리셋 (CLICK TO LOAD) */}
      <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-gray-800 tracking-tight">
            실제 주문 시나리오 프리셋 (CLICK TO LOAD)
          </h3>
          <span className="text-[11px] text-gray-400 font-mono">
            3 Preset Scenarios Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_ORDER_PRESETS.map((preset, idx) => {
            const badgeStyles =
              idx === 0
                ? 'text-orange-700 bg-orange-50 border-orange-200'
                : idx === 1
                ? 'text-amber-800 bg-amber-50 border-amber-200'
                : 'text-yellow-800 bg-yellow-50 border-yellow-200';

            return (
              <div
                key={idx}
                onClick={() => handleLoadPreset(idx)}
                className="group border border-gray-200/80 hover:border-blue-400 rounded-lg p-3 bg-white hover:bg-blue-50/20 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeStyles}`}
                    >
                      {preset.badge}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600 transition-colors flex items-center gap-0.5"
                    >
                      LOAD &rarr;
                    </button>
                  </div>
                  <h4 className="text-xs font-bold text-gray-800 line-clamp-1 mb-1 group-hover:text-blue-700">
                    {preset.title}
                  </h4>
                  <p className="text-[11px] text-gray-500 line-clamp-1">
                    {preset.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 메인 2열 그리드: 좌측 AI DATA EXTRACTION vs 우측 추출된 주문 엔티티 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 좌측: 1. AI DATA EXTRACTION */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3.5">
          {/* 헤더 & AI 파일 자동입력 버튼 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                1. AI DATA EXTRACTION (발주서/도면 분석)
              </h3>
            </div>
            <label className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold px-2.5 py-1 rounded cursor-pointer shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto">
              <Upload className="w-3.5 h-3.5" />
              <span>AI 발주서/도면 자동 입력</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  e.target.files?.[0] && onImageSelect(e.target.files[0])
                }
                className="hidden"
              />
            </label>
          </div>

          {/* 도면/메모 이미지 드롭존 */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/50 ${
              isDragOver ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'
            }`}
          >
            {imagePreview ? (
              <div className="relative w-full flex flex-col items-center justify-center">
                <img
                  src={imagePreview}
                  alt="도면 첨부"
                  className="max-h-24 rounded border border-gray-200 object-contain mb-1"
                />
                <span className="text-[10px] text-emerald-600 font-medium">
                  이미지 파일 첨부 완료
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Upload className="w-6 h-6 mx-auto text-gray-400 stroke-1" />
                <p className="text-xs text-gray-600">
                  수기 견적서, 실측 메모, 손도면 사진을 드래그하거나 선택하세요
                </p>
                <div>
                  <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded cursor-pointer shadow-xs transition-colors">
                    도면/메모 이미지 선택
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] && onImageSelect(e.target.files[0])
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 상담 메모 / 텍스트에리어 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">
                상담 메모 / 카톡 문의 / 치수 기재란
              </label>
              <button
                type="button"
                onClick={() => setPromptText(SAMPLE_ORDER_PRESETS[0].rawText)}
                className="text-[11px] text-blue-600 hover:underline font-medium"
              >
                + 표준 양식 예시 삽입
              </button>
            </div>
            <textarea
              rows={9}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="상담 메모 또는 고객 요청사항을 입력하세요..."
              className="w-full bg-slate-50/70 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
            />
          </div>

          {/* AI 실행 버튼 */}
          <button
            type="button"
            onClick={onParseAiOrder}
            disabled={aiParsingLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            {aiParsingLoading ? (
              <span>Gemini 3.7 AI 파싱 중...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI 주문 파라미터 자동 추출 실행</span>
              </>
            )}
          </button>
        </div>

        {/* 우측: 추출된 주문 엔티티 및 정밀 파라미터 */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3.5">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-gray-800">
                추출된 주문 엔티티 및 정밀 파라미터
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              OrderEntity Spec
            </span>
          </div>

          {/* 고객 정보 3열 */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-500 font-medium mb-1">
                고객명/현장
              </label>
              <input
                type="text"
                value={orderEntity.customerName}
                onChange={(e) =>
                  setOrderEntity({ ...orderEntity, customerName: e.target.value })
                }
                className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none bg-white font-medium"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-500 font-medium mb-1">
                연락처
              </label>
              <input
                type="text"
                value={orderEntity.contact}
                onChange={(e) =>
                  setOrderEntity({ ...orderEntity, contact: e.target.value })
                }
                className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none bg-white font-medium"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-500 font-medium mb-1">
                현장 주소
              </label>
              <input
                type="text"
                value={orderEntity.address}
                onChange={(e) =>
                  setOrderEntity({ ...orderEntity, address: e.target.value })
                }
                className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none bg-white font-medium truncate"
              />
            </div>
          </div>

          {/* 상세 규격 치수 (MM 단위 정밀 환산) */}
          <div className="border border-gray-100 bg-slate-50/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-gray-700">
                  상세 규격 치수 (MM 단위 정밀 환산)
                </span>
              </div>
              <select
                value={orderEntity.layoutType}
                onChange={(e) =>
                  setOrderEntity({
                    ...orderEntity,
                    layoutType: e.target.value as LayoutType,
                  })
                }
                className="border border-gray-200 rounded bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="I_SHAPE">ㅡ자형 (일자형)</option>
                <option value="L_SHAPE">ㄱ자형 주방</option>
                <option value="U_SHAPE">ㄷ자형 주방</option>
                <option value="ISLAND_PARALLEL">아일랜드 대면형</option>
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  하부장 길이 (mm)
                </label>
                <input
                  type="number"
                  value={orderEntity.dimensions.lowerCabinetLengthMm}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      dimensions: {
                        ...orderEntity.dimensions,
                        lowerCabinetLengthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-gray-200 bg-white rounded px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  상부장 길이 (mm)
                </label>
                <input
                  type="number"
                  value={orderEntity.dimensions.upperCabinetLengthMm}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      dimensions: {
                        ...orderEntity.dimensions,
                        upperCabinetLengthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-gray-200 bg-white rounded px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  아일랜드 길이 (mm)
                </label>
                <input
                  type="number"
                  value={orderEntity.dimensions.islandLengthMm || 0}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      dimensions: {
                        ...orderEntity.dimensions,
                        islandLengthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-gray-200 bg-white rounded px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  냉장고장 폭 (mm)
                </label>
                <input
                  type="number"
                  value={orderEntity.dimensions.fridgeCabinetWidthMm || 0}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      dimensions: {
                        ...orderEntity.dimensions,
                        fridgeCabinetWidthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-gray-200 bg-white rounded px-2.5 py-1.5 font-mono text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 도어 & 마감재 사양 vs 상판 / 인조대리석 사양 2열 박스 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 좌측: 도어 & 마감재 사양 */}
            <div className="border border-gray-100 rounded-lg p-2.5 space-y-2 bg-slate-50/20">
              <span className="text-[11px] font-bold text-blue-600 block">
                도어 &amp; 마감재 사양
              </span>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  도어 재질 및 색상
                </label>
                <input
                  type="text"
                  value={orderEntity.doorOption.material}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      doorOption: { ...orderEntity.doorOption, material: e.target.value },
                    })
                  }
                  className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800 font-medium truncate"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">
                    손잡이 방식
                  </label>
                  <select
                    value={orderEntity.doorOption.handleType}
                    onChange={(e) =>
                      setOrderEntity({
                        ...orderEntity,
                        doorOption: {
                          ...orderEntity.doorOption,
                          handleType: e.target.value as any,
                        },
                      })
                    }
                    className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800"
                  >
                    <option value="C_CHANNEL">C찬넬 핸들리스</option>
                    <option value="WOOD_CHANNEL">목찬넬 핸들리스</option>
                    <option value="PUSH_OPEN">푸시 철물</option>
                    <option value="PULL_HANDLE">돌출 손잡이</option>
                    <option value="EDGE_PULL">내리기 핸들리스</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">
                    엣지 마감
                  </label>
                  <input
                    type="text"
                    value={orderEntity.doorOption.edgeFinish}
                    onChange={(e) =>
                      setOrderEntity({
                        ...orderEntity,
                        doorOption: {
                          ...orderEntity.doorOption,
                          edgeFinish: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* 우측: 상판 / 인조대리석 사양 */}
            <div className="border border-gray-100 rounded-lg p-2.5 space-y-2 bg-slate-50/20">
              <span className="text-[11px] font-bold text-amber-700 block">
                상판 / 인조대리석 사양
              </span>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">
                  브랜드 및 모델명
                </label>
                <input
                  type="text"
                  value={`${orderEntity.countertopOption.brand} ${orderEntity.countertopOption.model}`}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      countertopOption: {
                        ...orderEntity.countertopOption,
                        model: e.target.value,
                      },
                    })
                  }
                  className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800 font-medium truncate"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">
                    상판 두께
                  </label>
                  <input
                    type="text"
                    value={orderEntity.countertopOption.thickness}
                    onChange={(e) =>
                      setOrderEntity({
                        ...orderEntity,
                        countertopOption: {
                          ...orderEntity.countertopOption,
                          thickness: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">
                    가공 방식
                  </label>
                  <input
                    type="text"
                    value={orderEntity.countertopOption.edgeType}
                    onChange={(e) =>
                      setOrderEntity({
                        ...orderEntity,
                        countertopOption: {
                          ...orderEntity.countertopOption,
                          edgeType: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 기기 사양 4열 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">
                싱크볼
              </label>
              <input
                type="text"
                value={orderEntity.appliances.sinkBowlModel}
                onChange={(e) =>
                  setOrderEntity({
                    ...orderEntity,
                    appliances: {
                      ...orderEntity.appliances,
                      sinkBowlModel: e.target.value,
                    },
                  })
                }
                className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800 truncate"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">
                수전
              </label>
              <input
                type="text"
                value={orderEntity.appliances.faucetModel}
                onChange={(e) =>
                  setOrderEntity({
                    ...orderEntity,
                    appliances: {
                      ...orderEntity.appliances,
                      faucetModel: e.target.value,
                    },
                  })
                }
                className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800 truncate"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">
                렌지후드
              </label>
              <input
                type="text"
                value={orderEntity.appliances.hoodModel}
                onChange={(e) =>
                  setOrderEntity({
                    ...orderEntity,
                    appliances: {
                      ...orderEntity.appliances,
                      hoodModel: e.target.value,
                    },
                  })
                }
                className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800 truncate"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">
                쿡탑/인덕션
              </label>
              <input
                type="text"
                value={orderEntity.appliances.cooktopModel}
                onChange={(e) =>
                  setOrderEntity({
                    ...orderEntity,
                    appliances: {
                      ...orderEntity.appliances,
                      cooktopModel: e.target.value,
                    },
                  })
                }
                className="w-full border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-800 truncate"
              />
            </div>
          </div>

          {/* 옵션 및 현장 조건 체크박스 */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={orderEntity.siteConditions.needsDemolition}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      siteConditions: {
                        ...orderEntity.siteConditions,
                        needsDemolition: e.target.checked,
                      },
                    })
                  }
                  className="w-3.5 h-3.5 text-blue-600 rounded"
                />
                <span>기존 싱크대 철거 필요</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={orderEntity.siteConditions.hasElevator}
                  onChange={(e) =>
                    setOrderEntity({
                      ...orderEntity,
                      siteConditions: {
                        ...orderEntity.siteConditions,
                        hasElevator: e.target.checked,
                      },
                    })
                  }
                  className="w-3.5 h-3.5 text-blue-600 rounded"
                />
                <span>
                  엘리베이터 있음 ({orderEntity.siteConditions.floor}층)
                </span>
              </label>
            </div>

            <div className="text-[10px] font-mono text-gray-400 font-semibold tracking-wider">
              DEMOLITION: {orderEntity.siteConditions.needsDemolition ? 'YES' : 'NO'}
            </div>
          </div>

          {/* 다음 단계 버튼 */}
          <button
            type="button"
            onClick={onNextStep}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            <span>결정론적 원가 및 견적 산출 실행 (NEXT STEP &rarr;)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

