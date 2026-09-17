/// <reference path="../pb_data/types.d.ts" />
//
// HOTFIX for a regression in 5_lock_isappadmin_on_create.js: PocketBase's
// Google OAuth2 auto-provisioning never sends `isAppAdmin` in its create
// body at all (Google has no concept of it) -- but contrary to what that
// migration assumed, `@request.body.isAppAdmin = false` does NOT treat a
// completely absent field as false. It evaluates false (no match), which
// blocked EVERY brand-new employee's first Google sign-in with "Failed to
// create record", not just the intended isAppAdmin-escalation attempts.
// Confirmed live: an OAuth-style create with no isAppAdmin field in the body
// was rejected under the old rule, and succeeds under this one.
//
// Fix: explicitly allow the field being unset via `:isset`, in addition to
// it being present-and-false. This still blocks a create body that sets
// isAppAdmin=true.
const ORG_DOMAIN_RULE = "@request.body.email ~ \"%@villacartegroup.com\"";
const ISAPPADMIN_NOT_TRUE_RULE = "(@request.body.isAppAdmin:isset = false || @request.body.isAppAdmin = false)";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.createRule = `${ORG_DOMAIN_RULE} && ${ISAPPADMIN_NOT_TRUE_RULE}`;
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.createRule = `${ORG_DOMAIN_RULE} && @request.body.isAppAdmin = false`;
    app.save(users);
  }
});
