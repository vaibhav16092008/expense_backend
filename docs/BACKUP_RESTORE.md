# ExpenseIQ Backend — Database Backup & Restore Guide

This guide outlines PostgreSQL logical backup (`pg_dump`), restore procedures, and pre-migration database snapshotting best practices.

---

## 1. Logical Backup (`pg_dump`)

### Full Database Backup (Custom Binary Format - Recommended)

```bash
pg_dump -h localhost -U postgres -d expenseiq -F c -b -v -f expenseiq_backup_$(date +%Y%m%d_%H%M%S).dump
```

### SQL Text Backup

```bash
pg_dump -h localhost -U postgres -d expenseiq -F p -v -f expenseiq_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Pre-Migration Snapshot Recommendation

Always take a logical backup immediately prior to running `npx prisma migrate deploy` in production:

```bash
# Take pre-migration snapshot
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f pre_migration_$(date +%Y%m%d).dump

# Execute migration
npx prisma migrate deploy
```

---

## 3. Database Restore (`pg_restore` / `psql`)

### Restore Custom Format (`.dump`)

```bash
# 1. Create fresh target database if needed
createdb -h localhost -U postgres expenseiq_restored

# 2. Restore backup into target database
pg_restore -h localhost -U postgres -d expenseiq_restored -v expenseiq_backup_20260908_120000.dump
```

### Restore Plain SQL Text Format (`.sql`)

```bash
psql -h localhost -U postgres -d expenseiq_restored -f expenseiq_backup_20260908_120000.sql
```

---

## 4. Post-Restore Verification Checklist

After restoring a database backup:

1. Verify schema integrity:
   ```bash
   npx prisma validate
   ```
2. Verify application connectivity:
   ```bash
   curl -f http://localhost:5000/health/ready
   ```
3. Run test suite against restored database copy in staging environment:
   ```bash
   npm test
   ```
