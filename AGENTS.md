# Project architecture

- Dashboard requests use the shared React Query client with keys scoped to API server, user, logged-in branch, profile, endpoint and sales dates; short-lived caching and in-flight deduplication reduce repeated legacy calls without mixing sessions.
- Dashboard primary branch data loads independently from branch metadata and summaries; consolidated branch requests remain concurrency-limited to avoid saturating the legacy server.
- When the legacy comparative endpoint returns an empty array, Dashboard builds per-group comparisons from actual current and previous sales periods, sharing cached sales requests; group types remain Geral when the sales response supplies no type, rather than inventing classifications.