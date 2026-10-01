/// <reference path="../pb_data/types.d.ts" />
//
// Auto-renews Google Calendar access without the manual "reconnect" prompt
// that was previously needed every time the ~1hr access token expired.
//
// How it fits together (see also GoogleAuthModal.tsx, googleCalendarService.ts):
//   1. Sign-in now requests access_type=offline + prompt=consent, so Google
//      also issues a long-lived refresh_token (previously only the
//      short-lived access_token was ever requested/used).
//   2. The client POSTs that refresh_token here once, right after sign-in --
//      /api/save-google-refresh-token -- which stores it in the
//      googleRefreshTokens collection (locked down, see its migration).
//   3. Whenever the client needs a fresh access token (proactively on a
//      timer, or reactively after an expired-token Calendar API error), it
//      calls /api/refresh-google-token instead of prompting the user. This
//      route uses the stored refresh_token + the app's OAuth client
//      id/secret (secret from the GOOGLE_CLIENT_SECRET env var -- never
//      sent to the client) to ask Google for a new access_token directly,
//      and returns ONLY that new access_token back.
//
// Users who connected before this existed won't have a stored refresh_token
// yet -- they'll see one more manual reconnect (which now also requests
// offline access), and auto-renewal takes over after that.
//
// NOTE: no shared top-level consts/helpers between (or even within) the
// routes below, on purpose -- see sendTicketEmail.pb.js's comment for why.
// Confirmed the hard way while testing this file: a top-level
// GOOGLE_OAUTH_CLIENT_ID const, referenced only from the second route below,
// still threw "ReferenceError: GOOGLE_OAUTH_CLIENT_ID is not defined" at
// runtime -- each routerAdd callback really does need everything inlined.

routerAdd("POST", "/api/save-google-refresh-token", (e) => {
  if (!e.auth) {
    throw new UnauthorizedError("Must be signed in.");
  }

  let data;
  try {
    data = new DynamicModel({ refreshToken: "" });
    e.bindBody(data);
  } catch (err) {
    throw new BadRequestError("Invalid request body.");
  }

  const refreshToken = data.refreshToken;
  if (!refreshToken) {
    throw new BadRequestError("Missing refreshToken.");
  }

  const userId = e.auth.id;
  let record = null;
  try {
    record = $app.findFirstRecordByFilter("googleRefreshTokens", "userId = {:userId}", { userId: userId });
  } catch (err) {
    // not found -- will create below
  }

  if (!record) {
    const collection = $app.findCollectionByNameOrId("googleRefreshTokens");
    record = new Record(collection);
    record.set("userId", userId);
  }
  record.set("refreshToken", refreshToken);

  try {
    $app.save(record);
  } catch (err) {
    console.error("Failed to save Google refresh token for user", userId, ":", err);
    throw new BadRequestError("Failed to save refresh token.");
  }

  return e.json(200, { ok: true });
}, $apis.requireAuth());

routerAdd("GET", "/api/refresh-google-token", (e) => {
  if (!e.auth) {
    throw new UnauthorizedError("Must be signed in.");
  }

  const GOOGLE_OAUTH_CLIENT_ID = "250664497600-qripk9kqfi16e4i5na7veta3pa772krm.apps.googleusercontent.com";

  const clientSecret = $os.getenv("GOOGLE_CLIENT_SECRET");
  if (!clientSecret) {
    console.error("GOOGLE_CLIENT_SECRET env var is not set -- cannot refresh Google tokens.");
    return e.json(500, { error: "server_not_configured" });
  }

  let record = null;
  try {
    record = $app.findFirstRecordByFilter("googleRefreshTokens", "userId = {:userId}", { userId: e.auth.id });
  } catch (err) {
    return e.json(404, { error: "no_refresh_token" });
  }

  const refreshToken = record.get("refreshToken");
  if (!refreshToken) {
    return e.json(404, { error: "no_refresh_token" });
  }

  const body = "grant_type=refresh_token" +
    "&refresh_token=" + encodeURIComponent(refreshToken) +
    "&client_id=" + encodeURIComponent(GOOGLE_OAUTH_CLIENT_ID) +
    "&client_secret=" + encodeURIComponent(clientSecret);

  let res;
  try {
    res = $http.send({
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
    });
  } catch (err) {
    console.error("Google token refresh request failed:", err);
    return e.json(502, { error: "google_request_failed" });
  }

  if (res.statusCode !== 200) {
    console.error("Google token refresh returned non-200:", res.statusCode, res.raw);
    // invalid_grant means the refresh token itself is dead (revoked/expired) --
    // clear it so we stop retrying with a token that will never work again.
    if (res.statusCode === 400 && res.json && res.json.error === "invalid_grant") {
      try {
        $app.delete(record);
      } catch (err) {
        console.error("Failed to clear dead refresh token:", err);
      }
    }
    return e.json(502, { error: "google_refresh_failed" });
  }

  return e.json(200, { accessToken: res.json.access_token, expiresIn: res.json.expires_in });
}, $apis.requireAuth());
