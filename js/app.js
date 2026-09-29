/* ==========================================================================
   Latido — aplicación
   Tablón de solicitudes, reservas de cita, formulario para centros,
   compatibilidad de grupos, centrifugadora, bolsa de donación y test.
   Los datos se guardan en localStorage (solo en este navegador).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const pad2 = (n) => String(n).padStart(2, '0');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const numberFormat = new Intl.NumberFormat('es-ES');
  const fmtNum = (n) => numberFormat.format(n);

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));
  const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const joinList = (arr) => (arr.length <= 1 ? arr[0] || '' : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`);
  const icon = (name) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  function onMedia(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  /* Fechas en hora local (nunca con toISOString, que usa UTC) */
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fromISO = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(fromISO(s)) === s;
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };
  const addMonths = (iso, n) => {
    const d = fromISO(iso);
    d.setMonth(d.getMonth() + n);
    return toISO(d);
  };
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  const fmtLong = (iso) => fromISO(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = (iso) => fromISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDayMonth = (iso) => fromISO(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

  const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fromMinutes = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

  function isPhone(value) {
    const s = String(value).replace(/[\s().-]/g, '');
    return /^(?:\+34|0034)?[6789]\d{8}$/.test(s) || /^\+\d{9,15}$/.test(s);
  }
  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  /* ---------- Datos de dominio ---------- */
  const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const groupLabel = (g) => g.replace('-', '−');
  const groupSpoken = (g) => `${g.slice(0, -1)} ${g.endsWith('+') ? 'positivo' : 'negativo'}`;

  // minutes: tiempo que hay que reservar para que la donación termine antes del cierre
  const TYPES = {
    sangre: { label: 'Sangre total', icon: 'drop', minutes: 45 },
    plaquetas: { label: 'Plaquetas', icon: 'platelets', minutes: 90 },
    plasma: { label: 'Plasma', icon: 'plasma', minutes: 60 }
  };

  const URGENCY = {
    critica: { label: 'Crítica', rank: 0 },
    urgente: { label: 'Urgente', rank: 1 },
    normal: { label: 'Normal', rank: 2 }
  };

  // Centros ficticios. La fecha límite se calcula respecto a hoy (offset en días).
  const SAMPLE_REQUESTS = [
    {
      id: 's-rioclaro', center: 'Hospital Universitario Río Claro', kind: 'Hospital', city: 'Sevilla',
      address: 'Avenida de la Ciencia, 12', type: 'sangre', groups: ['O-', 'O+'], urgency: 'critica',
      needed: 40, committed: 26, offset: 2, open: '08:00', close: '21:00',
      note: 'Las reservas de O negativo están bajo mínimos tras varias cirugías urgentes este fin de semana.'
    },
    {
      id: 's-acacias', center: 'Hospital Materno-Infantil Las Acacias', kind: 'Hospital', city: 'Madrid',
      address: 'Calle del Olmo, 48', type: 'sangre', groups: ['O-', 'B-', 'AB-'], urgency: 'critica',
      needed: 16, committed: 5, offset: 1, open: '09:00', close: '20:00',
      note: 'Buscamos donantes Rh negativo: las reservas de estos grupos no cubren la semana.'
    },
    {
      id: 's-levante', center: 'Centro de Transfusión Levante', kind: 'Centro de transfusión', city: 'Valencia',
      address: 'Paseo de la Alameda, 7', type: 'plaquetas', groups: ['A+', 'A-', 'O+'], urgency: 'urgente',
      needed: 18, committed: 7, offset: 4, open: '08:30', close: '20:30',
      note: 'Para pacientes en tratamiento oncológico. La donación por aféresis dura entre 60 y 90 minutos.'
    },
    {
      id: 's-puertoazul', center: 'Hospital General Puerto Azul', kind: 'Hospital', city: 'Málaga',
      address: 'Camino de la Farola, 3', type: 'sangre', groups: ['A-', 'O-'], urgency: 'urgente',
      needed: 30, committed: 12, offset: 5, open: '08:00', close: '21:00',
      note: 'Han aumentado las intervenciones quirúrgicas en la zona durante las últimas semanas.'
    },
    {
      id: 's-monteverde', center: 'Clínica Monteverde', kind: 'Clínica', city: 'Bilbao',
      address: 'Alameda de los Tilos, 21', type: 'plaquetas', groups: ['O+', 'O-'], urgency: 'urgente',
      needed: 10, committed: 3, offset: 3, open: '09:00', close: '19:00',
      note: 'Dos pacientes de hematología pendientes de trasplante necesitan transfusiones de plaquetas.'
    },
    {
      id: 's-sierraalta', center: 'Hospital Comarcal Sierra Alta', kind: 'Hospital', city: 'Granada',
      address: 'Carretera de la Sierra, km 4', type: 'sangre', groups: [], urgency: 'normal',
      needed: 60, committed: 41, offset: 9, open: '08:30', close: '20:00',
      note: 'Campaña de reposición de reservas después del verano. Todos los grupos son bienvenidos.'
    },
    {
      id: 's-costanorte', center: 'Banco de Sangre Costa Norte', kind: 'Banco de sangre', city: 'Santander',
      address: 'Muelle de los Pescadores, 15', type: 'plasma', groups: ['AB+', 'AB-'], urgency: 'normal',
      needed: 25, committed: 9, offset: 12, open: '09:00', close: '20:00',
      note: 'El plasma del grupo AB es compatible con pacientes de cualquier grupo.'
    },
    {
      id: 's-meseta', center: 'Centro de Hemodonación Meseta', kind: 'Centro de transfusión', city: 'Valladolid',
      address: 'Plaza de los Tintes, 2', type: 'sangre', groups: [], urgency: 'normal',
      needed: 80, committed: 58, offset: 14, open: '09:00', close: '21:00',
      note: 'También hay una unidad móvil en el campus universitario de lunes a jueves.'
    },
    {
      id: 's-delvalle', center: 'Hospital del Valle', kind: 'Hospital', city: 'Zaragoza',
      address: 'Avenida de los Almendros, 30', type: 'plasma', groups: ['A+', 'B+'], urgency: 'normal',
      needed: 15, committed: 15, offset: 6, open: '09:00', close: '19:30',
      note: 'Objetivo alcanzado. Gracias a todas las personas que han donado.'
    }
  ];

  const QUIZ = [
    { q: '¿Tienes entre 18 y 65 años?', ok: 'si', fail: 'Para donar sangre hay que tener entre 18 y 65 años.' },
    { q: '¿Pesas 50 kg o más?', ok: 'si', fail: 'El peso mínimo para donar es de 50 kg, para que la extracción sea segura para ti.' },
    { q: '¿Te encuentras bien de salud hoy?', ok: 'si', fail: 'Si hoy tienes fiebre, catarro o malestar, espera a recuperarte del todo.' },
    { q: '¿Has donado sangre en los últimos 2 meses?', ok: 'no', fail: 'Entre dos donaciones de sangre total deben pasar al menos 2 meses.' },
    { q: '¿Te has hecho un tatuaje, un piercing o una sesión de acupuntura en los últimos 4 meses?', ok: 'no', fail: 'Después de un tatuaje, un piercing o una sesión de acupuntura hay que esperar 4 meses.' },
    { q: '¿Estás embarazada o has dado a luz hace menos de 6 meses?', ok: 'no', fail: 'Durante el embarazo y los 6 meses siguientes al parto no se puede donar.', hint: 'Si no es tu caso, responde «No».' }
  ];

  /* ---------- Almacenamiento ---------- */
  const KEYS = {
    requests: 'latido.requests.v1',
    commits: 'latido.commits.v1',
    appts: 'latido.appointments.v1',
    myGroup: 'latido.mygroup.v1',
    theme: 'latido.theme'
  };

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* sin almacenamiento disponible */
      }
    }
  };

  const isStr = (v, max) => typeof v === 'string' && v.length <= max;

  function validRequest(r) {
    return Boolean(r) && typeof r === 'object' &&
      isStr(r.id, 40) && r.id.startsWith('r-') &&
      isStr(r.center, 80) && r.center.length > 0 &&
      isStr(r.city, 50) && isStr(r.address, 100) &&
      has(TYPES, r.type) && has(URGENCY, r.urgency) &&
      Array.isArray(r.groups) && r.groups.every((g) => GROUPS.includes(g)) &&
      Number.isInteger(r.needed) && r.needed > 0 && r.needed <= 500 &&
      isISODate(r.deadline) && isTime(r.open) && isTime(r.close) &&
      (r.note == null || isStr(r.note, 200));
  }

  function validAppt(a) {
    return Boolean(a) && typeof a === 'object' &&
      isStr(a.id, 40) && isStr(a.code, 20) && isStr(a.requestId, 40) &&
      isStr(a.center, 80) && isStr(a.city, 50) && isStr(a.address, 100) &&
      has(TYPES, a.type) && isISODate(a.date) && isTime(a.time) &&
      isStr(a.name, 80) && (a.group === '?' || GROUPS.includes(a.group)) &&
      typeof a.counted === 'boolean';
  }

  const state = {
    myRequests: [],
    commits: Object.create(null),
    appts: [],
    filters: { type: 'all', group: 'all', q: '', urgentOnly: false },
    persistOk: true,
    lastNewAppt: null
  };

  function loadState() {
    const reqs = store.get(KEYS.requests, []);
    state.myRequests = Array.isArray(reqs) ? reqs.filter(validRequest) : [];

    const commits = store.get(KEYS.commits, {});
    state.commits = Object.create(null);
    if (commits && typeof commits === 'object' && !Array.isArray(commits)) {
      Object.keys(commits).forEach((k) => {
        const v = commits[k];
        if (Number.isInteger(v) && v > 0 && v < 10000) state.commits[k] = v;
      });
    }

    const appts = store.get(KEYS.appts, []);
    state.appts = Array.isArray(appts) ? appts.filter(validAppt) : [];
  }

  function persist(key, value) {
    const ok = store.set(key, value);
    if (!ok && state.persistOk) {
      state.persistOk = false;
      toast('Este navegador no permite guardar datos. Los cambios se perderán al recargar la página.', 'error');
    }
    return ok;
  }
  const saveRequests = () => persist(KEYS.requests, state.myRequests);
  const saveCommits = () => persist(KEYS.commits, state.commits);
  const saveAppts = () => persist(KEYS.appts, state.appts);

  /* ---------- Solicitudes: derivados ---------- */
  function allRequests() {
    const today = todayISO();
    const samples = SAMPLE_REQUESTS.map((s) => Object.assign({}, s, { deadline: addDays(today, s.offset), mine: false }));
    const mine = state.myRequests.map((r) => Object.assign({}, r, { mine: true }));
    return mine.concat(samples).map((r) => {
      r.committed = Math.min(r.needed, (r.committed || 0) + (state.commits[r.id] || 0));
      return r;
    });
  }

  const findRequest = (id) => allRequests().find((r) => r.id === id);

  function statusOf(r) {
    if (daysBetween(todayISO(), r.deadline) < 0) return 'expired';
    if (r.committed >= r.needed) return 'covered';
    return 'open';
  }

  const STATUS_RANK = { open: 0, covered: 1, expired: 2 };
  function sortRequests(list) {
    return list.sort((a, b) =>
      STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)] ||
      URGENCY[a.urgency].rank - URGENCY[b.urgency].rank ||
      a.deadline.localeCompare(b.deadline) ||
      (b.needed - b.committed) - (a.needed - a.committed));
  }

  const openRequests = () => sortRequests(allRequests().filter((r) => statusOf(r) === 'open'));

  function deadlineInfo(iso) {
    const d = daysBetween(todayISO(), iso);
    let text;
    if (d < 0) text = 'Plazo terminado';
    else if (d === 0) text = 'Termina hoy';
    else if (d === 1) text = 'Termina mañana';
    else text = `Quedan ${d} días`;
    return { text, soon: d >= 0 && d <= 2 };
  }

  function slotsFor(r, iso) {
    const open = toMinutes(r.open);
    const close = toMinutes(r.close);
    const duration = TYPES[r.type].minutes;
    const now = new Date();
    // Hoy solo se ofrecen horas con al menos 30 minutos de margen.
    const earliest = iso === todayISO() ? now.getHours() * 60 + now.getMinutes() + 30 : -1;
    const slots = [];
    for (let t = Math.ceil(open / 30) * 30; t + duration <= close; t += 30) {
      if (t >= earliest) slots.push(fromMinutes(t));
    }
    return slots;
  }

  function firstAvailableDate(r) {
    const today = todayISO();
    const span = daysBetween(today, r.deadline);
    for (let i = 0; i <= span; i++) {
      const d = addDays(today, i);
      if (slotsFor(r, d).length) return d;
    }
    return '';
  }

  /* ---------- Plantillas ---------- */
  const ECG_MINI = 'M0 12H40L45 9L50 12H56L60 15L64 2L69 22L73 12H84Q92 5 100 12H140L145 9L150 12H156L160 15L164 2L169 22L173 12H184Q192 5 200 12H240L245 9L250 12H256L260 15L264 2L269 22L273 12H284Q292 5 300 12H340L345 9L350 12H356L360 15L364 2L369 22L373 12H384Q392 5 400 12';
  const DROP_PATH = 'M60 8C60 8 18 58 18 90a42 42 0 0 0 84 0C102 58 60 8 60 8z';

  const ecgMini = () => `<svg class="req-ecg" viewBox="0 0 400 24" aria-hidden="true" focusable="false"><path class="e-base" d="${ECG_MINI}"/><path class="e-run" pathLength="100" d="${ECG_MINI}"/></svg>`;

  function groupsHTML(groups) {
    const label = '<span class="sr-only">Grupos que se buscan: </span>';
    if (!groups.length) return `${label}<span class="bt bt--all">Todos los grupos</span>`;
    return label + groups.map((g) => `<span class="bt" title="${groupSpoken(g)}">${groupLabel(g)}</span>`).join(' ');
  }

  const urgencyHTML = (u) => `<span class="urgency urgency--${u}"><span class="dot" aria-hidden="true"></span>${URGENCY[u].label}</span>`;
  const typeHTML = (t) => `<span class="req-type" data-type="${t}">${icon(TYPES[t].icon)}${TYPES[t].label}</span>`;

  function meterHTML(r) {
    const pct = r.needed ? clamp(r.committed / r.needed, 0, 1) : 0;
    return `<div class="meter" role="progressbar" aria-label="Donantes con cita" aria-valuemin="0" aria-valuemax="${r.needed}" aria-valuenow="${r.committed}"><span style="--p:${pct.toFixed(3)}"></span></div>`;
  }

  function cardHTML(r, opts = {}) {
    const status = opts.preview ? 'open' : statusOf(r);
    const remaining = Math.max(0, r.needed - r.committed);
    const dl = deadlineInfo(r.deadline);
    let action;
    if (opts.preview) {
      action = '<span class="btn btn--primary btn--sm is-fake" aria-hidden="true">Quiero donar</span>';
    } else if (status === 'covered') {
      action = `<span class="covered-tag">${icon('check')}Cubierta</span>`;
    } else {
      action = `<button class="btn btn--primary btn--sm" type="button" data-book="${esc(r.id)}" aria-label="Quiero donar en ${esc(r.center)}">Quiero donar</button>`;
    }
    return `
      <article class="req-card${status === 'covered' ? ' is-covered' : ''}" data-id="${esc(r.id)}" data-urgency="${r.urgency}" style="--i:${opts.index || 0}">
        ${r.urgency === 'critica' ? ecgMini() : ''}
        <div class="req-top">
          <div class="req-tags">${urgencyHTML(r.urgency)}${r.mine ? '<span class="mine-tag">Tu solicitud</span>' : ''}</div>
          ${typeHTML(r.type)}
        </div>
        <div class="req-main">
          <h3 class="req-center">${esc(r.center)}</h3>
          <p class="req-place">${icon('pin')}<span>${esc(r.city)}${r.address ? ' · ' + esc(r.address) : ''}</span></p>
        </div>
        <p class="req-groups">${groupsHTML(r.groups)}</p>
        ${r.note ? `<p class="req-note">${esc(r.note)}</p>` : ''}
        <div class="req-progress">
          ${meterHTML(r)}
          <p class="req-progress-meta">
            <span><strong>${r.committed}</strong> de ${r.needed} donantes</span>
            <span>${status === 'covered' ? 'Objetivo cubierto' : `Faltan ${remaining}`}</span>
          </p>
        </div>
        <div class="req-foot">
          <span class="req-deadline${dl.soon && status === 'open' ? ' is-soon' : ''}">${icon('clock')}<span>${dl.text} · ${fmtShort(r.deadline)}</span></span>
          ${action}
        </div>
      </article>`;
  }

  /* ---------- Elementos ---------- */
  const els = {};

  function cacheElements() {
    Object.assign(els, {
      header: $('#siteHeader'),
      heroLive: $('#heroLive'),
      spotlight: $('#spotlight'),
      ticker: $('#tickerTrack'),
      boardGrid: $('#boardGrid'),
      boardEmpty: $('#boardEmpty'),
      boardCount: $('#boardCount'),
      search: $('#fSearch'),
      urgent: $('#fUrgent'),
      dialog: $('#bookDialog'),
      bookBody: $('#bookBody'),
      rqForm: $('#requestForm'),
      rqPreview: $('#rqPreview'),
      rqBanner: $('#rqBanner'),
      myRequests: $('#myRequests'),
      appts: $('#appointments'),
      navCount: $('#navCount'),
      toasts: $('#toasts')
    });
  }

  /* ---------- Tablón ---------- */
  function matchesFilters(r) {
    const f = state.filters;
    if (f.type !== 'all' && r.type !== f.type) return false;
    if (f.group !== 'all' && r.groups.length && !r.groups.includes(f.group)) return false;
    if (f.urgentOnly && r.urgency === 'normal') return false;
    if (f.q) {
      const haystack = normalize(`${r.center} ${r.city} ${r.address}`);
      if (!haystack.includes(normalize(f.q))) return false;
    }
    return true;
  }

  function renderBoard() {
    const all = sortRequests(allRequests().filter((r) => statusOf(r) !== 'expired'));
    const list = all.filter(matchesFilters);
    els.boardGrid.innerHTML = list.map((r, i) => cardHTML(r, { index: Math.min(i, 8) })).join('');
    els.boardEmpty.hidden = list.length > 0;
    if (list.length === all.length) {
      els.boardCount.innerHTML = `<strong>${all.length}</strong> ${all.length === 1 ? 'solicitud publicada' : 'solicitudes publicadas'}`;
    } else {
      els.boardCount.innerHTML = `Mostrando <strong>${list.length}</strong> de ${all.length} solicitudes`;
    }
  }

  function setFilters(next) {
    Object.assign(state.filters, next);
    const f = state.filters;
    const typeInput = $(`input[name="ftype"][value="${cssEsc(f.type)}"]`);
    if (typeInput) typeInput.checked = true;
    const groupInput = $(`input[name="fgroup"][value="${cssEsc(f.group)}"]`);
    if (groupInput) groupInput.checked = true;
    els.search.value = f.q;
    els.urgent.checked = f.urgentOnly;
    renderBoard();
  }

  const resetFilters = () => setFilters({ type: 'all', group: 'all', q: '', urgentOnly: false });

  function initFilters() {
    $$('input[name="ftype"]').forEach((input) => {
      input.addEventListener('change', () => {
        state.filters.type = input.value;
        renderBoard();
      });
    });
    $$('input[name="fgroup"]').forEach((input) => {
      input.addEventListener('change', () => {
        state.filters.group = input.value;
        renderBoard();
      });
    });
    let searchTimer = 0;
    els.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.q = els.search.value;
        renderBoard();
      }, 160);
    });
    els.urgent.addEventListener('change', () => {
      state.filters.urgentOnly = els.urgent.checked;
      renderBoard();
    });
    $('#clearFilters').addEventListener('click', resetFilters);
    $$('[data-filter-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setFilters({ type: btn.dataset.filterType, group: 'all', q: '', urgentOnly: false });
        scrollToSection('#solicitudes');
      });
    });
    // El navegador puede restaurar los controles al recargar: se parte siempre de un estado limpio.
    resetFilters();
  }

  function focusCard(id) {
    const selector = `.req-card[data-id="${cssEsc(id)}"]`;
    let card = els.boardGrid.querySelector(selector);
    if (!card) {
      resetFilters();
      card = els.boardGrid.querySelector(selector);
    }
    if (!card) return;
    card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    card.classList.remove('is-highlight');
    void card.offsetWidth;
    card.classList.add('is-highlight');
    const btn = card.querySelector('[data-book]');
    if (btn) btn.focus({ preventScroll: true });
  }

  /* ---------- Hero: cifras, destacado y ticker ---------- */
  const statValues = {};
  let countToken = 0;

  function countUp(el, to, duration, delay) {
    const token = ++countToken;
    el.dataset.countToken = String(token);
    if (reduced() || to === 0) {
      el.textContent = fmtNum(to);
      return;
    }
    el.textContent = '0';
    const startAt = performance.now() + (delay || 0);
    const tick = (now) => {
      if (el.dataset.countToken !== String(token)) return;
      if (now < startAt) {
        requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNum(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function setStat(name, value) {
    const el = $(`[data-stat="${name}"]`);
    if (!el) return;
    const prev = statValues[name];
    statValues[name] = value;
    if (prev === undefined) {
      countUp(el, value, 1600, 1100);
      return;
    }
    if (prev === value) return;
    el.dataset.countToken = String(++countToken);
    el.textContent = fmtNum(value);
    if (!reduced()) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  function renderHero() {
    const open = openRequests();
    const missing = open.reduce((sum, r) => sum + (r.needed - r.committed), 0);
    const urgent = open.filter((r) => r.urgency !== 'normal').length;
    setStat('active', open.length);
    setStat('missing', missing);
    setStat('urgent', urgent);
    els.heroLive.textContent = open.length === 1
      ? '1 solicitud activa ahora mismo'
      : `${open.length} solicitudes activas ahora mismo`;
    renderSpotlight(open[0]);
  }

  function renderSpotlight(r) {
    if (!r) {
      els.spotlight.innerHTML = `
        <div class="spot-card">
          <span class="spot-kicker">Ahora mismo</span>
          <p class="spot-empty">No hay solicitudes abiertas. Las reservas se mantienen gracias a quien dona con regularidad: puedes donar en cualquier centro de transfusión.</p>
        </div>`;
      return;
    }
    const dl = deadlineInfo(r.deadline);
    els.spotlight.innerHTML = `
      <div class="spot-card">
        <div class="spot-head">
          <span class="spot-kicker">La más urgente</span>
          ${urgencyHTML(r.urgency)}
        </div>
        <p class="spot-center">${esc(r.center)}</p>
        <p class="spot-place">${icon('pin')}<span>${esc(r.city)} · ${TYPES[r.type].label}</span></p>
        <p class="req-groups">${groupsHTML(r.groups)}</p>
        ${meterHTML(r)}
        <p class="spot-meta"><span><strong>${r.committed}</strong> de ${r.needed} donantes</span><span>${dl.text}</span></p>
        <button class="btn btn--primary" type="button" data-book="${esc(r.id)}">Reservar cita ${icon('arrow')}</button>
      </div>`;
  }

  function initTilt() {
    const host = els.spotlight;
    const fine = window.matchMedia('(pointer: fine)');
    let frame = 0;
    host.addEventListener('pointermove', (e) => {
      if (!fine.matches || reduced()) return;
      const card = host.querySelector('.spot-card');
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.classList.add('is-tilting');
        card.style.transform = `rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg)`;
      });
    });
    host.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      const card = host.querySelector('.spot-card');
      if (!card) return;
      card.classList.remove('is-tilting');
      card.style.transform = '';
    });
  }

  function renderTicker() {
    const track = els.ticker;
    const urgent = openRequests().filter((r) => r.urgency !== 'normal');
    if (!urgent.length) {
      track.classList.add('is-empty');
      track.innerHTML = '<p class="tick-empty">Ahora mismo no hay solicitudes urgentes. Donar con regularidad mantiene las reservas estables.</p>';
      return;
    }
    track.classList.remove('is-empty');
    const item = (r, hidden) => `
      <span class="tick-item"${hidden ? ' aria-hidden="true"' : ''}>
        <span class="tick-urg tick-urg--${r.urgency}">${URGENCY[r.urgency].label}</span>
        <span class="tick-groups">${r.groups.length ? r.groups.map(groupLabel).join(' ') : 'Todos los grupos'}</span>
        <span>${TYPES[r.type].label} · ${esc(r.center)}, ${esc(r.city)}</span>
        ${icon('drop')}
      </span>`;
    const readable = urgent.map((r) => item(r, false)).join('');
    const hidden = urgent.map((r) => item(r, true)).join('');

    // Se repite el contenido hasta cubrir el ancho visible para que el bucle no deje huecos.
    track.innerHTML = `<div class="ticker-group">${readable}</div>`;
    const visible = track.parentElement.clientWidth || window.innerWidth;
    const baseWidth = track.firstElementChild.scrollWidth || 1;
    const reps = Math.max(1, Math.ceil(visible / baseWidth));
    const first = readable + hidden.repeat(reps - 1);
    track.innerHTML = `<div class="ticker-group">${first}</div><div class="ticker-group" aria-hidden="true">${hidden.repeat(reps)}</div>`;
    const groupWidth = track.firstElementChild.scrollWidth;
    track.style.setProperty('--dur', `${Math.max(20, groupWidth / 60).toFixed(1)}s`);
  }

  /* ---------- Reserva de cita ---------- */
  let bookingReq = null;
  let lastOpener = null;

  function openDialog() {
    const d = els.dialog;
    d.classList.remove('is-closing');
    if (typeof d.showModal === 'function') {
      if (!d.open) d.showModal();
    } else {
      d.setAttribute('open', '');
    }
    const card = d.querySelector('.modal-card');
    if (card) card.scrollTop = 0;
  }

  function restoreFocus() {
    if (lastOpener && lastOpener.isConnected) {
      lastOpener.focus({ preventScroll: true });
      return;
    }
    if (bookingReq) {
      const again = document.querySelector(`[data-book="${cssEsc(bookingReq.id)}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  function closeDialog(after) {
    const d = els.dialog;
    if (!d.open || d.classList.contains('is-closing')) return;
    const finish = () => {
      d.classList.remove('is-closing');
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
      if (typeof after === 'function') after();
      else restoreFocus();
    };
    if (reduced()) {
      finish();
      return;
    }
    d.classList.add('is-closing');
    setTimeout(finish, 220);
  }

  function initDialog() {
    const d = els.dialog;
    let downOnBackdrop = false;
    d.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDialog();
    });
    d.addEventListener('pointerdown', (e) => {
      downOnBackdrop = e.target === d;
    });
    d.addEventListener('click', (e) => {
      if (e.target === d) {
        if (downOnBackdrop) closeDialog();
        return;
      }
      if (e.target.closest('[data-close]')) {
        closeDialog();
        return;
      }
      const goto = e.target.closest('[data-goto]');
      if (goto) {
        closeDialog(() => {
          scrollToSection(goto.dataset.goto);
          const heading = $('#citas-title');
          if (heading) heading.focus({ preventScroll: true });
        });
      }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-book]');
      if (btn) openBooking(btn.dataset.book, btn);
    });
  }

  function openBooking(id, opener) {
    const r = findRequest(id);
    if (!r || statusOf(r) !== 'open') {
      toast('Esta solicitud ya no admite citas.', 'error');
      refreshAll();
      return;
    }
    bookingReq = r;
    lastOpener = opener || null;
    els.bookBody.innerHTML = bookingFormHTML(r);
    setupBookingForm(r);
    openDialog();
  }

  function bookingFormHTML(r) {
    const saved = store.get(KEYS.myGroup, '');
    const options = ['<option value="">Selecciona tu grupo</option>']
      .concat(GROUPS.map((g) => `<option value="${g}"${g === saved ? ' selected' : ''}>${groupLabel(g)}</option>`))
      .concat(`<option value="?"${saved === '?' ? ' selected' : ''}>No lo sé</option>`)
      .join('');
    return `
      <header class="modal-head">
        <div class="req-tags">${urgencyHTML(r.urgency)}${typeHTML(r.type)}</div>
        <h2 id="bookTitle">Reserva tu cita</h2>
        <p class="modal-sub"><strong>${esc(r.center)}</strong><br>${esc(r.address)}, ${esc(r.city)}</p>
      </header>
      <form class="modal-form" id="bookForm" novalidate>
        <div class="form-alert" id="bkAlert" role="alert" hidden></div>
        <div class="form-grid">
          <div class="field field--full">
            <label for="bkName">Nombre y apellidos</label>
            <input id="bkName" type="text" autocomplete="name" maxlength="80" aria-describedby="bkName-err">
            <p class="field-error" id="bkName-err"></p>
          </div>
          <div class="field">
            <label for="bkGroup">Tu grupo sanguíneo</label>
            <select id="bkGroup" aria-describedby="bkGroup-err">${options}</select>
            <p class="field-error" id="bkGroup-err"></p>
          </div>
          <div class="field">
            <label for="bkPhone">Teléfono</label>
            <input id="bkPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="612 345 678" aria-describedby="bkPhone-err">
            <p class="field-error" id="bkPhone-err"></p>
          </div>
          <div class="field--full group-note" id="bkGroupNote" hidden></div>
          <div class="field field--full">
            <label for="bkEmail">Correo electrónico <span class="opt">(opcional)</span></label>
            <input id="bkEmail" type="email" autocomplete="email" aria-describedby="bkEmail-err">
            <p class="field-error" id="bkEmail-err"></p>
          </div>
          <div class="field">
            <label for="bkDate">Día</label>
            <input id="bkDate" type="date" aria-describedby="bkDate-err">
            <p class="field-error" id="bkDate-err"></p>
          </div>
          <div class="field">
            <span class="field-label">Horario del centro</span>
            <p class="hours-note">${icon('clock')}${r.open} – ${r.close}</p>
          </div>
          <fieldset class="field field--full slots" aria-describedby="bkSlot-err">
            <legend>Hora</legend>
            <div id="bkSlots"></div>
            <p class="field-error" id="bkSlot-err"></p>
          </fieldset>
          <div class="field field--full">
            <label class="check">
              <input type="checkbox" id="bkOk" aria-describedby="bkOk-err">
              <span>Tengo entre 18 y 65 años, peso 50 kg o más y me encuentro bien de salud.</span>
            </label>
            <p class="field-error" id="bkOk-err"></p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn--secondary" type="button" data-close>Cancelar</button>
          <button class="btn btn--primary" type="submit" id="bkSubmit">Confirmar cita</button>
        </div>
      </form>`;
  }

  function setupBookingForm(r) {
    const form = $('#bookForm');
    const date = $('#bkDate');
    const first = firstAvailableDate(r);

    form.addEventListener('input', (e) => clearError(e.target.id || e.target.name));
    form.addEventListener('change', (e) => clearError(e.target.id || e.target.name));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitBooking(r);
    });
    $('#bkGroup').addEventListener('change', () => updateGroupNote(r));
    updateGroupNote(r);

    if (!first) {
      date.disabled = true;
      $('#bkSubmit').disabled = true;
      $('#bkSlots').innerHTML = '<p class="slots-empty">No quedan horas libres antes de que termine el plazo.</p>';
      showAlert('Este centro ya no tiene horas libres antes de que termine el plazo de la solicitud.');
      return;
    }
    date.min = first;
    date.max = r.deadline;
    date.value = first;
    date.addEventListener('change', () => renderSlots(r));
    renderSlots(r);
  }

  function renderSlots(r) {
    const box = $('#bkSlots');
    const date = $('#bkDate');
    const iso = date.value;
    const checked = box.querySelector('input[name="bkSlot"]:checked');
    const previous = checked ? checked.value : '';
    if (!isISODate(iso) || iso < date.min || iso > date.max) {
      box.innerHTML = `<p class="slots-empty">Elige un día entre el ${fmtLong(date.min)} y el ${fmtLong(date.max)}.</p>`;
      return;
    }
    const slots = slotsFor(r, iso);
    if (!slots.length) {
      box.innerHTML = '<p class="slots-empty">No quedan horas libres ese día. Prueba con otro.</p>';
      return;
    }
    const block = (title, list) => (list.length ? `
      <div class="slot-group">
        <p class="slot-group-title">${title}</p>
        <div class="slot-grid">
          ${list.map((s) => `<label class="slot"><input type="radio" name="bkSlot" value="${s}"${s === previous ? ' checked' : ''}><span>${s}</span></label>`).join('')}
        </div>
      </div>` : '');
    box.innerHTML = block('Mañana', slots.filter((s) => s < '14:00')) + block('Tarde', slots.filter((s) => s >= '14:00'));
  }

  function updateGroupNote(r) {
    const g = $('#bkGroup').value;
    const note = $('#bkGroupNote');
    if (!g) {
      note.hidden = true;
      return;
    }
    const wanted = joinList(r.groups.map(groupLabel));
    let kind;
    let symbol;
    let text;
    if (g === '?') {
      kind = 'is-info';
      symbol = 'info';
      text = r.groups.length
        ? `No pasa nada: en tu primera donación se analiza tu grupo. Como este centro busca ${wanted}, tu cita no sumará al contador de esta solicitud, pero tu donación irá a sus reservas.`
        : 'No pasa nada: en tu primera donación se analiza tu grupo sanguíneo. Este centro acepta todos los grupos.';
    } else if (!r.groups.length || r.groups.includes(g)) {
      kind = 'is-good';
      symbol = 'check';
      text = r.groups.length
        ? `${groupLabel(g)} es uno de los grupos que busca este centro. Tu cita sumará a la solicitud.`
        : 'Este centro acepta todos los grupos. Tu cita sumará a la solicitud.';
    } else {
      kind = 'is-info';
      symbol = 'info';
      text = `Este centro busca ahora ${wanted}. Puedes donar igualmente: tu donación irá a sus reservas generales, aunque no sumará al contador de esta solicitud.`;
    }
    note.className = `field--full group-note ${kind}`;
    note.innerHTML = `${icon(symbol)}<span>${text}</span>`;
    note.hidden = false;
  }

  function showAlert(message) {
    const box = $('#bkAlert');
    if (!box) return;
    box.innerHTML = `${icon('alert')}<span></span>`;
    box.querySelector('span').textContent = message;
    box.hidden = false;
    box.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function findConflict(r, date) {
    const today = todayISO();
    const sameRequest = state.appts.find((a) => a.requestId === r.id && a.date >= today);
    if (sameRequest) {
      return `Ya tienes una cita para esta solicitud el ${fmtLong(sameRequest.date)} a las ${sameRequest.time}.`;
    }
    const sameDay = state.appts.find((a) => a.date === date);
    if (sameDay) {
      return `Ya tienes una cita ese día (${fmtLong(date)}) en ${sameDay.center}. Elige otro día.`;
    }
    if (r.type === 'sangre') {
      const near = state.appts.find((a) => a.type === 'sangre' && addMonths(a.date, 2) > date && addMonths(date, 2) > a.date);
      if (near) {
        return `Tienes otra donación de sangre total el ${fmtLong(near.date)}. Entre dos donaciones de sangre total deben pasar al menos 2 meses.`;
      }
    }
    return '';
  }

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const used = new Set(state.appts.map((a) => a.code));
    let code;
    do {
      const buf = new Uint32Array(6);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
      else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 4294967296);
      code = 'LT-' + Array.from(buf, (n) => chars[n % chars.length]).join('');
    } while (used.has(code));
    return code;
  }

  const BOOK_FIELDS = ['bkName', 'bkGroup', 'bkPhone', 'bkEmail', 'bkDate', 'bkSlot', 'bkOk'];

  function submitBooking(r) {
    const alertBox = $('#bkAlert');
    alertBox.hidden = true;

    const name = $('#bkName').value.trim().replace(/\s+/g, ' ');
    const group = $('#bkGroup').value;
    const phone = $('#bkPhone').value.trim();
    const email = $('#bkEmail').value.trim();
    const dateInput = $('#bkDate');
    const date = dateInput.value;
    const slot = $('input[name="bkSlot"]:checked');
    const time = slot ? slot.value : '';

    const errors = {};
    if (name.length < 2) errors.bkName = 'Escribe tu nombre y apellidos.';
    if (!group) errors.bkGroup = 'Elige tu grupo o marca «No lo sé».';
    if (!isPhone(phone)) errors.bkPhone = 'Escribe un teléfono válido, por ejemplo 612 345 678.';
    if (email && !isEmail(email)) errors.bkEmail = 'Revisa el correo: debe tener el formato nombre@dominio.es.';
    if (!isISODate(date) || date < dateInput.min || date > dateInput.max) {
      errors.bkDate = `Elige un día entre el ${fmtLong(dateInput.min)} y el ${fmtLong(dateInput.max)}.`;
    } else if (!time) {
      errors.bkSlot = 'Elige una hora.';
    } else if (!slotsFor(r, date).includes(time)) {
      errors.bkSlot = 'Esa hora ya no está disponible. Elige otra.';
      renderSlots(r);
    }
    if (!$('#bkOk').checked) errors.bkOk = 'Confirma que cumples los requisitos básicos.';
    if (!showErrors(errors, BOOK_FIELDS)) return;

    const fresh = findRequest(r.id);
    if (!fresh || statusOf(fresh) !== 'open') {
      showAlert('Esta solicitud se acaba de cubrir o ya no está disponible. Elige otra en el tablón.');
      refreshAll();
      return;
    }
    const conflict = findConflict(fresh, date);
    if (conflict) {
      showAlert(conflict);
      return;
    }

    const counted = !fresh.groups.length || (group !== '?' && fresh.groups.includes(group));
    const appt = {
      id: uid('a'),
      code: makeCode(),
      requestId: fresh.id,
      center: fresh.center,
      city: fresh.city,
      address: fresh.address,
      type: fresh.type,
      date,
      time,
      name,
      group,
      phone,
      email,
      counted,
      createdAt: Date.now()
    };
    state.appts.push(appt);
    saveAppts();
    if (counted) {
      state.commits[fresh.id] = (state.commits[fresh.id] || 0) + 1;
      saveCommits();
    }
    store.set(KEYS.myGroup, group);
    state.lastNewAppt = appt.id;
    refreshAll();
    showBookingSuccess(appt);
  }

  function showBookingSuccess(appt) {
    const burst = Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join('');
    const firstName = appt.name.split(' ')[0];
    let note = '';
    if (!appt.counted) {
      note = appt.group === '?'
        ? '<p class="success-note">Como aún no sabes tu grupo, esta cita no suma al contador de la solicitud. Tu donación irá igualmente a las reservas del centro.</p>'
        : '<p class="success-note">Tu grupo no está entre los que busca ahora este centro, así que la cita no suma al contador. Tu donación irá a sus reservas generales.</p>';
    }
    els.bookBody.innerHTML = `
      <div class="book-success">
        <div class="success-mark" aria-hidden="true">
          <svg viewBox="0 0 120 140" focusable="false">
            <defs><clipPath id="successClip"><path d="${DROP_PATH}"/></clipPath></defs>
            <g clip-path="url(#successClip)"><rect class="s-fill" x="0" y="0" width="120" height="140"/></g>
            <path class="s-outline" pathLength="1" d="${DROP_PATH}"/>
            <path class="s-check" pathLength="1" d="M40 90 L54 104 L82 74"/>
          </svg>
          <span class="s-burst">${burst}</span>
        </div>
        <h2 id="bookTitle" tabindex="-1">¡Cita confirmada!</h2>
        <p>Gracias, ${esc(firstName)}. Te esperamos en <strong>${esc(appt.center)}</strong>.</p>
        <dl class="success-ticket">
          <div><dt>Código</dt><dd class="code">${esc(appt.code)}</dd></div>
          <div><dt>Donación</dt><dd>${TYPES[appt.type].label}</dd></div>
          <div><dt>Día</dt><dd>${cap(fmtLong(appt.date))}</dd></div>
          <div><dt>Hora</dt><dd>${appt.time}</dd></div>
          <div class="span-2"><dt>Dirección</dt><dd>${esc(appt.address)}, ${esc(appt.city)}</dd></div>
        </dl>
        <ul class="success-tips">
          <li>${icon('check')}<span>Come algo ligero antes de ir: no vengas en ayunas.</span></li>
          <li>${icon('check')}<span>Bebe agua durante el día y lleva tu DNI, NIE o pasaporte.</span></li>
          <li>${icon('check')}<span>Si no puedes ir, cancela la cita en «Mis citas» para liberar la hora.</span></li>
        </ul>
        ${note}
        <div class="modal-actions">
          <button class="btn btn--secondary" type="button" data-goto="#mis-citas">Ver mis citas</button>
          <button class="btn btn--primary" type="button" data-close>Hecho</button>
        </div>
      </div>`;
    const card = els.dialog.querySelector('.modal-card');
    if (card) card.scrollTop = 0;
    $('#bookTitle').focus({ preventScroll: true });
  }

  /* ---------- Errores de formulario ---------- */
  function setFieldError(key, message) {
    const err = document.getElementById(`${key}-err`);
    const field = document.getElementById(key);
    if (err) err.textContent = message || '';
    if (field) {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
  }

  function clearError(key) {
    if (key) setFieldError(key, '');
  }

  // Devuelve true si no hay errores. Si los hay, lleva el foco al primero.
  function showErrors(errors, keys) {
    keys.forEach((key) => setFieldError(key, errors[key] || ''));
    const first = keys.find((key) => errors[key]);
    if (!first) return true;
    let target = document.getElementById(first);
    if (first === 'rqGroups') target = $('input[name="rqGroups"]');
    if (first === 'bkSlot') target = $('input[name="bkSlot"]') || $('#bkDate');
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    }
    return false;
  }

  /* ---------- Mis citas ---------- */
  function ticketHTML(a, index, today) {
    const d = daysBetween(today, a.date);
    const past = d < 0;
    let when;
    if (past) when = 'Pasada';
    else if (d === 0) when = 'Hoy';
    else if (d === 1) when = 'Mañana';
    else when = `En ${d} días`;
    const classes = ['ticket'];
    if (past) classes.push('is-past');
    if (a.id === state.lastNewAppt) classes.push('is-new');
    const action = past
      ? `<button class="link-btn" type="button" data-remove-appt="${esc(a.id)}">${icon('x')}<span>Quitar del historial</span></button>`
      : `<button class="link-btn" type="button" data-cancel-appt="${esc(a.id)}">${icon('x')}<span>Cancelar cita</span></button>`;
    return `
      <article class="${classes.join(' ')}" style="--i:${Math.min(index, 6)}">
        <div class="ticket-main">
          <p class="ticket-type">${icon(TYPES[a.type].icon)}${TYPES[a.type].label}<span class="ticket-when-badge">${when}</span></p>
          <h3>${esc(a.center)}</h3>
          <p class="ticket-place">${icon('pin')}<span>${esc(a.address)}, ${esc(a.city)}</span></p>
          <dl class="ticket-data">
            <div><dt>Día</dt><dd>${cap(fmtShort(a.date))}</dd></div>
            <div><dt>Hora</dt><dd>${a.time}</dd></div>
            <div><dt>Grupo</dt><dd>${a.group === '?' ? 'Por saber' : groupLabel(a.group)}</dd></div>
          </dl>
        </div>
        <div class="ticket-stub">
          <div>
            <span class="ticket-code-label">Código</span>
            <span class="ticket-code">${esc(a.code)}</span>
          </div>
          <div class="ticket-actions">
            <button class="link-btn" type="button" data-copy="${esc(a.id)}">${icon('copy')}<span>Copiar datos</span></button>
            ${action}
          </div>
        </div>
      </article>`;
  }

  function renderAppts() {
    const today = todayISO();
    const list = state.appts.slice().sort((a, b) => {
      const pastA = a.date < today;
      const pastB = b.date < today;
      if (pastA !== pastB) return pastA ? 1 : -1;
      const ka = a.date + a.time;
      const kb = b.date + b.time;
      return pastA ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
    const upcoming = list.filter((a) => a.date >= today).length;
    els.navCount.textContent = String(upcoming);
    els.navCount.hidden = upcoming === 0;

    if (!list.length) {
      els.appts.innerHTML = `
        <div class="appts-empty">
          ${icon('heart')}
          <h3>Todavía no tienes citas</h3>
          <p>Elige una solicitud en el tablón y reserva hora. Tu cita aparecerá aquí con su código.</p>
          <a class="btn btn--primary" href="#solicitudes">Buscar dónde donar</a>
        </div>`;
      return;
    }
    els.appts.innerHTML = list.map((a, i) => ticketHTML(a, i, today)).join('');
    state.lastNewAppt = null;
  }

  // Botones de dos pasos: el primer clic pide confirmación y el segundo ejecuta.
  const armedOriginals = new WeakMap();
  function armOrRun(btn, armedLabel, run) {
    if (armedOriginals.has(btn)) {
      const saved = armedOriginals.get(btn);
      clearTimeout(saved.timer);
      armedOriginals.delete(btn);
      btn.classList.remove('is-armed');
      btn.innerHTML = saved.html;
      run();
      return;
    }
    const saved = { html: btn.innerHTML, timer: 0 };
    armedOriginals.set(btn, saved);
    btn.classList.add('is-armed');
    const label = btn.querySelector('span');
    if (label) label.textContent = armedLabel;
    else btn.textContent = armedLabel;
    saved.timer = setTimeout(() => {
      armedOriginals.delete(btn);
      btn.classList.remove('is-armed');
      btn.innerHTML = saved.html;
    }, 4000);
  }

  function removeAppt(id, release) {
    const a = state.appts.find((x) => x.id === id);
    if (!a) return;
    state.appts = state.appts.filter((x) => x.id !== id);
    saveAppts();
    if (release && a.counted && state.commits[a.requestId] > 0) {
      state.commits[a.requestId] -= 1;
      if (!state.commits[a.requestId]) delete state.commits[a.requestId];
      saveCommits();
    }
    refreshAll();
    toast(release ? 'Cita cancelada. La hora queda libre para otra persona.' : 'Cita quitada del historial.');
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }

  function initAppointments() {
    els.appts.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) {
        const a = state.appts.find((x) => x.id === copyBtn.dataset.copy);
        if (!a) return;
        const text = `Cita para donar ${TYPES[a.type].label.toLowerCase()}\n${a.center}\n${a.address}, ${a.city}\n${cap(fmtLong(a.date))} a las ${a.time}\nCódigo: ${a.code}`;
        copyText(text).then((ok) => {
          if (ok) toast('Datos de la cita copiados.');
          else toast(`No se ha podido copiar. Tu código es ${a.code}.`, 'error');
        });
        return;
      }
      const cancelBtn = e.target.closest('[data-cancel-appt]');
      if (cancelBtn) {
        armOrRun(cancelBtn, '¿Seguro? Pulsa otra vez', () => removeAppt(cancelBtn.dataset.cancelAppt, true));
        return;
      }
      const removeBtn = e.target.closest('[data-remove-appt]');
      if (removeBtn) {
        armOrRun(removeBtn, 'Pulsa otra vez para quitarla', () => removeAppt(removeBtn.dataset.removeAppt, false));
      }
    });
  }

  /* ---------- Formulario para centros ---------- */
  const RQ_FIELDS = ['rqCenter', 'rqCity', 'rqAddress', 'rqGroups', 'rqNeeded', 'rqDeadline', 'rqOpen', 'rqClose', 'rqContact', 'rqPhone', 'rqEmail', 'rqConfirm'];

  function readRequestForm() {
    const form = els.rqForm;
    const text = (id) => $(`#${id}`).value.trim().replace(/\s+/g, ' ');
    const checkedGroups = $$('input[name="rqGroups"]:checked', form).map((b) => b.value);
    const neededRaw = $('#rqNeeded').value.trim();
    const typeInput = $('input[name="rqType"]:checked', form);
    const urgencyInput = $('input[name="rqUrgency"]:checked', form);
    return {
      center: text('rqCenter'),
      kind: $('#rqKind').value,
      city: text('rqCity'),
      address: text('rqAddress'),
      type: typeInput && has(TYPES, typeInput.value) ? typeInput.value : 'sangre',
      checkedGroups,
      groups: checkedGroups.includes('all') ? [] : GROUPS.filter((g) => checkedGroups.includes(g)),
      urgency: urgencyInput && has(URGENCY, urgencyInput.value) ? urgencyInput.value : 'urgente',
      needed: /^\d+$/.test(neededRaw) ? parseInt(neededRaw, 10) : NaN,
      deadline: $('#rqDeadline').value,
      open: $('#rqOpen').value.slice(0, 5),
      close: $('#rqClose').value.slice(0, 5),
      contact: text('rqContact'),
      phone: $('#rqPhone').value.trim(),
      email: $('#rqEmail').value.trim(),
      note: $('#rqNote').value.trim(),
      confirm: $('#rqConfirm').checked
    };
  }

  function validateRequest(d) {
    const e = {};
    const today = todayISO();
    const maxDate = addDays(today, 90);
    if (d.center.length < 3) e.rqCenter = 'Escribe el nombre del centro.';
    if (d.city.length < 2) e.rqCity = 'Indica la ciudad.';
    if (d.address.length < 5) e.rqAddress = 'Indica la dirección donde se dona.';
    if (!d.checkedGroups.length) e.rqGroups = 'Elige al menos un grupo o marca «Todos los grupos».';
    if (!Number.isInteger(d.needed) || d.needed < 1 || d.needed > 500) e.rqNeeded = 'Indica un número entero entre 1 y 500.';

    if (!isISODate(d.deadline)) e.rqDeadline = 'Elige una fecha límite.';
    else if (d.deadline < today) e.rqDeadline = 'La fecha límite no puede ser anterior a hoy.';
    else if (d.deadline > maxDate) e.rqDeadline = 'La fecha límite puede ser, como mucho, dentro de 90 días.';

    if (!isTime(d.open)) e.rqOpen = 'Indica la hora de apertura.';
    if (!isTime(d.close)) e.rqClose = 'Indica la hora de cierre.';
    if (isTime(d.open) && isTime(d.close)) {
      const minutes = TYPES[d.type].minutes;
      if (toMinutes(d.close) <= toMinutes(d.open)) {
        e.rqClose = 'La hora de cierre debe ser posterior a la de apertura.';
      } else if (toMinutes(d.close) - Math.ceil(toMinutes(d.open) / 30) * 30 < minutes) {
        e.rqClose = `El horario es demasiado corto: una donación de ${TYPES[d.type].label.toLowerCase()} necesita al menos ${minutes} minutos.`;
      } else if (!e.rqDeadline && d.deadline === today && !slotsFor({ open: d.open, close: d.close, type: d.type }, today).length) {
        e.rqDeadline = 'Hoy ya no quedan horas dentro de ese horario. Elige una fecha límite posterior.';
      }
    }

    if (d.contact.length < 3) e.rqContact = 'Indica el nombre de la persona de contacto.';
    if (!isPhone(d.phone)) e.rqPhone = 'Escribe un teléfono válido, por ejemplo 912 345 678.';
    if (!isEmail(d.email)) e.rqEmail = 'Escribe un correo válido, con el formato nombre@centro.es.';
    if (!d.confirm) e.rqConfirm = 'Marca la casilla para confirmar que representas al centro.';
    return e;
  }

  function updatePreview() {
    const d = readRequestForm();
    const today = todayISO();
    const preview = {
      id: 'preview',
      center: d.center || 'Nombre del centro',
      city: d.city || 'Ciudad',
      address: d.address,
      type: d.type,
      groups: d.groups,
      urgency: d.urgency,
      needed: Number.isInteger(d.needed) && d.needed > 0 ? Math.min(d.needed, 500) : 20,
      committed: 0,
      deadline: isISODate(d.deadline) && d.deadline >= today ? d.deadline : addDays(today, 7),
      note: d.note,
      mine: true
    };
    els.rqPreview.innerHTML = cardHTML(preview, { preview: true });
  }

  function updateNoteCount() {
    $('#rqNote-count').textContent = `${$('#rqNote').value.length} / 200`;
  }

  function setRequestDefaults() {
    const today = todayISO();
    const deadline = $('#rqDeadline');
    deadline.min = today;
    deadline.max = addDays(today, 90);
    deadline.defaultValue = addDays(today, 7);
    deadline.value = addDays(today, 7);
  }

  function renderMyRequests() {
    const mine = allRequests().filter((r) => r.mine);
    if (!mine.length) {
      els.myRequests.innerHTML = '<p class="empty-note">Todavía no has publicado ninguna solicitud desde este navegador.</p>';
      return;
    }
    const labels = { open: 'Activa', covered: 'Cubierta', expired: 'Plazo terminado' };
    els.myRequests.innerHTML = `<div class="my-requests-list">${mine.map((r) => {
      const st = statusOf(r);
      return `
        <article class="myreq">
          <div class="myreq-top">
            <div>
              <p class="myreq-name">${esc(r.center)}</p>
              <p class="myreq-sub">${TYPES[r.type].label} · ${esc(r.city)}</p>
            </div>
            <span class="status-pill status-pill--${st}">${labels[st]}</span>
          </div>
          ${meterHTML(r)}
          <div class="myreq-foot">
            <span>${r.committed} de ${r.needed} donantes · hasta el ${fmtDayMonth(r.deadline)}</span>
            <button class="link-btn" type="button" data-retire="${esc(r.id)}">${icon('x')}<span>Retirar</span></button>
          </div>
        </article>`;
    }).join('')}</div>`;
  }

  function submitRequest() {
    const d = readRequestForm();
    if (!showErrors(validateRequest(d), RQ_FIELDS)) return;

    const req = {
      id: uid('r'),
      center: d.center,
      kind: d.kind,
      city: d.city,
      address: d.address,
      type: d.type,
      groups: d.groups,
      urgency: d.urgency,
      needed: d.needed,
      committed: 0,
      deadline: d.deadline,
      open: d.open,
      close: d.close,
      contact: d.contact,
      phone: d.phone,
      email: d.email,
      note: d.note,
      createdAt: Date.now()
    };
    state.myRequests.unshift(req);
    saveRequests();
    refreshAll();

    els.rqForm.reset();
    setRequestDefaults();
    RQ_FIELDS.forEach(clearError);
    updatePreview();
    updateNoteCount();

    els.rqBanner.innerHTML = `
      ${icon('check')}
      <p>Solicitud publicada. Ya aparece en el tablón de donantes.</p>
      <button class="btn btn--primary btn--sm" type="button" data-show-card="${esc(req.id)}">Verla en el tablón</button>`;
    els.rqBanner.hidden = false;
    els.rqBanner.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    toast('Solicitud publicada en el tablón.');
  }

  function initRequestForm() {
    const form = els.rqForm;
    setRequestDefaults();

    const boxes = $$('input[name="rqGroups"]', form);
    const allBox = boxes.find((b) => b.value === 'all');
    boxes.forEach((box) => {
      box.addEventListener('change', () => {
        if (box === allBox && box.checked) boxes.forEach((b) => { if (b !== allBox) b.checked = false; });
        else if (box !== allBox && box.checked) allBox.checked = false;
      });
    });

    const refresh = (e) => {
      clearError(e.target.id || e.target.name);
      if (!els.rqBanner.hidden && e.type === 'input') els.rqBanner.hidden = true;
      updatePreview();
      updateNoteCount();
    };
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitRequest();
    });

    els.rqBanner.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-show-card]');
      if (btn) focusCard(btn.dataset.showCard);
    });

    els.myRequests.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-retire]');
      if (!btn) return;
      armOrRun(btn, '¿Retirar? Pulsa otra vez', () => {
        const id = btn.dataset.retire;
        state.myRequests = state.myRequests.filter((r) => r.id !== id);
        delete state.commits[id];
        saveRequests();
        saveCommits();
        refreshAll();
        toast('Solicitud retirada del tablón.');
      });
    });

    updatePreview();
    updateNoteCount();
  }

  /* ---------- Compatibilidad ---------- */
  const compat = { component: 'rbc', mode: 'donate', group: 'O-' };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let compatLinks = [];
  let compatRaf = 0;
  let compatVisible = false;

  function canGive(donor, recipient, component) {
    const donorAbo = donor.slice(0, -1);
    const recipientAbo = recipient.slice(0, -1);
    if (component === 'plasma') {
      // El plasma lleva los anticuerpos del donante: solo cuenta el sistema ABO.
      return [...recipientAbo].every((ag) => ag === 'O' || donorAbo.includes(ag));
    }
    const aboOk = [...donorAbo].every((ag) => ag === 'O' || recipientAbo.includes(ag));
    const rhOk = donor.endsWith('-') || recipient.endsWith('+');
    return aboOk && rhOk;
  }

  function compatMatches() {
    const { component, mode, group } = compat;
    return GROUPS.filter((g) => (mode === 'donate' ? canGive(group, g, component) : canGive(g, group, component)));
  }

  function describeCompat(matches) {
    const { component, mode, group } = compat;
    const what = component === 'plasma' ? 'plasma' : 'glóbulos rojos';
    const list = joinList(matches.map((g) => `<strong>${groupLabel(g)}</strong>`));
    let scope;
    if (matches.length === GROUPS.length) scope = 'los 8 grupos';
    else if (matches.length === 1) scope = `un solo grupo: ${list}`;
    else scope = `${matches.length} grupos: ${list}`;
    let text = `<strong>${groupLabel(group)}</strong> puede ${mode === 'donate' ? 'donar' : 'recibir'} ${what} ${mode === 'donate' ? 'a' : 'de'} ${scope}.`;

    if (component === 'rbc') {
      if (mode === 'donate' && group === 'O-') text += ' Es el donante universal: por eso los hospitales lo necesitan siempre en urgencias.';
      if (mode === 'receive' && group === 'AB+') text += ' Es el receptor universal de glóbulos rojos.';
      if (mode === 'receive' && group === 'O-') text += ' Solo puede recibir de su mismo grupo, por eso sus reservas son tan importantes.';
    } else {
      if (mode === 'donate' && group.startsWith('AB')) text += ' AB es el donante universal de plasma.';
      if (mode === 'receive' && group.startsWith('O')) text += ' El grupo O puede recibir plasma de cualquier grupo.';
      text += ' En el plasma solo cuenta el sistema ABO, no el factor Rh.';
    }
    return text;
  }

  function nodeBox(btn) {
    const row = btn.parentElement;
    const top = row.offsetTop + btn.offsetTop;
    return {
      x: row.offsetLeft + btn.offsetLeft + btn.offsetWidth / 2,
      top,
      bottom: top + btn.offsetHeight
    };
  }

  function bezierPoint(L, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [
      a * L.p[0] + b * L.p[2] + c * L.p[4] + d * L.p[6],
      a * L.p[1] + b * L.p[3] + c * L.p[5] + d * L.p[7]
    ];
  }

  function drawCompatLinks(animate) {
    const stage = $('#compatStage');
    const svg = $('#compatLinks');
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.textContent = '';
    compatLinks = [];

    const { mode, group } = compat;
    const pairs = compatMatches().map((g) => (mode === 'donate' ? [group, g] : [g, group]));
    const now = performance.now();

    pairs.forEach(([donor, recipient], i) => {
      const from = nodeBox($(`.bt-node[data-role="donor"][data-g="${donor}"]`));
      const to = nodeBox($(`.bt-node[data-role="recipient"][data-g="${recipient}"]`));
      const x1 = from.x;
      const y1 = from.bottom + 4;
      const x2 = to.x;
      const y2 = to.top - 4;
      const my = (y1 + y2) / 2;
      const p = [x1, y1, x1, my, x2, my, x2, y2];

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'link');
      path.setAttribute('pathLength', '1');
      path.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      const delay = animate ? i * 0.06 : 0;
      if (animate && !reduced()) {
        path.style.setProperty('--delay', `${delay}s`);
      } else {
        path.style.animation = 'none';
        path.style.strokeDasharray = 'none';
      }
      svg.appendChild(path);

      const dots = [];
      if (!reduced()) {
        for (let k = 0; k < 3; k++) {
          const dot = document.createElementNS(SVG_NS, 'circle');
          dot.setAttribute('class', 'particle');
          dot.setAttribute('r', '3.5');
          dot.setAttribute('opacity', '0');
          svg.appendChild(dot);
          dots.push(dot);
        }
      }
      compatLinks.push({ p, dots, born: now + (animate ? (delay + 0.7) * 1000 : 0), seed: i * 0.13 });
    });
    startParticles();
  }

  function particleFrame(now) {
    compatRaf = 0;
    if (!compatVisible || reduced()) return;
    const base = now / 1500;
    compatLinks.forEach((L) => {
      const live = now >= L.born;
      L.dots.forEach((dot, k) => {
        if (!live) {
          dot.setAttribute('opacity', '0');
          return;
        }
        const t = (base + k / L.dots.length + L.seed) % 1;
        const [x, y] = bezierPoint(L, t);
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
        dot.setAttribute('opacity', Math.sin(t * Math.PI).toFixed(2));
      });
    });
    compatRaf = requestAnimationFrame(particleFrame);
  }

  function startParticles() {
    if (compatRaf || !compatVisible || reduced()) return;
    compatRaf = requestAnimationFrame(particleFrame);
  }

  function updateCompat(animate) {
    const root = $('.compat');
    const { component, mode, group } = compat;
    root.classList.toggle('is-plasma', component === 'plasma');
    const matches = compatMatches();
    const nodes = $$('.bt-node');
    nodes.forEach((btn) => btn.classList.remove('is-match'));
    void root.offsetWidth; // reinicia la animación de aparición
    let order = 0;
    nodes.forEach((btn) => {
      const g = btn.dataset.g;
      const isDonorRow = btn.dataset.role === 'donor';
      const selected = g === group && (mode === 'donate') === isDonorRow;
      const inResultRow = mode === 'donate' ? !isDonorRow : isDonorRow;
      const match = inResultRow && matches.includes(g);
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', String(selected));
      btn.classList.toggle('is-match', match);
      btn.classList.toggle('is-dim', !selected && !match);
      if (match) btn.style.setProperty('--delay', `${(0.25 + order++ * 0.06).toFixed(2)}s`);
    });
    $('#compatResult').innerHTML = describeCompat(matches);
    drawCompatLinks(animate);
  }

  function initCompat() {
    const node = (g, role) => `<button class="bt-node" type="button" data-role="${role}" data-g="${g}" aria-pressed="false" aria-label="${role === 'donor' ? 'Donante' : 'Receptor'} ${groupSpoken(g)}">${groupLabel(g)}</button>`;
    $('#compatDonors').innerHTML = GROUPS.map((g) => node(g, 'donor')).join('');
    $('#compatRecipients').innerHTML = GROUPS.map((g) => node(g, 'recipient')).join('');

    const stage = $('#compatStage');
    stage.addEventListener('click', (e) => {
      const btn = e.target.closest('.bt-node');
      if (!btn) return;
      compat.mode = btn.dataset.role === 'donor' ? 'donate' : 'receive';
      compat.group = btn.dataset.g;
      updateCompat(true);
    });
    $$('input[name="compComponent"]').forEach((input) => {
      input.checked = input.value === compat.component;
      input.addEventListener('change', () => {
        compat.component = input.value;
        updateCompat(true);
      });
    });

    if ('ResizeObserver' in window) {
      let lastSize = '';
      new ResizeObserver(() => {
        const size = `${stage.clientWidth}x${stage.clientHeight}`;
        if (size === lastSize) return;
        lastSize = size;
        drawCompatLinks(false);
      }).observe(stage);
    } else {
      window.addEventListener('resize', () => drawCompatLinks(false));
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        compatVisible = entries[0].isIntersecting;
        if (compatVisible) startParticles();
      }).observe(stage);
    } else {
      compatVisible = true;
    }

    updateCompat(false);
  }

  /* ---------- Centrifugadora ---------- */
  function initCentrifuge() {
    const vidas = $('#vidas');
    const btn = $('#spinBtn');
    const status = $('#centriStatus');
    const tube = $('#tube');
    let timer = 0;

    const separate = () => {
      vidas.dataset.state = 'separated';
      btn.removeAttribute('aria-disabled');
      btn.textContent = 'Volver a mezclar';
      status.textContent = 'Componentes separados';
      tube.setAttribute('aria-label', 'Tubo centrifugado: plasma arriba, una fina capa de plaquetas en medio y glóbulos rojos abajo');
    };

    const spin = () => {
      if (vidas.dataset.state !== 'mixed') return;
      if (reduced()) {
        separate();
        return;
      }
      vidas.dataset.state = 'spinning';
      btn.setAttribute('aria-disabled', 'true');
      status.textContent = 'Centrifugando…';
      clearTimeout(timer);
      timer = setTimeout(separate, 2400);
    };

    btn.addEventListener('click', () => {
      const current = vidas.dataset.state;
      if (current === 'spinning') return;
      if (current === 'separated') {
        vidas.dataset.state = 'mixed';
        btn.textContent = 'Centrifugar la bolsa';
        status.textContent = 'Sangre total sin separar';
        tube.setAttribute('aria-label', 'Tubo con sangre total sin centrifugar');
        return;
      }
      spin();
    });

    // La primera vez que se ve la sección, la centrifugadora gira sola.
    if ('IntersectionObserver' in window && !reduced()) {
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        setTimeout(spin, 700);
      }, { threshold: 0.5 });
      io.observe($('#centrifuge'));
    }
  }

  /* ---------- Proceso: la bolsa se llena con el scroll ---------- */
  function initProcess() {
    const steps = $$('#steps .step');
    const liquid = $('#bagLiquid');
    const ml = $('#bagMl');
    const caption = $('#bagCaption');
    const CAPTIONS = ['Recepción', 'Entrevista y chequeo', 'Extracción', 'Bolsa completa'];
    // Geometría de la bolsa en el SVG: interior de y=62 a y=284.
    const EMPTY_Y = 284;
    const TRAVEL = 232;
    let lastFill = -1;
    let pending = false;

    const update = () => {
      pending = false;
      const line = window.innerHeight * 0.55;
      let active = -1;
      const tops = steps.map((s) => s.getBoundingClientRect().top);
      tops.forEach((top, i) => {
        if (top < line) active = i;
      });
      steps.forEach((s, i) => {
        s.classList.toggle('is-active', i === active);
        s.classList.toggle('is-done', i < active);
      });

      // La bolsa solo se llena durante la extracción (paso 3).
      let fill = 0;
      if (active >= 3) fill = 1;
      else if (active === 2) fill = clamp((line - tops[2]) / Math.max(1, tops[3] - tops[2]), 0, 1);

      if (Math.abs(fill - lastFill) > 0.001) {
        lastFill = fill;
        liquid.setAttribute('transform', `translate(0 ${(EMPTY_Y - fill * TRAVEL).toFixed(1)})`);
        ml.textContent = String(Math.round(fill * 450));
      }
      caption.textContent = CAPTIONS[Math.max(0, active)];
    };

    const request = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* ---------- Test: ¿puedo donar? ---------- */
  function initQuiz() {
    const stage = $('#quizStage');
    const bar = $('#quizBar');
    let index = 0;
    let fails = [];

    const focusFirstButton = () => {
      const b = stage.querySelector('button, a');
      if (b) b.focus({ preventScroll: true });
    };

    const render = () => {
      bar.style.transform = `scaleX(${index / QUIZ.length})`;
      if (index >= QUIZ.length) {
        renderResult();
        return;
      }
      const q = QUIZ[index];
      stage.innerHTML = `
        <div class="quiz-q">
          <p class="quiz-count">Pregunta ${index + 1} de ${QUIZ.length}</p>
          <p class="quiz-question" id="quizQ">${q.q}</p>
          ${q.hint ? `<p class="quiz-hint">${q.hint}</p>` : ''}
          <div class="quiz-answers" role="group" aria-labelledby="quizQ">
            <button class="btn btn--secondary" type="button" data-answer="si">Sí</button>
            <button class="btn btn--secondary" type="button" data-answer="no">No</button>
          </div>
        </div>`;
    };

    const renderResult = () => {
      if (!fails.length) {
        stage.innerHTML = `
          <div class="quiz-result">
            <span class="quiz-result-icon is-ok">${icon('check')}</span>
            <h4>Todo indica que puedes donar</h4>
            <p>El día de la donación, el personal sanitario lo confirmará en una entrevista breve. Mientras tanto, busca un centro cerca de ti.</p>
            <div class="quiz-answers">
              <a class="btn btn--primary" href="#solicitudes">Buscar dónde donar</a>
              <button class="btn btn--secondary" type="button" data-restart>Repetir el test</button>
            </div>
          </div>`;
      } else {
        stage.innerHTML = `
          <div class="quiz-result">
            <span class="quiz-result-icon is-no">${icon('info')}</span>
            <h4>Ahora mismo no puedes donar</h4>
            <ul>${fails.map((f) => `<li>${f}</li>`).join('')}</ul>
            <p>Si tienes dudas, consulta con tu centro de transfusión: cada caso se valora de forma individual.</p>
            <div class="quiz-answers">
              <button class="btn btn--secondary" type="button" data-restart>Repetir el test</button>
            </div>
          </div>`;
      }
    };

    stage.addEventListener('click', (e) => {
      const answer = e.target.closest('[data-answer]');
      if (answer) {
        const q = QUIZ[index];
        if (answer.dataset.answer !== q.ok) fails.push(q.fail);
        index += 1;
        render();
        focusFirstButton();
        return;
      }
      if (e.target.closest('[data-restart]')) {
        index = 0;
        fails = [];
        render();
        focusFirstButton();
      }
    });

    render();
  }

  /* ---------- Cabecera, menú, tema y progreso ---------- */
  function scrollToSection(selector) {
    const el = $(selector);
    if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  function initHeader() {
    const header = els.header;
    const hero = $('.hero');

    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver((entries) => {
        header.classList.toggle('is-over-hero', entries[0].isIntersecting);
      }, { rootMargin: `-${Math.round(header.offsetHeight)}px 0px 0px 0px` }).observe(hero);
    } else {
      header.classList.remove('is-over-hero');
    }

    const toggle = $('#menuToggle');
    const setMenu = (open) => {
      header.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      toggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
    };
    toggle.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
    $$('#mainNav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('menu-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (header.classList.contains('menu-open') && !header.contains(e.target)) setMenu(false);
    });
    onMedia(window.matchMedia('(min-width: 1100px)'), (m) => {
      if (m.matches) setMenu(false);
    });

    // Enlace activo según la sección visible
    const sectionToNav = {
      solicitudes: 'solicitudes',
      'que-donar': 'que-donar',
      'tres-vidas': 'que-donar',
      compatibilidad: 'compatibilidad',
      'como-donar': 'como-donar',
      centros: 'centros',
      'mis-citas': 'mis-citas'
    };
    const links = $$('[data-nav]');
    if ('IntersectionObserver' in window) {
      const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const key = sectionToNav[entry.target.id] || '';
          links.forEach((l) => {
            const active = l.dataset.nav === key;
            l.classList.toggle('is-active', active);
            if (active) l.setAttribute('aria-current', 'true');
            else l.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-45% 0px -54% 0px' });
      $$('main > section[id]').forEach((s) => spy.observe(s));
    }

    // Barra de progreso de lectura
    const bar = $('#scrollProgress');
    let pending = false;
    const paint = () => {
      pending = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    window.addEventListener('scroll', () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  function initTheme() {
    const btn = $('#themeToggle');
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const effective = () => root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
    const syncLabel = () => {
      btn.setAttribute('aria-label', effective() === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro');
    };
    btn.addEventListener('click', () => {
      const next = effective() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem(KEYS.theme, next);
      } catch (e) {
        /* sin almacenamiento: el tema dura hasta recargar */
      }
      syncLabel();
    });
    onMedia(systemDark, syncLabel);
    syncLabel();
  }

  /* ---------- Efectos generales ---------- */
  function initReveal() {
    const items = $$('.reveal');
    if (reduced() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    document.documentElement.classList.add('reveal-on');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }

  function initRipple() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn || reduced() || btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.classList.contains('is-fake')) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 800);
    });
  }

  function toast(message, kind = 'ok') {
    if (!els.toasts) return;
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check')}<span></span>`;
    el.querySelector('span').textContent = message;
    els.toasts.appendChild(el);
    while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 380);
    }, kind === 'error' ? 6000 : 4200);
  }

  function initReset() {
    const btn = $('#resetDemo');
    btn.addEventListener('click', () => {
      armOrRun(btn, 'Pulsa otra vez para borrar tus citas y solicitudes', () => {
        [KEYS.requests, KEYS.commits, KEYS.appts, KEYS.myGroup].forEach((key) => store.remove(key));
        loadState();
        state.persistOk = true;
        els.rqForm.reset();
        setRequestDefaults();
        RQ_FIELDS.forEach(clearError);
        els.rqBanner.hidden = true;
        updatePreview();
        updateNoteCount();
        resetFilters();
        refreshAll();
        toast('Datos de la demo restablecidos.');
      });
    });
  }

  function refreshAll() {
    renderBoard();
    renderHero();
    renderTicker();
    renderAppts();
    renderMyRequests();
  }

  /* ---------- Arranque ---------- */
  function safely(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`[Latido] Error al iniciar ${name}:`, err);
    }
  }

  function init() {
    cacheElements();
    loadState();
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    safely('tema', initTheme);
    safely('cabecera', initHeader);
    safely('filtros', initFilters);
    safely('contenido', refreshAll);
    safely('efecto 3D', initTilt);
    safely('reservas', initDialog);
    safely('formulario de centros', initRequestForm);
    safely('citas', initAppointments);
    safely('compatibilidad', initCompat);
    safely('centrifugadora', initCentrifuge);
    safely('proceso', initProcess);
    safely('test', initQuiz);
    safely('revelado', initReveal);
    safely('ondas', initRipple);
    safely('restablecer', initReset);
    safely('contadores', () => {
      $$('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count) || 0, 1600, 1100));
    });

    // Con las fuentes definitivas cambian los anchos medidos del ticker.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => safely('ticker', renderTicker));
    }

    let lastWidth = window.innerWidth;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        renderTicker();
      }, 200);
    });

    // Otra pestaña ha cambiado los datos: se recargan.
    window.addEventListener('storage', (e) => {
      if (e.key && !e.key.startsWith('latido.')) return;
      loadState();
      refreshAll();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
