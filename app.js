(() => {
  'use strict';

  const STORAGE_KEY = 'smart-launcher-data-v1';
  const THEME_ORDER = ['dark', 'light', 'cyberpunk'];
  const DEFAULT_STATE = {
    theme: 'dark',
    categories: [
      { id: uid(), name: 'ذكاء اصطناعي', emoji: '🤖' },
      { id: uid(), name: 'برمجة', emoji: '💻' },
      { id: uid(), name: 'تواصل', emoji: '📱' }
    ],
    links: [
      { id: uid(), categoryId: null, name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'GPT', pinned: true, clicks: 0, recent: 0 },
      { id: uid(), categoryId: null, name: 'GitHub', url: 'https://github.com', icon: 'GH', pinned: true, clicks: 0, recent: 0 },
      { id: uid(), categoryId: null, name: 'YouTube', url: 'https://youtube.com', icon: 'YT', pinned: false, clicks: 0, recent: 0 }
    ]
  };

  const state = loadState();
  const nodes = {
    clock: document.getElementById('clock'),
    date: document.getElementById('date'),
    profileCount: document.getElementById('profile-count'),
    themeName: document.getElementById('theme-name'),
    statCategories: document.getElementById('stat-categories'),
    statLinks: document.getElementById('stat-links'),
    statPinned: document.getElementById('stat-pinned'),
    statRecent: document.getElementById('stat-recent'),
    sectionsList: document.getElementById('sections-list'),
    mainSearch: document.getElementById('main-search'),
    sidebarSearch: document.getElementById('sidebar-search'),
    results: document.getElementById('search-results'),
    toastWrap: document.getElementById('toast-wrap'),
    linkSection: document.getElementById('link-section'),
    sectionModal: document.getElementById('modal-section'),
    linkModal: document.getElementById('modal-link'),
    sectionName: document.getElementById('section-name'),
    sectionEmoji: document.getElementById('section-emoji'),
    sectionSave: document.getElementById('section-save'),
    linkName: document.getElementById('link-name'),
    linkUrl: document.getElementById('link-url'),
    linkIcon: document.getElementById('link-icon')
  };

  const app = {
    editMode: false,
    editingCategoryId: null,
    editingLinkId: null,
    query: '',
    searchItems: [],
    searchIndex: -1,
  };

  bind();
  applyTheme(state.theme || 'dark', false);
  clock();
  render();

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 11);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        categories: Array.isArray(parsed.categories) ? parsed.categories : structuredClone(DEFAULT_STATE.categories),
        links: Array.isArray(parsed.links) ? parsed.links : structuredClone(DEFAULT_STATE.links)
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }

  function normalizeUrl(input) {
    const value = String(input || '').trim();
    if (!value) return '';
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  }

  function hostnameFromUrl(url) {
    try {
      return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
    } catch {
      return String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    }
  }

  function faviconFor(url) {
    const host = hostnameFromUrl(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  }

  function toast(title, message = '', type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'danger' ? '!' : 'i';
    el.innerHTML = `<div class="t-ico">${icon}</div><div class="t-body"><strong>${esc(title)}</strong><span>${esc(message)}</span></div>`;
    nodes.toastWrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 240);
    }, 2600);
  }

  function setTheme(theme, persist = true) {
    if (!THEME_ORDER.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    nodes.themeName.textContent = theme;
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
    document.getElementById('btn-theme-cycle').textContent = theme === 'light' ? '☀️' : theme === 'cyberpunk' ? '⚡' : '🌙';
    if (persist) {
      state.theme = theme;
      saveState();
      renderStats();
    }
  }

  function applyTheme(theme, persist = true) {
    setTheme(theme, persist);
  }

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(state.theme || 'dark');
    applyTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
    toast('تم تغيير المظهر', '', 'success');
  }

  function clock() {
    const tick = () => {
      const d = new Date();
      nodes.clock.textContent = d.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });
      nodes.date.textContent = d.toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };
    tick();
    setInterval(tick, 1000);
  }

  function bind() {
    document.getElementById('btn-theme-cycle').addEventListener('click', cycleTheme);
    document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));

    document.getElementById('btn-add-category').addEventListener('click', () => openCategoryModal());
    document.getElementById('btn-add-link').addEventListener('click', () => openLinkModal());
    document.getElementById('btn-toggle-edit').addEventListener('click', toggleEditMode);
    document.getElementById('btn-export').addEventListener('click', exportJSON);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importJSON);
    document.getElementById('btn-clear-all').addEventListener('click', clearAll);
    document.getElementById('btn-rename-section').addEventListener('click', renameFirstCategory);

    nodes.sidebarSearch.addEventListener('input', syncSearchFromSidebar);
    nodes.mainSearch.addEventListener('input', syncSearchFromMain);
    nodes.mainSearch.addEventListener('keydown', onSearchKeydown);
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-main-wrap')) closeSearch();
      if (!e.target.closest('.modal')) closeModals();
    });
    document.addEventListener('keydown', onGlobalKeydown);

    nodes.sectionsList.addEventListener('click', onSectionsClick);

    document.getElementById('section-save').addEventListener('click', saveSection);
    document.getElementById('link-save').addEventListener('click', saveLink);
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModals));

    nodes.linkUrl.addEventListener('input', () => {
      const normalized = normalizeUrl(nodes.linkUrl.value);
      if (!normalized) return;
      if (!nodes.linkName.value.trim()) nodes.linkName.value = hostnameFromUrl(normalized).split('.')[0];
    });

    nodes.sectionEmoji.addEventListener('input', e => { e.target.value = e.target.value.slice(0, 3); });
    nodes.linkIcon.addEventListener('input', e => { e.target.value = e.target.value.slice(0, 3); });
  }

  function toggleEditMode() {
    app.editMode = !app.editMode;
    document.body.classList.toggle('edit-mode', app.editMode);
    document.getElementById('btn-toggle-edit').textContent = app.editMode ? 'إنهاء التعديل' : 'وضع التعديل';
    toast(app.editMode ? 'وضع التعديل مفعل' : 'تم إيقاف وضع التعديل', '', 'info');
    render();
  }

  function openCategoryModal(category = null) {
    app.editingCategoryId = category?.id || null;
    document.getElementById('section-modal-title').textContent = category ? 'تعديل قسم' : 'قسم جديد';
    nodes.sectionName.value = category?.name || '';
    nodes.sectionEmoji.value = category?.emoji || '📁';
    nodes.sectionModal.classList.add('open');
    setTimeout(() => nodes.sectionName.focus(), 50);
  }

  function openLinkModal(link = null) {
    app.editingLinkId = link?.id || null;
    document.getElementById('link-modal-title').textContent = link ? 'تعديل رابط' : 'رابط جديد';
    nodes.linkName.value = link?.name || '';
    nodes.linkUrl.value = link?.url || '';
    nodes.linkIcon.value = link?.icon || '';
    fillLinkSections(link?.categoryId || state.categories[0]?.id || '');
    nodes.linkModal.classList.add('open');
    setTimeout(() => nodes.linkName.focus(), 50);
  }

  function fillLinkSections(selectedId) {
    nodes.linkSection.innerHTML = state.categories.map(c => `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('');
  }

  function closeModals() {
    nodes.sectionModal.classList.remove('open');
    nodes.linkModal.classList.remove('open');
  }

  function saveSection() {
    const name = nodes.sectionName.value.trim();
    const emoji = nodes.sectionEmoji.value.trim() || '📁';
    if (!name) return toast('اكتب اسم القسم', '', 'danger');
    if (app.editingCategoryId) {
      const cat = state.categories.find(c => c.id === app.editingCategoryId);
      if (cat) {
        cat.name = name;
        cat.emoji = emoji;
      }
    } else {
      state.categories.push({ id: uid(), name, emoji });
    }
    app.editingCategoryId = null;
    saveState();
    closeModals();
    render();
    toast('تم حفظ القسم', '', 'success');
  }

  function saveLink() {
    const categoryId = nodes.linkSection.value;
    let url = nodes.linkUrl.value.trim();
    const name = nodes.linkName.value.trim();
    const icon = nodes.linkIcon.value.trim();
    if (!categoryId) return toast('اختر قسمًا', '', 'danger');
    if (!url) return toast('اكتب الرابط', '', 'danger');
    url = normalizeUrl(url);
    const payload = { categoryId, name: name || hostnameFromUrl(url), url, icon: icon || '🌐' };
    if (app.editingLinkId) {
      const link = state.links.find(l => l.id === app.editingLinkId);
      if (link) Object.assign(link, payload);
    } else {
      state.links.push({ id: uid(), pinned: false, clicks: 0, recent: Date.now(), ...payload });
    }
    app.editingLinkId = null;
    saveState();
    closeModals();
    render();
    toast('تم حفظ الرابط', hostnameFromUrl(url), 'success');
  }

  function renameFirstCategory() {
    if (!state.categories.length) return toast('لا توجد أقسام بعد', '', 'danger');
    openCategoryModal(state.categories[0]);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'smart-launcher-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('تم التصدير', 'ملف JSON جاهز', 'success');
  }

  async function importJSON(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
      state.theme = parsed.theme || state.theme || 'dark';
      state.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
      state.links = Array.isArray(parsed.links) ? parsed.links : [];
      saveState();
      applyTheme(state.theme, false);
      render();
      toast('تم الاستيراد', 'تم تحميل النسخة الاحتياطية', 'success');
    } catch {
      toast('فشل الاستيراد', 'ملف JSON غير صالح', 'danger');
    }
  }

  function clearAll() {
    if (!confirm('حذف كل البيانات؟')) return;
    state.theme = 'dark';
    state.categories = structuredClone(DEFAULT_STATE.categories);
    state.links = structuredClone(DEFAULT_STATE.links);
    saveState();
    applyTheme('dark', false);
    render();
    toast('تم الحذف', 'تمت إعادة الضبط', 'success');
  }

  function syncSearchFromSidebar() {
    nodes.mainSearch.value = nodes.sidebarSearch.value;
    runSearch();
  }

  function syncSearchFromMain() {
    nodes.sidebarSearch.value = nodes.mainSearch.value;
    runSearch();
  }

  function isDomainLike(q) {
    return /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(String(q || '').trim());
  }

  function runSearch() {
    app.query = nodes.mainSearch.value.trim().toLowerCase();
    if (!app.query) {
      closeSearch();
      render();
      return;
    }

    const directUrl = isDomainLike(app.query) ? normalizeUrl(app.query) : '';
    const matches = state.links.filter(link => [link.name, link.url, link.icon, hostnameFromUrl(link.url)].some(v => String(v).toLowerCase().includes(app.query)));
    app.searchItems = [];
    if (directUrl) app.searchItems.push({ type: 'url', title: 'فتح الرابط مباشرة', url: directUrl, icon: '🌐', meta: hostnameFromUrl(directUrl) });
    if (matches.length) app.searchItems.push(...matches.map(link => ({ type: 'link', ...link })));
    if (!app.searchItems.length) {
      app.searchItems.push({ type: 'google', title: `بحث Google عن ${app.query}`, url: `https://www.google.com/search?q=${encodeURIComponent(app.query)}`, icon: '🔍', meta: 'Google' });
    }
    app.searchIndex = 0;
    renderSearchResults();
    nodes.results.classList.add('open');
    render();
  }

  function renderSearchResults() {
    nodes.results.innerHTML = app.searchItems.map((item, idx) => {
      const image = item.type === 'link'
        ? `<img src="${faviconFor(item.url)}" alt="">`
        : `<span>${esc(item.icon || '🔍')}</span>`;
      return `
        <div class="res-item ${idx === app.searchIndex ? 'active' : ''}" data-idx="${idx}">
          <div class="mini">${image}</div>
          <div class="txt"><strong>${esc(item.title)}</strong><span>${esc(item.meta || item.url)}</span></div>
        </div>
      `;
    }).join('');
    nodes.results.querySelectorAll('.res-item').forEach(el => el.addEventListener('click', () => openSearchResult(+el.dataset.idx)));
  }

  function openSearchResult(idx) {
    const item = app.searchItems[idx];
    if (!item) return;
    if (item.type === 'link') {
      const link = state.links.find(l => l.id === item.id);
      if (link) {
        link.clicks = (link.clicks || 0) + 1;
        link.recent = Date.now();
      }
    }
    saveState();
    window.open(item.url, '_blank', 'noopener');
    closeSearch();
    nodes.mainSearch.value = '';
    nodes.sidebarSearch.value = '';
    render();
  }

  function onSearchKeydown(e) {
    if (!nodes.results.classList.contains('open')) {
      if (e.key === 'Enter') {
        const q = nodes.mainSearch.value.trim();
        if (!q) return;
        if (isDomainLike(q)) window.open(normalizeUrl(q), '_blank', 'noopener');
        else window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener');
      }
      return;
    }

    const max = app.searchItems.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      app.searchIndex = Math.min(app.searchIndex + 1, max);
      renderSearchResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      app.searchIndex = Math.max(app.searchIndex - 1, 0);
      renderSearchResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openSearchResult(Math.max(app.searchIndex, 0));
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  }

  function closeSearch() {
    nodes.results.classList.remove('open');
    app.searchIndex = -1;
  }

  function onGlobalKeydown(e) {
    if (e.key === 'Escape') {
      if (nodes.sectionModal.classList.contains('open') || nodes.linkModal.classList.contains('open')) {
        closeModals();
        return;
      }
      if (app.editMode) {
        toggleEditMode();
        return;
      }
      closeSearch();
    }
  }

  function onSectionsClick(e) {
    const card = e.target.closest('.card');
    const pin = e.target.closest('.toolbtn.pin');
    const del = e.target.closest('.toolbtn.del');
    const editCategory = e.target.closest('[data-edit-category]');
    const deleteCategory = e.target.closest('[data-delete-category]');

    if (editCategory) {
      const cat = state.categories.find(c => c.id === editCategory.dataset.editCategory);
      if (cat) openCategoryModal(cat);
      return;
    }

    if (deleteCategory) {
      const cat = state.categories.find(c => c.id === deleteCategory.dataset.deleteCategory);
      if (!cat) return;
      if (!confirm(`حذف القسم "${cat.name}" وكل الروابط بداخله؟`)) return;
      state.categories = state.categories.filter(c => c.id !== cat.id);
      state.links = state.links.filter(l => l.categoryId !== cat.id);
      saveState();
      render();
      toast('تم حذف القسم', cat.name, 'danger');
      return;
    }

    if (!card) return;
    const id = card.dataset.id;
    const link = state.links.find(l => l.id === id);
    if (!link) return;

    if (pin) {
      e.preventDefault();
      e.stopPropagation();
      link.pinned = !link.pinned;
      saveState();
      render();
      toast(link.pinned ? 'تم التثبيت' : 'إلغاء التثبيت', link.name, 'success');
      return;
    }

    if (del && app.editMode) {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('حذف الرابط؟')) return;
      state.links = state.links.filter(l => l.id !== id);
      saveState();
      render();
      toast('تم الحذف', link.name, 'danger');
      return;
    }

    if (app.editMode) {
      e.preventDefault();
      e.stopPropagation();
      openLinkModal(link);
      return;
    }

    link.clicks = (link.clicks || 0) + 1;
    link.recent = Date.now();
    saveState();
    window.open(link.url, '_blank', 'noopener');
    toast('فتح الرابط', link.name, 'info');
    render();
  }

  function renderStats() {
    nodes.profileCount.textContent = `${state.links.length} رابط`;
    nodes.statCategories.textContent = state.categories.length;
    nodes.statLinks.textContent = state.links.length;
    nodes.statPinned.textContent = state.links.filter(l => l.pinned).length;
    nodes.statRecent.textContent = state.links.filter(l => l.recent).length;
  }

  function decorateCard(card, link) {
    card.dataset.id = link.id;
    card.innerHTML = `
      <div class="card-tools">
        <button class="toolbtn del" title="حذف">✕</button>
        <button class="toolbtn pin ${link.pinned ? 'on' : ''}" title="تثبيت">⭐</button>
      </div>
      <div class="icon">
        <img src="${faviconFor(link.url)}" alt="${esc(link.name)}" onerror="this.remove(); this.parentElement.innerHTML='<div class=\"fallback\">${esc((link.icon || link.name || '?').slice(0, 1).toUpperCase())}</div>'" />
      </div>
      <div class="title">${esc(link.name)}</div>
      <div class="url">${esc(hostnameFromUrl(link.url))}</div>
    `;
  }

  function renderSection(title, emoji, links, smart = false, categoryId = null) {
    const cards = links.length
      ? links.map(link => {
          const el = document.createElement('article');
          el.className = 'card';
          decorateCard(el, link);
          return el.outerHTML;
        }).join('')
      : '<div class="empty" style="padding:20px">لا يوجد روابط هنا</div>';

    return `
      <section class="section ${smart ? 'section-smart' : ''}" data-category="${categoryId || ''}">
        <div class="section-head">
          <div>
            <div class="section-title"><span>${esc(emoji)}</span><span>${esc(title)}</span></div>
            <div class="section-sub">${links.length} عنصر</div>
          </div>
          ${categoryId ? `<div class="search-strip"><button class="btn btn-glass" data-edit-category="${categoryId}">تعديل</button><button class="btn btn-danger" data-delete-category="${categoryId}">حذف</button></div>` : ''}
        </div>
        <div class="grid">${cards}</div>
      </section>
    `;
  }

  function buildSections(filter = '') {
    const q = filter.trim().toLowerCase();
    const links = q ? state.links.filter(l => [l.name, l.url, l.icon, hostnameFromUrl(l.url)].some(v => String(v).toLowerCase().includes(q))) : state.links;
    const sections = [];
    const pinned = links.filter(l => l.pinned);
    if (pinned.length) sections.push(renderSection('المثبتة', '📌', pinned, true));
    const mostUsed = [...links].filter(l => !l.pinned && (l.clicks || 0) > 0).sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 6);
    if (mostUsed.length) sections.push(renderSection('الأكثر استخدامًا', '🔥', mostUsed, true));
    state.categories.forEach(cat => {
      const catLinks = links.filter(l => l.categoryId === cat.id);
      if (q && !catLinks.length) return;
      sections.push(renderSection(cat.name, cat.emoji, catLinks, false, cat.id));
    });
    return sections;
  }

  function render() {
    renderStats();
    fillLinkSections(nodes.linkSection.value || state.categories[0]?.id || '');
    const sections = buildSections(app.query);
    nodes.sectionsList.innerHTML = sections.length ? sections.join('') : '<div class="empty">لا توجد نتائج مطابقة</div>';
    nodes.sectionsList.querySelectorAll('.section').forEach(s => s.classList.toggle('section-edit', app.editMode));
    nodes.sectionsList.querySelectorAll('.card').forEach(card => {
      const link = state.links.find(l => l.id === card.dataset.id);
      if (link) decorateCard(card, link);
    });
  }
})();