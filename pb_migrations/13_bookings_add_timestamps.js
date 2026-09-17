/// <reference path="../pb_data/types.d.ts" />
//
// Same gap as itTickets had (9_it_tickets_add_timestamps.js): `bookings` was
// created as a plain base collection with no explicit `created`/`updated`
// system fields, so booking.createdAt/updatedAt have been blank since day
// one (bookingService.ts's toBooking() reads record.created/record.updated,
// which simply don't exist as columns). This never crashed the way
// itTickets did only because nothing sorts bookings by "-created" (it uses
// "-startTime" instead) -- but the missing data is still a real gap.
//
// Adding the field does NOT retroactively populate old rows (PocketBase
// doesn't backfill autodate values for existing records) -- existing
// bookings will keep showing a blank createdAt, exactly as they do now, so
// this doesn't touch/alter any existing data. Only bookings created or
// updated from this point forward get a real timestamp.
migrate((app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    if (!bookings.fields.getByName("created")) {
      bookings.fields.add(new AutodateField({ name: "created", onCreate: true, system: true }));
    }
    if (!bookings.fields.getByName("updated")) {
      bookings.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true, system: true }));
    }
    app.save(bookings);
  }
}, (app) => {
  const bookings = app.findCollectionByNameOrId("bookings");
  if (bookings) {
    const created = bookings.fields.getByName("created");
    if (created) bookings.fields.removeById(created.id);
    const updated = bookings.fields.getByName("updated");
    if (updated) bookings.fields.removeById(updated.id);
    app.save(bookings);
  }
});
