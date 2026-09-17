/// <reference path="../pb_data/types.d.ts" />
//
// bookings.attendeesCount had no server-side lower bound -- the client's
// number input has min={1} but that's only a browser-level nudge, and
// validateBookingConstraints only checked the upper bound (capacity) until
// this same audit pass added the lower-bound check there too. A direct API
// write could still set 0 or a negative attendee count with nothing to stop
// it. This enforces the same floor at the schema level.
migrate((app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    const attendeesCount = bookings.fields.getByName("attendeesCount");
    if (attendeesCount) attendeesCount.min = 1;
    app.save(bookings);
  }
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    const attendeesCount = bookings.fields.getByName("attendeesCount");
    if (attendeesCount) attendeesCount.min = null;
    app.save(bookings);
  }
});
