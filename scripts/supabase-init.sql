-- =============================================================
-- Queen-OS — Supabase SQL Editor 직접 실행 스크립트
-- PostgreSQL 문법 / snake_case 네이밍
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- =============================================================

-- 1. pricing_item 테이블
CREATE TABLE IF NOT EXISTS "pricing_item" (
    "id"           TEXT             NOT NULL,
    "code"         TEXT             NOT NULL,
    "category"     TEXT             NOT NULL,
    "name"         TEXT             NOT NULL,
    "spec"         TEXT             NOT NULL,
    "material"     TEXT             NOT NULL,
    "unit"         TEXT             NOT NULL,
    "cost_price"   INTEGER          NOT NULL,
    "selling_price" INTEGER         NOT NULL,
    "supplier"     TEXT             NOT NULL,
    "stock_status" TEXT             NOT NULL DEFAULT 'INSTOCK',
    "notes"        TEXT,
    "updated_at"   TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT "pricing_item_pkey" PRIMARY KEY ("id")
);

-- 2. draft 테이블 (quote보다 먼저 생성 — FK 참조 대상)
CREATE TABLE IF NOT EXISTS "draft" (
    "id"                  TEXT        NOT NULL,
    "status"              TEXT        NOT NULL DEFAULT 'ACTIVE',
    "revision"            INTEGER     NOT NULL DEFAULT 1,
    "payload"             JSONB       NOT NULL,
    "customer_name"       TEXT        NOT NULL DEFAULT '',
    "project_name"        TEXT        NOT NULL DEFAULT '',
    "step"                INTEGER     NOT NULL DEFAULT 1,
    "total_amount"        INTEGER,
    "pricing_fingerprint" TEXT,
    "last_editor_id"      TEXT,
    "published_quote_ids" JSONB       NOT NULL DEFAULT '[]'::jsonb,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "draft_pkey" PRIMARY KEY ("id")
);

-- 3. quote 테이블
CREATE TABLE IF NOT EXISTS "quote" (
    "id"                       TEXT             NOT NULL,
    "quote_number"             TEXT             NOT NULL,
    "title"                    TEXT             NOT NULL,
    "status"                   TEXT             NOT NULL DEFAULT 'ISSUED',
    "version"                  INTEGER          NOT NULL DEFAULT 1,
    "parent_quote_id"          TEXT,
    "target_margin_rate"       DOUBLE PRECISION NOT NULL,
    "order_entity"             JSONB            NOT NULL,
    "calculation_result"       JSONB            NOT NULL,
    "publish_meta"             JSONB,
    "applied_pricing_snapshot" JSONB,
    "company_info"             JSONB            NOT NULL,
    "notes"                    TEXT,
    "draft_id"                 TEXT,
    "created_at"               TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updated_at"               TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT "quote_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "quote_draft_id_fkey" FOREIGN KEY ("draft_id")
        REFERENCES "draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. quote_draft_revision 테이블
CREATE TABLE IF NOT EXISTS "quote_draft_revision" (
    "id"       SERIAL      NOT NULL,
    "draft_id" TEXT        NOT NULL,
    "revision" INTEGER     NOT NULL,
    "label"    TEXT        NOT NULL,
    "payload"  JSONB       NOT NULL,
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "quote_draft_revision_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "quote_draft_revision_draft_id_fkey" FOREIGN KEY ("draft_id")
        REFERENCES "draft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_item_code_key"
    ON "pricing_item"("code");
CREATE INDEX        IF NOT EXISTS "pricing_item_category_idx"
    ON "pricing_item"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "quote_quote_number_key"
    ON "quote"("quote_number");
CREATE INDEX        IF NOT EXISTS "quote_status_created_at_idx"
    ON "quote"("status", "created_at");
CREATE INDEX        IF NOT EXISTS "draft_status_updated_at_idx"
    ON "draft"("status", "updated_at");
CREATE INDEX        IF NOT EXISTS "quote_draft_revision_draft_id_saved_at_idx"
    ON "quote_draft_revision"("draft_id", "saved_at");
CREATE UNIQUE INDEX IF NOT EXISTS "quote_draft_revision_draft_id_revision_key"
    ON "quote_draft_revision"("draft_id", "revision");

-- 6. Prisma 마이그레이션 추적 테이블 + 완료 기록
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
