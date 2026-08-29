var CACHE_NAME = 'hamburg-poi-v4';
var APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/villes/hambourg.json'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(APP_SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  var url = event.request.url;
  var sameOrigin = url.indexOf(self.location.origin) === 0;

  // Ne jamais mettre en cache les tuiles de carte en direct — respecte la politique
  // d'usage des tuiles d'OpenStreetMap (pas de mise en cache tierce prolongée).
  if(url.indexOf('tile.openstreetmap.org') !== -1){
    return;
  }

  // Coquille de l'application : réseau d'abord (toujours la dernière version en ligne),
  // cache uniquement en secours si hors-ligne. Comparaison exacte, uniquement pour les
  // fichiers de l'app elle-même — pas de correspondance approximative qui capterait
  // aussi les appels vers des API externes (Overpass, etc.).
  var isShell = sameOrigin && APP_SHELL.some(function(path){
    return url === self.location.origin + path;
  });
  if(isShell){
    event.respondWith(
      fetch(event.request).then(function(response){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        return response;
      }).catch(function(){
        return caches.match(event.request);
      })
    );
    return;
  }

  // Bibliothèque Leaflet et polices Google : cache d'abord, mis en cache au premier chargement
  if(url.indexOf('cdnjs.cloudflare.com') !== -1 || url.indexOf('fonts.googleapis.com') !== -1 || url.indexOf('fonts.gstatic.com') !== -1){
    event.respondWith(
      caches.match(event.request).then(function(cached){
        if(cached) return cached;
        return fetch(event.request).then(function(response){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          return response;
        });
      })
    );
    return;
  }

  // Tout le reste (API Overpass, géolocalisation, etc.) : jamais intercepté,
  // comportement réseau natif du navigateur.
});
