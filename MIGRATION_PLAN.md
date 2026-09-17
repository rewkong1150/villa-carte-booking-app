# Villa Carte Group — Meeting Room Booking App: Current Implementation & Migration Plan

## 1. Current Architecture

**Stack:** React 19 + TypeScript + Vite (SPA) + TailwindCSS v4, backed by a single self-hosted **PocketBase** instance (Go binary, SQLite storage, built-in auth/realtime/file storage/SMTP mailer).

**Hosting:** PocketBase runs as a Docker container (`ghcr.io/muchobien/pocketbase:latest`) on a Synology NAS at the client's office, via `docker-compose.yml`. PocketBase serves **both** the REST/realtime API **and** the built React app itself (static files copied into `pocketbase/pb_public/`) — same origin, no separate web server, no CORS configuration needed.

**External network path:** Office MikroTik router, dual-WAN (2 ISP lines) with PCC load-balancing + a DDNS hostname (`vcgaccounting.synology.me`) resolving to whichever WAN is currently primary. Port-forwards 443/80 to the NAS on both WAN legs, plus symmetric-routing firewall rules so replies exit the same WAN a connection arrived on (this took real debugging effort — see §5).

**Auth:** Google OAuth2 only (via PocketBase's built-in OAuth2 support), restricted to the `@villacartegroup.com` domain. No email/password signup path is exposed in the UI. A designated admin email (`ADMIN_EMAIL` in `src/data/initialData.ts`) gets elevated `role: 'admin'` app-side, gated server-side via an `isAppAdmin` field on the `users` collection (see `pb_migrations/2_app_admin_role.js`, `5_lock_isappadmin_on_create.js`, `7_fix_isappadmin_create_rule.js`).

**External integration:** Google Calendar — each booking is mirrored to the booker's own primary Google Calendar AND to a Google Workspace **Calendar Resource** (a real bookable room resource in the client's Google Workspace, one per physical meeting room — see `resourceEmail` on each room in `src/data/initialData.ts`), via `src/services/googleCalendarService.ts` calling the Calendar REST API directly with the user's OAuth access token (no server-side Calendar API key/service account — access token is short-lived, ~1hr, and the app has UI to detect and prompt reconnection when it expires).

## 2. Data Model (PocketBase Collections)

| Collection | Purpose | Key fields |
|---|---|---|
| `users` (built-in auth collection) | App users | `email`, `name`, `isAppAdmin`, `isITStaff`, department (client-side localStorage, not server-persisted — see gotcha in §5) |
| `bookings` | Room reservations | `roomId`, `title`, `startTime`/`endTime`, `attendeesCount`, `status` (`confirmed`/`cancelled`), `googleCalendarEventId`/`googleCalendarEventLink`, `created`/`updated` (added late — migration 13) |
| `emailNotifications` | In-app notification log + triggers real email send | `recipientEmail`, `subject`, `bodyHtml`, `emailSent`/`emailSentAt`/`emailError` |
| `itTickets` | IT Helpdesk tickets (separate feature, same app) | `title`, `description`, `category`, `priority`, `status`, `assignedToEmail`, `resolvedByEmail`, `resolutionNotes` |

Rooms themselves are **not** a database collection — they're a hardcoded array in `src/data/initialData.ts` (5 fixed rooms across 2 floors, each with a `resourceEmail` for Google Workspace Calendar Resource sync). Departments are similarly a fixed list in `src/data/departments.ts`, not a collection.

