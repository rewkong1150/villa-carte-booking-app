/// <reference path="../pb_data/types.d.ts" />
//
// Tracks the separate IT-setup Google Calendar event's id, mirroring
// googleCalendarEventId. Without this, cancelling a booking has no way to
// find and delete that second event -- confirmed as a real bug via a live
// test booking: cancelling correctly removed the main event but left the
// IT-setup one orphaned on the calendar.
migrate((app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    if (!bookings.fields.getByName("itSetupCalendarEventId")) {
      bookings.fields.add(new TextField({ name: "itSetupCalendarEventId" }));
    }
    app.save(bookings);
  }
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    const field = bookings.fields.getByName("itSetupCalendarEventId");
    if (field) bookings.fields.removeById(field.id);
    app.save(bookings);
  }
});
