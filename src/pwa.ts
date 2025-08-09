import { registerSW } from 'virtual:pwa-register';

export function registerPwa() {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      if (confirm('Pembaruan tersedia. Muat ulang aplikasi?')) {
        updateServiceWorker(true);
      }
    },
    onOfflineReady() {
      console.log('Aplikasi siap digunakan offline.');
    },
  });
}
