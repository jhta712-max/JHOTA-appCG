-- CreateTable
CREATE TABLE "project_addendums" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "project_id"  UUID         NOT NULL,
    "number"      INTEGER      NOT NULL,
    "amount"      DECIMAL(15,2) NOT NULL,
    "description" TEXT         NOT NULL,
    "date"        DATE         NOT NULL,
    "created_by"  UUID         NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_addendums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_addendums_project_id_number_key" ON "project_addendums"("project_id", "number");

-- CreateIndex
CREATE INDEX "project_addendums_project_id_idx" ON "project_addendums"("project_id");

-- AddForeignKey
ALTER TABLE "project_addendums" ADD CONSTRAINT "project_addendums_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_addendums" ADD CONSTRAINT "project_addendums_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
