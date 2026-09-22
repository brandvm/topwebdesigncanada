// Loaded only by production pages. Google receives nothing before consent.
(() => {
  const panel = document.querySelector('[data-analytics-consent]');
  const settings = document.querySelector('[data-analytics-settings]');
  if (!panel || !settings) return;
  const {measurementId: id, analyticsHost: host} = panel.dataset;
  if (!/^G-[A-Z0-9]+$/.test(id || '') || location.hostname !== host) return;
  const key = 'analytics-consent-v1';
  const duration = 180 * 86400000;
  const status = panel.querySelector('[data-consent-status]');
  let started = false;
  let previousFocus;
  const gpc = navigator.globalPrivacyControl === true;
  function preference() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && value.expires > Date.now() && ['granted','denied'].includes(value.choice) ? value.choice : null;
    } catch { return null; }
  }
  function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', host, host.replace(/^www\./, '')]) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? '; Domain=' + domain : ''}`;
      }
    }
  }
  function start() {
    if (started || gpc || preference() !== 'granted') return;
    started = true;
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    const gtag = window.gtag;
    gtag('consent', 'default', {analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('consent', 'update', {analytics_storage:'granted'});
    gtag('js', new Date());
    // Drop arbitrary query strings and fragments; retain explicit campaign attribution.
    const query = new URLSearchParams(location.search);
    const config = {allow_google_signals:false,allow_ad_personalization_signals:false,cookie_flags:'SameSite=Lax;Secure',page_location:location.origin + location.pathname};
    for (const [utm, field] of Object.entries({utm_source:'campaign_source',utm_medium:'campaign_medium',utm_campaign:'campaign_name',utm_id:'campaign_id',utm_term:'campaign_term',utm_content:'campaign_content'})) {
      const value = query.get(utm);
      if (value && value.length <= 100 && !/@/.test(value)) config[field] = value;
    }
    try { config.page_referrer = document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch { config.page_referrer = ''; }
    gtag('config', id, config);
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    tag.dataset.googleAnalytics = '';
    document.head.append(tag);
  }
  function close() { panel.hidden = true; previousFocus?.focus(); }
  function save(choice) {
    try { localStorage.setItem(key, JSON.stringify({choice, expires:Date.now() + duration})); } catch {
      status.textContent = 'Your browser could not save this choice. Analytics remains off.';
      return;
    }
    if (choice === 'granted' && !gpc) start();
    else {
      window['ga-disable-' + id] = true;
      clearCookies();
      if (started) { location.reload(); return; }
    }
    close();
  }
  panel.querySelector('[data-consent-accept]').addEventListener('click', () => save('granted'));
  panel.querySelector('[data-consent-reject]').addEventListener('click', () => save('denied'));
  panel.querySelector('[data-consent-close]').addEventListener('click', close);
  settings.hidden = false;
  settings.addEventListener('click', () => {
    previousFocus = settings;
    status.textContent = gpc ? 'Global Privacy Control is enabled. Analytics is off.' : `Analytics is ${preference() === 'granted' ? 'on' : 'off'}. You can change your choice below.`;
    panel.hidden = false;
    panel.querySelector('[data-consent-reject]').focus();
  });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    if (preference() === 'granted' && !gpc) start();
    else { window['ga-disable-' + id] = true; clearCookies(); if (started) location.reload(); }
  });
  if (gpc) { window['ga-disable-' + id] = true; clearCookies(); }
  else if (preference() === 'granted') start();
  else if (!preference()) panel.hidden = false;
})();
