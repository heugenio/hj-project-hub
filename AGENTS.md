# Project architecture

- Dashboard requests use the shared React Query client with keys scoped to API server, user, logged-in branch, profile, endpoint and sales dates; short-lived caching and in-flight deduplication reduce repeated legacy calls without mixing sessions.
- Dashboard primary branch data loads independently from branch metadata and summaries; consolidated branch requests remain concurrency-limited to avoid saturating the legacy server.
- Dashboard never calls getDemonstrativoVendas; KPIs (faturamento, lucro, margem) come from getComparativoResumo and group panels from getComparativo, to keep the legacy server load low.