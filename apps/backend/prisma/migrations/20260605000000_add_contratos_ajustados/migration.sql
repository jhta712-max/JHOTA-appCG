-- CreateEnum
CREATE TYPE "contrato_ajustado_estado" AS ENUM ('ACTIVO', 'COMPLETADO', 'CANCELADO');

-- CreateTable: contratos_ajustados
CREATE TABLE "contratos_ajustados" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id"           UUID NOT NULL,
    "supplier_id"          UUID NOT NULL,
    "descripcion_trabajo"  TEXT NOT NULL,
    "monto_contratado"     DECIMAL(15,2) NOT NULL,
    "fecha_contrato"       DATE NOT NULL,
    "estado"               "contrato_ajustado_estado" NOT NULL DEFAULT 'ACTIVO',
    "observaciones"        TEXT,
    "created_by"           UUID NOT NULL,
    "updated_by"           UUID,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_ajustados_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contrato_ajustado_pagos
CREATE TABLE "contrato_ajustado_pagos" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "contrato_ajustado_id"  UUID NOT NULL,
    "orden_pago_id"         UUID,
    "nomina_id"             UUID,
    "gasto_id"              UUID,
    "monto"                 DECIMAL(15,2) NOT NULL,
    "fecha"                 DATE NOT NULL,
    "creado_por"            UUID NOT NULL,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_ajustado_pagos_pkey" PRIMARY KEY ("id")
);

-- Add optional FK to expenses
ALTER TABLE "expenses" ADD COLUMN "contrato_ajustado_id" UUID;

-- Foreign keys
ALTER TABLE "contratos_ajustados" ADD CONSTRAINT "contratos_ajustados_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contratos_ajustados" ADD CONSTRAINT "contratos_ajustados_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contratos_ajustados" ADD CONSTRAINT "contratos_ajustados_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contratos_ajustados" ADD CONSTRAINT "contratos_ajustados_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contrato_ajustado_pagos" ADD CONSTRAINT "contrato_ajustado_pagos_contrato_ajustado_id_fkey"
    FOREIGN KEY ("contrato_ajustado_id") REFERENCES "contratos_ajustados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_contrato_ajustado_id_fkey"
    FOREIGN KEY ("contrato_ajustado_id") REFERENCES "contratos_ajustados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "contratos_ajustados_project_id_idx" ON "contratos_ajustados"("project_id");
CREATE INDEX "contratos_ajustados_supplier_id_idx" ON "contratos_ajustados"("supplier_id");
CREATE INDEX "contratos_ajustados_estado_idx" ON "contratos_ajustados"("estado");
CREATE INDEX "contrato_ajustado_pagos_contrato_ajustado_id_idx" ON "contrato_ajustado_pagos"("contrato_ajustado_id");
CREATE INDEX "contrato_ajustado_pagos_gasto_id_idx" ON "contrato_ajustado_pagos"("gasto_id");
CREATE INDEX "expenses_contrato_ajustado_id_idx" ON "expenses"("contrato_ajustado_id");
