-- CreateTable
CREATE TABLE "pricing_item" (
    "id"            TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "category"      TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "spec"          TEXT NOT NULL,
    "material"      TEXT NOT NULL,
    "unit"          TEXT NOT NULL,
    "cost_price"    INTEGER NOT NULL,
    "selling_price" INTEGER NOT NULL,
    "supplier"      TEXT NOT NULL,
    "stock_status"  TEXT NOT NULL DEFAULT 'INSTOCK',
    "notes"         TEXT,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id"                       TEXT NOT NULL,
    "quote_number"             TEXT NOT NULL,
    "title"                    TEXT NOT NULL,
    "status"                   TEXT NOT NULL DEFAULT 'ISSUED',
    "version"                  INTEGER NOT NULL DEFAULT 1,
    "parent_quote_id"          TEXT,
    "target_margin_rate"       DOUBLE PRECISION NOT NULL,
    "order_entity"             JSONB NOT NULL,
    "calculation_result"       JSONB NOT NULL,
    "publish_meta"             JSONB,
    "applied_pricing_snapshot" JSONB,
    "company_info"             JSONB NOT NULL,
    "notes"                    TEXT,
    "draft_id"                 TEXT,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft" (
    "id"                  TEXT NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision"            INTEGER NOT NULL DEFAULT 1,
    "payload"             JSONB NOT NULL,
    "customer_name"       TEXT NOT NULL DEFAULT '',
    "project_name"        TEXT NOT NULL DEFAULT '',
    "step"                INTEGER NOT NULL DEFAULT 1,
    "total_amount"        INTEGER,
    "pricing_fingerprint" TEXT,
    "last_editor_id"      TEXT,
    "published_quote_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_draft_revision" (
    "id"       SERIAL NOT NULL,
    "draft_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "label"    TEXT NOT NULL,
    "payload"  JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_draft_revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_item_code_key" ON "pricing_item"("code");

-- CreateIndex
CREATE INDEX "pricing_item_category_idx" ON "pricing_item"("category");

-- CreateIndex
CREATE UNIQUE INDEX "quote_quote_number_key" ON "quote"("quote_number");

-- CreateIndex
CREATE INDEX "quote_status_created_at_idx" ON "quote"("status", "created_at");

-- CreateIndex
CREATE INDEX "draft_status_updated_at_idx" ON "draft"("status", "updated_at");

-- CreateIndex
CREATE INDEX "quote_draft_revision_draft_id_saved_at_idx" ON "quote_draft_revision"("draft_id", "saved_at");

-- CreateIndex
CREATE UNIQUE INDEX "quote_draft_revision_draft_id_revision_key" ON "quote_draft_revision"("draft_id", "revision");

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_draft_id_fkey"
    FOREIGN KEY ("draft_id") REFERENCES "draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_draft_revision" ADD CONSTRAINT "quote_draft_revision_draft_id_fkey"
    FOREIGN KEY ("draft_id") REFERENCES "draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
