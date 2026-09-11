-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_userId_clientRequestId_key" ON "transactions"("userId", "clientRequestId");
