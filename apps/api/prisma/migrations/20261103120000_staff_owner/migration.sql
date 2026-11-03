-- The platform's one Owner (DECISION_LOG E-64): at most one row.


-- CreateTable
CREATE TABLE "staff_owner" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID NOT NULL,
    "since" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_owner_user_id_key" ON "staff_owner"("user_id");

-- AddForeignKey
ALTER TABLE "staff_owner" ADD CONSTRAINT "staff_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One Owner at most: the only id allowed is 1.
ALTER TABLE "staff_owner" ADD CONSTRAINT "staff_owner_one_row" CHECK ("id" = 1);
