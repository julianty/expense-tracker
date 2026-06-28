-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'create';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "splitMode" TEXT NOT NULL DEFAULT 'equal';
