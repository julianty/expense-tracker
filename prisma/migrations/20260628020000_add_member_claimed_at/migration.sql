-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN "claimedAt" TIMESTAMP(3);

-- Backfill: slots already linked to a real account count as claimed.
UPDATE "GroupMember" SET "claimedAt" = "createdAt" WHERE "claimedByUserId" IS NOT NULL;
