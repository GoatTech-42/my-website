# Restricted viewer access pilot

Production Registry remains disabled. The dark Worker has no hostname, Registry binding or authentication variables. It contains no campaign data.

Browser enrollment uses an independent public code and a 256-bit HttpOnly browser secret. A member must post only the code from their own browser in the original group. Approval requires the attributed original message, timestamp and an opaque member key. Source IDs are provenance references, not identity authentication. The trusted executor must verify the originals.

An approved code expires in15minutes, is consumed atomically and rotates the browser secret. Every read checks a separate active membership grant, expiration and generation. Local tests use a24-hour grant ceiling, not approved production policy. Reads never renew it. After a lapse, expired sessions are deleted and a fresh browser enrollment is required. A seven-day cookie does not guarantee seven-day campaign access. Known member revocation invalidates every old-generation session and pending approval immediately. Individual administrative session revocation is not implemented; own logout is available.

No current-roster API exists. A missed departure can retain access for the remaining grant period. The proposed policy must be accepted with this limitation and the daily own-browser enrollment burden before live use. No daily reminder loop is enabled.

Implemented local checks cover transaction claim cap, expiry, digest rotation, replay denial, known revocation, stale/predating/replayed attestation rejection, exact Origin on browser mutations, secret-only cookies, read-only viewers and hostname denial. Storage cleanup covers expired pending records and indexes, consumed pending records, expired/revoked sessions, and member generation tombstones. Garbage-row inspection is a direct Registry storage-double test; concurrency/consume/revoke tests use actual SQLite.

Remaining: actual HTTPS cookies/host/asset checks, trusted group enrollment handling, membership-policy approval, protected executor installation, live save/readback/restore and sole-writer handoff. Anonymous issuance has a global30/hour cap. It bounds storage but can deny the entire group's enrollment under attack; availability is not claimed solved. Freshness checks cannot stop a compromised trusted executor. Lost cookies require new enrollment, not a shared password.
