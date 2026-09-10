-- =============================================================
-- Queen-OS — Supabase SQL Editor 직접 실행 스크립트
-- PostgreSQL 문법 (SQLite 문법 변환 완료)
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- =============================================================

-- 1. PricingItem 테이블
CREATE TABLE IF NOT EXISTS "PricingItem" (
    "id"           TEXT             NOT NULL,
    "code"         TEXT             NOT NULL,
    "category"     TEXT             NOT NULL,
    "name"         TEXT             NOT NULL,
    "spec"         TEXT             NOT NULL,
    "material"     TEXT             NOT NULL,
    "unit"         TEXT             NOT NULL,
    "costPrice"    INTEGER          NOT NULL,
    "sellingPrice" INTEGER          NOT NULL,
    "supplier"     TEXT             NOT NULL,
    "stockStatus"  TEXT             NOT NULL DEFAULT 'INSTOCK',
    "notes"        TEXT,
    "updatedAt"    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT "PricingItem_pkey" PRIMARY KEY ("id")
);

-- 2. Draft 테이블 (Quote보다 먼저 생성 — FK 참조 대상)
CREATE TABLE IF NOT EXISTS "Draft" (
    "id"                 TEXT        NOT NULL,
    "status"             TEXT        NOT NULL DEFAULT 'ACTIVE',
    "revision"           INTEGER     NOT NULL DEFAULT 1,
    "payload"            JSONB       NOT NULL,
    "customerName"       TEXT        NOT NULL DEFAULT '',
    "projectName"        TEXT        NOT NULL DEFAULT '',
    "step"               INTEGER     NOT NULL DEFAULT 1,
    "totalAmount"        INTEGER,
    "pricingFingerprint" TEXT,
    "lastEditorId"       TEXT,
    "publishedQuoteIds"  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- 3. Quote 테이블
CREATE TABLE IF NOT EXISTS "Quote" (
    "id"                     TEXT             NOT NULL,
    "quoteNumber"            TEXT             NOT NULL,
    "title"                  TEXT             NOT NULL,
    "status"                 TEXT             NOT NULL DEFAULT 'ISSUED',
    "version"                INTEGER          NOT NULL DEFAULT 1,
    "parentQuoteId"          TEXT,
    "targetMarginRate"       DOUBLE PRECISION NOT NULL,
    "orderEntity"            JSONB            NOT NULL,
    "calculationResult"      JSONB            NOT NULL,
    "publishMeta"            JSONB,
    "appliedPricingSnapshot" JSONB,
    "companyInfo"            JSONB            NOT NULL,
    "notes"                  TEXT,
    "draftId"                TEXT,
    "createdAt"              TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updatedAt"              TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT "Quote_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "Quote_draftId_fkey" FOREIGN KEY ("draftId")
        REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. QuoteDraftRevision 테이블
CREATE TABLE IF NOT EXISTS "QuoteDraftRevision" (
    "id"       SERIAL      NOT NULL,
    "draftId"  TEXT        NOT NULL,
    "revision" INTEGER     NOT NULL,
    "label"    TEXT        NOT NULL,
    "payload"  JSONB       NOT NULL,
    "savedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "QuoteDraftRevision_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "QuoteDraftRevision_draftId_fkey" FOREIGN KEY ("draftId")
        REFERENCES "Draft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS "PricingItem_code_key"              ON "PricingItem"("code");
CREATE INDEX        IF NOT EXISTS "PricingItem_category_idx"          ON "PricingItem"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "Quote_quoteNumber_key"             ON "Quote"("quoteNumber");
CREATE INDEX        IF NOT EXISTS "Quote_status_createdAt_idx"        ON "Quote"("status", "createdAt");
CREATE INDEX        IF NOT EXISTS "Draft_status_updatedAt_idx"        ON "Draft"("status", "updatedAt");
CREATE INDEX        IF NOT EXISTS "QuoteDraftRevision_draftId_savedAt_idx" ON "QuoteDraftRevision"("draftId", "savedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteDraftRevision_draftId_revision_key" ON "QuoteDraftRevision"("draftId", "revision");

-- 6. Prisma 마이그레이션 추적 테이블 생성 + 완료 기록
--    (나중에 migrate deploy 실행 시 이 마이그레이션을 중복 실행하지 않도록)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  TEXT        NOT NULL,
    "checksum"            TEXT        NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      TEXT        NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER     NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    gen_random_uuid()::text,
    'manual_apply_via_sql_editor',
    now(),
    '20260910030636_init',
    NULL,
    NULL,
    now(),
    1
)
ON CONFLICT DO NOTHING;
