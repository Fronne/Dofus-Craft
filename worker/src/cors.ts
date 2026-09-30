// Every answer of this Worker carries these headers: the site calls it from another origin.
// specs/025-rune-purchase-import adds PATCH and DELETE for the Forgemagie profile (contracts/fm-site-api.md).
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};
