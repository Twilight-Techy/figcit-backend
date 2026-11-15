-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "seats_purchased" INTEGER;

-- CreateTable
CREATE TABLE "tenant_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "number" VARCHAR(24) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "seats" INTEGER NOT NULL,
    "unit_minor" INTEGER NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "vat_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'GBP',
    "status" VARCHAR(8) NOT NULL DEFAULT 'draft',
    "note" VARCHAR(300),
    "issued_at" TIMESTAMPTZ(3),
    "due_at" DATE,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invoices_number_key" ON "tenant_invoices"("number");

-- CreateIndex
CREATE INDEX "tenant_invoices_tenant_id_created_at_idx" ON "tenant_invoices"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
