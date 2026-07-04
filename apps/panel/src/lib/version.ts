// ============================================================================
// App Version — single source of truth
//
// Read from package.json at build time via next.config.js env injection.
// Falls back to the literal string so it always renders something.
// ============================================================================

/** Semantic version string, e.g. "1.3.0" */
export const APP_VERSION: string =
  process.env.NEXT_PUBLIC_APP_VERSION ?? '1.3.0';

/** Full display string shown in the UI, e.g. "v1.3.0" */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
