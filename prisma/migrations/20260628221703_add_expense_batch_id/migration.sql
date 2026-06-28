-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_batchId_idx" ON "Expense"("batchId");
