-- CreateTable
CREATE TABLE "app_user" (
    "id"                   TEXT NOT NULL,
    "email"                TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "role"                 TEXT NOT NULL DEFAULT 'ESTIMATOR',
    "password_hash"        TEXT NOT NULL,
    "status"               TEXT NOT NULL DEFAULT 'ACTIVE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at"        TIMESTAMP(3),
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_session" (
    "id"         TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "app_user_status_idx" ON "app_user"("status");

-- CreateIndex
CREATE UNIQUE INDEX "app_session_token_hash_key" ON "app_session"("token_hash");

-- CreateIndex
CREATE INDEX "app_session_user_id_idx" ON "app_session"("user_id");

-- CreateIndex
CREATE INDEX "app_session_expires_at_idx" ON "app_session"("expires_at");

-- AddForeignKey
ALTER TABLE "app_session" ADD CONSTRAINT "app_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
