/// <reference path="../pb_data/types.d.ts" />
//
// Adds an opt-in "I want IT to help set up this meeting" flag to bookings.
// When true, notifyItSetup.pb.js emails IT staff on booking create, and the
// client (App.tsx) additionally creates a separate Google Calendar entry
// inviting IT staff, using a token only the browser has.
migrate((app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    if (!bookings.fields.getByName("needsItSupport")) {
      bookings.fields.add(new BoolField({ name: "needsItSupport" }));
    }
    app.save(bookings);
  }
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    const field = bookings.fields.getByName("needsItSupport");
    if (field) bookings.fields.removeById(field.id);
    app.save(bookings);
  }
});
