/// <reference path="../pb_data/types.d.ts" />
//
// Stores each user's Google OAuth refresh token so the Calendar access token
// can be auto-renewed server-side (see pb_hooks/googleTokenRefresh.pb.js)
// instead of requiring a manual "reconnect" every ~1 hour when it expires.
//
// Locked down completely: all rules are null (superuser/hook-only, NOT ""
// which in PocketBase means "public, unrestricted" -- confirmed via official
// docs, the two are opposite). No client, not even the token's own owner,
// can list/view/create/update/delete these records through the regular API
// at all -- only $app-level hook code (which bypasses rules entirely) can
// read or write them. The refreshToken field is additionally marked hidden
// as defense in depth.
migrate((app) => {
  const collection = new Collection({
    name: "googleRefreshTokens",
    type: "base",
    fields: [
      { name: "userId", type: "text", required: true },
      { name: "refreshToken", type: "text", required: true, hidden: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_googleRefreshTokens_userId ON googleRefreshTokens (userId)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("googleRefreshTokens");
  if (collection) app.delete(collection);
});
