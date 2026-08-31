var CACHE_NAME = 'hamburg-poi-v8';

// Chemins calculés depuis la portée (scope) du service worker plutôt que
// depuis la racine du domaine : indispensable quand l'app est servie sous
// un sous-dossier (ex: GitHub Pages -> username.github.io/repo/).
var BASE = self.registration.scope;
var APP_SHELL = [
  '', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'villes/hambourg.json'
].map(function(p){ return BASE + p; });

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

  // Ne jamais mettre en cache les tuiles de carte en direct — respecte la politique
  // d'usage des tuiles d'OpenStreetMap (pas de mise en cache tierce prolongée).
  if(url.indexOf('tile.openstreetmap.org') !== -1){
    return;
  }

  // Coquille de l'application : réseau d'abord (toujours la dernière version en ligne),
  // cache uniquement en secours si hors-ligne. Comparaison exacte contre la liste
  // précalculée depuis le scope — pas de correspondance approximative qui capterait
  // aussi les appels vers des API externes (Overpass, etc.).
  if(APP_SHELL.indexOf(url) !== -1){
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
