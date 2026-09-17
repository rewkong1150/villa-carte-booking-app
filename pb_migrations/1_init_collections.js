/// <reference path="../pb_data/types.d.ts" />
//
// Schema-as-code for the Villa Carte Group meeting room booking app.
// PocketBase applies this automatically on container startup (no manual
// clicking through the Admin UI needed). Mirrors the access-control logic
// that used to live in firestore.rules:
//   - only signed-in @villacartegroup.com accounts may read/write at all
//   - a booking can only be created under the signer's own identity
//   - only the original booker or the admin may edit/cancel a booking
//   - only the admin may permanently delete a booking
//
// NOTE: rule syntax (`@request.body.*` vs `@request.data.*`) matches
// PocketBase 0.23+. If your installed version is older, the Admin UI's rule
// editor will flag a syntax error immediately — swap `@request.body` for
// `@request.data` in that case.

const ADMIN_EMAIL = "patomporn.k@villacartegroup.com";
const ORG_DOMAIN_RULE = "@request.auth.id != '' && @request.auth.email ~ '%@villacartegroup.com'";

migrate((app) => {
  // The built-in `users` auth collection ships with public self-registration
  // (createRule: ""). Restrict it server-side to the company domain only.
  //
  // NOTE: we deliberately do NOT also exclude ADMIN_EMAIL here. PocketBase's
  // OAuth2 auto-provisioning runs through this same createRule, and on
  // PocketBase 0.39.11 an email-inequality check combined with a
  // `:isset`-based password check on @request.body caused the rule engine to
  // fail with "sql: no rows in result set" — surfaced client-side as "Failed
  // to create record" and blocking Google Sign-In entirely. Confirmed via
  // Admin UI Logs during real deployment. The admin-email-blocked-from-
  // password-signup behavior is still enforced client-side in
  // GoogleAuthModal.tsx (no password input is ever shown/submitted for that
  // address), so this server-side rule doesn't need to duplicate it.
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.createRule = `@request.body.email ~ "%@villacartegroup.com"`;
    app.save(users);
  }

  const bookings = new Collection({
    name: "bookings",
    type: "base",
    listRule: ORG_DOMAIN_RULE,
    viewRule: ORG_DOMAIN_RULE,
    createRule: `${ORG_DOMAIN_RULE} && @request.body.userEmail = @request.auth.email`,
    updateRule: `${ORG_DOMAIN_RULE} && (@request.auth.email = "${ADMIN_EMAIL}" || userEmail = @request.auth.email)`,
    deleteRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
    fields: [
      { name: "roomId", type: "text", required: true },
      { name: "title", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "userId", type: "text", required: true },
      { name: "userName", type: "text", required: true },
      { name: "userEmail", type: "email", required: true },
      { name: "department", type: "text", required: true },
      { name: "startTime", type: "date", required: true },
      { name: "endTime", type: "date", required: true },
      { name: "attendeesCount", type: "number", required: true },
      { name: "guestEmails", type: "json" },
      { name: "googleCalendarEventId", type: "text" },
      { name: "googleCalendarEventLink", type: "url" },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["confirmed", "cancelled"],
      },
    ],
    indexes: [
      "CREATE INDEX idx_bookings_roomId ON bookings (roomId)",
      "CREATE INDEX idx_bookings_userEmail ON bookings (userEmail)",
    ],
  });
  app.save(bookings);

  const emailNotifications = new Collection({
    name: "emailNotifications",
    type: "base",
    listRule: ORG_DOMAIN_RULE,
    viewRule: ORG_DOMAIN_RULE,
    createRule: ORG_DOMAIN_RULE,
    updateRule: ORG_DOMAIN_RULE,
    deleteRule: ORG_DOMAIN_RULE,
    fields: [
      {
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["booking_created", "booking_cancelled", "booking_updated"],
      },
      { name: "recipientEmail", type: "email", required: true },
      { name: "recipientName", type: "text" },
      { name: "subject", type: "text", required: true },
      { name: "bodyHtml", type: "editor" },
      { name: "sentAt", type: "date", required: true },
      { name: "read", type: "bool" },
      { name: "bookingDetails", type: "json" },
      // set by pb_hooks/sendBookingEmail.pb.js once it attempts real delivery
      { name: "emailSent", type: "bool" },
      { name: "emailSentAt", type: "date" },
      { name: "emailError", type: "text" },
    ],
  });
  app.save(emailNotifications);
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) app.delete(bookings);

  const emailNotifications = app.findCollectionByNameOrId("emailNotifications");
  if (emailNotifications) app.delete(emailNotifications);

  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.createRule = ""; // restore PocketBase's default (public, unrestricted signup)
    app.save(users);
  }
});
