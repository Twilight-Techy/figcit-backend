-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "buyable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length_days" SMALLINT,
ADD COLUMN     "tier" VARCHAR(8) NOT NULL DEFAULT 'free';

-- The plans in the business plan (Developer Brief, Plans and pricing). Prices are pence before VAT;
-- every paid plan has an annual option at 12 months for the price of 10. FigCit Plus is retired:
-- anyone who has it keeps what it gave them, as Prime.
UPDATE "plans" SET "tier" = 'prime', "active" = false WHERE "code" LIKE 'plus\_%';
UPDATE "plans" SET "tier" = 'premium', "name" = 'Organisation seat', "position" = 6 WHERE "code" = 'institution';

INSERT INTO "plans" ("code", "name", "tier", "price_minor", "currency", "interval", "features", "active", "position", "buyable", "length_days") VALUES
  ('free', 'Free', 'free', NULL, 'GBP', NULL, ARRAY['all_free_tools','engine','help','support_plan','progress_30_days'], true, 0, false, NULL),
  ('prime_monthly', 'Prime', 'prime', 700, 'GBP', 'month', ARRAY['full_history','more_choices','sorting','unlimited_rewrite'], true, 1, true, NULL),
  ('prime_yearly', 'Prime', 'prime', 7000, 'GBP', 'year', ARRAY['full_history','more_choices','sorting','unlimited_rewrite'], true, 2, true, NULL),
  ('premium_monthly', 'Premium', 'premium', 1300, 'GBP', 'month', ARRAY['full_history','reports','patterns','full_toolkit'], true, 3, true, NULL),
  ('premium_yearly', 'Premium', 'premium', 13000, 'GBP', 'year', ARRAY['full_history','reports','patterns','full_toolkit'], true, 4, true, NULL),
  ('org_seat', 'Organisation seat', 'premium', 1000, 'GBP', 'month', ARRAY['full_history','reports','patterns','full_toolkit'], true, 5, false, NULL),
  ('pilot', 'Launch pilot', 'premium', NULL, 'GBP', NULL, ARRAY['full_history','reports','patterns','full_toolkit'], true, 7, false, 42)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name", "tier" = EXCLUDED."tier", "price_minor" = EXCLUDED."price_minor",
  "interval" = EXCLUDED."interval", "features" = EXCLUDED."features", "active" = EXCLUDED."active",
  "position" = EXCLUDED."position", "buyable" = EXCLUDED."buyable", "length_days" = EXCLUDED."length_days";
