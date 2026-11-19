-- CreateTable
CREATE TABLE "comm_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text_enc" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comm_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comm_cards_user_id_created_at_idx" ON "comm_cards"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "comm_cards" ADD CONSTRAINT "comm_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
