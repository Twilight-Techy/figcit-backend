-- CreateEnum
CREATE TYPE "pathway" AS ENUM ('regulate', 'dump', 'express', 'execute', 'adapt', 'reflect', 'connect', 'meditate');

-- CreateEnum
CREATE TYPE "light" AS ENUM ('green', 'yellow', 'amber', 'red', 'blue');

-- CreateEnum
CREATE TYPE "timeline_code" AS ENUM ('T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX', 'TR');

-- CreateEnum
CREATE TYPE "origin" AS ENUM ('online', 'offline');

-- CreateEnum
CREATE TYPE "adaptation_kind" AS ENUM ('environment', 'scope', 'modality', 'pace', 'sequence', 'instructions', 'communication');

-- CreateEnum
CREATE TYPE "ai_outcome" AS ENUM ('ok', 'fallback', 'timeout', 'invalid', 'blocked', 'circuit_open', 'not_entitled');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('google');

-- CreateEnum
CREATE TYPE "sign_in_method" AS ENUM ('magic_link', 'password', 'google', 'refresh', 'mfa');

-- CreateEnum
CREATE TYPE "sign_in_result" AS ENUM ('success', 'failure', 'locked', 'mfa_required');

-- CreateEnum
CREATE TYPE "magic_link_purpose" AS ENUM ('sign_in', 'upgrade_from_browse');

-- CreateEnum
CREATE TYPE "check_in_source" AS ENUM ('grid', 'not_sure');

-- CreateEnum
CREATE TYPE "check_in_entry" AS ENUM ('full', 'quick', 'recheck');

-- CreateEnum
CREATE TYPE "consent_purpose" AS ENUM ('wellbeing_data', 'personalisation', 'analytics', 'research', 'institution_sharing');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('draft', 'in_review', 'published', 'retired');

-- CreateEnum
CREATE TYPE "content_kind" AS ENUM ('copy', 'tool_script', 'reflect_prompt', 'practice', 'starter', 'adaptation', 'comm_card', 'help_route', 'card_wording', 'pattern_template', 'ai_prompt');

-- CreateEnum
CREATE TYPE "tool_tier" AS ENUM ('free', 'advanced');

-- CreateEnum
CREATE TYPE "dump_bucket" AS ENUM ('ideas', 'notes', 'worries', 'todo');

-- CreateEnum
CREATE TYPE "dump_moved_to" AS ENUM ('task', 'draft', 'reflection');

-- CreateEnum
CREATE TYPE "entitlement_source" AS ENUM ('none', 'web', 'store', 'institution', 'staff_grant');

-- CreateEnum
CREATE TYPE "entitlement_status" AS ENUM ('active', 'grace', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "draft_mode" AS ENUM ('draft', 'simplify', 'rewrite', 'structure', 'script', 'record');

-- CreateEnum
CREATE TYPE "session_outcome" AS ENUM ('helped', 'a_bit', 'not_really', 'skipped');

-- CreateEnum
CREATE TYPE "file_purpose" AS ENUM ('transcription_input', 'voice_note', 'practice_audio', 'export');

-- CreateEnum
CREATE TYPE "file_status" AS ENUM ('pending', 'uploaded', 'deleted');

-- CreateEnum
CREATE TYPE "tenant_role" AS ENUM ('member', 'support_lead', 'admin');

-- CreateEnum
CREATE TYPE "reminder_subject" AS ENUM ('checkin', 'task', 'practice', 'recheck', 'custom');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('push', 'inbox', 'email');

-- CreateEnum
CREATE TYPE "practice_type" AS ENUM ('ritual', 'prayer', 'recitation', 'meditation', 'other');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "recommendation_action_type" AS ENUM ('start', 'try_another', 'not_now', 'correct', 'get_support', 'adapt', 'why');

-- CreateEnum
CREATE TYPE "snapshot_status" AS ENUM ('draft', 'in_review', 'safety_review', 'published', 'retired');

-- CreateEnum
CREATE TYPE "safety_trigger" AS ENUM ('button', 'phrase', 'option', 'sustained');

-- CreateEnum
CREATE TYPE "transcription_status" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('open', 'done', 'dropped');

-- CreateEnum
CREATE TYPE "task_source" AS ENUM ('manual', 'demand', 'dump', 'express');

-- CreateEnum
CREATE TYPE "day_plan_slot" AS ENUM ('now', 'later', 'not_today');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('customer', 'admin', 'safety_reviewer', 'content_editor', 'institution_supporter');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "age_band" AS ENUM ('18_plus', '16_17_institution');

-- CreateEnum
CREATE TYPE "theme" AS ENUM ('fig_citrus', 'quiet_pear', 'midnight_bergamot', 'blood_orange_hush', 'cool_melon', 'blue_citron');

-- CreateEnum
CREATE TYPE "notification_style" AS ENUM ('gentle', 'standard', 'silent');

-- CreateTable
CREATE TABLE "adaptations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "kind" "adaptation_kind" NOT NULL,
    "detail_code" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adaptations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_adaptations" (
    "user_id" UUID NOT NULL,
    "kind" "adaptation_kind" NOT NULL,
    "detail_code" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_adaptations_pkey" PRIMARY KEY ("user_id","kind","detail_code")
);

