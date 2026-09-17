/// <reference path="../pb_data/types.d.ts" />
//
// Sends a REAL email whenever the client app writes a new `emailNotifications`
// record (see src/services/bookingService.ts `addEmailNotification`). This is
// the PocketBase replacement for the old Firebase Cloud Function
// (functions/index.js) — no SendGrid/Blaze plan needed, since PocketBase can
// send mail directly through any SMTP account.
//
// REQUIRED SETUP (see DEPLOY.md "Configure SMTP" section):
//   PocketBase Admin UI -> Settings -> Mail settings
//   Fill in your SMTP host/port/username/password (e.g. Gmail + an App
//   Password, or your company mailbox's SMTP relay) and Save. That's it —
//   this hook uses whatever is configured there.

onRecordAfterCreateSuccess((e) => {
  const notification = e.record;

  const recipientEmail = notification.get("recipientEmail");
  const subject = notification.get("subject");
  const bodyHtml = notification.get("bodyHtml");

  if (!recipientEmail || !subject) {
    console.warn("Skipping malformed emailNotifications record", notification.id);
    e.next();
    return;
  }

  try {
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      },
      to: [{ address: recipientEmail }],
      subject: subject,
      html: bodyHtml || "",
    });

    $app.newMailClient().send(message);

    notification.set("emailSent", true);
    notification.set("emailSentAt", new Date().toISOString());
    $app.save(notification);
  } catch (err) {
    console.error("Failed to send booking email:", err);
    notification.set("emailSent", false);
    notification.set("emailError", String(err));
    $app.save(notification);
  }

  e.next();
}, "emailNotifications");
