// Every answer of this Worker carries these headers: the site calls it from another origin.
// specs/025-rune-purchase-import adds PATCH and DELETE for the Forgemagie profile (contracts/fm-site-api.md),
// specs/027-fm-item-recap PUT to attach a session to an item.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};
