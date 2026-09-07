-- CreateIndex
CREATE INDEX "goal_contributions_userId_goalId_createdAt_idx" ON "goal_contributions"("userId", "goalId", "createdAt");

-- CreateIndex
CREATE INDEX "recurring_transactions_active_nextRunAt_idx" ON "recurring_transactions"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "recurring_transactions_userId_active_nextRunAt_idx" ON "recurring_transactions"("userId", "active", "nextRunAt");
