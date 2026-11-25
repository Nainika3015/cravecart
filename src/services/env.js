/* ============================================================
   CraveCart - env.js
   Small environment helpers.

   isDemoEnvironment() decides whether the public demo credentials
   may be shown. They are hidden on a custom/real domain, because a
   site serving real accounts must never advertise shared logins.
   ============================================================ */

export function currentHost() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.hostname || '';
}

export function isLocalHost() {
  const host = currentHost();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isDemoEnvironment() {
  const host = currentHost();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  /* The hosted hackathon demo lives on a *.vercel.app domain. */
  return host.endsWith('.vercel.app') || host.startsWith('192.168.') || host.startsWith('10.');
}

/* Same-origin API base: the Vite dev middleware and the Vercel
   serverless function both answer on /api/*. */
export const API_BASE = '/api';
