/// <reference path="../pb_data/types.d.ts" />
//
// Adds `resolvedByEmail`: IT staff can click "Mark Resolved" directly on an
// Open ticket without ever clicking "Assign to Me" first, so `assignedToEmail`
// alone doesn't reliably record who actually fixed it -- only who claimed it
// (if anyone did). This is a separate field set specifically at resolve time.
migrate((app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) {
    if (!itTickets.fields.getByName("resolvedByEmail")) {
      itTickets.fields.add(new EmailField({ name: "resolvedByEmail" }));
    }
    app.save(itTickets);
  }
}, (app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) {
    const field = itTickets.fields.getByName("resolvedByEmail");
    if (field) itTickets.fields.removeById(field.id);
    app.save(itTickets);
  }
});
