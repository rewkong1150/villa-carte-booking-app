/// <reference path="../pb_data/types.d.ts" />
//
// SECURITY FIX: `2_app_admin_role.js` added the `isAppAdmin` field and locked
// `users.updateRule` to superuser-only, closing the self-PATCH-to-admin path.
// It missed that `users.createRule` (from `1_init_collections.js`) only
// checks the email domain -- it never restricted the `isAppAdmin` field. Any
// unauthenticated caller could POST directly to
// `/api/collections/users/records` with `{ email: "x@villacartegroup.com",
// password: "...", passwordConfirm: "...", isAppAdmin: true }` and grant
// themselves App Admin on signup, bypassing Google Sign-In entirely.
//
// Fix: require `isAppAdmin` to be false/absent on create. PocketBase's
// OAuth2 auto-provisioning (which also goes through this createRule per the
// comment in 1_init_collections.js) never sends `isAppAdmin` in its body, so
// it defaults to the field's zero value (false) and still passes.
// Promoting someone to App Admin remains admin-UI-only, as designed.
const ORG_DOMAIN_RULE = "@request.body.email ~ \"%@villacartegroup.com\"";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.createRule = `${ORG_DOMAIN_RULE} && @request.body.isAppAdmin = false`;
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.createRule = ORG_DOMAIN_RULE;
    app.save(users);
  }
});
