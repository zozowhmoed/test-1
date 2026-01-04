const CACHE_NAME = 'study-timer-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-timer') {
    event.waitUntil(syncTimerData());
  }
});

async function syncTimerData() {
  // هنا يمكنك إضافة كود لمزامنة البيانات مع الخادم
  const data = {
    lastUpdate: new Date().toISOString()
  };
  
  return fetch('https://your-api-endpoint.com/sync', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_UPDATED') {
    // معالجة تحديث الذاكرة المؤقتة
  }
});