-- CreateTable
CREATE TABLE "ai_calls" (
    "id" UUID NOT NULL,
    "task" VARCHAR(32) NOT NULL,
    "user_hash" CHAR(64),
    "model" VARCHAR(64),
    "prompt_version" VARCHAR(32),
    "outcome" "ai_outcome" NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "user_hash" CHAR(64),
    "props" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_rollups" (
    "day" DATE NOT NULL,
    "metric" VARCHAR(48) NOT NULL,
    "dimension" VARCHAR(48) NOT NULL DEFAULT '',
    "value" BIGINT NOT NULL,

    CONSTRAINT "daily_rollups_pkey" PRIMARY KEY ("day","metric","dimension")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(32) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32) NOT NULL,
    "target_id" VARCHAR(64),
    "reason" VARCHAR(200),
    "meta" JSONB,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_label" VARCHAR(80),
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "mfa_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(32),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_links" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" UUID,
    "purpose" "magic_link_purpose" NOT NULL DEFAULT 'sign_in',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(16) NOT NULL DEFAULT 'totp',
    "secret_enc" BYTEA NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "last_used_step" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_in_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "method" "sign_in_method" NOT NULL,
    "result" "sign_in_result" NOT NULL,
    "device_type" VARCHAR(16),
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browse_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "upgraded_at" TIMESTAMPTZ(3),

    CONSTRAINT "browse_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_customers" (
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "provider_customer_id" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "provider_event_id" VARCHAR(120) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "user_id" UUID,
    "processed_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "energy" SMALLINT,
    "mood" SMALLINT,
    "cell_id" VARCHAR(8),
    "source" "check_in_source" NOT NULL DEFAULT 'grid',
    "entry" "check_in_entry" NOT NULL DEFAULT 'full',
    "not_sure_answers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "recheck_of_id" UUID,
    "snapshot_version" VARCHAR(32) NOT NULL,
    "created_on_device_at" TIMESTAMPTZ(3) NOT NULL,
    "origin" "origin" NOT NULL DEFAULT 'online',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_emotions" (
    "id" UUID NOT NULL,
    "check_in_id" UUID NOT NULL,
    "emotion_code" VARCHAR(48) NOT NULL,
    "family_code" VARCHAR(48) NOT NULL,
    "intensity" SMALLINT NOT NULL,

    CONSTRAINT "check_in_emotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_sensations" (
    "id" UUID NOT NULL,
    "check_in_id" UUID NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "tag_code" VARCHAR(48) NOT NULL,
    "intensity" SMALLINT,
    "body_regions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "check_in_sensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_contexts" (
    "check_in_id" UUID NOT NULL,
    "environment" VARCHAR(48),
    "people" VARCHAR(32),
    "time_available" VARCHAR(16),
    "support" VARCHAR(32),
    "sensitivity_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_tag_ids" UUID[] DEFAULT ARRAY[]::UUID[],

    CONSTRAINT "check_in_contexts_pkey" PRIMARY KEY ("check_in_id")
);

-- CreateTable
CREATE TABLE "custom_tags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "label_enc" BYTEA NOT NULL,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "custom_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "need_selections" (
    "check_in_id" UUID NOT NULL,
    "need_code" VARCHAR(48),
    "own_words_enc" BYTEA,
    "parsed_need_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "just_support" BOOLEAN NOT NULL DEFAULT false,
    "has_demand" BOOLEAN NOT NULL DEFAULT false,
    "demand_type" VARCHAR(48),
    "task_id" UUID,
    "due_at" TIMESTAMPTZ(3),
    "timeline_code" "timeline_code",
    "drivers" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "need_selections_pkey" PRIMARY KEY ("check_in_id")
);

-- CreateTable
CREATE TABLE "saved_starters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID,
    "text_enc" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "saved_starters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'community',
    "name_enc" BYTEA NOT NULL,
    "link_enc" BYTEA,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "connect_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "consent_purpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "notice_version" VARCHAR(16) NOT NULL,
    "source" VARCHAR(16) NOT NULL DEFAULT 'settings',
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en-GB',
    "version" INTEGER NOT NULL,
    "kind" "content_kind" NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "body" JSONB NOT NULL,
    "touches_safety" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID,
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "release_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_releases" (
    "id" SERIAL NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by" UUID,
    "item_count" INTEGER NOT NULL,

    CONSTRAINT "content_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "tool_id" VARCHAR(48) NOT NULL,
    "pathway" "pathway" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "tier" "tool_tier" NOT NULL DEFAULT 'free',
    "safety_floor" BOOLEAN NOT NULL DEFAULT false,
    "public_safe" BOOLEAN NOT NULL DEFAULT true,
    "eyes_open" BOOLEAN NOT NULL DEFAULT true,
    "minutes" SMALLINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("tool_id")
);

-- CreateTable
CREATE TABLE "dumps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" VARCHAR(8) NOT NULL DEFAULT 'text',
    "transcription_id" UUID,
    "sorted_at" TIMESTAMPTZ(3),
    "origin" "origin" NOT NULL DEFAULT 'online',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "dumps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dump_items" (
    "id" UUID NOT NULL,
    "dump_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "text_enc" BYTEA NOT NULL,
    "bucket" "dump_bucket",
    "suggested_bucket" "dump_bucket",
    "moved_to" "dump_moved_to",
    "moved_to_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "dump_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "code" VARCHAR(24) NOT NULL,
    "name" VARCHAR(48) NOT NULL,
    "price_minor" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
    "interval" VARCHAR(8),
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_code" VARCHAR(24) NOT NULL,
    "source" "entitlement_source" NOT NULL,
    "status" "entitlement_status" NOT NULL DEFAULT 'active',
    "tenant_id" UUID,
    "provider_ref" VARCHAR(120),
    "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renews_at" TIMESTAMPTZ(3),
    "grace_until" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title_enc" BYTEA,
    "purpose_enc" BYTEA,
    "audience" VARCHAR(32),
    "mode" "draft_mode" NOT NULL DEFAULT 'draft',
    "source_type" VARCHAR(16),
    "source_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_versions" (
    "id" UUID NOT NULL,
    "draft_id" UUID NOT NULL,
    "mode" "draft_mode" NOT NULL,
    "body_enc" BYTEA NOT NULL,
    "ai_used" BOOLEAN NOT NULL DEFAULT false,
    "ai_task" VARCHAR(24),
    "changes" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assist_usage" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "count" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "assist_usage_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateTable
CREATE TABLE "pathway_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recommendation_id" UUID,
    "pathway" "pathway" NOT NULL,
    "tool_id" VARCHAR(48) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "length_seconds" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "stopped_early" BOOLEAN NOT NULL DEFAULT false,
    "task_id" UUID,
    "current_step_id" UUID,
    "remaining_seconds" INTEGER,
    "paused_at" TIMESTAMPTZ(3),
    "practice_id" UUID,
    "eyes_open" BOOLEAN,
    "context_public" BOOLEAN,
    "origin" "origin" NOT NULL DEFAULT 'online',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pathway_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "outcome" "session_outcome" NOT NULL,
    "helpful" SMALLINT,
    "effort" SMALLINT,
    "recheck_check_in_id" UUID,
    "recheck_rule" VARCHAR(8),
    "recovery_started_at" TIMESTAMPTZ(3),
    "recovery_ends_at" TIMESTAMPTZ(3),
    "next_step_released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "purpose" "file_purpose" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" VARCHAR(64) NOT NULL,
    "size_bytes" INTEGER,
    "max_bytes" INTEGER NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "status" "file_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'employer',
    "anonymity_floor" SMALLINT NOT NULL DEFAULT 10,
    "seats_plan_code" VARCHAR(24),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "tenant_role" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "code" VARCHAR(16) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "cohort_aggregates" (
    "tenant_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "metric" VARCHAR(48) NOT NULL,
    "dimension" VARCHAR(48) NOT NULL DEFAULT '',
    "value" INTEGER,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cohort_aggregates_pkey" PRIMARY KEY ("tenant_id","week_start","metric","dimension")
);

-- CreateTable
CREATE TABLE "outreach_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message_enc" BYTEA NOT NULL,
    "preferred" VARCHAR(16) NOT NULL DEFAULT 'email',
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "handled_by_id" UUID,
    "handled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject_type" "reminder_subject" NOT NULL,
    "subject_id" UUID,
    "label_enc" BYTEA,
    "at" TIMESTAMPTZ(3),
    "rrule" VARCHAR(200),
    "local_time" SMALLINT,
    "style" VARCHAR(16) NOT NULL DEFAULT 'gentle',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMPTZ(3),
    "last_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys_enc" BYTEA NOT NULL,
    "user_agent" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_success_at" TIMESTAMPTZ(3),
    "failure_count" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "ref_type" VARCHAR(32),
    "ref_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reminder_id" UUID,
    "category" VARCHAR(16) NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "result" VARCHAR(24) NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "practice_type" NOT NULL,
    "name_enc" BYTEA NOT NULL,
    "content_enc" BYTEA,
    "link_enc" BYTEA,
    "audio_file_id" UUID,
    "schedule_rule" VARCHAR(200),
    "reminder_style" VARCHAR(16) NOT NULL DEFAULT 'gentle',
    "minutes" SMALLINT,
    "helps_when_struggling" BOOLEAN NOT NULL DEFAULT false,
    "makes_me_worse" BOOLEAN NOT NULL DEFAULT false,
    "is_transition_ritual" BOOLEAN NOT NULL DEFAULT false,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'queued',
    "file_id" UUID,
    "error_code" VARCHAR(32),
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "check_in_id" UUID NOT NULL,
    "task_id" UUID,
    "parent_id" UUID,
    "band" VARCHAR(24) NOT NULL,
    "light" "light" NOT NULL,
    "cell_id" VARCHAR(8) NOT NULL,
    "primary" JSONB NOT NULL,
    "alternatives" JSONB NOT NULL,
    "queued_step" JSONB,
    "patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rationale_template_id" VARCHAR(64),
    "safety_triggered" BOOLEAN NOT NULL DEFAULT false,
    "trace" JSONB NOT NULL,
    "engine_version" VARCHAR(32) NOT NULL,
    "snapshot_version" VARCHAR(32) NOT NULL,
    "origin" "origin" NOT NULL DEFAULT 'online',
    "differs_from_device" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_actions" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" "recommendation_action_type" NOT NULL,
    "tool_id" VARCHAR(48),
    "reason" VARCHAR(48),
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "variant" VARCHAR(32) NOT NULL,
    "answers_enc" BYTEA NOT NULL,
    "takeaway_enc" BYTEA,
    "topic_tag" VARCHAR(48),
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "saved_for_later" BOOLEAN NOT NULL DEFAULT false,
    "safety_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_topic_counts" (
    "user_id" UUID NOT NULL,
    "topic_tag" VARCHAR(48) NOT NULL,
    "count_7d" SMALLINT NOT NULL DEFAULT 0,
    "count_all" INTEGER NOT NULL DEFAULT 0,
    "last_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_topic_counts_pkey" PRIMARY KEY ("user_id","topic_tag")
);

-- CreateTable
CREATE TABLE "rule_snapshots" (
    "id" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "source_file_key" TEXT,
    "status" "snapshot_status" NOT NULL DEFAULT 'draft',
    "json" JSONB NOT NULL,
    "fixture_report" JSONB,
    "diff_summary" JSONB,
    "touches_safety" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),
    "created_by_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "safety_signed_by_id" UUID,
    "safety_signed_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "source_module" VARCHAR(32) NOT NULL,
    "trigger" "safety_trigger" NOT NULL,
    "rule_id" VARCHAR(32),
    "category" VARCHAR(32),
    "route_chosen" VARCHAR(32),
    "origin" "origin" NOT NULL DEFAULT 'online',
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_plans" (
    "user_id" UUID NOT NULL,
    "preferred_routes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signs_enc" BYTEA,
    "what_helps_enc" BYTEA,
    "what_to_avoid_enc" BYTEA,
    "messages_enc" BYTEA,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_plans_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "trusted_contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name_enc" BYTEA NOT NULL,
    "phone_enc" BYTEA,
    "email_enc" BYTEA,
    "relationship" VARCHAR(32),
    "contact_when" TEXT[] DEFAULT ARRAY['connect']::TEXT[],
    "consent_confirmed_at" TIMESTAMPTZ(3),
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "trusted_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "recipient_label_enc" BYTEA,
    "sections" TEXT[],
    "range_days" SMALLINT NOT NULL,
    "snapshot_enc" BYTEA NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_id" UUID,
    "purpose" VARCHAR(16) NOT NULL,
    "status" "transcription_status" NOT NULL DEFAULT 'pending',
    "text_enc" BYTEA,
    "duration_ms" INTEGER,
    "keep_audio" BOOLEAN NOT NULL DEFAULT false,
    "safety_flag" BOOLEAN NOT NULL DEFAULT false,
    "error_code" VARCHAR(32),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity" VARCHAR(32) NOT NULL,
    "entity_id" UUID NOT NULL,
    "op" VARCHAR(8) NOT NULL,
    "result_code" VARCHAR(24) NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "user_id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "response_status" SMALLINT NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title_enc" BYTEA NOT NULL,
    "type" VARCHAR(48),
    "timeline_code" "timeline_code",
    "due_at" TIMESTAMPTZ(3),
    "recurrence_rule" VARCHAR(200),
    "putting_off" BOOLEAN NOT NULL DEFAULT false,
    "nucripce_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "task_status" NOT NULL DEFAULT 'open',
    "source" "task_source" NOT NULL DEFAULT 'manual',
    "source_dump_item_id" UUID,
    "snoozed_until" TIMESTAMPTZ(3),
    "plan_slot" "day_plan_slot",
    "plan_date" DATE,
    "skip_count" SMALLINT NOT NULL DEFAULT 0,
    "done_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "text_enc" BYTEA NOT NULL,
    "source" VARCHAR(8) NOT NULL DEFAULT 'user',
    "done_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "email_verified_at" TIMESTAMPTZ(3),
    "password_hash" TEXT,
    "nickname" VARCHAR(40),
    "age_confirmed_at" TIMESTAMPTZ(3),
    "age_band" "age_band",
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en-GB',
    "region" VARCHAR(8) NOT NULL DEFAULT 'GB',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/London',
    "status" "user_status" NOT NULL DEFAULT 'active',
    "roles" "user_role"[] DEFAULT ARRAY['customer']::"user_role"[],
    "tenant_id" UUID,
    "data_key_enc" BYTEA NOT NULL,
    "help_with" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profile_enc" BYTEA,
    "journey_seen_at" TIMESTAMPTZ(3),
    "setup_done_at" TIMESTAMPTZ(3),
    "failed_sign_ins" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_active_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences" (
    "user_id" UUID NOT NULL,
    "text_size" SMALLINT NOT NULL DEFAULT 0,
    "theme" "theme" NOT NULL DEFAULT 'fig_citrus',
    "follow_system_theme" BOOLEAN NOT NULL DEFAULT true,
    "high_contrast" BOOLEAN NOT NULL DEFAULT false,
    "reduce_motion" BOOLEAN NOT NULL DEFAULT false,
    "sound" BOOLEAN NOT NULL DEFAULT true,
    "haptics" BOOLEAN NOT NULL DEFAULT true,
    "dyslexic_font" BOOLEAN NOT NULL DEFAULT false,
    "low_stimulation" BOOLEAN NOT NULL DEFAULT false,
    "notification_style" "notification_style" NOT NULL DEFAULT 'gentle',
    "quiet_hours_start" SMALLINT,
    "quiet_hours_end" SMALLINT,
    "in_worship" BOOLEAN NOT NULL DEFAULT false,
    "in_worship_until" TIMESTAMPTZ(3),
    "task_nudges_per_day" SMALLINT NOT NULL DEFAULT 2,
    "notify_categories" TEXT[] DEFAULT ARRAY['checkin', 'tasks', 'practices', 'recheck']::TEXT[],
    "pattern_prompts" BOOLEAN NOT NULL DEFAULT true,
    "personalisation" BOOLEAN NOT NULL DEFAULT true,
    "field_updated_at" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "adaptations_recommendation_id_idx" ON "adaptations"("recommendation_id");

-- CreateIndex
CREATE INDEX "adaptations_user_id_created_at_idx" ON "adaptations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_calls_task_at_idx" ON "ai_calls"("task", "at");

-- CreateIndex
CREATE INDEX "ai_calls_at_idx" ON "ai_calls"("at");

-- CreateIndex
CREATE INDEX "events_name_at_idx" ON "events"("name", "at");

-- CreateIndex
CREATE INDEX "events_at_idx" ON "events"("at");

-- CreateIndex
CREATE INDEX "audit_events_target_type_target_id_at_idx" ON "audit_events"("target_type", "target_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_actor_id_at_idx" ON "audit_events"("actor_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_at_idx" ON "audit_events"("at");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_subject_key" ON "auth_identities"("provider", "provider_subject");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_token_hash_key" ON "magic_links"("token_hash");

-- CreateIndex
CREATE INDEX "magic_links_email_created_at_idx" ON "magic_links"("email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "mfa_factors_user_id_idx" ON "mfa_factors"("user_id");

-- CreateIndex
CREATE INDEX "sign_in_events_user_id_at_idx" ON "sign_in_events"("user_id", "at" DESC);

-- CreateIndex
CREATE INDEX "sign_in_events_at_idx" ON "sign_in_events"("at");

-- CreateIndex
CREATE UNIQUE INDEX "browse_tokens_token_hash_key" ON "browse_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "browse_tokens_expires_at_idx" ON "browse_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_provider_customer_id_key" ON "billing_customers"("provider_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_provider_event_id_key" ON "billing_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "check_ins_user_id_created_at_idx" ON "check_ins"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "check_ins_recheck_of_id_idx" ON "check_ins"("recheck_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_emotions_check_in_id_emotion_code_key" ON "check_in_emotions"("check_in_id", "emotion_code");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_sensations_check_in_id_tag_code_key" ON "check_in_sensations"("check_in_id", "tag_code");

-- CreateIndex
CREATE INDEX "custom_tags_user_id_type_idx" ON "custom_tags"("user_id", "type");

-- CreateIndex
CREATE INDEX "need_selections_task_id_idx" ON "need_selections"("task_id");

-- CreateIndex
CREATE INDEX "saved_starters_user_id_created_at_idx" ON "saved_starters"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "connect_groups_user_id_idx" ON "connect_groups"("user_id");

-- CreateIndex
CREATE INDEX "consents_user_id_purpose_at_idx" ON "consents"("user_id", "purpose", "at" DESC);

-- CreateIndex
CREATE INDEX "content_items_status_kind_locale_idx" ON "content_items"("status", "kind", "locale");

-- CreateIndex
CREATE INDEX "content_items_release_id_idx" ON "content_items"("release_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_key_locale_version_key" ON "content_items"("key", "locale", "version");

-- CreateIndex
CREATE INDEX "tools_pathway_active_idx" ON "tools"("pathway", "active");

-- CreateIndex
CREATE UNIQUE INDEX "dumps_transcription_id_key" ON "dumps"("transcription_id");

-- CreateIndex
CREATE INDEX "dumps_user_id_created_at_idx" ON "dumps"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "dump_items_dump_id_position_idx" ON "dump_items"("dump_id", "position");

-- CreateIndex
CREATE INDEX "dump_items_user_id_bucket_idx" ON "dump_items"("user_id", "bucket");

-- CreateIndex
CREATE INDEX "entitlements_user_id_status_idx" ON "entitlements"("user_id", "status");

-- CreateIndex
CREATE INDEX "entitlements_provider_ref_idx" ON "entitlements"("provider_ref");

-- CreateIndex
CREATE INDEX "drafts_user_id_updated_at_idx" ON "drafts"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "draft_versions_draft_id_created_at_idx" ON "draft_versions"("draft_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pathway_sessions_user_id_started_at_idx" ON "pathway_sessions"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "pathway_sessions_user_id_pathway_started_at_idx" ON "pathway_sessions"("user_id", "pathway", "started_at" DESC);

-- CreateIndex
CREATE INDEX "pathway_sessions_recommendation_id_idx" ON "pathway_sessions"("recommendation_id");

-- CreateIndex
CREATE INDEX "pathway_sessions_task_id_idx" ON "pathway_sessions"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_session_id_key" ON "feedback"("session_id");

-- CreateIndex
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE INDEX "stored_files_user_id_purpose_idx" ON "stored_files"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "stored_files_status_expires_at_idx" ON "stored_files"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "invite_codes_tenant_id_idx" ON "invite_codes"("tenant_id");

-- CreateIndex
CREATE INDEX "outreach_requests_tenant_id_status_created_at_idx" ON "outreach_requests"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outreach_requests_user_id_idx" ON "outreach_requests"("user_id");

-- CreateIndex
CREATE INDEX "reminders_user_id_idx" ON "reminders"("user_id");

-- CreateIndex
CREATE INDEX "reminders_next_run_at_idx" ON "reminders"("next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "inbox_items_user_id_created_at_idx" ON "inbox_items"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_user_id_category_at_idx" ON "notification_logs"("user_id", "category", "at" DESC);

-- CreateIndex
CREATE INDEX "practices_user_id_position_idx" ON "practices"("user_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "export_jobs_file_id_key" ON "export_jobs"("file_id");

-- CreateIndex
CREATE INDEX "export_jobs_user_id_requested_at_idx" ON "export_jobs"("user_id", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "deletion_requests_scheduled_for_idx" ON "deletion_requests"("scheduled_for");

-- CreateIndex
CREATE INDEX "recommendations_user_id_created_at_idx" ON "recommendations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommendations_check_in_id_idx" ON "recommendations"("check_in_id");

-- CreateIndex
CREATE INDEX "recommendations_light_created_at_idx" ON "recommendations"("light", "created_at");

-- CreateIndex
CREATE INDEX "recommendation_actions_recommendation_id_idx" ON "recommendation_actions"("recommendation_id");

-- CreateIndex
CREATE INDEX "recommendation_actions_user_id_action_at_idx" ON "recommendation_actions"("user_id", "action", "at" DESC);

-- CreateIndex
CREATE INDEX "reflections_user_id_created_at_idx" ON "reflections"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reflections_user_id_topic_tag_idx" ON "reflections"("user_id", "topic_tag");

-- CreateIndex
CREATE UNIQUE INDEX "rule_snapshots_version_key" ON "rule_snapshots"("version");

-- CreateIndex
CREATE INDEX "rule_snapshots_status_created_at_idx" ON "rule_snapshots"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "safety_events_user_id_at_idx" ON "safety_events"("user_id", "at" DESC);

-- CreateIndex
CREATE INDEX "safety_events_at_idx" ON "safety_events"("at");

-- CreateIndex
CREATE INDEX "trusted_contacts_user_id_position_idx" ON "trusted_contacts"("user_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "shares_token_hash_key" ON "shares"("token_hash");

-- CreateIndex
CREATE INDEX "shares_user_id_created_at_idx" ON "shares"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "shares_tenant_id_idx" ON "shares"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_file_id_key" ON "transcriptions"("file_id");

-- CreateIndex
CREATE INDEX "transcriptions_user_id_created_at_idx" ON "transcriptions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transcriptions_status_created_at_idx" ON "transcriptions"("status", "created_at");

-- CreateIndex
CREATE INDEX "sync_operations_user_id_applied_at_idx" ON "sync_operations"("user_id", "applied_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_due_at_idx" ON "tasks"("user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_user_id_updated_at_idx" ON "tasks"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "task_steps_task_id_position_idx" ON "task_steps"("task_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_status_deleted_at_idx" ON "users"("status", "deleted_at");

-- AddForeignKey
ALTER TABLE "adaptations" ADD CONSTRAINT "adaptations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adaptations" ADD CONSTRAINT "adaptations_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_adaptations" ADD CONSTRAINT "saved_adaptations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_in_events" ADD CONSTRAINT "sign_in_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_recheck_of_id_fkey" FOREIGN KEY ("recheck_of_id") REFERENCES "check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_emotions" ADD CONSTRAINT "check_in_emotions_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_sensations" ADD CONSTRAINT "check_in_sensations_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_contexts" ADD CONSTRAINT "check_in_contexts_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_tags" ADD CONSTRAINT "custom_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_selections" ADD CONSTRAINT "need_selections_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_selections" ADD CONSTRAINT "need_selections_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_starters" ADD CONSTRAINT "saved_starters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_starters" ADD CONSTRAINT "saved_starters_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "trusted_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_groups" ADD CONSTRAINT "connect_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "content_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dumps" ADD CONSTRAINT "dumps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dumps" ADD CONSTRAINT "dumps_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dump_items" ADD CONSTRAINT "dump_items_dump_id_fkey" FOREIGN KEY ("dump_id") REFERENCES "dumps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dump_items" ADD CONSTRAINT "dump_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_versions" ADD CONSTRAINT "draft_versions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assist_usage" ADD CONSTRAINT "assist_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathway_sessions" ADD CONSTRAINT "pathway_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathway_sessions" ADD CONSTRAINT "pathway_sessions_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathway_sessions" ADD CONSTRAINT "pathway_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathway_sessions" ADD CONSTRAINT "pathway_sessions_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pathway_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_recheck_check_in_id_fkey" FOREIGN KEY ("recheck_check_in_id") REFERENCES "check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_aggregates" ADD CONSTRAINT "cohort_aggregates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_requests" ADD CONSTRAINT "outreach_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_requests" ADD CONSTRAINT "outreach_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_requests" ADD CONSTRAINT "outreach_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practices" ADD CONSTRAINT "practices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practices" ADD CONSTRAINT "practices_audio_file_id_fkey" FOREIGN KEY ("audio_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_actions" ADD CONSTRAINT "recommendation_actions_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_actions" ADD CONSTRAINT "recommendation_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pathway_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_counts" ADD CONSTRAINT "user_topic_counts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_snapshots" ADD CONSTRAINT "rule_snapshots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_snapshots" ADD CONSTRAINT "rule_snapshots_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_snapshots" ADD CONSTRAINT "rule_snapshots_safety_signed_by_id_fkey" FOREIGN KEY ("safety_signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_plans" ADD CONSTRAINT "support_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_dump_item_id_fkey" FOREIGN KEY ("source_dump_item_id") REFERENCES "dump_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written additions (ENGINEERING_RULES §5.3). Prisma doesn't model these.
-- ---------------------------------------------------------------------------

-- Scales and ratings stay in range.
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_energy_range" CHECK ("energy" BETWEEN 1 AND 4);
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_mood_range" CHECK ("mood" BETWEEN 1 AND 4);
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_grid_has_cell" CHECK ("source" <> 'grid' OR ("energy" IS NOT NULL AND "mood" IS NOT NULL));
ALTER TABLE "check_in_emotions" ADD CONSTRAINT "check_in_emotions_intensity_range" CHECK ("intensity" BETWEEN 0 AND 10);
ALTER TABLE "check_in_sensations" ADD CONSTRAINT "check_in_sensations_intensity_range" CHECK ("intensity" IS NULL OR "intensity" BETWEEN 0 AND 10);
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_helpful_range" CHECK ("helpful" IS NULL OR "helpful" BETWEEN 1 AND 5);
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_effort_range" CHECK ("effort" IS NULL OR "effort" BETWEEN 1 AND 5);
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_text_size_range" CHECK ("text_size" BETWEEN 0 AND 3);
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_quiet_hours_range" CHECK (("quiet_hours_start" IS NULL OR "quiet_hours_start" BETWEEN 0 AND 1439) AND ("quiet_hours_end" IS NULL OR "quiet_hours_end" BETWEEN 0 AND 1439));
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_nudges_range" CHECK ("task_nudges_per_day" BETWEEN 0 AND 10);
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_position_range" CHECK ("position" BETWEEN 0 AND 19);
ALTER TABLE "dump_items" ADD CONSTRAINT "dump_items_position_range" CHECK ("position" BETWEEN 0 AND 199);
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_anonymity_floor_min" CHECK ("anonymity_floor" >= 5);
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email"));

-- At most one published rule snapshot.
CREATE UNIQUE INDEX "rule_snapshots_one_published" ON "rule_snapshots" ("status") WHERE "status" = 'published';

-- Append-only tables: the app may insert, never change or remove (hard deletes of a whole user go
-- through the cascade, which is allowed by checking for the deleting session flag).
CREATE FUNCTION "reject_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('figcit.allow_purge', true) = 'on' THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER "audit_events_append_only" BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION "reject_change"();
CREATE TRIGGER "consents_append_only" BEFORE UPDATE ON "consents" FOR EACH ROW EXECUTE FUNCTION "reject_change"();
CREATE TRIGGER "safety_events_append_only" BEFORE UPDATE ON "safety_events" FOR EACH ROW EXECUTE FUNCTION "reject_change"();

-- Large JSON compresses well with lz4.
ALTER TABLE "recommendations" ALTER COLUMN "trace" SET COMPRESSION lz4;
ALTER TABLE "rule_snapshots" ALTER COLUMN "json" SET COMPRESSION lz4;

-- Hot subsets.
CREATE INDEX "tasks_open_by_due" ON "tasks" ("user_id", "due_at") WHERE "status" = 'open' AND "deleted_at" IS NULL;
CREATE INDEX "reminders_due" ON "reminders" ("next_run_at") WHERE "active" AND "deleted_at" IS NULL;
CREATE INDEX "users_pending_purge" ON "users" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
