// Caching logic for PWA offline functionality
const CACHE_NAME = 'guru-pwa-cache-v2';
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/manifest.webmanifest',
    '/logo.svg' // Add the new logo to the app shell
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching App Shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .then(() => self.skipWaiting()) // Activate new SW immediately
    );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Take control of all pages
});

// Fetch: stale-while-revalidate strategy for offline-first experience
self.addEventListener('fetch', (event) => {
    // For non-GET requests, just use the network.
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    console.warn('Service Worker: Network request failed. Serving from cache if available.', err);
                });

                return cachedResponse || fetchPromise;
            });
        })
    );
});

// Existing notification logic
let timeoutIds = [];
const dayMap = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 0 };

function showNotification(item) {
    const className = item.className || item.class_id; 
    self.registration.showNotification('Pengingat Kelas: ' + item.subject, {
        body: 'Kelas ' + className + ' akan dimulai pada pukul ' + item.start_time + '.',
        icon: '/logo.svg', // Use new SVG logo for notifications
        requireInteraction: true,
        tag: item.id,
    });
}

function scheduleNotifications(schedule) {
    clearScheduledNotifications();
    const now = new Date();
    const todayIndex = now.getDay();
    const upcomingClasses = schedule.filter(item => {
        if (dayMap[item.day] !== todayIndex) return false;
        const [hours, minutes] = item.start_time.split(':');
        const classTime = new Date();
        classTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        return classTime > now;
    });
    upcomingClasses.forEach(item => {
        const [hours, minutes] = item.start_time.split(':');
        const classTime = new Date();
        classTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        // Remind 5 minutes before
        const notificationTime = new Date(classTime.getTime() - 5 * 60 * 1000);
        if (notificationTime > now) {
            const delay = notificationTime.getTime() - now.getTime();
            const id = setTimeout(() => {
                showNotification(item);
            }, delay);
            timeoutIds.push(id);
        }
    });
}

function clearScheduledNotifications() {
    timeoutIds.forEach(clearTimeout);
    timeoutIds = [];
}

self.addEventListener('message', (event) => {
    if (event.data) {
        if (event.data.type === 'SCHEDULE_UPDATED') {
            scheduleNotifications(event.data.payload);
        } else if (event.data.type === 'CLEAR_SCHEDULE') {
            clearScheduledNotifications();
        }
    }
});
