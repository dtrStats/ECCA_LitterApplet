/* ECCA Litter Study — service worker
   Makes the applet open with no signal after the first successful load.

   Strategy:
     - The app shell (this page) is cached on install and served cache-first,
       so a volunteer at a trailhead with no bars can still open it.
     - Requests to Google Apps Script are NEVER cached or intercepted. Data
       must always go to the live sheet, and a cached "success" would be a lie.
     - A new deployment bumps CACHE_VERSION, which drops every old cache.
*/
const CACHE_VERSION = 'ecca-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', event => {
  // Take over as soon as the new worker is ready
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                     // never touch writes

  const url = new URL(req.url);
  // Data traffic must always hit the network, online or not.
  if (url.hostname.indexOf('google.com') !== -1 ||
      url.hostname.indexOf('googleusercontent.com') !== -1) return;

  if (url.origin !== self.location.origin) return;      // leave other origins alone

  // Network-first so a redeploy is picked up promptly, cache as the fallback
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});

// Lets the page trigger an immediate update
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
