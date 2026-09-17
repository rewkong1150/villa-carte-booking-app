/// <reference path="../pb_data/types.d.ts" />
//
// SECURITY FIX: `emailNotifications` previously used the same org-domain-wide
// rule as everything else (any signed-in @villacartegroup.com user could
// list/view/update/delete ANY notification record). That meant:
//   - every employee's EmailDrawer showed every OTHER employee's booking
//     invites (meeting titles, guest lists, etc.) — a real privacy leak.
//   - the "Clear inbox" button deleted the entire company's notification
//     history, not just the clicker's own.
// Scoping these rules to `recipientEmail = @request.auth.email` fixes both,
// with no client-side code changes needed — `getFullList()`/`subscribe('*')`
// in src/services/bookingService.ts already only ever receive whatever the
// API rule permits, so the existing client code becomes correctly scoped
// automatically once this rule is in place.

const ORG_DOMAIN_RULE = "@request.auth.id != '' && @request.auth.email ~ '%@villacartegroup.com'";
const RECIPIENT_ONLY_RULE = `${ORG_DOMAIN_RULE} && recipientEmail = @request.auth.email`;

migrate((app) => {
  const emailNotifications = app.findCollectionByNameOrId("emailNotifications");
  if (emailNotifications) {
    emailNotifications.listRule = RECIPIENT_ONLY_RULE;
    emailNotifications.viewRule = RECIPIENT_ONLY_RULE;
    emailNotifications.updateRule = RECIPIENT_ONLY_RULE;
    emailNotifications.deleteRule = RECIPIENT_ONLY_RULE;
    app.save(emailNotifications);
  }
}, (app) => {
  const emailNotifications = app.findCollectionByNameOrId("emailNotifications");
  if (emailNotifications) {
    emailNotifications.listRule = ORG_DOMAIN_RULE;
    emailNotifications.viewRule = ORG_DOMAIN_RULE;
    emailNotifications.updateRule = ORG_DOMAIN_RULE;
    emailNotifications.deleteRule = ORG_DOMAIN_RULE;
    app.save(emailNotifications);
  }
});
