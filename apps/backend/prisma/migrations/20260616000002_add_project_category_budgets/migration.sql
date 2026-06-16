CREATE TABLE "project_category_budgets" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"  UUID        NOT NULL,
  "category_id" INTEGER     NOT NULL,
  "budget"      DECIMAL(14,2) NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_category_budgets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_category_budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "project_category_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "project_category_budgets_project_id_category_id_key" UNIQUE ("project_id", "category_id")
);