Server-side authorization (who can create/read/update/delete what) lives entirely in **PocketBase collection API rules** (configured via the migration files, not the Admin UI) — e.g. floor-1 rooms are admin-only to book, users can only edit/cancel their own bookings, IT staff/admins can manage all tickets. A new platform must reimplement this rule logic at whatever layer replaces it (a different BaaS's row-level security, or custom API middleware).

## 3. Business Logic That Lives Outside the Database Rules

PocketBase JS hooks (`pb_hooks/*.pb.js`) implement logic too complex for declarative API rules:

- **`preventBookingOverlap.pb.js`** — server-side double-booking prevention (checks for an existing `confirmed` booking on the same room with an overlapping time range, on both create and update, rejecting with a clear error message).
- **`sendBookingEmail.pb.js`** / **`sendTicketEmail.pb.js`** — real email delivery via PocketBase's built-in SMTP mailer whenever an `emailNotifications` record is created, or on ticket status transitions (created / resolved / closed / reopened) for `itTickets`.

**Important PocketBase-specific gotcha, confirmed via official docs, that caused a real production outage this project:** each hook handler executes in its own isolated JS context and does **not** reliably share module-level `const`/functions declared elsewhere in the same file — all logic must be fully inlined inside each individual hook callback. A migration to a different backend that uses normal shared-scope functions won't have this constraint, but anyone re-reading this codebase to port the logic should not be confused by the inlined/duplicated-looking code in these hook files — it's intentional.

## 4. Client-Side Business Logic Worth Preserving

- **Bangkok-timezone-safe date handling** (`src/utils/bookingUtils.ts`) — the app hardcodes UTC+7 (no DST in Thailand) for constructing and displaying all booking times, independent of the viewing device's own timezone/locale. This was deliberately built and tested (via a Node script under multiple simulated system timezones) after a real bug where a non-Thailand-timezone browser stored the wrong absolute time.
- **Double-booking / capacity / floor-1-admin-only validation** — enforced both client-side (`validateBookingConstraints` in `bookingUtils.ts`, for instant UX feedback) and server-side (PocketBase API rules + the overlap hook, as the actual source of truth — never trust the client alone).
- **3-language i18n** (Thai/English/Russian) via `src/context/LanguageContext.tsx`, with browser-language auto-detection on first visit.
- **Session handling** — the client actively re-validates the PocketBase auth token against the server (not just trusting the locally-cached JWT's own embedded expiry) on mount, every 10 minutes, and on tab focus/visibility change, because mobile browsers throttle background timers. A cached-but-actually-expired token is explicitly cleared (a real bug fixed in this project — a stale "look logged in, but every read/write silently fails" state).

## 5. Known Gotchas / Things a New Team Must Not Rediscover the Hard Way

1. **PocketBase migration filenames are not zero-padded** (`1_`, `2_`, ... `13_`) and PocketBase sorts them as strings, not numbers — `10_`/`11_`/`12_`/`13_` sort *before* `2_`–`9_` alphabetically. Harmless for normal one-at-a-time incremental deploys, but a from-scratch replay (disaster recovery, or migrating the schema to a fresh instance) will run them out of order and can crash (`findCollectionByNameOrId` throws, not returns null, when a referenced collection doesn't exist yet). **Fix before migrating**: rename to zero-padded (`01_`...`13_`) — but note PocketBase tracks *applied* migrations by filename in its own `_migrations` table, so renaming already-applied files on the *live* instance would make it think they're new and try to re-run them. Do this rename only on a fresh target instance building up from these files from scratch, not by renaming in place on the current production instance.
2. **`google-calendar` reply-routing on the office router** — external reachability to the NAS depends on the office MikroTik's dual-WAN symmetric-routing firewall rules (mangle rules keyed by which WAN interface a connection arrived on). If the migration includes moving off this NAS/network entirely, this whole class of problem (and the router config) becomes irrelevant — worth flagging explicitly to a new host provider that this was previously a real source of "random" outages caused by network asymmetry, not application bugs.
3. **`.env.local` vs `.env.development.local`** — Vite loads `.env.local` in *all* modes including production builds; only `.env.development.local` is dev-only. A previous near-miss almost baked a dev backend URL into a production bundle.
4. **Google Calendar Resource `resource:true` attendee flag** can only be set the *first* time an attendee is added to an event — but since this app always rebuilds the full attendee list from scratch on every update (Calendar API replaces list fields wholesale on PATCH), changing a booking's room correctly swaps which resource is invited (old one removed = no longer attending; new one added fresh = counts as "first time").
5. **`fs.cpSync` recursive mode crashes Node with no error output** when the destination path contains Thai characters (this machine's dev folder is Thai-named) — `scripts/copy-to-pocketbase.js` uses manual recursive copy instead. Not an issue if a new host's build pipeline doesn't reuse this exact script on this exact machine, but worth knowing if debugging that script specifically.
6. Deploy pipeline note: `scripts/deploy.ps1`'s `scp` step passes a Windows-style wildcard path directly to `scp.exe`, which PowerShell does not glob-expand for external executables — this step currently fails and has to be done manually via a shell that does perform the expansion (e.g., Git Bash). Worth fixing properly if the deploy pipeline itself carries over to a new host.

## 6. Suggested Migration Approach (hosting/platform move)

Since the target platform wasn't specified yet, here's a phased approach that works regardless of the destination:

**Phase 1 — Stand up PocketBase on the new host, unchanged.**
The lowest-risk first step: PocketBase is a single portable Go binary + SQLite file. Move the whole `pb_data/` directory (contains the live SQLite DB + uploaded files) and the `pb_migrations/`/`pb_hooks/` folders to the new host, running the identical PocketBase version via the same `docker-compose.yml` (or bare binary). This alone decouples the app from the current NAS/router network entirely, without touching a single line of application code. Point DNS to the new host, done.

**Phase 2 — (Optional) Replace PocketBase with a different backend.**
Only pursue this if the new platform specifically can't or shouldn't run PocketBase (e.g., a mandated cloud stack). In that case, the collections in §2, the API rules encoding the authorization logic, and the hook logic in §3 all need to be reimplemented on the new backend — this is a substantially larger effort than Phase 1 and should be scoped separately once the target platform is chosen. Recommend keeping the same client-side data shapes (`src/types.ts`) as a spec to reduce the blast radius on the React app.

**Either way, do NOT skip:**
- Re-verifying Google OAuth2 redirect URIs are updated in Google Cloud Console for the new domain/host, or logins will break.
- Re-verifying the Google Workspace Calendar Resource emails (`resourceEmail` per room) still work — they're tied to the client's Google Workspace, not to the hosting platform, so this should be unaffected, but confirm as part of testing.
- Reconfiguring SMTP settings on whatever now sends the `sendBookingEmail`/`sendTicketEmail` mail (currently PocketBase's built-in mailer, configured via its Admin UI, not in this repo's version control at all).

## 7. Open Questions for Whoever Picks This Up

- What's the target platform/host? (Determines whether Phase 1 or Phase 2 above applies.)
- Does the new environment need to preserve the exact current domain (`vcgaccounting.synology.me`), or is a new domain acceptable? Affects the OAuth redirect URI update above.
- Is downtime during cutover acceptable, or does this need a zero-downtime migration (relevant mainly if going with Phase 2, since Phase 1 can be done with a brief DNS-cutover window)?
