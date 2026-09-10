-- CreateTable
CREATE TABLE "ai_parse_log" (
    "id"                 TEXT NOT NULL,
    "kind"               TEXT NOT NULL,
    "engine"             TEXT NOT NULL,
    "model"              TEXT NOT NULL DEFAULT '',
    "latency_ms"         INTEGER NOT NULL DEFAULT 0,
    "prompt_chars"       INTEGER NOT NULL DEFAULT 0,
    "has_attachment"     BOOLEAN NOT NULL DEFAULT false,
    "error_message"      TEXT,
    "item_count"         INTEGER,
    "parsed_snapshot"    JSONB NOT NULL,
    "confirmed_snapshot" JSONB,
    "confirm_stage"      TEXT,
    "tracked_count"      INTEGER,
    "matched_count"      INTEGER,
    "corrected_count"    INTEGER,
    "missing_count"      INTEGER,
    "correction_rate"    DOUBLE PRECISION,
    "accuracy_rate"      DOUBLE PRECISION,
    "field_diffs"        JSONB,
    "confirmed_at"       TIMESTAMP(3),
    "draft_id"           TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_parse_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_parse_log_kind_created_at_idx" ON "ai_parse_log"("kind", "created_at");

-- CreateIndex
CREATE INDEX "ai_parse_log_confirmed_at_idx" ON "ai_parse_log"("confirmed_at");
