# Performance query index

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
