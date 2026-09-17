/// <reference path="../pb_data/types.d.ts" />
//
// Server-side double-booking guard. bookingUtils.ts's validateBookingConstraints
// already checks for overlaps client-side before a booking is submitted, but
// that check only runs against whatever the client had cached locally at
// that exact moment -- there is no unique/exclusion constraint on the
// `bookings` collection anywhere (only plain, non-unique indexes on roomId
// and userEmail; see pb_migrations/1_init_collections.js). Two people
// booking the same room+time within the same race window each pass their
// OWN client-side check against their own stale snapshot and could both
// reach the create/update API call -- there was nothing stopping both from
// succeeding at the database level. This hook re-checks atomically at
// write time, right before the record is actually persisted.
//
// NOTE: the overlap check is written out fully inside EACH hook callback
// (not factored into a shared top-level helper function) on purpose -- a
// prior version used a shared `const hasOverlap = (...) => {...}` referenced
// from both callbacks, and it broke ALL booking creation in production with
// "ReferenceError: hasOverlap is not defined" the moment it went live. That
// helper was defined and used in the same file and should have been in
// scope, but PocketBase's JS hook runtime evidently doesn't guarantee a
// module-level const survives to be visible from inside hook callbacks the
// way plain JavaScript scoping would suggest (unlike sendTicketEmail.pb.js's
// AFTER-success hooks, which use the same pattern and do work -- the
// difference wasn't understood well enough to trust here again, so this
// file deliberately avoids relying on it a second time).

onRecordCreateRequest((e) => {
  const record = e.record;
  if (record.get("status") === "confirmed") {
    const roomId = record.get("roomId");
    const startTime = record.get("startTime");
    const endTime = record.get("endTime");
    const conflicts = $app.findRecordsByFilter(
      "bookings",
      "roomId = {:roomId} && status = 'confirmed' && startTime < {:endTime} && endTime > {:startTime}",
      "",
      1,
      0,
      { roomId: roomId, startTime: startTime, endTime: endTime }
    );
    if (conflicts.length > 0) {
      throw new BadRequestError("This room is already booked for the selected time. Please choose a different time or room.");
    }
  }
  e.next();
}, "bookings");

onRecordUpdateRequest((e) => {
  const record = e.record;
  if (record.get("status") === "confirmed") {
    const roomId = record.get("roomId");
    const startTime = record.get("startTime");
    const endTime = record.get("endTime");
    const conflicts = $app.findRecordsByFilter(
      "bookings",
      "roomId = {:roomId} && status = 'confirmed' && startTime < {:endTime} && endTime > {:startTime} && id != {:excludeId}",
      "",
      1,
      0,
      { roomId: roomId, startTime: startTime, endTime: endTime, excludeId: record.id }
    );
    if (conflicts.length > 0) {
      throw new BadRequestError("This room is already booked for the selected time. Please choose a different time or room.");
    }
  }
  e.next();
}, "bookings");
