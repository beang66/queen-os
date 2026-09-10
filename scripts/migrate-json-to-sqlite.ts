/**
 * 기존 data/db.json (JSON 파일 저장소) → Prisma/SQLite 1회 이관 스크립트.
 *
 * 실행: npx tsx scripts/migrate-json-to-sqlite.ts
 * 원본 db.json은 삭제하지 않고 .migrated 접미사로 이름만 바꿔 보존합니다.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DB_JSON_PATH = path.join(process.cwd(), 'data', 'db.json');

/** 초안 revision의 appliedPricingSnapshot 제거 — 스키마 전환과 함께 이 낭비도 정리한다. */
function stripPricingSnapshot(payload: any) {
  if (!payload?.calculationResult?.appliedPricingSnapshot) return payload;
  const { appliedPricingSnapshot, ...restCalc } = payload.calculationResult;
  return { ...payload, calculationResult: restCalc };
}

async function main() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.log('data/db.json 이 없습니다. 이관할 데이터가 없어 종료합니다.');
    return;
  }

  const legacy = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
  const pricingItems = Array.isArray(legacy.pricingItems) ? legacy.pricingItems : [];
  const quotes = Array.isArray(legacy.quotes) ? legacy.quotes : [];
  const drafts = Array.isArray(legacy.drafts) ? legacy.drafts : [];

  console.log(`이관 대상: 단가 ${pricingItems.length}건 / 견적서 ${quotes.length}건 / 초안 ${drafts.length}건`);

  const existingCounts = {
    pricing: await prisma.pricingItem.count(),
    quotes: await prisma.quote.count(),
    drafts: await prisma.draft.count(),
  };
  if (existingCounts.pricing + existingCounts.quotes + existingCounts.drafts > 0) {
    console.error(
      `[중단] SQLite에 이미 데이터가 있습니다 (단가 ${existingCounts.pricing} / 견적서 ${existingCounts.quotes} / 초안 ${existingCounts.drafts}).`
    );
    console.error('중복 이관을 막기 위해 중단합니다. 다시 하려면 data/queen-os.db 를 지우고 `npx prisma migrate reset` 후 재시도하세요.');
    process.exit(1);
  }

  let pricingCount = 0;
  let quoteCount = 0;
  let draftCount = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const item of pricingItems) {
        await tx.pricingItem.create({
          data: {
            id: item.id,
            code: item.code,
            category: item.category,
            name: item.name,
            spec: item.spec ?? '',
            material: item.material ?? '',
            unit: item.unit,
            costPrice: item.costPrice ?? 0,
            sellingPrice: item.sellingPrice ?? 0,
            supplier: item.supplier ?? '',
            stockStatus: item.stockStatus ?? 'INSTOCK',
            notes: item.notes ?? null,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          },
        });
        pricingCount++;
      }

      // 초안을 먼저 넣어야 견적서의 draftId 참조가 성립한다.
      for (const d of drafts) {
        const payload = stripPricingSnapshot(d.payload ?? {});
        await tx.draft.create({
          data: {
            id: d.id,
            status: d.status ?? 'ACTIVE',
            revision: d.revision ?? 1,
            payload,
            customerName: d.payload?.orderEntity?.customerName ?? '',
            projectName: d.payload?.orderEntity?.projectName ?? '',
            step: d.payload?.step ?? 1,
            totalAmount: d.payload?.calculationResult?.summary?.finalGrandTotal ?? null,
            pricingFingerprint: d.pricingFingerprint ?? null,
            lastEditorId: d.lastEditorId ?? null,
            publishedQuoteIds: d.publishedQuoteIds ?? [],
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
            revisions: {
              create: (d.history ?? []).map((h: any) => ({
                revision: h.revision,
                label: h.label ?? '자동 저장',
                payload: stripPricingSnapshot(h.payload ?? {}),
                savedAt: h.savedAt ? new Date(h.savedAt) : new Date(),
              })),
            },
          },
        });
        draftCount++;
      }

      for (const q of quotes) {
        await tx.quote.create({
          data: {
            id: q.id,
            quoteNumber: q.quoteNumber,
            title: q.title,
            status: q.status ?? 'ISSUED',
            version: q.version ?? 1,
            parentQuoteId: q.parentQuoteId ?? null,
            targetMarginRate: q.targetMarginRate ?? 28,
            orderEntity: q.orderEntity,
            calculationResult: q.calculationResult,
            publishMeta: q.publishMeta ?? null,
            appliedPricingSnapshot: q.appliedPricingSnapshot ?? null,
            notes: q.notes ?? null,
            companyInfo: q.companyInfo,
            draftId: q.draftId ?? null,
            createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
            updatedAt: q.updatedAt ? new Date(q.updatedAt) : new Date(),
          },
        });
        quoteCount++;
      }
    },
    { timeout: 30_000 }
  );

  const backupPath = `${DB_JSON_PATH}.migrated-${Date.now()}`;
  fs.renameSync(DB_JSON_PATH, backupPath);

  console.log(`이관 완료: 단가 ${pricingCount}건 / 초안 ${draftCount}건 / 견적서 ${quoteCount}건`);
  console.log(`원본은 보존했습니다: ${backupPath}`);
}

main()
  .catch((err) => {
    console.error('이관 실패:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
