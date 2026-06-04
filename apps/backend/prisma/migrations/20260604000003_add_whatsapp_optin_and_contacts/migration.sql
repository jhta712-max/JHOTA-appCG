-- AlterTable: add whatsapp_opt_in to users
ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: notification_contacts
CREATE TABLE "notification_contacts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_contacts_is_active_idx" ON "notification_contacts"("is_active");

-- AddForeignKey
ALTER TABLE "notification_contacts" ADD CONSTRAINT "notification_contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
