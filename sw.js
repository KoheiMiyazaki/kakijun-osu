// ============================================================================
// かきじゅん押忍！ Service Worker
// 共通ハーネスルール4: PWAキャッシュクリーン（更新ハーネス）
// GitHub Pagesへのコード更新をスマホ側が即座に検知し、古いキャッシュを破棄して
// アプリを最新状態に自動リロード（強制クリーン更新）するロジック
// ============================================================================

const CACHE_VERSION = 'kakijun-osu-v3.29.0';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './hiragana_strokes.json',
  // タイトル画面背景画像・木の板テクスチャ（軽量WebP）
  './assets/aistudio/title_bg.webp',
  './assets/aistudio/wood_board_texture.webp',
  // 主人公空手少年スプライトシート（軽量WebP）
  './assets/aistudio/karate_boy_4d6a3fcf.webp',
  // 盛り上げ役仲間キャラクター全スプライトシート（軽量WebP）
  './assets/aistudio/rabbit_karate_spritesheet.webp',
  './assets/aistudio/kintaro_karate_spritesheet.webp',
  './assets/aistudio/turtle_karate_spritesheet.webp',
  './assets/aistudio/hood_karate_spritesheet.webp',
  './assets/aistudio/girl_karate_spritesheet.webp',
  './assets/aistudio/wolf_karate_spritesheet.webp',
  './assets/aistudio/boy_ally_spritesheet.webp',
  './assets/aistudio/monkey_karate_spritesheet.webp',
  // 空手・和風道場BGM（軽量シームレスループMP3）
  './audio/dojo_bgm.mp3',
  // 空手少年気合ボイス（軽量MP3）
  './audio/boy_kiai_ei.mp3',
  './audio/boy_kiai_kick.mp3',
  './audio/boy_kiai_sei.mp3',
  // 師範評価ボイス（5区分15種類・軽量MP3）
  './audio/shihan_appare.mp3',
  './audio/shihan_monkunashi.mp3',
  './audio/shihan_kamigakatteru.mp3',
  './audio/shihan_migoto.mp3',
  './audio/shihan_subarashii.mp3',
  './audio/shihan_onushi.mp3',
  './audio/shihan_hou_yarunou.mp3',
  './audio/shihan_iizo_sonochoushi.mp3',
  './audio/shihan_kire.mp3',
  './audio/shihan_maamaa.mp3',
  './audio/shihan_warukuwanai.mp3',
  './audio/shihan_mousukoshi.mp3',
  './audio/shihan_katsu.mp3',
  './audio/shihan_shugyo.mp3',
  './audio/shihan_kiai_irenaose.mp3',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// インストール時に新しいキャッシュを保存し、即座に待機状態をスキップ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを完全破棄し、クライアントを即時制御
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_VERSION) {
            console.log('[SW] 古いキャッシュを破棄:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim()).then(() => {
      // 全クライアントに更新完了を通知
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// フェッチ制御: HTML/JS/CSSはネットワーク優先（更新検知）、オフライン時はキャッシュ提供
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 同一オリジンのアセット処理
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// メッセージ受信ハンドラ
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
