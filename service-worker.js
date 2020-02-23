/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js");

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "404.html",
    "revision": "b1a8a5e31e56dba9e98d93a498afe470"
  },
  {
    "url": "android-chrome-192x192.png",
    "revision": "01bafd5cc06880d98f79eb014521b310"
  },
  {
    "url": "android-chrome-384x384.png",
    "revision": "f2d43f64b33b3aeeca99f27c463d2aad"
  },
  {
    "url": "apple-touch-icon.png",
    "revision": "f88235df4c68f647bcf9eff7df846cc0"
  },
  {
    "url": "assets/css/0.styles.6ccafff3.css",
    "revision": "3928fb544e442597af5b20963eadcb79"
  },
  {
    "url": "assets/img/search.83621669.svg",
    "revision": "83621669651b9a3d4bf64d1a670ad856"
  },
  {
    "url": "assets/js/10.a37664df.js",
    "revision": "386bf1de5f04ab086c021901f3c4bc92"
  },
  {
    "url": "assets/js/11.67e7b0eb.js",
    "revision": "b2c583ca5f921200ff39b16745bac7da"
  },
  {
    "url": "assets/js/12.a0870932.js",
    "revision": "7486ab58794379d02b32118769882ffa"
  },
  {
    "url": "assets/js/13.d777ef69.js",
    "revision": "ebc6bc63e5d3e67f9ead1ba5e94d1991"
  },
  {
    "url": "assets/js/14.5b0eb2b0.js",
    "revision": "92522e0575e24a73310de3262e60d380"
  },
  {
    "url": "assets/js/15.eb042c5f.js",
    "revision": "2a7717366bd17fdacf0ac626af4acc9c"
  },
  {
    "url": "assets/js/16.dbb54867.js",
    "revision": "eeaf95ebaaaf109b0dbaabfaf99d9bbc"
  },
  {
    "url": "assets/js/17.49781a55.js",
    "revision": "bf624e0dac760ae805d648f4962e3b72"
  },
  {
    "url": "assets/js/18.c6db1280.js",
    "revision": "dc79caa82d57eb450c09840636b33e2f"
  },
  {
    "url": "assets/js/19.2d875e18.js",
    "revision": "12b7cba2643b30f30fe440b63b2b7115"
  },
  {
    "url": "assets/js/2.d7159a1c.js",
    "revision": "59404bd7ac97f5a7ced7ded0f3e309dd"
  },
  {
    "url": "assets/js/20.f1ab9812.js",
    "revision": "94eb0fe981f30d3f6f8bb58dd3c863a5"
  },
  {
    "url": "assets/js/21.c4959b69.js",
    "revision": "2bd3cc8c2f47923e41733e2908548098"
  },
  {
    "url": "assets/js/3.7045207d.js",
    "revision": "af2109fa65ff65954ea8bd9bae639eeb"
  },
  {
    "url": "assets/js/4.e4954225.js",
    "revision": "d39794b289caa4f5122f79b2d3c26397"
  },
  {
    "url": "assets/js/5.a6d16c77.js",
    "revision": "127204dfdbe7fb057ade27049d27df37"
  },
  {
    "url": "assets/js/6.ea48aa5b.js",
    "revision": "bc9c4347233ed18db740607a49494659"
  },
  {
    "url": "assets/js/7.b09d797c.js",
    "revision": "f0472e54f78bca0913db7f129055d172"
  },
  {
    "url": "assets/js/8.b8dd6134.js",
    "revision": "14f30d5bf74125d50fe7c3cbe8161daf"
  },
  {
    "url": "assets/js/9.69a7a5ad.js",
    "revision": "5fa91c2dc323904735b23c4ea08ded8c"
  },
  {
    "url": "assets/js/app.bb69a353.js",
    "revision": "805074ad0fe131aaa90fa4c8bc224c38"
  },
  {
    "url": "favicon-16x16.png",
    "revision": "c6b93302fc3f2ea8f101011a70d63a08"
  },
  {
    "url": "favicon-32x32.png",
    "revision": "d00874ce1e43be2ac335d1e80c0c8ead"
  },
  {
    "url": "guide/cli.html",
    "revision": "a1d9f1648aa5b0cc74f6a9309db24793"
  },
  {
    "url": "guide/cluster.html",
    "revision": "7f8aca111a5d2ab145688f4bf24a7757"
  },
  {
    "url": "guide/configuration.html",
    "revision": "2fe06ca698e3300c8b025ba0ed8b7fbd"
  },
  {
    "url": "guide/index.html",
    "revision": "d1e3e5baa7cbbad55275b89ca89ea250"
  },
  {
    "url": "guide/installation.html",
    "revision": "8f99884080186a2cc830066daf9080d4"
  },
  {
    "url": "guide/upgrading.html",
    "revision": "4060ce4fde443c34fab34fe554b7949e"
  },
  {
    "url": "index.html",
    "revision": "39c85e423f9b2479c44e83178c7bad32"
  },
  {
    "url": "integrations/bluetooth-classic.html",
    "revision": "fb679841d7e3323afcdb77d9923e983e"
  },
  {
    "url": "integrations/bluetooth-low-energy.html",
    "revision": "f17a87058b82dfe3077874a4a2a2777d"
  },
  {
    "url": "integrations/gpio.html",
    "revision": "908aba4caea760cf285619ba605784b0"
  },
  {
    "url": "integrations/grid-eye.html",
    "revision": "c87469da7d5d13c83b7f0a8c7f91f309"
  },
  {
    "url": "integrations/home-assistant.html",
    "revision": "ead3fc11b827265b28cb52d46124e00d"
  },
  {
    "url": "integrations/index.html",
    "revision": "9f11669b319ffca4df27d3b5f808229e"
  },
  {
    "url": "integrations/omron-d6t.html",
    "revision": "74f6b346dc05c21c17ddf0ef93153fbc"
  },
  {
    "url": "integrations/shell.html",
    "revision": "525f0186cabbc4e4c6f3eb7342679ab0"
  },
  {
    "url": "mstile-150x150.png",
    "revision": "5461702e6d17101516497b481857edd8"
  },
  {
    "url": "room-assistant.png",
    "revision": "e79e479593059c21d0971d8d802c5a9c"
  },
  {
    "url": "safari-pinned-tab.svg",
    "revision": "37c5052d727a9267b550b55e1faec638"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
addEventListener('message', event => {
  const replyPort = event.ports[0]
  const message = event.data
  if (replyPort && message && message.type === 'skip-waiting') {
    event.waitUntil(
      self.skipWaiting().then(
        () => replyPort.postMessage({ error: null }),
        error => replyPort.postMessage({ error })
      )
    )
  }
})