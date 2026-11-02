-- Engine v2 (docs/engine-v2): the rule store, the clinical admin role, the check-in's standard
-- input, decision records and explorer runs. One migration for the branch (repo rule; E-34),
-- squashed from the branch's working migrations in order, each kept as written.

-- ====================================================================================
-- ruleset_store
-- ====================================================================================

-- CreateEnum
CREATE TYPE "ruleset_status" AS ENUM ('draft', 'in_review', 'published', 'retired', 'discarded');

-- CreateEnum
CREATE TYPE "rule_role" AS ENUM ('rule', 'example', 'reference', 'note');

-- CreateEnum
CREATE TYPE "rule_mapping" AS ENUM ('pending', 'exact', 'interpreted', 'unresolved');

-- CreateEnum
CREATE TYPE "rule_record_status" AS ENUM ('active', 'retired');

-- CreateEnum
CREATE TYPE "rule_gap_status" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "rule_gap_owner" AS ENUM ('founder', 'clinical_safety', 'owner');

-- CreateTable
CREATE TABLE "ruleset_versions" (
    "id" UUID NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "workbook_version" VARCHAR(16) NOT NULL,
    "revision" INTEGER NOT NULL,
    "format" INTEGER NOT NULL,
    "status" "ruleset_status" NOT NULL DEFAULT 'draft',
    "based_on_id" UUID,
    "hash" CHAR(64),
    "frames" JSONB NOT NULL,
    "import_report" JSONB,
    "source_hash" CHAR(64),
    "checks" JSONB,
    "notes" VARCHAR(500),
    "created_by_id" UUID,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "published_by_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruleset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruleset_records" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "tab" VARCHAR(32) NOT NULL,
    "role" "rule_role" NOT NULL,
    "section" VARCHAR(120),
    "source_ref" VARCHAR(200) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "columns" JSONB NOT NULL,
    "origin" JSONB NOT NULL,
    "frame" INTEGER,
    "engine" JSONB,
    "mapping" "rule_mapping" NOT NULL DEFAULT 'pending',
    "status" "rule_record_status" NOT NULL DEFAULT 'active',
    "safety" BOOLEAN NOT NULL DEFAULT false,
    "workbook_tag" VARCHAR(16),
    "changed_by_id" UUID,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_reason" VARCHAR(500),

    CONSTRAINT "ruleset_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_gaps" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "detail" TEXT NOT NULL,
    "record_ids" UUID[],
    "source_refs" TEXT[],
    "example_input" JSONB,
    "while_exempt" TEXT,
    "recommendation" TEXT,
    "decides" "rule_gap_owner" NOT NULL,
    "safety" BOOLEAN NOT NULL DEFAULT false,
    "doc_ref" VARCHAR(120),
    "status" "rule_gap_status" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "created_by_id" UUID,
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(3),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rule_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_decisions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "detail" TEXT NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "decided_by" VARCHAR(120) NOT NULL,
    "decided_at" DATE NOT NULL,
    "gap_ids" UUID[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruleset_audit_events" (
    "seq" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(32) NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "version_id" UUID,
    "record_id" UUID,
    "gap_id" UUID,
    "detail" JSONB NOT NULL,
    "prev_hash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "ruleset_audit_events_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE UNIQUE INDEX "ruleset_versions_label_key" ON "ruleset_versions"("label");

-- CreateIndex
CREATE INDEX "ruleset_versions_status_created_at_idx" ON "ruleset_versions"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ruleset_versions_workbook_version_revision_key" ON "ruleset_versions"("workbook_version", "revision");

-- CreateIndex
CREATE INDEX "ruleset_records_version_id_tab_sort_order_idx" ON "ruleset_records"("version_id", "tab", "sort_order");

-- CreateIndex
CREATE INDEX "ruleset_records_record_id_idx" ON "ruleset_records"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "ruleset_records_version_id_record_id_key" ON "ruleset_records"("version_id", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "rule_gaps_number_key" ON "rule_gaps"("number");

-- CreateIndex
CREATE INDEX "rule_gaps_status_idx" ON "rule_gaps"("status");

-- CreateIndex
CREATE INDEX "rule_gaps_record_ids_idx" ON "rule_gaps" USING GIN ("record_ids");

-- CreateIndex
CREATE UNIQUE INDEX "rule_decisions_code_key" ON "rule_decisions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ruleset_audit_events_hash_key" ON "ruleset_audit_events"("hash");

-- CreateIndex
CREATE INDEX "ruleset_audit_events_version_id_seq_idx" ON "ruleset_audit_events"("version_id", "seq");

-- CreateIndex
CREATE INDEX "ruleset_audit_events_record_id_seq_idx" ON "ruleset_audit_events"("record_id", "seq");

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_based_on_id_fkey" FOREIGN KEY ("based_on_id") REFERENCES "ruleset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_records" ADD CONSTRAINT "ruleset_records_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "ruleset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one published version, and at most one open draft or version in review at a time.
CREATE UNIQUE INDEX "ruleset_versions_one_published" ON "ruleset_versions" ("status") WHERE "status" = 'published';
CREATE UNIQUE INDEX "ruleset_versions_one_open" ON "ruleset_versions" ((true)) WHERE "status" IN ('draft', 'in_review');

-- The author's reference is unique among the live rows of a table in a version.
CREATE UNIQUE INDEX "ruleset_records_active_ref" ON "ruleset_records" ("version_id", "tab", COALESCE("section", ''), "source_ref") WHERE "status" = 'active';

-- Records can only change while their version is a draft (published versions are immutable).
CREATE FUNCTION "ruleset_records_draft_only"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status "ruleset_status";
BEGIN
  SELECT "status" INTO v_status FROM "ruleset_versions"
   WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."version_id" ELSE NEW."version_id" END;
  -- A draft version being deleted takes its records with it (the version row is already gone).
  IF v_status IS DISTINCT FROM 'draft' AND NOT (TG_OP = 'DELETE' AND v_status IS NULL) THEN
    RAISE EXCEPTION 'ruleset_records: version is %, only drafts can change', v_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."version_id" <> OLD."version_id" THEN
    RAISE EXCEPTION 'ruleset_records: a record cannot move between versions' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "ruleset_records_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "ruleset_records"
  FOR EACH ROW EXECUTE FUNCTION "ruleset_records_draft_only"();

-- A published version only changes by being retired; retired and discarded versions never change;
-- only drafts can be deleted.
CREATE FUNCTION "ruleset_versions_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'draft' THEN
      RAISE EXCEPTION 'ruleset_versions: only drafts can be deleted' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" IN ('retired', 'discarded') THEN
    RAISE EXCEPTION 'ruleset_versions: % versions cannot change', OLD."status" USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."status" = 'published' AND NOT (
       NEW."status" = 'retired'
       AND NEW."hash" IS NOT DISTINCT FROM OLD."hash"
       AND NEW."frames" = OLD."frames"
       AND NEW."label" = OLD."label"
       AND NEW."workbook_version" = OLD."workbook_version"
       AND NEW."revision" = OLD."revision"
       AND NEW."format" = OLD."format"
       AND NEW."published_at" IS NOT DISTINCT FROM OLD."published_at") THEN
    RAISE EXCEPTION 'ruleset_versions: a published version can only be retired' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."status" = 'published' AND NEW."hash" IS NULL THEN
    RAISE EXCEPTION 'ruleset_versions: publishing needs a hash' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ruleset_versions_frozen" BEFORE UPDATE OR DELETE ON "ruleset_versions"
  FOR EACH ROW EXECUTE FUNCTION "ruleset_versions_frozen"();

-- The rule store audit log is append-only (reject_change comes from the init migration).
CREATE TRIGGER "ruleset_audit_events_append_only" BEFORE UPDATE OR DELETE ON "ruleset_audit_events"
  FOR EACH ROW EXECUTE FUNCTION "reject_change"();

-- ====================================================================================
-- clinical_admin_role
-- ====================================================================================

-- AlterEnum: the role that changes engine v2 rules (DECISION_LOG E-34).
ALTER TYPE "user_role" ADD VALUE 'clinical_admin';

-- ====================================================================================
-- rule_mapping_reference
-- ====================================================================================

-- AlterEnum: rows that state no executable rule (a definition or a description), E-37.
ALTER TYPE "rule_mapping" ADD VALUE 'reference';

-- ====================================================================================
-- checkin_standard_input
-- ====================================================================================

-- Check-in input without silent defaults (DECISION_LOG E-41, E-45): unrated feelings, several
-- supports, a skipped state, and custom places linked to a standard place.
-- AlterEnum
ALTER TYPE "check_in_source" ADD VALUE 'not_given';

-- AlterTable
ALTER TABLE "check_in_contexts" ADD COLUMN     "supports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "check_in_emotions" ALTER COLUMN "intensity" DROP NOT NULL;

-- AlterTable
ALTER TABLE "custom_tags" ADD COLUMN     "like_code" VARCHAR(48);


-- ====================================================================================
-- decision_records
-- ====================================================================================

-- CreateEnum
CREATE TYPE "decision_mode" AS ENUM ('signed_in', 'browse');

-- CreateTable
CREATE TABLE "decision_records" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "decision_mode" NOT NULL,
    "user_id" UUID,
    "version_id" UUID NOT NULL,
    "ruleset_hash" CHAR(64) NOT NULL,
    "engine_version" VARCHAR(20) NOT NULL,
    "input" JSONB NOT NULL,
    "card" JSONB NOT NULL,
    "trace" JSONB NOT NULL,
    "band" VARCHAR(32),
    "light" VARCHAR(16),
    "support_screen" BOOLEAN NOT NULL,
    "recheck_of_id" UUID,
    "replayed_at" TIMESTAMPTZ(3),
    "replay_matches" BOOLEAN,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decision_records_user_id_created_at_idx" ON "decision_records"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "decision_records_created_at_idx" ON "decision_records"("created_at");

-- CreateIndex
CREATE INDEX "decision_records_version_id_idx" ON "decision_records"("version_id");

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A decision record is append-only (DESIGN §7): only the replay outcome may be written later, and
-- the account link may be cleared (account deletion, O-06). Deleting a row stays possible for
-- retention and the right to erasure.
CREATE OR REPLACE FUNCTION decision_records_append_only() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR NEW."mode" IS DISTINCT FROM OLD."mode"
    OR (NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."user_id" IS NOT NULL)
    OR NEW."version_id" IS DISTINCT FROM OLD."version_id"
    OR NEW."ruleset_hash" IS DISTINCT FROM OLD."ruleset_hash"
    OR NEW."engine_version" IS DISTINCT FROM OLD."engine_version"
    OR NEW."input" IS DISTINCT FROM OLD."input"
    OR NEW."card" IS DISTINCT FROM OLD."card"
    OR NEW."trace" IS DISTINCT FROM OLD."trace"
    OR NEW."band" IS DISTINCT FROM OLD."band"
    OR NEW."light" IS DISTINCT FROM OLD."light"
    OR NEW."support_screen" IS DISTINCT FROM OLD."support_screen"
    OR NEW."recheck_of_id" IS DISTINCT FROM OLD."recheck_of_id" THEN
    RAISE EXCEPTION 'decision_records: a decision record cannot change' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_records_append_only
  BEFORE UPDATE ON "decision_records"
  FOR EACH ROW EXECUTE FUNCTION decision_records_append_only();

-- ====================================================================================
-- engine_explorations
-- ====================================================================================

-- CreateEnum
CREATE TYPE "exploration_kind" AS ENUM ('explore', 'compare', 'impact');

-- CreateEnum
CREATE TYPE "exploration_status" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "engine_explorations" (
    "id" UUID NOT NULL,
    "kind" "exploration_kind" NOT NULL,
    "status" "exploration_status" NOT NULL DEFAULT 'queued',
    "label" VARCHAR(40) NOT NULL,
    "request" JSONB NOT NULL,
    "result" JSONB,
    "error" VARCHAR(500),
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "engine_explorations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engine_explorations_status_created_at_idx" ON "engine_explorations"("status", "created_at");

-- CreateIndex
CREATE INDEX "engine_explorations_created_at_idx" ON "engine_explorations"("created_at");
