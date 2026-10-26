# Performance query index

## Competitor date index (2026-10-26)

`competitor-indexes.rules.json` targets **schedule-7ec7a**, separately from the
performance database below. Its `competitorInfo/monthly/$month/data/$company`
rule adds `.indexOn: ["date"]` for every month and company. Existing permissions
were preserved when deployed. Actual SSG/K date-range REST reads were verified.

Competitor reads now reject missing indexes rather than scanning a whole month.
The shared reader stores bounded daily records in IndexedDB (180 days / 24 MiB),
validates each affected month's existing `monthly/{month}/updatedAt`, and reuses
overlapping in-flight reads. It keeps no historical raw-row memory cache. Existing
MSM month replacement writes are detected through that same timestamp; no MSM
project changes are required. Manual refresh clears the data cache without
touching meeting drafts. Cache storage failure falls back to indexed RTDB reads.

## Existing performance database

Merge the `performanceEntries/.indexOn` entry from `performance-indexes.rules.json`
into the existing Realtime Database rules for project `pgmdr-87328`.
Preserve all existing read/write permissions, validation rules, and indexes.
This file is a patch example, not a replacement for the full rules document.

Date queries use the existing `YYYYMMDDHHmm_...` entry IDs and RTDB's built-in
key index. Product queries use the existing `perfKey` field; they do not add
or move any performance data. REST queries reject missing indexes rather than
silently downloading the entire database for client-side filtering.

The database owner added the index in Firebase Console on 2026-10-15.
An actual `perfKey` query was verified successfully after that change.

## Runtime behavior

- PGM assignment queries one day using the key prefix; revisiting a cached date
  makes no further query. The navigation range ends at the earlier of promotion
  end, today in Korea, and `performanceMeta/latestDate`. Empty days show no rows.
- The previous-three expander queries one existing `perfKey` and caches that
  product's full history. P-1/P-2/P-3 all use promotion start as the cutoff,
  exclude the full promotion period, and use three calendar months (clamped at
  month end). Broadcasts starting from 01:00 through 04:59 are excluded.
- Metadata version changes invalidate cached entries lazily. Only a date/product
  currently being viewed or subsequently requested is fetched again. Memory
  caches retain at most 60 days and 150 products.
- Review loads only the user-selected range, reusing the date cache. Scheduling
  loads latest values and histories only for requested product keys.
- No performance root collection is downloaded. Promotion assignments retain
  their separate small realtime name subscription and original `promotionName`.

## Multiple promotions and reservations

- `performancePromotionIds/{entryId}` is the authoritative realtime membership
  index: `{ "_v": true, "promotionId": true }`. `_v` keeps an explicitly cleared
  selection from falling back to an old `promotionName`. New edits also mirror
  individual ID leaves to `performanceEntries/{entryId}/promotionIds`.
- Opening Promotions migrates recognized legacy name-index assignments to IDs
  using transactions that preserve any existing ID selection. Legacy names and
  unrecognized names remain intact; reads support unmigrated rows as a fallback.
  Migration writes only the authoritative index and does not download history.
- `promotionReservations/{sha256([promotionId, broadcastTimestamp, code])}` stores
  Korea-local `broadcastDateTime`, its numeric `YYYYMMDDHHmm` timestamp, code,
  promotion ID, status, creator and application entry IDs. Registration validates
  the current RTDB code master and promotion period; duplicate submissions cannot
  reset completed reservations. Cancelled reservations can be registered again.
- Registration checks already existing performance for that day. Both performance
  refresh paths match newly imported rows by exact timestamp and code, add ID
  leaves, and mark reservations applied in one atomic update. No process runs
  merely because time passes: automatic application runs during app refresh.
- A transaction claims a pending reservation before application to prevent a
  concurrent cancellation. Failed applications release the claim. A claim left
  by a closed browser can be retried after two minutes. Completed reservations
  do not reapply a promotion that a user subsequently removes manually.
- Each promotion's report includes its ID membership; total/outside calculations
  continue to use unique performance entry IDs, not assignment counts.
