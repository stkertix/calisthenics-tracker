/** Konstanta app & storage keys. */

export const SCHEMA_VERSION = 1;

export const STORAGE = {
  meta: "yd-calisthenics-tracker:meta",
  master: "yd-calisthenics-tracker:master-v1",
  history: "yd-calisthenics-tracker:history-v1",
  session: "yd-calisthenics-tracker:session-v1",
};

export const LEGACY_STORAGE_KEY = "yd-calisthenics-tracker-v1";
export const HISTORY_EXPORT_TYPE = "calisthenics-tracker-history";
export const HISTORY_MAX = 60;

/**
 * Step migrasi: key = versi asal (sebelum naik 1).
 * Contoh: 1: (data) => { ...; return data; } lalu SCHEMA_VERSION = 2.
 */
export const MIGRATIONS = {
  0: (data) => data,
};
