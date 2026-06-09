-- AddForeignKey constraint for contrato_ajustado_id
ALTER TABLE "payroll_lines" ADD COLUMN "contrato_ajustado_id" UUID;
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_contrato_ajustado_id_fkey" FOREIGN KEY ("contrato_ajustado_id") REFERENCES "contratos_ajustados"("id") ON DELETE SET NULL;
CREATE INDEX "payroll_lines_contrato_ajustado_id_idx" ON "payroll_lines"("contrato_ajustado_id");
