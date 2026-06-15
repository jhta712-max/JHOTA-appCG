-- Add ncf to project_cubicaciones
ALTER TABLE "project_cubicaciones" ADD COLUMN "ncf" VARCHAR(19);

-- Create project_anticipos
CREATE TABLE "project_anticipos" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"  UUID        NOT NULL,
  "number"      INTEGER     NOT NULL,
  "amount"      DECIMAL(15,2) NOT NULL,
  "date"        DATE        NOT NULL,
  "ncf"         VARCHAR(19),
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_anticipos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "project_anticipos"
  ADD CONSTRAINT "project_anticipos_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "project_anticipos_project_id_number_key"
  ON "project_anticipos"("project_id", "number");

CREATE INDEX "project_anticipos_project_id_idx"
  ON "project_anticipos"("project_id");
