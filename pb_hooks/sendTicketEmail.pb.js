/// <reference path="../pb_data/types.d.ts" />
//
// Sends real emails for the IT Helpdesk: notifies every isITStaff=true user
// when a new ticket is created or reopened, and notifies the requester when
// their ticket is marked Resolved or Closed. Runs server-side ($app has
// superuser-level access), so it can look up all IT staff directly -- the
// client can't do this itself, since the `users` collection's listRule only
// lets someone see their own record.
//
// REQUIRED SETUP: same as sendBookingEmail.pb.js -- PocketBase Admin UI ->
// Settings -> Mail settings must have SMTP configured.
//
// NOTE: no shared top-level helper functions here, on purpose. An earlier
// version of pb_hooks/preventBookingOverlap.pb.js had a `const hasOverlap`
// declared at the top of the file and called from two separate hook
// callbacks -- syntactically fine, but it broke ALL booking creation in
// production with "ReferenceError: hasOverlap is not defined" the moment it
// went live. PocketBase's own docs explain why: "Each handler function
// (hook, route, middleware, etc.) is serialized and executed in its own
// isolated context as a separate 'program'" -- so a module-level const is
// NOT reliably visible inside a hook callback, even in the same file, even
// though plain JavaScript scoping rules would say it should be. This file
// had the exact same pattern (`sendMail`/`notifyItStaff` shared across two
// hooks) and was an equally real latent bug that just hadn't been triggered
// yet. Each hook below now defines its own small mail-sending helper INSIDE
// its own callback body instead -- a nested function used only within the
// same "program" is safe; a module-level one shared across hooks is not.

onRecordAfterCreateSuccess((e) => {
  const sendMail = (toEmail, subject, html) => {
    try {
      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
        to: [{ address: toEmail }],
        subject: subject,
        html: html,
      }));
    } catch (err) {
      console.error("Failed to send ticket email to", toEmail, ":", err);
    }
  };

  const ticket = e.record;
  let itStaff = [];
  try {
    itStaff = $app.findRecordsByFilter("users", "isITStaff = true", "-created", 100, 0);
  } catch (err) {
    console.error("Failed to look up IT staff for ticket notification:", err);
  }

  const subject = `[VCG IT Helpdesk] New ticket: ${ticket.get("title")}`;
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
      <h3 style="color: #1e1b4b;">New ticket</h3>
      <p><strong>Title:</strong> ${ticket.get("title")}</p>
      <p><strong>Category:</strong> ${ticket.get("category")} &nbsp;|&nbsp; <strong>Priority:</strong> ${ticket.get("priority")}</p>
      <p><strong>Requested by:</strong> ${ticket.get("requesterName")} (${ticket.get("requesterEmail")})</p>
      <p><strong>Description:</strong><br/>${ticket.get("description")}</p>
    </div>
  `;

  for (const staff of itStaff) {
    const email = staff.get("email");
    if (email) sendMail(email, subject, html);
  }

  e.next();
}, "itTickets");

onRecordAfterUpdateSuccess((e) => {
  const sendMail = (toEmail, subject, html) => {
    try {
      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName },
        to: [{ address: toEmail }],
        subject: subject,
        html: html,
      }));
    } catch (err) {
      console.error("Failed to send ticket email to", toEmail, ":", err);
    }
  };

  const ticket = e.record;
  const status = ticket.get("status");

  // A ticket is always created with status "Open", so seeing "Open" on an
  // UPDATE event (this hook only fires on updates, not creates) can only
  // mean it was just reopened.
  if (status === "Open") {
    let itStaff = [];
    try {
      itStaff = $app.findRecordsByFilter("users", "isITStaff = true", "-created", 100, 0);
    } catch (err) {
      console.error("Failed to look up IT staff for ticket notification:", err);
    }

    const subject = `[VCG IT Helpdesk] Ticket reopened: ${ticket.get("title")}`;
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
        <h3 style="color: #1e1b4b;">Ticket reopened</h3>
        <p><strong>Title:</strong> ${ticket.get("title")}</p>
        <p><strong>Category:</strong> ${ticket.get("category")} &nbsp;|&nbsp; <strong>Priority:</strong> ${ticket.get("priority")}</p>
        <p><strong>Requested by:</strong> ${ticket.get("requesterName")} (${ticket.get("requesterEmail")})</p>
        <p><strong>Description:</strong><br/>${ticket.get("description")}</p>
      </div>
    `;

    for (const staff of itStaff) {
      const email = staff.get("email");
      if (email) sendMail(email, subject, html);
    }
  }

  if (status === "Resolved" || status === "Closed") {
    const requesterEmail = ticket.get("requesterEmail");
    const subject = `[VCG IT Helpdesk] Your ticket is ${status}: ${ticket.get("title")}`;
    const notes = ticket.get("resolutionNotes");
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
        <h3 style="color: #047857;">Your ticket has been ${status === "Resolved" ? "resolved" : "closed"}</h3>
        <p><strong>Title:</strong> ${ticket.get("title")}</p>
        ${notes ? `<p><strong>Notes from IT:</strong><br/>${notes}</p>` : ""}
      </div>
    `;
    if (requesterEmail) sendMail(requesterEmail, subject, html);
  }

  e.next();
}, "itTickets");
