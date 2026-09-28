# Use shared-schema tenant isolation with collaboration grants

**Status: accepted.** The first deployment will use a shared PostgreSQL schema with mandatory `tenant_id`, API authorization, and PostgreSQL Row-Level Security. Supplier/buyer cooperation will use explicit, scoped collaboration grants rather than merging organizations into one tenant. This gives a low-cost starting point while preserving a migration path to dedicated schemas or databases for high-isolation customers.
