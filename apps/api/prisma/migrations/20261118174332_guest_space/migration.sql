-- AlterTable
ALTER TABLE "users" ADD COLUMN     "guest_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "guest_signups" (
    "id" UUID NOT NULL,
    "addr_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_signups_addr_hash_created_at_idx" ON "guest_signups"("addr_hash", "created_at");

-- CreateIndex
CREATE INDEX "guest_signups_created_at_idx" ON "guest_signups"("created_at");

-- CreateIndex
CREATE INDEX "users_is_guest_guest_expires_at_idx" ON "users"("is_guest", "guest_expires_at");
