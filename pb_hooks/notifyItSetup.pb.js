/// <reference path="../pb_data/types.d.ts" />
//
// "ต้องการให้ IT ช่วยเซ็ตอัพ" (needsItSupport) support for bookings:
//   1. On booking create, if needsItSupport is checked, email every
//      isITStaff=true user -- same reasoning as sendTicketEmail.pb.js: this
//      must run server-side ($app has superuser-level access) since the
//      `users` collection's listRule only lets a client see their own record.
//   2. A small authenticated read-only route the CLIENT calls to get IT
//      staff emails, needed so App.tsx can invite them to a Google Calendar
//      entry for the meeting setup -- that step has to happen in the browser
//      (only the browser holds the booker's short-lived Google OAuth access
//      token), so the client needs the recipient list, just not full user
//      records (hence a dedicated minimal endpoint instead of loosening the
//      users collection's listRule).
//
// NOTE: no shared top-level helper functions between the two registrations
// below, on purpose -- see sendTicketEmail.pb.js's comment for why (each
// hook/route handler runs in its own isolated PocketBase JS "program" and
// does not reliably see module-level consts from elsewhere in the file).

onRecordAfterCreateSuccess((e) => {
  const booking = e.record;
  if (!booking.get("needsItSupport")) {
    e.next();
    return;
  }

  let itStaff = [];
  try {
    itStaff = $app.findRecordsByFilter("users", "isITStaff = true", "-created", 100, 0);
  } catch (err) {
    console.error("Failed to look up IT staff for booking setup notification:", err);
  }

  // booking.get("startTime")/("endTime") are raw UTC ISO strings
  // (e.g. "2026-09-29 13:00:00.000Z") -- displaying them as-is would show IT
  // staff the wrong time (13:00 for a meeting that's actually 20:00 Bangkok
  // time). The rest of this app is careful about this (see bookingUtils.ts's
  // Bangkok-timezone-safe formatters), but those are client-side TS and not
  // available in this server-side hook runtime, so the same fixed UTC+7
  // conversion (Thailand has no DST) is reimplemented inline here. Defined
  // INSIDE this callback, not at module top-level -- see this file's top
  // comment for why a shared top-level helper broke a different hook once.
  const formatBangkok = (isoStr) => {
    const utcMs = new Date(isoStr).getTime();
    const bkk = new Date(utcMs + 7 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(bkk.getUTCDate())}/${pad(bkk.getUTCMonth() + 1)}/${bkk.getUTCFullYear()} ${pad(bkk.getUTCHours())}:${pad(bkk.getUTCMinutes())}`;
  };

  const subject = `[VCG Booking] Meeting setup support needed: ${booking.get("title")}`;
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
      <h3 style="color: #1e1b4b;">A meeting room booking has requested IT setup support</h3>
      <p><strong>Topic:</strong> ${booking.get("title")}</p>
      <p><strong>Room:</strong> ${booking.get("roomId")}</p>
      <p><strong>Start time:</strong> ${formatBangkok(booking.get("startTime"))} (Bangkok time)</p>
      <p><strong>End time:</strong> ${formatBangkok(booking.get("endTime"))} (Bangkok time)</p>
      <p><strong>Booked by:</strong> ${booking.get("userName")} (${booking.get("userEmail")})</p>
    </div>
  `;

  for (const staff of itStaff) {
    const email = staff.get("email");
    if (!email) continue;
    try {
      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
        to: [{ address: email }],
        subject: subject,
        html: html,
      }));
    } catch (err) {
      console.error("Failed to send IT setup email to", email, ":", err);
    }
  }

  e.next();
}, "bookings");

routerAdd("GET", "/api/it-staff-emails", (e) => {
  let itStaff = [];
  try {
    itStaff = $app.findRecordsByFilter("users", "isITStaff = true", "-created", 100, 0);
  } catch (err) {
    console.error("Failed to look up IT staff emails:", err);
    return e.json(500, { emails: [] });
  }
  const emails = itStaff.map((r) => r.get("email")).filter((email) => !!email);
  return e.json(200, { emails: emails });
}, $apis.requireAuth());
