/// <reference path="../pb_data/types.d.ts" />
//
// Sets the `users` auth token lifetime to exactly 24 hours (in seconds).
// Requested after a real incident: a colleague's session went stale while her
// tab stayed open, and every booking write silently failed until she
// refreshed the page (see App.tsx's new periodic authRefresh() check, added
// the same day, which now also slides this expiry forward on every
// successful check while a tab stays active and online).
const ONE_DAY_SECONDS = 24 * 60 * 60;

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.authToken.duration = ONE_DAY_SECONDS;
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.authToken.duration = 7 * 24 * 60 * 60; // PocketBase factory default
    app.save(users);
  }
});
