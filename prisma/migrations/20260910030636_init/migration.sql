-- CreateTable
CREATE TABLE "PricingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "costPrice" INTEGER NOT NULL,
    "sellingPrice" INTEGER NOT NULL,
    "supplier" TEXT NOT NULL,
    "stockStatus" TEXT NOT NULL DEFAULT 'INSTOCK',
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentQuoteId" TEXT,
    "targetMarginRate" REAL NOT NULL,
    "orderEntity" JSONB NOT NULL,
    "calculationResult" JSONB NOT NULL,
    "publishMeta" JSONB,
    "appliedPricingSnapshot" JSONB,
    "companyInfo" JSONB NOT NULL,
    "notes" TEXT,
    "draftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "step" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" INTEGER,
    "pricingFingerprint" TEXT,
    "lastEditorId" TEXT,
    "publishedQuoteIds" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuoteDraftRevision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "draftId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteDraftRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingItem_code_key" ON "PricingItem"("code");

-- CreateIndex
CREATE INDEX "PricingItem_category_idx" ON "PricingItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_status_createdAt_idx" ON "Quote"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Draft_status_updatedAt_idx" ON "Draft"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "QuoteDraftRevision_draftId_savedAt_idx" ON "QuoteDraftRevision"("draftId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteDraftRevision_draftId_revision_key" ON "QuoteDraftRevision"("draftId", "revision");
