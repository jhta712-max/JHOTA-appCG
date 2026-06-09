CREATE TABLE "contrato_ajustado_adendas" (
  "id"                   UUID          NOT NULL DEFAULT gen_random_uuid(),
  "contrato_ajustado_id" UUID          NOT NULL,
  "number"               INTEGER       NOT NULL,
  "monto"                DECIMAL(15,2) NOT NULL,
  "descripcion"          VARCHAR(500)  NOT NULL,
  "fecha"                DATE          NOT NULL,
  "created_by"           UUID          NOT NULL,
  "created_at"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "contrato_ajustado_adendas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contrato_ajustado_adendas_contrato_number_key" UNIQUE ("contrato_ajustado_id", "number"),
  CONSTRAINT "contrato_ajustado_adendas_contrato_id_fkey"
    FOREIGN KEY ("contrato_ajustado_id") REFERENCES "contratos_ajustados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contrato_ajustado_adendas_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "contrato_ajustado_adendas_contrato_id_idx" ON "contrato_ajustado_adendas"("contrato_ajustado_id");
