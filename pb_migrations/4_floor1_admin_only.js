/// <reference path="../pb_data/types.d.ts" />
//
// Floor 1 rooms (room-101, room-102, room-103) are walk-in/VIP rooms managed
// at the front desk — only an admin (super-admin or app-admin) may create a
// booking for them. Regular employees must ask the admin to book on their
// behalf. Enforced here on createRule only (not updateRule): the app's
// cancel flow submits a partial update ({status: 'cancelled'}) with no
// roomId in the body at all, and PocketBase 0.39.11's rule engine has a
// documented crash with `:isset`-based conditional checks (see
// 1_init_collections.js), so a roomId-conditional updateRule isn't safe to
// add here. The client (BookingModal.tsx) already prevents non-admins from
// selecting or switching to a Floor 1 room in the UI.
const ADMIN_EMAIL = "patomporn.k@villacartegroup.com";
const ORG_DOMAIN_RULE = "@request.auth.id != '' && @request.auth.email ~ '%@villacartegroup.com'";
const IS_ADMIN_RULE = `(@request.auth.email = "${ADMIN_EMAIL}" || @request.auth.isAppAdmin = true)`;

migrate((app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    bookings.createRule = `${ORG_DOMAIN_RULE} && @request.body.userEmail = @request.auth.email && (@request.body.roomId ~ "room-2%" || ${IS_ADMIN_RULE})`;
    app.save(bookings);
  }
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    bookings.createRule = `${ORG_DOMAIN_RULE} && @request.body.userEmail = @request.auth.email`;
    app.save(bookings);
  }
});
