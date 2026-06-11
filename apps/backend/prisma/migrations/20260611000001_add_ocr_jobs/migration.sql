-- CreateTable
CREATE TABLE "ocr_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "result" JSONB,
    "error" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_jobs_user_id_idx" ON "ocr_jobs"("user_id");

-- CreateIndex
CREATE INDEX "ocr_jobs_status_idx" ON "ocr_jobs"("status");

-- CreateIndex
CREATE INDEX "ocr_jobs_created_at_idx" ON "ocr_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
