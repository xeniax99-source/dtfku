(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pageName = document.body.dataset.page;
  const languageData = window.SITE_TRANSLATIONS || {};
  const languages = ['ru', 'en', 'fr', 'de'];
  const numberLocales = { ru: 'ru-RU', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };
  const pageFiles = {
    home: 'index.html', prayers: 'prayers.html', practices: 'practices.html', wheel: 'wheel.html',
    traditions: 'traditions/', prayerWheel: 'prayer-wheel/', mantras: 'mantras/', prayerFlags: 'prayer-flags/',
    buddhistPrayer: 'buddhist-prayer/', offerings: 'offerings/', number108: '108/',
    tibetanBuddhism: 'tibetan-buddhism/', meditation: 'meditation/'
  };
  const socialLocales = { ru: 'ru_RU', en: 'en_GB', fr: 'fr_FR', de: 'de_DE' };
  const socialSiteNames = { ru: 'В круге', en: 'In the Circle', fr: 'Dans le cercle', de: 'Im Kreis' };

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const pathname = window.location.pathname;
  const languageSegmentIndex = pathParts.findIndex((segment) => ['en', 'fr', 'de'].includes(segment));
  const routeLanguage = languageSegmentIndex >= 0 ? pathParts[languageSegmentIndex] : 'ru';
  const languagePrefix = routeLanguage === 'ru' ? '' : `${routeLanguage}/`;
  const routeFile = pageFiles[pageName] || '';
  const routeSuffixes = routeFile.endsWith('/')
    ? [`${languagePrefix}${routeFile}`, `${languagePrefix}${routeFile}index.html`]
    : [`${languagePrefix}${routeFile}`, ...(routeFile === 'index.html' ? [languagePrefix] : [])];
  const matchingSuffix = routeSuffixes.find((suffix) => suffix && pathname.endsWith(suffix));
  let siteRootPath = matchingSuffix ? pathname.slice(0, -matchingSuffix.length) : pathname;
  if (!siteRootPath) siteRootPath = '/';
  if (!siteRootPath.endsWith('/')) siteRootPath += '/';
  let currentLanguage = routeLanguage;

  try {
    const savedLanguage = localStorage.getItem('circle-site-language');
    if (routeLanguage === 'ru' && ['en', 'fr', 'de'].includes(savedLanguage) && pageFiles[pageName]) {
      window.location.replace(`${siteRootPath}${savedLanguage}/${pageFiles[pageName]}`);
      currentLanguage = savedLanguage;
    }
  } catch (_) { /* The URL remains authoritative when storage is unavailable. */ }

  const getLocale = (language = currentLanguage) => languageData[language] || {};
  const getLiveCopy = (key) => (currentLanguage === 'ru' ? russianLive[key] : (getLocale().live || {})[key]) || russianLive[key] || '';
  const formatTemplate = (template, values = {}) => String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    if (typeof value === 'number') return new Intl.NumberFormat(numberLocales[currentLanguage] || 'en').format(value);
    return value == null ? '' : String(value);
  });
  const localizedAttribute = (source) => (currentLanguage === 'ru' ? source : ((getLocale().attrs || {})[source] || source));
  const setMetaContent = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.setAttribute('content', value);
  };

  const russianLive = {
    idle: 'Засчитывается каждый полный оборот.',
    progress: 'Завершено кругов: {done} из {total}.',
    complete: 'Число завершённых кругов сохранено на этом устройстве.',
    toastTitle: 'Тестовая операция подтверждена',
    toastProgress: 'Тестовый режим · завершено кругов: {done} из {total}. Реальных списаний нет.',
    toastComplete: 'Тестовый запуск завершён: кругов {count}. Реальных списаний нет.',
    testPrice: 'Сумма в тестовом режиме: {price}',
    saved: 'Пожелание сохранено в личном журнале на этом устройстве.',
    notSaved: 'Пожелание не добавлено в журнал.',
    saveError: 'Не удалось сохранить пожелание в хранилище браузера.',
    journalDeleted: 'Пожелание удалено с этого устройства.',
    journalCleared: 'Все сохранённые пожелания удалены.',
    journalError: 'Не удалось изменить хранилище браузера.'
  };

  const getTextKey = (element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('svg,[aria-hidden="true"],.required-mark,.brand-mark,.counter-dot,.counter-divider,.caption-rule').forEach((node) => node.remove());
    clone.querySelectorAll('br').forEach((node) => node.replaceWith(document.createTextNode(' ')));
    return clone.textContent.replace(/\s+/g, ' ').trim();
  };
  const copySelector = 'h1,h2,h3,h4,p,a,button,label,small,figcaption,blockquote,span,strong,legend,summary,.art-kicker';
  const copyNodes = [...document.querySelectorAll(copySelector)].filter((node) =>
    !node.closest('.language-switch')
    && (!node.closest('.wheel-visual') || node.classList.contains('wheel-click-hint'))
    // Let child links be translated without replacing their wrapper and losing hrefs.
    && (!node.querySelector('a') || node.tagName.toLowerCase() === 'a')
  );
  const attributeNodes = [...document.querySelectorAll('[aria-label],[alt],[placeholder],[title]')];
  const attributeSources = new WeakMap();
  const titleSource = document.title;
  const descriptionNode = document.querySelector('meta[name="description"]');
  const descriptionSource = descriptionNode ? descriptionNode.content : '';

  // Keep the source copy reversible when this file is used on the Russian route.
  copyNodes.forEach((node) => {
    if (!node.hasAttribute('data-locale-source-html')) node.dataset.localeSourceHtml = node.innerHTML;
    if (!node.hasAttribute('data-locale-source-key')) node.dataset.localeSourceKey = getTextKey(node);
  });
  attributeNodes.forEach((node) => {
    const sources = {};
    ['aria-label', 'alt', 'placeholder', 'title'].forEach((name) => {
      if (node.hasAttribute(name)) sources[name] = node.getAttribute(name);
    });
    attributeSources.set(node, sources);
  });

  const setPlainCopyPreservingDecorations = (element, translation) => {
    const preserve = [...element.children].some((child) => child.matches('[aria-hidden="true"],svg,.required-mark,.eyebrow-line'));
    if (!preserve) {
      element.textContent = translation;
      return;
    }
    const directTextNodes = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
    const firstText = directTextNodes.find((node) => node.textContent.trim());
    if (firstText) {
      firstText.textContent = translation;
      directTextNodes.forEach((node) => { if (node !== firstText) node.textContent = ''; });
    } else {
      element.textContent = translation;
    }
  };

  const languageToggle = document.querySelector('.language-toggle');
  const languageMenu = document.querySelector('.language-menu');
  const languageCurrent = document.getElementById('language-current');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const message = document.getElementById('turn-message');
  const toast = document.getElementById('ritual-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastCopy = document.getElementById('toast-copy');

  const navigateToLanguage = (language) => {
    if (!languages.includes(language) || language === currentLanguage || !pageFiles[pageName]) return;
    try { localStorage.setItem('circle-site-language', language); } catch (_) { /* The URL remains authoritative. */ }
    const destination = language === 'ru'
      ? `${siteRootPath}${pageFiles[pageName]}`
      : `${siteRootPath}${language}/${pageFiles[pageName]}`;
    window.location.assign(destination);
  };

  const applyLanguage = (language, persist = true) => {
    if (!languages.includes(language)) language = 'ru';
    currentLanguage = language;
    const locale = getLocale(language);
    const copy = locale.copy || {};
    document.documentElement.lang = language;

    copyNodes.forEach((node) => {
      const sourceHtml = node.dataset.localeSourceHtml || '';
      const key = node.dataset.localeSourceKey || '';
      // Keep the checkbox itself intact; its adjacent text span is translated separately.
      if (node.matches('label') && node.querySelector('input,select,textarea,button')) return;
      if (language === 'ru') {
        if (node.innerHTML !== sourceHtml) node.innerHTML = sourceHtml;
        return;
      }
      const translated = copy[key];
      if (typeof translated !== 'string') return;
      if (/<\/?[a-z][^>]*>/i.test(translated)) node.innerHTML = translated;
      else setPlainCopyPreservingDecorations(node, translated);
    });

    attributeNodes.forEach((node) => {
      const sources = attributeSources.get(node) || {};
      Object.entries(sources).forEach(([name, source]) => {
        node.setAttribute(name, language === 'ru' ? source : ((locale.attrs || {})[source] || source));
      });
    });

    const pageTitle = language === 'ru' ? titleSource : ((locale.title || {})[pageName] || titleSource);
    const pageDescription = language === 'ru' ? descriptionSource : ((locale.description || {})[pageName] || descriptionSource);
    document.title = pageTitle;
    if (descriptionNode) descriptionNode.content = pageDescription;
    setMetaContent('meta[property="og:title"]', pageTitle);
    setMetaContent('meta[property="og:description"]', pageDescription);
    setMetaContent('meta[property="og:locale"]', socialLocales[language] || socialLocales.ru);
    setMetaContent('meta[property="og:site_name"]', socialSiteNames[language] || socialSiteNames.ru);
    setMetaContent('meta[name="twitter:title"]', pageTitle);
    setMetaContent('meta[name="twitter:description"]', pageDescription);
    if (languageCurrent) languageCurrent.textContent = locale.code || 'RU';
    document.querySelectorAll('[data-language]').forEach((button) => {
      if (button.dataset.language === language) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    if (menuButton) {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-label', localizedAttribute(open ? 'Закрыть меню' : 'Открыть меню'));
    }
    if (persist) {
      try { localStorage.setItem('circle-site-language', language); } catch (_) { /* Private browsing. */ }
    }
    renderCompletedTurns();
    renderWishJournal();
    updateTestPricing();
    updateLiveText();
  };

  if (languageToggle && languageMenu) {
    const closeLanguageMenu = (returnFocus = false) => {
      languageMenu.hidden = true;
      languageToggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) languageToggle.focus();
    };
    languageToggle.addEventListener('click', () => {
      const opening = languageMenu.hidden;
      languageMenu.hidden = !opening;
      languageToggle.setAttribute('aria-expanded', String(opening));
      if (opening) languageMenu.querySelector('[data-language]')?.focus();
    });
    languageMenu.querySelectorAll('[data-language]').forEach((button) => {
      button.addEventListener('click', () => {
        const requestedLanguage = button.dataset.language;
        closeLanguageMenu(requestedLanguage === currentLanguage);
        navigateToLanguage(requestedLanguage);
      });
    });
    document.addEventListener('click', (event) => {
      if (!languageMenu.hidden && !event.target.closest('.language-switch')) closeLanguageMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !languageMenu.hidden) closeLanguageMenu(true);
    });
  }

  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === pageName) link.setAttribute('aria-current', 'page');
  });

  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      menuButton.setAttribute('aria-label', localizedAttribute(isOpen ? 'Открыть меню' : 'Закрыть меню'));
      mobileMenu.hidden = isOpen;
    });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', localizedAttribute('Открыть меню'));
      mobileMenu.hidden = true;
    }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', localizedAttribute('Открыть меню'));
        mobileMenu.hidden = true;
        menuButton.focus();
      }
    });
  }

  const topicsDropdown = document.querySelector('.topics-dropdown');
  if (topicsDropdown) {
    document.addEventListener('click', (event) => {
      if (topicsDropdown.open && !topicsDropdown.contains(event.target)) topicsDropdown.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && topicsDropdown.open) {
        topicsDropdown.open = false;
        topicsDropdown.querySelector('summary')?.focus();
      }
    });
    if (topicsDropdown.querySelector('[aria-current="page"]')) topicsDropdown.dataset.active = 'true';
  }

  document.querySelectorAll('a[data-transition]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.origin !== current.origin || destination.pathname === current.pathname) return;
      event.preventDefault();
      if (reduceMotion) {
        window.location.assign(destination.href);
        return;
      }
      document.body.classList.add('is-leaving');
      window.setTimeout(() => window.location.assign(destination.href), 230);
    });
  });

  document.querySelectorAll('a[data-scroll]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetURL = new URL(link.href, window.location.href);
      if (targetURL.pathname !== window.location.pathname || !targetURL.hash) return;
      const target = document.querySelector(decodeURIComponent(targetURL.hash));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', targetURL.hash);
    });
  });

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const turnsKey = 'circle-prayer-completed-turns-v1';
  const legacyStatsKey = 'circle-prayer-demo-stats-v1';
  const wishesKey = 'circle-prayer-wishes-v2';
  const readCompletedTurns = () => {
    try {
      const current = localStorage.getItem(turnsKey);
      if (current !== null) {
        const value = Number.parseInt(current, 10);
        try { localStorage.removeItem(legacyStatsKey); } catch (_) { /* Ignore obsolete data. */ }
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
      }
      // The previous local counter incremented this field only when a full turn actually finished.
      const legacy = JSON.parse(localStorage.getItem(legacyStatsKey) || '{}');
      const legacyTurns = Number(legacy.turns);
      const value = Number.isSafeInteger(legacyTurns) && legacyTurns > 0 ? legacyTurns : 0;
      if (value) localStorage.setItem(turnsKey, String(value));
      localStorage.removeItem(legacyStatsKey); // Discard the former synthetic user/prayer totals.
      return value;
    } catch (_) {
      try { localStorage.removeItem(legacyStatsKey); } catch (_) { /* Storage may be disabled. */ }
      return 0;
    }
  };
  let completedTurns = readCompletedTurns();
  const persistCompletedTurns = () => {
    try {
      localStorage.setItem(turnsKey, String(completedTurns));
      return true;
    } catch (_) { return false; }
  };
  const formatCount = (value) => new Intl.NumberFormat(numberLocales[currentLanguage] || 'en', { minimumIntegerDigits: 2 }).format(value);
  const getRequestedSpinTotal = () => {
    const custom = document.getElementById('custom-count');
    const selected = document.querySelector('input[name="circleCount"]:checked');
    const value = custom && custom.value.trim() ? Number(custom.value) : Number(selected ? selected.value : 7);
    return Number.isFinite(value) ? Math.min(5000, Math.max(1, Math.round(value))) : 7;
  };
  const getSpinTotal = () => {
    const requested = getRequestedSpinTotal();
    return reduceMotion ? Math.min(requested, 10) : requested;
  };

  const form = document.getElementById('ritual-form');
  const wishField = document.getElementById('main-wish');
  const wishCount = document.getElementById('wish-count');
  const saveWishField = document.getElementById('save-wish');
  const wishJournalList = document.getElementById('wish-journal-list');
  const wishJournalEmpty = document.getElementById('wish-journal-empty');
  const wishJournalClear = document.getElementById('wish-journal-clear');
  const wishJournalStatus = document.getElementById('wish-journal-status');
  const overlay = document.getElementById('ritual-overlay');
  const rotor = document.getElementById('wheel-rotor');
  const surface = document.getElementById('wheel-surface');
  const spinButtons = [document.getElementById('spin-trigger'), document.getElementById('wheel-visual')].filter(Boolean);
  const formSubmit = form ? form.querySelector('[type="submit"]') : null;
  const closeButtons = overlay ? overlay.querySelectorAll('.ritual-close, .ritual-backdrop') : [];
  const toastTimerDuration = 34000;
  let previousFocus = null;
  let toastTimer = 0;
  let isSpinning = false;
  let pendingSpin = null;
  let toastState = null;
  let activeRaf = 0;

  const readWishEntries = () => {
    try {
      const entries = JSON.parse(localStorage.getItem(wishesKey) || '[]');
      return Array.isArray(entries)
        ? entries.filter((entry) => entry && typeof entry.wish === 'string').slice(-50)
        : [];
    } catch (_) { return []; }
  };
  const saveWishLocally = (wish) => {
    try {
      const safeEntries = readWishEntries().slice(-49);
      safeEntries.push({ wish });
      localStorage.setItem(wishesKey, JSON.stringify(safeEntries));
      return true;
    } catch (_) { return false; }
  };
  function renderWishJournal(statusText = '') {
    if (!wishJournalList || !wishJournalEmpty) return;
    const entries = readWishEntries();
    while (wishJournalList.firstChild) wishJournalList.removeChild(wishJournalList.firstChild);
    entries.slice().reverse().forEach((entry, displayIndex) => {
      const storageIndex = entries.length - displayIndex - 1;
      const item = document.createElement('li');
      item.className = 'wish-journal-entry';
      const wishText = document.createElement('span');
      wishText.className = 'wish-journal-text';
      wishText.textContent = entry.wish;
      const deleteButton = document.createElement('button');
      deleteButton.className = 'wish-journal-delete';
      deleteButton.type = 'button';
      deleteButton.dataset.deleteWish = String(storageIndex);
      deleteButton.setAttribute('aria-label', localizedAttribute('Удалить пожелание'));
      deleteButton.textContent = '×';
      item.append(wishText, deleteButton);
      wishJournalList.appendChild(item);
    });
    wishJournalEmpty.hidden = entries.length > 0;
    wishJournalList.hidden = entries.length === 0;
    if (wishJournalClear) wishJournalClear.hidden = entries.length === 0;
    if (wishJournalStatus) {
      wishJournalStatus.textContent = statusText;
      wishJournalStatus.hidden = !statusText;
    }
  }
  if (wishJournalList) wishJournalList.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('[data-delete-wish]') : null;
    if (!button || !wishJournalList.contains(button)) return;
    const index = Number(button.dataset.deleteWish);
    if (!Number.isInteger(index)) return;
    try {
      const entries = readWishEntries();
      if (index < 0 || index >= entries.length) return;
      entries.splice(index, 1);
      localStorage.setItem(wishesKey, JSON.stringify(entries));
      renderWishJournal(getLiveCopy('journalDeleted'));
    } catch (_) { renderWishJournal(getLiveCopy('journalError')); }
  });
  if (wishJournalClear) wishJournalClear.addEventListener('click', () => {
    try {
      localStorage.removeItem(wishesKey);
      renderWishJournal(getLiveCopy('journalCleared'));
    } catch (_) { renderWishJournal(getLiveCopy('journalError')); }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === wishesKey) renderWishJournal();
    if (event.key === turnsKey) {
      const value = Number.parseInt(event.newValue || '0', 10);
      if (Number.isSafeInteger(value) && value >= 0) {
        completedTurns = value;
        renderCompletedTurns();
      }
    }
  });

  const updateLiveText = () => {
    if (message) {
      if (pendingSpin && isSpinning) message.textContent = formatTemplate(getLiveCopy('progress'), { done: pendingSpin.completed, total: pendingSpin.total });
      else if (completedTurns > 0) message.textContent = getLiveCopy('complete');
      else message.textContent = getLiveCopy('idle');
    }
    if (toast && !toast.hidden && toastState && toastCopy) {
      if (toastTitle) toastTitle.textContent = getLiveCopy('toastTitle');
      const progress = isSpinning || toastState.completed === 0;
      const template = progress ? getLiveCopy('toastProgress') : getLiveCopy('toastComplete');
      const base = formatTemplate(template, {
        done: toastState.completed || 0,
        total: toastState.total || 0,
        count: toastState.completed || 0
      });
      let privacy = '';
      if (!progress && toastState.saveResult === 'saved') privacy = getLiveCopy('saved');
      else if (!progress && toastState.saveResult === 'not-saved') privacy = getLiveCopy('notSaved');
      else if (!progress && toastState.saveResult === 'error') privacy = getLiveCopy('saveError');
      toastCopy.textContent = privacy ? `${base} ${privacy}` : base;
    }
  };

  function renderCompletedTurns() {
    const node = document.getElementById('turn-count');
    if (node) node.textContent = formatCount(completedTurns);
    updateLiveText();
  }

  const applyLanguageAfterSetup = () => applyLanguage(currentLanguage, false);

  const customCount = document.getElementById('custom-count');
  const customPriceNote = document.querySelector('.custom-price-note');
  const testPriceSummary = document.getElementById('test-price-summary');
  const countRadios = [...document.querySelectorAll('input[name="circleCount"]')];
  const getTestPriceCents = (turns) => (turns <= 7 ? 50 : turns <= 21 ? 100 : turns <= 108 ? 200 : turns <= 1008 ? 500 : 1000);
  const formatTestPrice = (cents) => new Intl.NumberFormat(numberLocales[currentLanguage] || 'en-GB', {
    style: 'currency', currency: 'EUR'
  }).format(cents / 100);
  const updateTestPricing = () => {
    document.querySelectorAll('[data-test-price-cents]').forEach((node) => {
      const cents = Number(node.dataset.testPriceCents);
      if (Number.isFinite(cents)) node.textContent = formatTestPrice(cents);
    });
    if (testPriceSummary) {
      const price = formatTestPrice(getTestPriceCents(getRequestedSpinTotal()));
      testPriceSummary.textContent = formatTemplate(getLiveCopy('testPrice'), { price });
    }
    if (customPriceNote) customPriceNote.hidden = !(customCount && customCount.value.trim());
  };
  if (customCount) customCount.addEventListener('input', () => {
    if (customCount.value.trim()) countRadios.forEach((radio) => { radio.checked = false; });
    updateTestPricing();
  });
  countRadios.forEach((radio) => radio.addEventListener('change', () => {
    if (radio.checked && customCount) customCount.value = '';
    updateTestPricing();
  }));
  updateTestPricing();

  if (wishField && wishCount) {
    const updateWishCount = () => { wishCount.textContent = `${wishField.value.length} / 200`; };
    wishField.addEventListener('input', updateWishCount);
    updateWishCount();
  }

  const openRitual = () => {
    if (!overlay || isSpinning) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('ritual-open');
    window.setTimeout(() => wishField && wishField.focus(), 70);
  };
  const closeRitual = () => {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('ritual-open');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  };
  spinButtons.forEach((button) => button.addEventListener('click', openRitual));
  closeButtons.forEach((button) => button.addEventListener('click', closeRitual));
  document.addEventListener('keydown', (event) => {
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRitual();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll('.ritual-dialog button:not([disabled]), .ritual-dialog input:not([disabled]), .ritual-dialog select:not([disabled]), .ritual-dialog textarea:not([disabled]), .ritual-dialog [href]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  if (toast) {
    const toastClose = document.getElementById('toast-close');
    if (toastClose) toastClose.addEventListener('click', () => {
      toast.hidden = true;
      toastState = null;
      window.clearTimeout(toastTimer);
    });
  }

  if (surface) {
    const faceCount = 72;
    const textureStep = 540 / faceCount;
    for (let index = 0; index < faceCount; index += 1) {
      const face = document.createElement('span');
      face.className = 'wheel-face';
      face.style.setProperty('--angle', `${index * (360 / faceCount)}deg`);
      const textureSlice = (index + faceCount / 2) % faceCount;
      face.style.setProperty('--texture-position', `${textureSlice * -textureStep}px`);
      surface.appendChild(face);
    }
  }

  const bezierCoordinate = (t, p1, p2) => (3 * (1 - t) * (1 - t) * t * p1) + (3 * (1 - t) * t * t * p2) + (t * t * t);
  const easeOutProgress = (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let low = 0;
    let high = 1;
    let t = x;
    for (let index = 0; index < 18; index += 1) {
      t = (low + high) / 2;
      const estimate = bezierCoordinate(t, 0.08, 0.14);
      if (estimate < x) low = t;
      else high = t;
    }
    return bezierCoordinate(t, 0.72, 1);
  };

  const countCompletedTurn = () => {
    completedTurns += 1;
    persistCompletedTurns();
    renderCompletedTurns();
  };
  const finishSpin = () => {
    if (!pendingSpin) return;
    while (pendingSpin.completed < pendingSpin.total) {
      pendingSpin.completed += 1;
      countCompletedTurn();
    }
    isSpinning = false;
    if (formSubmit) formSubmit.disabled = false;
    const finishedSpin = pendingSpin;
    pendingSpin = null;
    if (toastState) toastState.completed = finishedSpin.completed;
    if (activeRaf) cancelAnimationFrame(activeRaf);
    activeRaf = 0;
    updateLiveText();
  };

  const rotateDrum = () => {
    if (!rotor) {
      isSpinning = false;
      if (formSubmit) formSubmit.disabled = false;
      return;
    }
    const total = getSpinTotal();
    const duration = reduceMotion ? 1200 : Math.min(90000, Math.max(5000, total * 520));
    pendingSpin = { total, completed: 0 };
    if (toastState) {
      toastState.total = total;
      toastState.completed = 0;
    }
    if (typeof rotor.animate === 'function') {
      rotor.getAnimations().forEach((animation) => animation.cancel());
      const degrees = total * 360;
      rotor.animate([
        { transform: 'translate3d(-50%, -50%, 0) perspective(1150px) rotateX(-8deg) rotateY(0deg)' },
        { transform: `translate3d(-50%, -50%, 0) perspective(1150px) rotateX(-8deg) rotateY(${degrees}deg)` }
      ], { duration, easing: reduceMotion ? 'ease-in-out' : 'cubic-bezier(.08,.72,.14,1)', fill: 'none' });
    }
    const wheelButton = document.getElementById('wheel-visual');
    if (wheelButton) {
      wheelButton.classList.remove('is-pressed');
      requestAnimationFrame(() => wheelButton.classList.add('is-pressed'));
      window.setTimeout(() => wheelButton.classList.remove('is-pressed'), 420);
    }
    const startedAt = performance.now();
    const tick = (now) => {
      if (!pendingSpin) return;
      const elapsed = Math.min(duration, now - startedAt);
      const progress = reduceMotion ? elapsed / duration : easeOutProgress(elapsed / duration);
      const targetCompleted = Math.min(total, Math.floor((progress * total) + 1e-7));
      while (pendingSpin.completed < targetCompleted) {
        pendingSpin.completed += 1;
        if (toastState) toastState.completed = pendingSpin.completed;
        countCompletedTurn();
      }
      // CSS fallback for browsers without the Web Animations API.
      if (typeof rotor.animate !== 'function') {
        const angle = progress * total * 360;
        rotor.style.transform = `translate3d(-50%, -50%, 0) perspective(1150px) rotateX(-8deg) rotateY(${angle}deg)`;
      }
      if (elapsed < duration) activeRaf = requestAnimationFrame(tick);
      else finishSpin();
    };
    activeRaf = requestAnimationFrame(tick);
    updateLiveText();
  };

  const showToast = (spin) => {
    if (!toast) return;
    toastState = spin;
    if (toastTitle) toastTitle.textContent = getLiveCopy('toastTitle');
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      toastState = null;
    }, toastTimerDuration);
    updateLiveText();
  };

  if (form) form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isSpinning || !form.reportValidity()) return;
    const wish = wishField ? wishField.value.trim() : '';
    const requestedSave = Boolean(saveWishField && saveWishField.checked && wish);
    let saveResult = wish ? 'not-saved' : 'none';
    if (requestedSave) saveResult = saveWishLocally(wish) ? 'saved' : 'error';
    if (saveResult === 'saved') renderWishJournal(getLiveCopy('saved'));
    const total = getSpinTotal();
    const spin = { total, completed: 0, saved: saveResult === 'saved', saveResult, testMode: true, testPriceCents: getTestPriceCents(getRequestedSpinTotal()) };
    isSpinning = true;
    if (formSubmit) formSubmit.disabled = true;
    closeRitual();
    showToast(spin);
    updateLiveText();
    window.setTimeout(rotateDrum, reduceMotion ? 0 : 230);
  });

  document.querySelectorAll('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  applyLanguageAfterSetup();
})();
