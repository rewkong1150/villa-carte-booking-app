/// <reference path="../pb_data/types.d.ts" />
//
// HOTFIX: 6_it_helpdesk.js created `itTickets` as a plain base collection
// without explicit `created`/`updated` system fields. Unlike collections
// made through the Admin UI wizard (which auto-adds these), a collection
// built via migration code does NOT get them for free -- so every list/
// subscribe call in ticketService.ts (`sort: '-created'`) has been failing
// with "invalid sort field \"created\"" (400) since deploy, for every signed-in
// user, every page load (confirmed via a live PocketBase log entry: GET
// /api/collections/itTickets/records ... sort=-created -> 400, details:
// "invalid sort field \"created\""). It failed silently client-side (caught
// and console.error'd in ticketService.ts) so nobody's booking flow broke,
// but the ticket list itself never actually loaded for anyone.
migrate((app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) {
    if (!itTickets.fields.getByName("created")) {
      itTickets.fields.add(new AutodateField({ name: "created", onCreate: true, system: true }));
    }
    if (!itTickets.fields.getByName("updated")) {
      itTickets.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true, system: true }));
    }
    app.save(itTickets);
  }
}, (app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) {
    const created = itTickets.fields.getByName("created");
    if (created) itTickets.fields.removeById(created.id);
    const updated = itTickets.fields.getByName("updated");
    if (updated) itTickets.fields.removeById(updated.id);
    app.save(itTickets);
  }
});
