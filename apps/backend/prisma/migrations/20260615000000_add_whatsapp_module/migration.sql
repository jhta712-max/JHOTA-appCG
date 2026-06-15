-- WhatsApp integration tables

CREATE TABLE "whatsapp_conversations" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "phone_number" VARCHAR(30)  NOT NULL,
    "user_id"      UUID,
    "status"       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    "context_data" JSONB        NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_messages" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID         NOT NULL,
    "direction"       VARCHAR(10)  NOT NULL,
    "content"         TEXT         NOT NULL,
    "ai_intent"       VARCHAR(50),
    "processed"       BOOLEAN      NOT NULL DEFAULT false,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_audit_logs" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "action"           VARCHAR(50)  NOT NULL,
    "entity_type"      VARCHAR(50),
    "entity_id"        VARCHAR(100),
    "request_payload"  JSONB        NOT NULL,
    "response_payload" JSONB        NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_conversations_phone_number_idx" ON "whatsapp_conversations"("phone_number");
CREATE INDEX "whatsapp_messages_conversation_id_idx"   ON "whatsapp_messages"("conversation_id");

ALTER TABLE "whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
