-- Migration: add system monitoring tables
CREATE TABLE "system_logs" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "level"       VARCHAR(10)  NOT NULL,
  "category"    VARCHAR(50)  NOT NULL,
  "message"     TEXT         NOT NULL,
  "details"     JSONB,
  "user_id"     UUID,
  "endpoint"    VARCHAR(200),
  "method"      VARCHAR(10),
  "status_code" INTEGER,
  "duration"    INTEGER,
  "ip_address"  VARCHAR(50),
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_logs_level_idx"      ON "system_logs"("level");
CREATE INDEX "system_logs_category_idx"   ON "system_logs"("category");
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

CREATE TABLE "health_check_results" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "status"            VARCHAR(20) NOT NULL,
  "db_ok"             BOOLEAN     NOT NULL,
  "memory_used_pct"   FLOAT       NOT NULL,
  "uptime_seconds"    FLOAT       NOT NULL,
  "response_time"     INTEGER     NOT NULL,
  "details"           JSONB,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "health_check_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "health_check_results_status_idx"     ON "health_check_results"("status");
CREATE INDEX "health_check_results_created_at_idx" ON "health_check_results"("created_at");
