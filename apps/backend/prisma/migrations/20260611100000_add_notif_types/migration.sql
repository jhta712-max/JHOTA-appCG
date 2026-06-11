ALTER TABLE "notification_contacts" ADD COLUMN "notif_types" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "notif_types" TEXT[] NOT NULL DEFAULT '{}';
