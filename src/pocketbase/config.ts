import PocketBase from 'pocketbase';

// Empty string in production: PocketBase serves the built React app itself
// (see scripts/copy-to-pocketbase.js), so API calls are same-origin. In dev,
// point this at your NAS's PocketBase instance, e.g. http://192.168.1.50:8090
const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || '';

export const pb = new PocketBase(POCKETBASE_URL);

// Multiple components subscribe/list concurrently (realtime + initial fetch) —
// don't let the SDK auto-cancel one in favor of the other.
pb.autoCancellation(false);

export const ADMIN_GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
];
