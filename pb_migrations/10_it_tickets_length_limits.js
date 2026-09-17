/// <reference path="../pb_data/types.d.ts" />
//
// itTickets.title/description had no explicit max length (PocketBase applies
// an implicit 5000-char default, but that's still large enough to let a
// title balloon well past anything the UI card layout or the notification
// email were designed for). Caps title to a real "title" length and
// description to a generous-but-bounded size.
migrate((app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) {
    const title = itTickets.fields.getByName("title");
    if (title) title.max = 200;
    const description = itTickets.fields.getByName("description");
    if (description) description.max = 3000;
    app.save(itTickets);
  }
}, (app) => {
  const itTickets = app.findCollectionByNameOrId("itTickets");
  if (itTickets) {
    const title = itTickets.fields.getByName("title");
    if (title) title.max = 0;
    const description = itTickets.fields.getByName("description");
    if (description) description.max = 0;
    app.save(itTickets);
  }
});
