/** Default timeout for Forge resolve / lightweight calls (ms). */
export const FORGE_REQUEST_TIMEOUT_MS = parseInt(
  process.env.THEFORGE_REQUEST_TIMEOUT_MS ?? '120000',
  10,
);

/** Create-stage can run legacy_start + deliverables — allow long upstream work (ms). */
export const FORGE_CREATE_STAGE_TIMEOUT_MS = parseInt(
  process.env.THEFORGE_CREATE_STAGE_TIMEOUT_MS ?? '600000',
  10,
);

/** Re-allow promote after a stuck pending promotion (ms). */
export const FORGE_PROMOTION_PENDING_TTL_MS = parseInt(
  process.env.FORGE_PROMOTION_PENDING_TTL_MS ?? '900000',
  10,
);
