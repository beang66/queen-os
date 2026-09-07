import React, { useState } from 'react';
import { DocumentUploadArea } from './extractor/DocumentUploadArea';
import { ExtractedPricingTable } from './extractor/ExtractedPricingTable';
import { ExtractedOrderPreview } from './extractor/ExtractedOrderPreview';
import { ParsedPriceItem, OrderEntity } from '../types';

const SAMPLE_PARSED_ORDER_ENTITY: OrderEntity = {
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
    faucetModel: '더죤테크 슈티에 거위목 수전 (니켈)',
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
};

interface DocumentExtractorProps {
  onApplyToPricingDb: (items: ParsedPriceItem[]) => Promise<void>;
  onNavigateToDb: () => void;
  onTransferToQuote: (order: OrderEntity) => void;
}

/**
 * 퀸 주방가구 AI 비구조화 문서 파서 (DocumentExtractor) 메인 컨테이너 컴포넌트
 */
export const DocumentExtractor: React.FC<DocumentExtractorProps> = ({
  onApplyToPricingDb,
  onNavigateToDb,
  onTransferToQuote,
}) => {
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [extractedPricingItems, setExtractedPricingItems] = useState<ParsedPriceItem[]>([]);
  const [extractedOrderEntity, setExtractedOrderEntity] = useState<OrderEntity | null>(null);

  // 문서 업로드 및 AI 파싱 요청
  const handleFileUpload = async (file: File) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('document', file);

      const res = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (data.type === 'PRICING_TABLE') {
          setExtractedPricingItems(data.items || []);
          setExtractedOrderEntity(null);
        } else if (data.type === 'ORDER_ENTITY') {
          setExtractedOrderEntity(data.orderEntity || null);
          setExtractedPricingItems([]);
        }
      } else {
        alert('문서 파싱 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err: any) {
      alert(`업로드 오류: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // 데모 샘플 데이터 로드
  const handleSampleSelect = (type: 'pricing' | 'order') => {
    setAnalyzing(true);
    setTimeout(() => {
      if (type === 'pricing') {
        setExtractedPricingItems([
          {
            code: 'PET-MATT-WH',
            category: 'DOOR',
            name: '한솔 E0 PET 무광 매트화이트 18T',
            spec: '18mm E0 PUR 엣지',
            material: 'PET',
            unit: '㎡',
            costPrice: 42000,
            sellingPrice: 65000,
            supplier: '한솔홈데코',
          },
          {
            code: 'LX-AURORA-12',
            category: 'COUNTERTOP',
            name: 'LX 하이막스 오로라 비앙코',
            spec: '12T 빗각 가공',
            material: '인조대리석',
            unit: 'm',
            costPrice: 180000,
            sellingPrice: 270000,
            supplier: 'LX 하우시스',
          },
          {
            code: 'SINK-BOWL-860',
            category: 'HARDWARE',
            name: '백조 그랜드 860 사각싱크볼',
            spec: 'STS304 1.2T 엠보',
            material: '스테인리스',
            unit: 'EA',
            costPrice: 210000,
            sellingPrice: 320000,
            supplier: '백조싱크',
          },
        ]);
        setExtractedOrderEntity(null);
      } else {
        setExtractedOrderEntity(SAMPLE_PARSED_ORDER_ENTITY);
        setExtractedPricingItems([]);
      }
      setAnalyzing(false);
    }, 600);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. 문서 업로드 & AI 분석 영역 */}
      <DocumentUploadArea
        analyzing={analyzing}
        onFileUpload={handleFileUpload}
        onSampleSelect={handleSampleSelect}
      />

      {/* 2. 파싱된 단가 목록 프리뷰 & DB 저장 */}
      <ExtractedPricingTable
        items={extractedPricingItems}
        onApplyToPricingDb={onApplyToPricingDb}
        onNavigateToDb={onNavigateToDb}
      />

      {/* 3. 파싱된 주방 주문서 엔티티 프리뷰 & 마법사 전송 */}
      <ExtractedOrderPreview
        orderEntity={extractedOrderEntity}
        onTransferToQuote={onTransferToQuote}
      />
    </div>
  );
};
