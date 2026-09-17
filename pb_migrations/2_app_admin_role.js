/// <reference path="../pb_data/types.d.ts" />
//
// Adds a second admin tier: "App Admin". The single hardcoded ADMIN_EMAIL
// (see src/data/initialData.ts) remains the one true super-admin (controls
// PocketBase itself — SMTP, OAuth, backups, etc). App Admins are ordinary
// signed-in staff additionally flagged `isAppAdmin = true` on their `users`
// record — they get the same in-app booking privileges as the super-admin
// (edit/cancel/delete any booking, see the Admin Dashboard) but cannot touch
// server settings.
//
// There is no in-app UI to grant this flag (by design — see below), so to
// promote someone: PocketBase Admin UI -> Collections -> users -> open their
// record -> set "isAppAdmin" to true -> Save.

const ADMIN_EMAIL = "patomporn.k@villacartegroup.com";
const ORG_DOMAIN_RULE = "@request.auth.id != '' && @request.auth.email ~ '%@villacartegroup.com'";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    if (!users.fields.getByName("isAppAdmin")) {
      users.fields.add(new BoolField({ name: "isAppAdmin" }));
    }
    // The app never lets a signed-in user edit their own `users` record (no
    // profile-editing feature exists), so there's no legitimate reason to
    // allow API updates to it at all. Locking updateRule to superuser-only
    // (null) closes off the only path a client could otherwise use to try to
    // self-promote by PATCHing their own isAppAdmin field.
    users.updateRule = null;
    app.save(users);
  }

  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    bookings.updateRule = `${ORG_DOMAIN_RULE} && (@request.auth.email = "${ADMIN_EMAIL}" || @request.auth.isAppAdmin = true || userEmail = @request.auth.email)`;
    bookings.deleteRule = `@request.auth.email = "${ADMIN_EMAIL}" || @request.auth.isAppAdmin = true`;
    app.save(bookings);
  }
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    bookings.updateRule = `${ORG_DOMAIN_RULE} && (@request.auth.email = "${ADMIN_EMAIL}" || userEmail = @request.auth.email)`;
    bookings.deleteRule = `@request.auth.email = "${ADMIN_EMAIL}"`;
    app.save(bookings);
  }

  const users = app.findCollectionByNameOrId("users");
  if (users) {
    const field = users.fields.getByName("isAppAdmin");
    if (field) users.fields.removeById(field.id);
    users.updateRule = null; // restore whatever the built-in default was is not recoverable; leave locked
    app.save(users);
  }
});
