const CACHE_NAME = 'app-cache-v50';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  // تكييش الملفات الأساسية والصور مشان يقبل يتثبت كـ PWA
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // حذف الكاش القديم
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // منع تكعيش ملفات فايربيس لضمان بقاء تسجيل الدخول
  if (event.request.method !== 'GET' || event.request.url.includes('firebase')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // جلب من النت أولاً، وتحديث الكاش بالخلفية
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response; 
      })
      .catch(() => {
        // إذا مافي نت، جيب من الكاش
        return caches.match(event.request);
      })
  );
});
