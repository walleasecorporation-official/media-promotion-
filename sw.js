/* 청소년 이용약관 - service worker
 * - fetch 핸들러가 있어야 Chromium 계열에서 "설치 가능(installable)" 판정을 받습니다.
 * - 앱 셸을 미리 캐싱해 두어 설치 후 오프라인에서도 실행됩니다.
 */
const CACHE = "juspeace-v1";

const ASSETS = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./favicon.ico",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/maskable-192.png",
    "./icons/maskable-512.png",
    "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE)
            // 하나라도 실패하면 전체가 실패하므로 개별적으로 담는다
            .then((cache) => Promise.all(
                ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => null))
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // 문서 요청: 네트워크 우선 -> 실패하면 캐시된 셸로 대체(오프라인 실행)
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => { });
                    return res;
                })
                .catch(() => caches.match("./index.html", { ignoreSearch: true })
                    .then((hit) => hit || caches.match("./", { ignoreSearch: true })))
        );
        return;
    }

    // 그 외 정적 자원: 캐시 우선
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((hit) => {
            if (hit) return hit;
            return fetch(req).then((res) => {
                if (res && res.ok && res.type === "basic") {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => { });
                }
                return res;
            });
        })
    );
});

self.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "SHOW_NOTIFICATION") {
        self.registration.showNotification(data.title || "알림", {
            body: data.body || "",
            icon: data.icon,
            badge: data.icon,
            vibrate: [120, 60, 120],
            tag: data.tag,
            renotify: !!data.tag,
            data: data.data || {}
        });
    }
});

self.addEventListener("notificationclick", (event) => {
    const step = (event.notification.data || {}).step;
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            if (list.length > 0) {
                list[0].postMessage({ type: "NOTIF_TAP", step: step });
                return list[0].focus();
            }
            return self.clients.openWindow("./" + (step ? ("?ntap=" + step) : ""));
        })
    );
});
