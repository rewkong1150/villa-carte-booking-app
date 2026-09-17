/// <reference path="../pb_data/types.d.ts" />
//
// IT Helpdesk: employees submit tickets, IT staff triage/resolve them. Reuses
// the same "manually-flagged staff tier" pattern as `isAppAdmin`
// (2_app_admin_role.js) rather than the client's `department` field -- that
// field only lives in the browser's localStorage (see App.tsx
// DEPARTMENTS_STORAGE_KEY), never persisted to the PocketBase `users`
// record, so it can't be trusted by a server-side rule. `isITStaff` is a real
// field on the auth record, toggled the same way App Admin is: PocketBase
// Admin UI -> Collections -> users -> open a record -> set "isITStaff" ->
// Save. No in-app UI grants it, for the same reason App Admin has none.
const ADMIN_EMAIL = "patomporn.k@villacartegroup.com";
const ORG_DOMAIN_RULE = "@request.auth.id != '' && @request.auth.email ~ '%@villacartegroup.com'";
const IS_IT_OR_ADMIN_RULE = `(@request.auth.email = "${ADMIN_EMAIL}" || @request.auth.isITStaff = true)`;

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    if (!users.fields.getByName("isITStaff")) {
      users.fields.add(new BoolField({ name: "isITStaff" }));
    }
    // users.updateRule is already locked to superuser-only (null) by
    // 2_app_admin_role.js, which covers this new field too.
    app.save(users);
  }

  const itTickets = new Collection({
    name: "itTickets",
    type: "base",
    listRule: `${ORG_DOMAIN_RULE} && (requesterEmail = @request.auth.email || ${IS_IT_OR_ADMIN_RULE})`,
    viewRule: `${ORG_DOMAIN_RULE} && (requesterEmail = @request.auth.email || ${IS_IT_OR_ADMIN_RULE})`,
    createRule: `${ORG_DOMAIN_RULE} && @request.body.requesterEmail = @request.auth.email`,
    updateRule: `${ORG_DOMAIN_RULE} && (requesterEmail = @request.auth.email || ${IS_IT_OR_ADMIN_RULE})`,
    deleteRule: IS_IT_OR_ADMIN_RULE,
    fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "text", required: true },
      {
        name: "category",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["Hardware", "Software", "Network", "Account", "Other"],
      },
      {
        name: "priority",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["Low", "Medium", "High", "Urgent"],
      },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["Open", "InProgress", "Resolved", "Closed"],
      },
      { name: "requesterEmail", type: "email", required: true },
      { name: "requesterName", type: "text", required: true },
      { name: "requesterDepartment", type: "text" },
      { name: "assignedToEmail", type: "email" },
      { name: "resolutionNotes", type: "text" },
      { name: "resolvedAt", type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_itTickets_requesterEmail ON itTickets (requesterEmail)",
      "CREATE INDEX idx_itTickets_status ON itTickets (status)",
    ],
  });
  app.save(itTickets);
}, (app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) app.delete(itTickets);

  const users = app.findCollectionByNameOrId("users");
  if (users) {
    const field = users.fields.getByName("isITStaff");
    if (field) users.fields.removeById(field.id);
    app.save(users);
  }
});
