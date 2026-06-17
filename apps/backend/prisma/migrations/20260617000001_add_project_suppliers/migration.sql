CREATE TABLE "project_suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_suppliers_project_id_supplier_id_key" ON "project_suppliers"("project_id", "supplier_id");
CREATE INDEX "project_suppliers_project_id_idx" ON "project_suppliers"("project_id");
CREATE INDEX "project_suppliers_supplier_id_idx" ON "project_suppliers"("supplier_id");

ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
