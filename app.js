/**
 * =============================================================================
 * ORION BY KOLLS — VEHICLE HEALTH APP
 * State, interactions and accessible UI behaviour.
 * =============================================================================
 */

'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

// Sample service estimates are authored in USD and displayed in naira.
const USD_TO_NGN = 1500;

/* -----------------------------------------------------------------------------
   Vehicle data
   -------------------------------------------------------------------------- */

const CARS = {
  suv: {
    name: '2024 Toyota RAV4 Hybrid',
    shortName: 'RAV4 Hybrid',
    baseScore: 87,
    battery: 13.8,
    coolant: 88,
    range: 680,
    fuel: 75,
    tires: [35, 35, 34, 34],
    saved: 2300,
    systems: { engine: 95, cooling: 78, electrical: 92, brakes: 84 },
    cooling: {
      value: 78,
      label: 'Watch',
      description: 'Thermostat responding slowly',
      tone: 'warn'
    },
    summary: 'No urgent faults. The cooling system is due for a check soon.',
    repairs: [
      {
        id: 'thermostat',
        icon: 'fa-temperature-arrow-up',
        title: 'Engine thermostat valve',
        description: 'Opening slightly late. Replacing it now prevents an overheating repair later.',
        severity: 'Service soon',
        chip: 'warn',
        costEarly: 20,
        costLate: 1850,
        earlyNote: 'Thermostat swap',
        lateNote: 'Warped cylinder head',
        savings: 1830,
        affects: 'cooling'
      },
      {
        id: 'brakes',
        icon: 'fa-circle-stop',
        title: 'Front brake pads',
        description: 'About 20% of pad lining remains. Replace before the rotor is damaged.',
        severity: 'Plan ahead',
        chip: 'warn',
        costEarly: 180,
        costLate: 650,
        earlyNote: 'Pad replacement',
        lateNote: 'Rotors + pads',
        savings: 470,
        affects: 'brakes'
      }
    ]
  },

  sedan: {
    name: '2023 Honda Civic 2.0L',
    shortName: 'Civic 2.0L',
    baseScore: 95,
    battery: 14.1,
    coolant: 86,
    range: 540,
    fuel: 62,
    tires: [36, 36, 35, 35],
    saved: 1800,
    systems: { engine: 97, cooling: 94, electrical: 96, brakes: 91 },
    cooling: {
      value: 94,
      label: 'Good',
      description: 'Operating within range',
      tone: 'good'
    },
    summary: 'Two routine items are due, but nothing urgent. All major systems are healthy.',
    repairs: [
      {
        id: 'brakes',
        icon: 'fa-circle-stop',
        title: 'Front brake pads',
        description: 'Pad life is getting low. Replacing pads early keeps the rotors smooth.',
        severity: 'Plan ahead',
        chip: 'warn',
        costEarly: 180,
        costLate: 650,
        earlyNote: 'Pad replacement',
        lateNote: 'Rotors + pads',
        savings: 470,
        affects: 'brakes'
      },
      {
        id: 'cabin-filter',
        icon: 'fa-wind',
        title: 'Cabin air filter',
        description: 'Airflow is reduced. A clean filter improves climate control and air quality.',
        severity: 'Routine',
        chip: 'quiet',
        costEarly: 40,
        costLate: 120,
        earlyNote: 'Filter replacement',
        lateNote: 'Blower strain',
        savings: 80,
        affects: 'electrical'
      }
    ]
  },

  truck: {
    name: '2022 Ford F-150 SuperCrew',
    shortName: 'F-150',
    baseScore: 74,
    battery: 13.5,
    coolant: 92,
    range: 420,
    fuel: 48,
    tires: [38, 38, 37, 37],
    saved: 900,
    systems: { engine: 88, cooling: 71, electrical: 86, brakes: 79 },
    cooling: {
      value: 71,
      label: 'Watch',
      description: 'Thermostat responding slowly',
      tone: 'warn'
    },
    summary: 'Two items need attention. Book service in the next two weeks.',
    repairs: [
      {
        id: 'thermostat',
        icon: 'fa-temperature-arrow-up',
        title: 'Engine thermostat valve',
        description: 'Opening slightly late. Towing makes the cooling system work harder.',
        severity: 'Service soon',
        chip: 'warn',
        costEarly: 20,
        costLate: 1850,
        earlyNote: 'Thermostat swap',
        lateNote: 'Warped cylinder head',
        savings: 1830,
        affects: 'cooling'
      },
      {
        id: 'transmission',
        icon: 'fa-gears',
        title: 'Transmission fluid',
        description: 'Fluid life is low for towing use. A fluid service protects the gearbox.',
        severity: 'Service soon',
        chip: 'warn',
        costEarly: 120,
        costLate: 900,
        earlyNote: 'Fluid service',
        lateNote: 'Gearbox repair',
        savings: 780,
        affects: 'engine'
      }
    ]
  }
};

const DEMO = {
  overheat: {
    score: 64,
    coolant: 112,
    summary: 'High coolant temperature detected. Stop safely, let the engine cool, and check the cooling system.',
    cooling: {
      value: 42,
      label: 'Critical',
      description: 'Coolant above safe temperature',
      tone: 'danger'
    },
    toast: 'Overheat scenario loaded.',
    tone: 'danger'
  },
  battery: {
    score: 72,
    battery: 11.4,
    summary: 'Charging voltage is below the healthy range. Test the battery and alternator before the next long drive.',
    toast: 'Low-voltage scenario loaded.',
    tone: 'warn'
  },
  tire: {
    score: 79,
    tires: [24, 35, 34, 34],
    summary: 'Front-left tire is below the recommended pressure. Inflate to 35 PSI before driving.',
    toast: 'Low tire pressure scenario loaded.',
    tone: 'danger'
  }
};

const PARTS = [
  { name: 'Engine oil', baseKm: 10000, usedKm: 3800 },
  { name: 'Brake pads', baseKm: 25000, usedKm: 19200 },
  { name: 'Tire tread', baseKm: 50000, usedKm: 32000 },
  { name: 'Spark plugs', baseKm: 80000, usedKm: 42000 },
  { name: 'Coolant', baseKm: 60000, usedKm: 20000 }
];

const DRIVE_STYLES = {
  gentle: { wear: 0.85, km: 1.15 },
  city: { wear: 1, km: 1 },
  heavy: { wear: 1.25, km: 0.75 }
};

const STATE = {
  currentTab: 'health',
  drivingStyle: 'gentle',
  currentCar: 'suv',
  score: CARS.suv.baseScore,
  saved: CARS.suv.saved,
  resolved: new Set(),
  demo: null,
  lastScan: new Date(),
  toastTimer: null,
  scanTimer: null,
  lastFocused: null,
  assistantMenuOpen: false,
  trendRange: 30,
  live: null,
  liveStatus: null,
  liveRenderedFresh: false,
  liveVehicleAutoSelected: false
};

/* Illustrative history for the Trends page. */
const TREND_HEALTH_30 = [
  80, 80, 81, 81, 82, 82, 83, 83, 84, 84,
  85, 85, 84, 85, 86, 86, 87, 86, 85, 85,
  84, 84, 85, 84, 85, 86, 86, 85, 86, 87
];
const TREND_FUEL = [7.4, 7.6, 7.2, 7.3, 7.1, 6.9];
const TREND_BATTERY = [
  13.7, 13.8, 13.6, 13.7, 13.8, 13.8, 13.7,
  13.6, 13.7, 13.8, 13.9, 13.8, 13.7, 13.8
];

/* -----------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function money(value) {
  return '\u20A6' + Math.round(Number(value || 0) * USD_TO_NGN).toLocaleString('en-US');
}

function escapeAiHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCar() {
  return CARS[STATE.currentCar];
}

const LIVE_STALE_MS = 9000;

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLiveData() {
  return STATE.live && Date.now() - STATE.live.receivedAt < LIVE_STALE_MS ? STATE.live.data : null;
}

function isLiveFresh() {
  return Boolean(getLiveData());
}

function liveAgeSeconds() {
  if (!STATE.live) return null;
  return Math.max(0, Math.round((Date.now() - STATE.live.receivedAt) / 1000));
}

function liveTone(data) {
  if (!data) return 'quiet';
  if (data.tone === 'danger' || data.tone === 'warn' || data.tone === 'good') return data.tone;
  if (data.severity === 2 || data.tamper || data.obdDetached || data.coolant >= 106 || (data.battery > 0 && data.battery < 11.8)) return 'danger';
  if (data.severity === 1 || data.coolant >= 95 || (data.battery > 0 && data.battery < 12.6) || data.deviceLow) return 'warn';
  return 'good';
}

function liveHealthScore(data) {
  if (!data) return 100;
  return window.OrionLive ? window.OrionLive.healthyScore(data) : 100;
}

function liveEngineScore(data) {
  if (!data) return 100;
  let score = 97;
  if (data.load >= 90) score -= 14;
  else if (data.load >= 80) score -= 8;
  else if (data.load >= 70) score -= 3;
  if (data.rpm >= 4500) score -= 18;
  else if (data.rpm >= 3800) score -= 8;
  else if (data.rpm >= 3200) score -= 3;
  if (data.statusText === 'HIGH ENGINE STRESS' || data.statusText === 'RPM REDLINE') score = Math.min(score, 58);
  return clampValue(Math.round(score), 20, 100);
}

function liveCoolingScore(data) {
  if (!data) return 100;
  if (data.coolant >= 106) return 24;
  if (data.coolant >= 100) return 48;
  if (data.coolant >= 95) return 68;
  if (data.coolant >= 90) return 88;
  return 97;
}

function liveElectricalScore(data) {
  if (!data || !data.battery) return 92;
  if (data.battery < 11.8) return 34;
  if (data.battery < 12.2) return 55;
  if (data.battery < 12.6) return 74;
  if (data.battery < 13.2) return 88;
  return 97;
}

function getOpenRepairs() {
  return getCar().repairs.filter((repair) => !STATE.resolved.has(repair.id));
}

function getDisplayScore() {
  if (STATE.demo) return DEMO[STATE.demo].score;
  const live = getLiveData();
  if (live) return liveHealthScore(live);
  return STATE.score;
}

function healthCopy(score) {
  if (score >= 85) {
    return {
      tone: 'good',
      status: 'Good condition',
      headline: 'Your car is healthy.'
    };
  }
  if (score >= 70) {
    return {
      tone: 'warn',
      status: 'Service advised',
      headline: 'A little attention needed.'
    };
  }
  return {
    tone: 'danger',
    status: 'Service required',
    headline: 'Service required.'
  };
}

function getSummary() {
  if (STATE.demo && DEMO[STATE.demo].summary) return DEMO[STATE.demo].summary;

  const live = getLiveData();
  if (live) {
    if (live.tamper || live.obdDetached) {
      return `The ESP32 reports ${live.statusText}. The OBD feed was interrupted, so check the gateway connection before relying on live readings.`;
    }
    if (live.severity === 2) {
      return `The ESP32 reports ${live.statusText}. Coolant is ${live.coolant.toFixed(1)}°C and system voltage is ${live.battery.toFixed(2)} V. Stop safely and inspect the vehicle.`;
    }
    if (live.severity === 1) {
      return `The ESP32 reports ${live.statusText}. Coolant is ${live.coolant.toFixed(1)}°C and system voltage is ${live.battery.toFixed(2)} V. Plan a check soon.`;
    }
    return `ESP32 live feed: coolant ${live.coolant.toFixed(1)}°C, oil ${live.oil.toFixed(1)}°C and system voltage ${live.battery.toFixed(2)} V. No warning flags in the current packet.`;
  }

  const open = getOpenRepairs();
  if (!open.length) return 'No outstanding maintenance. This vehicle is ready for the road.';

  if (STATE.resolved.size) {
    return open.length === 1
      ? 'One maintenance item is still open. No urgent faults.'
      : `${open.length} maintenance items are still open. No urgent faults.`;
  }

  return getCar().summary;
}

function getCoolingInfo() {
  if (STATE.demo === 'overheat') return DEMO.overheat.cooling;

  const live = getLiveData();
  if (live) {
    const liveCooling = live.systems && Number.isFinite(live.systems.cooling)
      ? live.systems.cooling
      : liveCoolingScore(live);
    if (live.coolant >= 106) {
      return {
        value: liveCooling,
        label: 'Critical',
        description: `ESP32 reports ${live.coolant.toFixed(1)}°C coolant`,
        tone: 'danger'
      };
    }
    if (live.coolant >= 95) {
      return {
        value: liveCooling,
        label: 'Watch',
        description: `ESP32 reports ${live.coolant.toFixed(1)}°C coolant`,
        tone: 'warn'
      };
    }
    return {
      value: liveCooling,
      label: 'Good',
      description: `ESP32 reports ${live.coolant.toFixed(1)}°C coolant`,
      tone: 'good'
    };
  }

  const car = getCar();
  const coolingRepair = car.repairs.find((repair) => repair.affects === 'cooling');

  if (coolingRepair && STATE.resolved.has(coolingRepair.id)) {
    return {
      value: 96,
      label: 'Good',
      description: 'Operating within range',
      tone: 'good'
    };
  }

  return car.cooling;
}

function getSystems() {
  const systems = Object.assign({}, getCar().systems);

  if (STATE.resolved.has('thermostat')) systems.cooling = Math.max(systems.cooling, 96);
  if (STATE.resolved.has('brakes')) systems.brakes = Math.max(systems.brakes, 96);
  if (STATE.resolved.has('transmission')) systems.engine = Math.max(systems.engine, 94);
  if (STATE.resolved.has('cabin-filter')) systems.electrical = Math.max(systems.electrical, 96);

  const live = getLiveData();
  if (live) {
    const liveSystems = live.systems || {};
    systems.engine = Number.isFinite(liveSystems.engine) ? liveSystems.engine : liveEngineScore(live);
    systems.cooling = Number.isFinite(liveSystems.cooling) ? liveSystems.cooling : liveCoolingScore(live);
    systems.electrical = Number.isFinite(liveSystems.electrical) ? liveSystems.electrical : liveElectricalScore(live);
    systems.brakes = Number.isFinite(liveSystems.brakes) ? liveSystems.brakes : systems.brakes;
  }

  return systems;
}

function getBattery() {
  if (STATE.demo && DEMO[STATE.demo].battery !== undefined) return DEMO[STATE.demo].battery;
  const live = getLiveData();
  if (live && live.battery > 0) return live.battery;
  return getCar().battery;
}

function getCoolant() {
  if (STATE.demo && DEMO[STATE.demo].coolant !== undefined) return DEMO[STATE.demo].coolant;
  const live = getLiveData();
  if (live && live.coolant > 0) return live.coolant;
  return getCar().coolant;
}

function getRange() {
  const live = getLiveData();
  if (live && Number.isFinite(live.range)) return live.range;
  return getCar().range;
}

function getFuel() {
  const live = getLiveData();
  if (live && Number.isFinite(live.fuel)) return live.fuel;
  return getCar().fuel;
}

function getTires() {
  const tires = STATE.demo && DEMO[STATE.demo].tires ? DEMO[STATE.demo].tires : getCar().tires;
  return tires.slice();
}

function getWearItems() {
  const style = DRIVE_STYLES[STATE.drivingStyle];

  const items = PARTS.map((part) => {
    const consumed = part.usedKm / part.baseKm;
    const pct = Math.max(5, Math.min(98, Math.round((1 - consumed) * 100 * style.wear)));
    const remainingKm = Math.max(0, Math.round((part.baseKm - part.usedKm) * style.km));
    return {
      name: part.name,
      pct,
      remainingKm,
      tone: pct >= 35 ? 'good' : pct >= 20 ? 'warn' : 'danger'
    };
  });

  if (STATE.resolved.has('brakes')) {
    const brakes = items.find((item) => item.name === 'Brake pads');
    if (brakes) {
      brakes.pct = 100;
      brakes.remainingKm = 25000;
      brakes.tone = 'good';
    }
  }

  return items;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatTrendDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function getTrendDates(count) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return date;
  });
}

function getHealthHistory90() {
  const history = [];

  for (let index = 0; index < 60; index += 1) {
    const value =
      75 +
      index * 0.07 +
      Math.sin(index * 0.55) * 1.2 +
      Math.cos(index * 0.21 + 0.8) * 0.8;
    history.push(Math.max(70, Math.min(80, Math.round(value))));
  }

  return history.concat(TREND_HEALTH_30);
}

function getHealthSeries(range) {
  const values = getHealthHistory90().slice(-range);
  values[values.length - 1] = Math.max(0, Math.min(100, Math.round(getDisplayScore())));
  return values;
}

function niceScale(min, max, targetTicks = 4) {
  const span = Math.max(max - min, 0.0001);
  const roughStep = span / Math.max(1, targetTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2.5 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks = [];

  for (let tick = high; tick >= low - step * 0.0001; tick -= step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return { min: low, max: high, step, ticks };
}

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
}

function setDot(id, tone) {
  const dot = document.getElementById(id);
  if (!dot) return;

  let className = 'status-dot';
  if (tone === 'neutral') className += ' status-dot--neutral';
  if (tone === 'warn') className += ' is-warn';
  if (tone === 'danger') className += ' is-danger';
  dot.className = className;
}

function setVitalTone(valueId, tone) {
  const card = document.getElementById(valueId);
  const icon = card ? card.closest('.vital-card')?.querySelector('.vital-icon') : null;
  if (!icon) return;

  icon.classList.toggle('is-warn', tone === 'warn');
  icon.classList.toggle('is-danger', tone === 'danger');
}

function focusAfterRepair() {
  const nextAction = $('#repairs-list .btn-primary, #repairs-list .btn-secondary');
  if (nextAction) {
    nextAction.focus({ preventScroll: true });
    return;
  }

  const heading = $('.section-head h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/* -----------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */

function renderAll() {
  renderGarage();
  renderHeader();
  renderHealth();
  renderTrends();
  renderRepairs();
  renderWearBars();
  renderLastScan();
}

function renderGarage() {
  $$('.garage-item').forEach((item) => {
    const key = item.dataset.car;
    const car = CARS[key];
    if (!car) return;

    const active = key === STATE.currentCar;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));

    const score = item.querySelector('[data-score-for]');
    if (score) {
      score.textContent = String(key === STATE.currentCar ? getDisplayScore() : car.baseScore);
    }
  });
}

function renderHeader() {
  const car = getCar();
  setText('header-car-name', car.shortName);
  setText('page-car-name', car.name);

  const chip = $('.vehicle-chip');
  if (chip) chip.title = 'Switch vehicle — ' + car.name;
}

function renderHealth() {
  const score = getDisplayScore();
  const copy = healthCopy(score);
  const card = $('.score-card');

  if (card) card.dataset.tone = copy.tone;

  setText('health-score-number', String(score));
  setText('health-status-text', copy.status);
  setText('health-headline', copy.headline);
  setText('health-summary-text', getSummary());

  const ring = $('#ring-value');
  if (ring) ring.style.strokeDashoffset = String(Math.max(0, 100 - score));

  const ringWrap = $('#score-ring');
  if (ringWrap) ringWrap.setAttribute('aria-label', `Health score: ${score} out of 100`);

  const badge = $('#health-status-badge');
  if (badge) {
    badge.className = 'status-pill';
    if (copy.tone === 'warn') badge.classList.add('is-warn');
    if (copy.tone === 'danger') badge.classList.add('is-danger');
  }

  renderVitals();
  renderSystems();
  renderCooling();
  renderTires();
  renderConnection(copy.tone);
  renderAiModel();
  renderLiveDevice();
}

function renderConnection(tone) {
  setDot('vehicle-dot', tone);
  setDot('connection-dot', tone);

  const text = isLiveFresh()
    ? 'ESP32 live feed'
    : tone === 'danger'
      ? 'Attention detected'
      : tone === 'warn'
        ? 'Service advised'
        : 'Vehicle connected';
  setText('connection-text', text);
}

function renderVitals() {
  const battery = getBattery();
  const coolant = getCoolant();
  const range = getRange();
  const fuel = getFuel();
  const live = getLiveData();
  const liveRange = Boolean(live && Number.isFinite(live.range));

  setText('val-battery', `${Number(battery).toFixed(1)} V`);
  setText('val-temp', `${Math.round(coolant)}°C`);
  setText('val-range', `${Number(range).toLocaleString('en-US')} km`);

  let batteryTone = 'good';
  let batteryText = 'Healthy';
  if (battery < 12.0) {
    batteryTone = 'danger';
    batteryText = 'Low voltage';
  } else if (battery < 12.4) {
    batteryTone = 'warn';
    batteryText = 'Check soon';
  }

  let coolantTone = 'good';
  let coolantText = 'Normal';
  if (coolant >= 105) {
    coolantTone = 'danger';
    coolantText = 'Overheating';
  } else if (coolant >= 96) {
    coolantTone = 'warn';
    coolantText = 'Running hot';
  }

  setDot('battery-dot', batteryTone);
  setText('battery-status-text', batteryText);
  setVitalTone('val-battery', batteryTone);

  setDot('temp-dot', coolantTone);
  setText('temp-status-text', coolantText);
  setVitalTone('val-temp', coolantTone);

  setDot('range-dot', 'neutral');
  setText('range-status-text', liveRange ? `${Math.round(fuel)}% · ESP32 live` : isLiveFresh() ? 'Garage estimate' : `${fuel}% tank`);
  setVitalTone('val-range', 'neutral');
}

function renderSystems() {
  const systems = getSystems();
  setText('systems-sub', isLiveFresh() ? 'Live engine telemetry from the ESP32 gateway' : 'Live diagnostics from your vehicle');

  $$('[data-system-value]').forEach((element) => {
    const key = element.dataset.systemValue;
    if (systems[key] !== undefined) element.textContent = `${systems[key]}%`;
  });
}

function renderCooling() {
  const cooling = getCoolingInfo();
  const row = document.getElementById('comp-row-cooling');

  if (row) {
    row.classList.toggle('is-warn', cooling.tone === 'warn');
    row.classList.toggle('is-danger', cooling.tone === 'danger');
  }

  setText('cooling-desc', cooling.description);
  setText('cooling-value', `${cooling.value}%`);
  setText('cooling-status-text', cooling.label);

  const status = document.getElementById('cooling-status');
  if (status) {
    status.className = 'status';
    if (cooling.tone === 'warn') status.classList.add('status--warn');
    else if (cooling.tone === 'danger') status.classList.add('status--danger');
    else status.classList.add('status--good');
  }
}

function renderTires() {
  const tires = getTires();
  const positions = ['fl', 'fr', 'rl', 'rr'];
  let lowCount = 0;
  let dangerCount = 0;

  tires.forEach((psi, index) => {
    const position = positions[index];
    let tone = 'good';
    let stateText = 'Optimal';

    if (psi < 28) {
      tone = 'danger';
      stateText = 'Low';
      lowCount += 1;
      dangerCount += 1;
    } else if (psi < 32) {
      tone = 'warn';
      stateText = 'Soft';
      lowCount += 1;
    }

    setText(`tire-${position}`, String(psi));
    setText(`tire-${position}-state`, stateText);
    setDot(`tire-${position}-dot`, tone);

    const item = document.getElementById(`tire-${position}-item`);
    if (item) {
      item.classList.toggle('is-warn', tone === 'warn');
      item.classList.toggle('is-danger', tone === 'danger');
    }
  });

  setText('tpms-badge-text', lowCount ? `${lowCount} low` : 'All normal');

  const badge = document.getElementById('tpms-badge');
  if (badge) {
    badge.className = 'chip ' + (lowCount ? (dangerCount ? 'chip--danger' : 'chip--warn') : 'chip--good');
  }

  const footnote = document.getElementById('tpms-footnote');
  if (footnote) {
    footnote.innerHTML = isLiveFresh()
      ? '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> TPMS is not on the ESP32 CAN feed; values are a garage estimate.'
      : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> Pressure checked 2 minutes ago';
  }
}

function renderLastScan() {
  if (isLiveFresh()) {
    const age = liveAgeSeconds();
    setText('last-scan', `ESP32 live · ${age}s ago`);
    return;
  }

  const label = STATE.demo ? 'Simulated just now' : `Updated ${formatTime(new Date(STATE.lastScan))}`;
  setText('last-scan', label);
}

function signedNumber(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}`;
}

function setDeviceButtons(enabled) {
  ['device-ping', 'device-reset'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = !enabled;
  });
}

function renderLiveDevice() {
  const card = document.getElementById('device-card');
  const status = window.OrionLive ? window.OrionLive.status() : null;
  const data = status && status.data ? status.data : STATE.live ? STATE.live.data : null;
  const fresh = Boolean(status && status.fresh) || isLiveFresh();
  const gatewayMode = Boolean(status && status.mode === 'gateway');
  const age = status && status.ageMs !== null ? Math.max(0, Math.round(status.ageMs / 1000)) : liveAgeSeconds();
  const liveBadge = document.getElementById('live-badge');
  const liveBadgeText = document.getElementById('live-badge-text');
  const stateChip = document.getElementById('device-state');
  const stateText = document.getElementById('device-state-text');

  const setChip = (tone, text) => {
    if (stateChip) stateChip.className = `chip chip--${tone}`;
    if (stateText) stateText.textContent = text;
  };

  const setBadge = (state, text) => {
    if (liveBadge) liveBadge.className = `live-badge ${state}`;
    if (liveBadgeText) liveBadgeText.textContent = text;
  };

  let tone = 'quiet';
  let chipText = 'Offline';

  if (data) {
    setText('device-rpm', `${Math.round(data.rpm).toLocaleString('en-US')} rpm`);
    setText('device-coolant', data.coolant > 0 ? `${data.coolant.toFixed(1)}°C` : '--');
    setText('device-oil', data.oil > 0 ? `${data.oil.toFixed(1)}°C` : '--');
    setText('device-load', `${Math.round(data.load)}%`);
    setText('device-battery', data.battery > 0 ? `${data.battery.toFixed(2)} V` : '--');
    setText('device-pack', data.deviceV > 0 ? `${data.deviceV.toFixed(2)} V · ${data.devicePct}%` : '--');
    setText(
      'device-trims',
      `STFT ${signedNumber(data.stft)}% · LTFT ${signedNumber(data.ltft)}% · IAT ${data.iat.toFixed(1)}°C · ${data.statusText}`
    );
    setText('device-meta', fresh ? `Updated ${age}s ago · ${data.canFeed} · ${data.statusText}` : `Last packet ${age}s ago · waiting for the next one`);
    setText('device-subtitle', fresh ? `${data.vehicleId} · ${data.canFeed} · firmware ${data.fwVersion}` : `${data.vehicleId} · last packet ${age}s ago`);
    setDeviceButtons(Boolean(status && status.connected));

    if (fresh) {
      tone = liveTone(data);
      chipText = tone === 'danger' ? 'Alert' : tone === 'warn' ? 'Warning' : 'Live';
      setBadge('is-live', 'ESP32 live');
    } else {
      tone = 'warn';
      chipText = 'Stale';
      setBadge('is-connecting', gatewayMode ? 'ESP32 offline' : 'ESP32 waiting');
    }
  } else {
    setText('device-rpm', '--');
    setText('device-coolant', '--');
    setText('device-oil', '--');
    setText('device-load', '--');
    setText('device-battery', '--');
    setText('device-pack', '--');
    setText('device-trims', 'Waiting for the next 2-second telemetry packet.');
    setDeviceButtons(Boolean(status && status.connected));

    if (!status || status.status === 'idle') {
      tone = 'quiet';
      chipText = 'Connecting';
      setBadge('is-demo', 'Demo mode');
      setText('device-subtitle', 'Waiting for the KA-TRUCK-001 gateway.');
      setText('device-meta', 'Direct HTTP · /telemetry');
    } else if (status.status === 'connecting' || status.status === 'reconnecting') {
      tone = 'quiet';
      chipText = 'Connecting';
      setBadge('is-connecting', gatewayMode ? 'Direct connect' : 'Connecting');
      setText('device-subtitle', gatewayMode ? `Connecting directly to ${status.gatewayUrl}.` : `Connecting to ${status.brokerUrl}.`);
      setText('device-meta', gatewayMode ? 'Direct HTTP · /telemetry' : 'HiveMQ · kolls/vehicle/telemetry');
    } else if (gatewayMode && status.connected && !status.gatewayConnected) {
      tone = 'quiet';
      chipText = 'Offline';
      setBadge('is-offline', 'ESP32 offline');
      setText('device-subtitle', status.gatewayError || `No reply from ${status.gatewayUrl}. Check the IP on the TFT NET page.`);
      setText('device-meta', `Direct HTTP · ${status.gatewayUrl}`);
      setDeviceButtons(false);
    } else if (status.connected) {
      tone = 'quiet';
      chipText = 'Waiting';
      setBadge('is-connecting', gatewayMode ? 'Direct · waiting' : 'ESP32 waiting');
      setText('device-subtitle', gatewayMode ? `Connected to ${status.gatewayUrl}. Waiting for telemetry...` : `Connected to HiveMQ. Waiting for ${status.vehicleId} telemetry...`);
      setText('device-meta', gatewayMode ? 'Direct HTTP · /telemetry' : `Live broker · ${status.topic}`);
    } else if (status.status === 'unavailable' || status.status === 'error' || status.status === 'offline') {
      tone = 'quiet';
      chipText = 'Offline';
      setBadge('is-offline', gatewayMode ? 'ESP32 offline' : 'Demo mode');
      setText('device-subtitle', status.error || (gatewayMode ? `No reply from ${status.gatewayUrl}.` : 'The live broker is offline. Showing the demo garage until the ESP32 reconnects.'));
      setText('device-meta', gatewayMode ? `Direct HTTP · ${status.gatewayUrl}` : `HiveMQ · ${status.brokerUrl}`);
      setDeviceButtons(false);
    } else {
      tone = 'quiet';
      chipText = 'Waiting';
      setBadge('is-connecting', gatewayMode ? 'Direct · waiting' : 'ESP32 waiting');
      setText('device-subtitle', `Waiting for ${status.vehicleId || 'KA-TRUCK-001'} telemetry...`);
      setText('device-meta', gatewayMode ? `Direct HTTP · ${status.gatewayUrl}` : `Live broker · ${status.topic}`);
    }
  }

  if (card) {
    card.dataset.state = tone;
    card.setAttribute(
      'aria-label',
      `ESP32 device link: ${chipText}. ${data ? `Coolant ${data.coolant.toFixed(1)} degrees Celsius, battery ${data.battery.toFixed(2)} volts.` : 'No telemetry received yet.'}`
    );
  }

  setChip(tone === 'quiet' ? 'quiet' : tone, chipText);
}

/* -----------------------------------------------------------------------------
   Trends
   -------------------------------------------------------------------------- */

function renderLineChart({
  values,
  dates,
  scale,
  lineId,
  areaId,
  gridId,
  yId,
  xId,
  dotId,
  formatValue,
  ariaTarget,
  ariaLabel
}) {
  if (!values.length) return;

  const valueRange = scale.max - scale.min || 1;
  const points = values.map((value, index) => ({
    x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100,
    y: (1 - (value - scale.min) / valueRange) * 100
  }));
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }

    const previous = points[index - 1];
    const middleX = (previous.x + point.x) / 2;
    return `${path} C${middleX.toFixed(2)},${previous.y.toFixed(2)} ${middleX.toFixed(2)},${point.y.toFixed(2)} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }, '');
  const areaPath = `${linePath} L100,100 L0,100 Z`;

  const line = document.getElementById(lineId);
  const area = document.getElementById(areaId);
  if (line) line.setAttribute('d', linePath);
  if (area) area.setAttribute('d', areaPath);

  const grid = document.getElementById(gridId);
  if (grid) {
    const tickGap = Math.max(1, scale.ticks.length - 1);
    grid.innerHTML = scale.ticks
      .map((tick, index) => {
        const y = (index / tickGap) * 100;
        return `<line x1="0" y1="${y}" x2="100" y2="${y}"></line>`;
      })
      .join('');
  }

  const yAxis = document.getElementById(yId);
  if (yAxis) {
    yAxis.innerHTML = scale.ticks.map((tick) => `<span>${formatValue(tick)}</span>`).join('');
  }

  const xAxis = document.getElementById(xId);
  if (xAxis) {
    const indexes = [...new Set([0, Math.floor((values.length - 1) / 2), values.length - 1])];
    xAxis.innerHTML = indexes
      .map((index) => `<span>${formatTrendDate(dates[index])}</span>`)
      .join('');
  }

  const dot = document.getElementById(dotId);
  if (dot) {
    dot.style.left = `${points[points.length - 1].x}%`;
    dot.style.top = `${points[points.length - 1].y}%`;
  }

  const chart = document.getElementById(ariaTarget);
  if (chart) chart.setAttribute('aria-label', ariaLabel);
}

function renderFuelChart() {
  const bars = document.getElementById('fuel-bars');
  if (!bars) return;

  const lowest = Math.min(...TREND_FUEL) - 0.2;
  const highest = Math.max(...TREND_FUEL) + 0.2;
  const span = highest - lowest || 1;

  bars.innerHTML = TREND_FUEL.map((value, index) => {
    const height = 30 + ((value - lowest) / span) * 65;
    const latest = index === TREND_FUEL.length - 1;
    return `
      <div class="bar-column${latest ? ' is-latest' : ''}" title="Week ${index + 1}: ${value.toFixed(1)} L/100 km">
        <span class="bar-value">${value.toFixed(1)}</span>
        <div class="bar-track"><span class="bar-fill" style="height:${height.toFixed(1)}%"></span></div>
        <span class="bar-label">W${index + 1}</span>
      </div>
    `;
  }).join('');

  const latest = TREND_FUEL[TREND_FUEL.length - 1];
  const average = TREND_FUEL.reduce((total, value) => total + value, 0) / TREND_FUEL.length;
  setText('fuel-latest', `${latest.toFixed(1)} L/100 km`);
  setText('fuel-average', `${average.toFixed(1)} L/100 km`);

  const chart = document.getElementById('fuel-chart');
  if (chart) {
    chart.setAttribute(
      'aria-label',
      `Weekly fuel economy: ${TREND_FUEL.map((value) => value.toFixed(1)).join(', ')} litres per 100 kilometres.`
    );
  }
}

function renderBatteryTrend() {
  const values = TREND_BATTERY.slice();
  values[values.length - 1] = Math.max(12, Math.min(15, Number(getBattery())));
  const dates = getTrendDates(values.length);
  const scale = niceScale(Math.min(...values), Math.max(...values), 4);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const latest = values[values.length - 1];

  renderLineChart({
    values,
    dates,
    scale,
    lineId: 'battery-chart-line',
    areaId: 'battery-chart-area',
    gridId: 'battery-chart-grid',
    yId: 'battery-chart-y',
    xId: 'battery-chart-x',
    dotId: 'battery-chart-dot',
    formatValue: (value) => value.toFixed(1),
    ariaTarget: 'battery-chart',
    ariaLabel: `Battery voltage over the last 14 days. Latest ${latest.toFixed(1)} volts, average ${average.toFixed(1)} volts.`
  });

  setText('battery-latest', latest.toFixed(1));
  setText('battery-average', `${average.toFixed(1)} V`);
}

function renderTrends() {
  const range = [7, 30, 90].includes(STATE.trendRange) ? STATE.trendRange : 30;
  const values = getHealthSeries(range);
  const dates = getTrendDates(range);
  const latest = values[values.length - 1];
  const first = values[0];
  const difference = latest - first;
  const average = Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  const best = Math.max(...values);
  const lowest = Math.min(...values);
  const bestIndex = values.indexOf(best);
  const lowestIndex = values.indexOf(lowest);
  const scale = niceScale(lowest, Math.max(...values), 4);

  setText('trend-current-score', String(latest));
  setText('trend-average', String(average));
  setText('trend-best', String(best));
  setText('trend-stat-average', String(average));
  setText('trend-stat-best', String(best));
  setText('trend-stat-best-label', formatTrendDate(dates[bestIndex]));
  setText('trend-stat-low', String(lowest));
  setText('trend-stat-low-label', formatTrendDate(dates[lowestIndex]));
  setText('trend-stat-change', `${difference > 0 ? '+' : ''}${difference}`);
  setText('health-trend-caption', `Daily overall condition, last ${range} days.`);
  setText('trend-summary-caption', `Last ${range} days at a glance.`);
  setText('trend-note-text', 'No fault codes recorded in this sample period.');

  const change = document.getElementById('trend-stat-change');
  if (change) change.classList.toggle('is-down', difference < 0);

  const delta = document.getElementById('trend-delta');
  if (delta) {
    delta.classList.toggle('is-down', difference < 0);
    const icon = delta.querySelector('i');
    if (icon) {
      icon.className =
        difference < 0
          ? 'fa-solid fa-arrow-trend-down'
          : difference === 0
            ? 'fa-solid fa-minus'
            : 'fa-solid fa-arrow-trend-up';
    }
    const text = delta.querySelector('span');
    if (text) {
      text.textContent = difference === 0 ? 'No change' : `${difference > 0 ? '+' : ''}${difference} pts`;
    }
  }

  const summaryIcon = $('.trend-summary-icon i');
  if (summaryIcon) {
    summaryIcon.className =
      difference < 0 ? 'fa-solid fa-arrow-trend-down' : difference === 0 ? 'fa-solid fa-minus' : 'fa-solid fa-arrow-trend-up';
  }

  renderLineChart({
    values,
    dates,
    scale,
    lineId: 'health-chart-line',
    areaId: 'health-chart-area',
    gridId: 'health-chart-grid',
    yId: 'health-chart-y',
    xId: 'health-chart-x',
    dotId: 'health-chart-dot',
    formatValue: (value) => String(Math.round(value)),
    ariaTarget: 'health-chart',
    ariaLabel: `Health score over the last ${range} days. Latest ${latest} out of 100. Average ${average}, low ${lowest}, high ${best}.`
  });

  renderFuelChart();
  renderBatteryTrend();
}

function setTrendRange(range) {
  const nextRange = Number(range);
  if (![7, 30, 90].includes(nextRange)) return;

  STATE.trendRange = nextRange;
  $$('[data-trend-range]').forEach((button) => {
    const active = Number(button.dataset.trendRange) === nextRange;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderTrends();
}

function repairTemplate(repair) {
  const chipClass = repair.chip === 'quiet' ? 'chip chip--quiet' : 'chip chip--warn';
  return `
    <article class="repair-card" data-repair="${repair.id}">
      <div class="repair-head">
        <div class="repair-icon"><i class="fa-solid ${repair.icon}" aria-hidden="true"></i></div>
        <div class="repair-title">
          <div class="repair-kicker"><span class="${chipClass}">${repair.severity}</span></div>
          <h3>${repair.title}</h3>
          <p>${repair.description}</p>
        </div>
      </div>

      <div class="cost-strip">
        <div class="cost-item">
          <span>Fix now</span>
          <strong>${money(repair.costEarly)}</strong>
          <small>${repair.earlyNote}</small>
        </div>
        <div class="cost-divider" aria-hidden="true"></div>
        <div class="cost-item cost-item--late">
          <span>If ignored</span>
          <strong>${money(repair.costLate)}</strong>
          <small>${repair.lateNote}</small>
        </div>
      </div>

      <div class="repair-foot">
        <span class="savings-line"><i class="fa-solid fa-arrow-trend-down" aria-hidden="true"></i> Saves ${money(repair.savings)}</span>
        <button class="btn btn-primary btn-sm" type="button" onclick="simulateRepair('${repair.id}')">Simulate fix</button>
      </div>
    </article>
  `;
}

function renderRepairs() {
  const open = getOpenRepairs();

  setText('repairs-count', open.length ? `${open.length} open item${open.length === 1 ? '' : 's'}` : 'No open items');
  setText('total-saved-display', money(STATE.saved));

  const list = document.getElementById('repairs-list');
  if (!list) return;

  if (!open.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
        <h3>All caught up</h3>
        <p>No outstanding maintenance for this vehicle. Keep an eye on the part-life estimates and enjoy the drive.</p>
        <button class="btn btn-secondary btn-sm" type="button" onclick="switchTab('health')">Back to health</button>
      </div>
    `;
    return;
  }

  list.innerHTML = open.map(repairTemplate).join('');
}

function renderWearBars() {
  const container = document.getElementById('wear-bars-container');
  if (!container) return;

  container.innerHTML = getWearItems()
    .map((item) => {
      const fillClass = item.tone === 'warn' ? 'bar-fill--warn' : item.tone === 'danger' ? 'bar-fill--danger' : '';
      return `
        <div class="wear-item">
          <div class="wear-top">
            <span class="wear-name">${item.name}</span>
            <strong class="wear-pct">${item.pct}%</strong>
          </div>
          <div class="bar" role="img" aria-label="${item.name}: ${item.pct}% remaining">
            <span class="bar-fill ${fillClass}" style="width:${item.pct}%"></span>
          </div>
          <p class="wear-note">${item.remainingKm.toLocaleString('en-US')} km estimated remaining</p>
        </div>
      `;
    })
    .join('');
}

function renderCertificate() {
  const car = getCar();
  const score = getDisplayScore();
  const copy = healthCopy(score);
  const systems = getSystems();
  const cooling = getCoolingInfo();
  const date = new Date();

  setText('cert-title', car.name);
  setText('cert-score', `${score} / 100`);
  setText('cert-engine', `${systems.engine}% · ${systems.engine >= 80 ? 'Pass' : 'Monitor'}`);
  setText('cert-cooling', `${cooling.value}% · ${cooling.tone === 'danger' ? 'Fail' : cooling.tone === 'warn' ? 'Monitor' : 'Pass'}`);
  setText('cert-electrical', `${systems.electrical}% · ${systems.electrical >= 80 ? 'Pass' : 'Monitor'}`);
  setText('cert-brakes', `${systems.brakes}% · ${systems.brakes >= 80 ? 'Pass' : 'Monitor'}`);
  setText('cert-date', formatDate(date));
  setText('cert-hash', `ORION-${hashText(`${car.name}|${score}|${date.toDateString()}`)}-${date.getFullYear()}`);
  setText('cert-status-text', copy.status);

  const status = document.getElementById('cert-status');
  if (status) {
    status.className = 'status-pill status-pill--light';
    if (copy.tone === 'warn') status.classList.add('is-warn');
    if (copy.tone === 'danger') status.classList.add('is-danger');
  }
}

/* -----------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */

function switchTab(tabId) {
  if (!['health', 'trends', 'repairs', 'assistant'].includes(tabId)) return;

  STATE.currentTab = tabId;

  if (tabId !== 'assistant') closeAssistantMenu(false);

  $$('.page').forEach((page) => {
    page.classList.toggle('active', page.id === `page-${tabId}`);
  });

  $$('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const titles = {
    health: 'Health — Orion',
    trends: 'Trends — Orion',
    repairs: 'Maintenance — Orion',
    assistant: 'Assistant — Orion'
  };
  document.title = titles[tabId];

  window.scrollTo(0, 0);

  const activePage = document.getElementById(`page-${tabId}`);
  const heading = activePage ? activePage.querySelector('h1') : null;
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/* -----------------------------------------------------------------------------
   Health actions
   -------------------------------------------------------------------------- */

function runScan() {
  if (STATE.scanTimer) return;

  const button = document.getElementById('scan-btn');
  if (!button) return;

  button.classList.add('is-scanning');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');

  STATE.scanTimer = window.setTimeout(() => {
    STATE.scanTimer = null;
    STATE.lastScan = new Date();

    button.classList.remove('is-scanning');
    button.disabled = false;
    button.removeAttribute('aria-busy');

    renderLastScan();

    if (window.OrionLive && window.OrionLive.status().mode === 'gateway') {
      window.OrionLive.refresh();
      showToast('Requested a fresh frame from the ESP32 gateway.', 'good');
      return;
    }

    if (isLiveFresh() && window.OrionLive) {
      const sent = window.OrionLive.sendCommand('PING');
      showToast(
        sent ? 'Live packet refreshed. PING sent to the ESP32 gateway.' : 'Live packet refreshed.',
        sent ? 'good' : 'warn'
      );
      return;
    }

    showToast(
      STATE.demo ? 'Scan complete. Simulated readings are still active.' : 'Scan complete. No new fault codes.',
      STATE.demo ? 'warn' : 'good'
    );
  }, 1000);
}

function handleLiveEvent(event) {
  const detail = event.detail || {};
  STATE.liveStatus = detail.state || (window.OrionLive ? window.OrionLive.status() : null);

  if (detail.event === 'telemetry' && detail.data) {
    STATE.live = { data: detail.data, receivedAt: Date.now() };
    STATE.liveRenderedFresh = true;
    ensureLiveVehicle(detail.data);

    if (!STATE.liveVehicleAutoSelected) {
      STATE.liveVehicleAutoSelected = true;
      useLiveVehicle(detail.data, true);
    } else if (STATE.currentCar === 'live') {
      renderHeader();
      renderGarage();
    }

    renderHealth();
    renderLastScan();
    return;
  }

  if (detail.event === 'command-response') {
    showToast('ESP32 replied PONG — the gateway is online.', 'good');
    return;
  }

  if (detail.event === 'command-sent') {
    showToast(`${detail.command || 'Command'} sent to the ESP32 gateway.`, 'good');
    return;
  }

  renderLiveDevice();
}

function initLiveTelemetry() {
  if (!window.OrionLive) {
    renderLiveDevice();
    return;
  }

  window.addEventListener('orion:telemetry', handleLiveEvent);
  window.OrionLive.start();
  renderLiveDevice();

  window.setInterval(() => {
    const status = window.OrionLive.status();
    const fresh = Boolean(status && status.fresh);

    if (STATE.liveRenderedFresh !== fresh) {
      STATE.liveRenderedFresh = fresh;
      renderHealth();
      renderLastScan();
      return;
    }

    if (!fresh) renderLiveDevice();
  }, 2000);
}

function reconnectDevice() {
  if (!window.OrionLive) {
    showToast('The MQTT bridge is unavailable.', 'warn');
    return;
  }

  window.OrionLive.restart();
  renderLiveDevice();
  showToast('Reconnecting to the ESP32 gateway…', 'good');
}

function pingDevice() {
  if (!window.OrionLive || !window.OrionLive.sendCommand('PING')) {
    showToast('The ESP32 is not connected yet.', 'warn');
    return;
  }

  showToast('PING queued for the ESP32 gateway.', 'good');
}

function resetDeviceTamper() {
  if (!window.OrionLive || !window.OrionLive.sendCommand('RESET_TAMPER')) {
    showToast('The ESP32 is not connected yet.', 'warn');
    return;
  }

  showToast('RESET_TAMPER queued for the ESP32 gateway.', 'good');
}

function simulateRepair(id) {
  const car = getCar();
  const repair = car.repairs.find((item) => item.id === id);

  if (!repair || STATE.resolved.has(id)) return;

  STATE.resolved.add(id);
  STATE.saved += repair.savings;

  const allResolved = car.repairs.every((item) => STATE.resolved.has(item.id));
  STATE.score = allResolved ? Math.max(STATE.score + 5, 92) : Math.min(100, STATE.score + 5);

  renderHealth();
  renderTrends();
  renderRepairs();
  renderWearBars();
  focusAfterRepair();

  showToast(`Repair simulated. ${money(repair.savings)} saved.`, 'good');
}

/* -----------------------------------------------------------------------------
   Garage, certificate and demo lab
   -------------------------------------------------------------------------- */

function ensureLiveVehicle(data) {
  if (!data) return null;

  const fallback = CARS.suv;
  const systems = data.systems || {};
  const name = data.name || (data.vehicleId ? `ESP32 ${data.vehicleId}` : 'ESP32 live vehicle');

  if (!CARS.live) {
    CARS.live = Object.assign({}, fallback, {
      name,
      shortName: data.vehicleId || 'ESP32 live',
      baseScore: Number.isFinite(data.score) ? data.score : fallback.baseScore,
      battery: data.battery > 0 ? data.battery : fallback.battery,
      coolant: data.coolant > 0 ? data.coolant : fallback.coolant,
      range: Number.isFinite(data.range) ? data.range : fallback.range,
      fuel: Number.isFinite(data.fuel) ? data.fuel : fallback.fuel,
      tires: fallback.tires.slice(),
      saved: 0,
      systems: {
        engine: Number.isFinite(systems.engine) ? systems.engine : fallback.systems.engine,
        cooling: Number.isFinite(systems.cooling) ? systems.cooling : fallback.systems.cooling,
        electrical: Number.isFinite(systems.electrical) ? systems.electrical : fallback.systems.electrical,
        brakes: Number.isFinite(systems.brakes) ? systems.brakes : fallback.systems.brakes
      },
      cooling: {
        value: Number.isFinite(systems.cooling) ? systems.cooling : fallback.cooling.value,
        label: data.tone === 'danger' ? 'Critical' : data.tone === 'warn' ? 'Watch' : 'Good',
        description: 'Live reading from the ESP32 gateway',
        tone: data.tone === 'danger' ? 'danger' : data.tone === 'warn' ? 'warn' : 'good'
      },
      summary: 'Live telemetry from the ESP32 gateway over direct HTTP.',
      repairs: []
    });
  } else {
    CARS.live.name = name;
    CARS.live.shortName = data.vehicleId || 'ESP32 live';
    CARS.live.baseScore = Number.isFinite(data.score) ? data.score : CARS.live.baseScore;
    CARS.live.battery = data.battery > 0 ? data.battery : CARS.live.battery;
    CARS.live.coolant = data.coolant > 0 ? data.coolant : CARS.live.coolant;
    CARS.live.range = Number.isFinite(data.range) ? data.range : CARS.live.range;
    CARS.live.fuel = Number.isFinite(data.fuel) ? data.fuel : CARS.live.fuel;
    CARS.live.systems = {
      engine: Number.isFinite(systems.engine) ? systems.engine : CARS.live.systems.engine,
      cooling: Number.isFinite(systems.cooling) ? systems.cooling : CARS.live.systems.cooling,
      electrical: Number.isFinite(systems.electrical) ? systems.electrical : CARS.live.systems.electrical,
      brakes: Number.isFinite(systems.brakes) ? systems.brakes : CARS.live.systems.brakes
    };
  }

  const item = document.getElementById('garage-live');
  if (item) {
    item.hidden = false;
    setText('garage-live-name', CARS.live.name);
    setText('garage-live-meta', `${data.vehicleId || 'ESP32'} · direct gateway`);
  }

  return CARS.live;
}

function useLiveVehicle(data, announce) {
  const car = ensureLiveVehicle(data);
  if (!car) return false;

  if (STATE.currentCar === 'live') {
    renderHeader();
    renderGarage();
    return true;
  }

  STATE.currentCar = 'live';
  STATE.demo = null;
  STATE.resolved.clear();
  STATE.score = car.baseScore;
  STATE.saved = 0;
  STATE.lastScan = new Date();

  renderAll();
  if (announce) showToast('ESP32 live — switched to the test vehicle.', 'good');
  return true;
}

function connectEsp32() {
  if (!window.OrionLive) {
    showToast('The live gateway bridge did not load.', 'warn');
    return;
  }

  const status = window.OrionLive.status();

  if (status.fresh && status.data) {
    STATE.liveVehicleAutoSelected = true;
    useLiveVehicle(status.data, true);
    renderHealth();
    return;
  }

  window.OrionLive.start();
  window.OrionLive.refresh();
  renderLiveDevice();

  const url = status.gatewayUrl || window.OrionLive.gatewayUrl();
  showToast(`Direct connecting to ${url}. Check the IP on the gateway TFT.`, 'good');

  window.setTimeout(() => {
    const current = window.OrionLive.status();
    if (current.fresh && current.data) {
      STATE.liveVehicleAutoSelected = true;
      useLiveVehicle(current.data, false);
      showToast('ESP32 live — test vehicle selected.', 'good');
    } else {
      showToast(`No reply from ${url}. Use ?gateway=http://NEW-IP on the app URL.`, 'warn');
    }
  }, 3000);
}

function selectCar(key) {
  if (!CARS[key]) return;

  const car = CARS[key];
  STATE.currentCar = key;
  STATE.demo = null;
  STATE.resolved.clear();
  STATE.score = car.baseScore;
  STATE.saved = car.saved;
  STATE.lastScan = new Date();

  renderAll();
  closeAllModals();
  showToast(`Switched to ${car.name}.`, 'good');
}

function openGarageModal() {
  renderGarage();
  openModal('garage-modal', '.garage-item.active');
}

function openCertModal() {
  renderCertificate();
  openModal('cert-modal', '.modal-close');
}

function openSimModal() {
  openModal('sim-modal', '.demo-option');
}

function triggerTestScenario(name) {
  if (name === 'reset') {
    STATE.demo = null;
    STATE.lastScan = new Date();
    renderAll();
    closeAllModals();
    showToast('Normal readings restored.', 'good');
    return;
  }

  if (!DEMO[name]) return;

  STATE.demo = name;
  STATE.lastScan = new Date();
  renderAll();
  closeAllModals();
  switchTab('health');
  showToast(DEMO[name].toast, DEMO[name].tone);
}

/* -----------------------------------------------------------------------------
   Driving style
   -------------------------------------------------------------------------- */

function setDriverStyle(style) {
  if (!DRIVE_STYLES[style]) return;

  STATE.drivingStyle = style;

  $$('.seg-btn').forEach((button) => {
    const active = button.id === `btn-style-${style}`;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  renderWearBars();
}

/* -----------------------------------------------------------------------------
   Assistant
   -------------------------------------------------------------------------- */

function appendBotMessage(html, meta) {
  const stream = document.getElementById('assistant-chat-stream');
  if (!stream) return;

  const message = document.createElement('div');
  message.className = 'msg msg--bot';
  message.innerHTML = html;

  if (meta) {
    const parts = [];
    if (meta.label) parts.push(meta.label);
    if (Number.isFinite(meta.confidence)) parts.push(`${meta.confidence}% intent match`);
    const showRisk = ['prediction', 'health', 'maintenance', 'cooling', 'brakes', 'battery', 'tires', 'oil', 'cost'].includes(meta.intent);
    if (showRisk && Number.isFinite(meta.risk)) parts.push(`anomaly ${meta.risk}/100`);

    if (parts.length) {
      const metaLine = document.createElement('span');
      metaLine.className = 'msg-meta';
      metaLine.textContent = parts.join(' · ');
      message.appendChild(metaLine);
    }
  }

  stream.appendChild(message);
  stream.scrollTop = stream.scrollHeight;
}

function sendChatMessage(rawText) {
  const stream = document.getElementById('assistant-chat-stream');
  const input = document.getElementById('assistant-input-field');
  const text = String(rawText || '').trim();

  if (!stream || !text) return;

  const userMessage = document.createElement('div');
  userMessage.className = 'msg msg--user';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  userMessage.appendChild(paragraph);
  stream.appendChild(userMessage);
  stream.scrollTop = stream.scrollHeight;

  if (input) input.value = '';

  const typing = document.createElement('div');
  typing.className = 'msg msg--bot typing';
  typing.setAttribute('aria-label', 'Assistant is typing');
  typing.innerHTML = '<span></span><span></span><span></span>';
  stream.appendChild(typing);
  stream.scrollTop = stream.scrollHeight;

  window.setTimeout(() => {
    typing.remove();
    const reply = getBotReply(text);
    appendBotMessage(reply.html, reply);
  }, 650);
}

function askMechanicQuestion(question) {
  sendChatMessage(question);
}

function buildAiContext() {
  const car = getCar();
  const live = getLiveData();

  return {
    vehicle: live ? `${live.vehicleId} · ESP32 live` : car.name,
    dataSource: live ? 'ESP32 live telemetry' : 'garage demo estimates',
    live: live || null,
    score: getDisplayScore(),
    summary: getSummary(),
    coolant: getCoolant(),
    battery: getBattery(),
    tires: getTires(),
    cooling: getCoolingInfo(),
    systems: getSystems(),
    wear: getWearItems(),
    openRepairs: getOpenRepairs(),
    range: live && Number.isFinite(live.range) ? live.range : live ? null : car.range,
    fuel: live && Number.isFinite(live.fuel) ? live.fuel : live ? null : car.fuel,
    history: getHealthSeries(30),
    drivingStyle: STATE.drivingStyle,
    money
  };
}

function renderAiModel() {
  const card = document.getElementById('ai-model-card');
  if (!card) return null;

  if (!window.OrionAI) {
    setText('ai-risk-score', '--');
    setText('ai-risk-label', 'Model loading');
    setText('ai-risk-summary', 'The local inference engine is not ready yet.');
    setText('ai-cluster', '--');
    setText('ai-confidence', '--');
    setText('ai-samples', '--');
    setText('ai-forecast', '--');
    setText('chat-model-summary', 'Model loading…');
    return null;
  }

  const analysis = window.OrionAI.analyze(buildAiContext());
  const chipTone = analysis.tone === 'danger' ? 'danger' : analysis.tone === 'warn' ? 'warn' : 'good';

  card.dataset.tone = analysis.tone;
  setText('ai-risk-score', String(analysis.risk));
  setText('ai-risk-label', analysis.status === 'Anomaly' ? 'Outlier detected' : analysis.status === 'Watch' ? 'Drift detected' : 'Within learned envelope');
  setText('ai-risk-summary', analysis.summary);
  setText('ai-cluster', analysis.cluster);
  setText('ai-confidence', `${analysis.confidence}%`);
  setText('ai-samples', `${analysis.samples} readings`);
  setText('ai-forecast', analysis.forecast.label);
  setText('chat-model-summary', `Risk ${analysis.risk}/100 · ${analysis.cluster}`);

  const stateChip = document.getElementById('ai-model-state');
  if (stateChip) {
    stateChip.className = `chip chip--${chipTone}`;
    stateChip.textContent = analysis.status;
  }

  const meter = document.getElementById('ai-risk-meter');
  if (meter) meter.style.width = `${analysis.risk}%`;

  const meterWrap = document.getElementById('ai-meter');
  if (meterWrap) {
    meterWrap.setAttribute('aria-label', `Anomaly risk: ${analysis.risk} out of 100. ${analysis.summary}`);
  }

  const signals = document.getElementById('ai-signals');
  if (signals) {
    const topSignals = analysis.contributors.filter((signal) => signal.magnitude > 0.12).slice(0, 3);
    signals.innerHTML = topSignals.length
      ? topSignals
          .map(
            (signal) => `
              <div class="ai-signal" title="${escapeAiHtml(signal.direction)}">
                <span class="ai-signal-name"><span class="ai-signal-dot"></span>${escapeAiHtml(signal.label)}</span>
                <strong>${escapeAiHtml(signal.value)}</strong>
              </div>
            `
          )
          .join('')
      : `
          <div class="ai-signal">
            <span class="ai-signal-name"><span class="ai-signal-dot"></span>No material outliers</span>
            <strong>Normal</strong>
          </div>
        `;
  }

  return analysis;
}

function explainAiModel() {
  if (!window.OrionAI) {
    showToast('The local AI engine is still loading.', 'warn');
    return;
  }

  const context = buildAiContext();
  const analysis = window.OrionAI.analyze(context);
  switchTab('assistant');
  closeAssistantMenu(false);

  window.setTimeout(() => {
    appendBotMessage(window.OrionAI.explain(context), {
      label: 'Model explanation',
      intent: 'prediction',
      risk: analysis.risk
    });
  }, 160);
}

function getBotReply(rawText) {
  if (window.OrionAI) {
    return window.OrionAI.respond(rawText, buildAiContext());
  }

  return {
    html: '<strong>The local AI engine is still loading.</strong> Refresh the page and try again.',
    intent: 'unknown',
    label: 'Offline',
    confidence: 0,
    risk: null
  };
}

/* -----------------------------------------------------------------------------
   Assistant tools menu
   -------------------------------------------------------------------------- */

function setAssistantMenu(open, moveFocus) {
  const layout = document.getElementById('assistant-layout');
  const toggle = document.getElementById('assistant-menu-toggle');
  if (!layout || !toggle) return;

  STATE.assistantMenuOpen = Boolean(open);
  layout.classList.toggle('is-menu-open', STATE.assistantMenuOpen);
  toggle.setAttribute('aria-expanded', String(STATE.assistantMenuOpen));

  if (!STATE.assistantMenuOpen && moveFocus) {
    toggle.focus({ preventScroll: true });
  }
}

function toggleAssistantMenu() {
  setAssistantMenu(!STATE.assistantMenuOpen, false);
}

function closeAssistantMenu(moveFocus) {
  if (!STATE.assistantMenuOpen) return;
  setAssistantMenu(false, moveFocus);
}

function openAssistantTool(tool) {
  if (STATE.assistantMenuOpen) {
    const toggle = document.getElementById('assistant-menu-toggle');
    setAssistantMenu(false, false);
    if (toggle) toggle.focus({ preventScroll: true });
  }

  if (tool === 'certificate') openCertModal();
  else if (tool === 'garage') openGarageModal();
  else if (tool === 'demo') openSimModal();
}

/* -----------------------------------------------------------------------------
   Modals and toast
   -------------------------------------------------------------------------- */

function openModal(id, focusSelector) {
  const overlay = document.getElementById(id);
  if (!overlay) return;

  STATE.lastFocused = document.activeElement;

  const modal = overlay.querySelector('.modal');
  if (modal) modal.setAttribute('tabindex', '-1');

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  window.setTimeout(() => {
    const target = focusSelector
      ? overlay.querySelector(focusSelector)
      : overlay.querySelector('button, [href], input, [tabindex]');
    if (target) target.focus();
    else if (modal) modal.focus();
  }, 60);
}

function closeModal(overlay) {
  if (!overlay || !overlay.classList.contains('open')) return;

  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');

  if (!document.querySelector('.modal-overlay.open')) {
    document.body.classList.remove('modal-open');
  }

  if (STATE.lastFocused && typeof STATE.lastFocused.focus === 'function') {
    STATE.lastFocused.focus({ preventScroll: true });
  }
  STATE.lastFocused = null;
}

function closeAllModals() {
  $$('.modal-overlay.open').forEach((overlay) => closeModal(overlay));
}

function handleModalKeydown(event) {
  const open = document.querySelector('.modal-overlay.open');

  if (event.key === 'Escape') {
    if (open) {
      event.preventDefault();
      closeModal(open);
      return;
    }
    if (STATE.assistantMenuOpen) {
      event.preventDefault();
      closeAssistantMenu(true);
    }
    return;
  }

  if (!open) return;

  if (event.key !== 'Tab') return;

  const focusables = $$(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    open
  ).filter((element) => element.offsetParent !== null);

  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function showToast(message, tone) {
  const toast = document.getElementById('toast-message');
  const text = document.getElementById('toast-text');
  const icon = document.getElementById('toast-icon');

  if (!toast || !text || !icon) return;

  text.textContent = message;
  toast.classList.remove('is-warn', 'is-danger');

  if (tone === 'danger') {
    toast.classList.add('is-danger');
    icon.className = 'fa-solid fa-triangle-exclamation';
  } else if (tone === 'warn') {
    toast.classList.add('is-warn');
    icon.className = 'fa-solid fa-circle-exclamation';
  } else {
    icon.className = 'fa-solid fa-check';
  }

  toast.classList.add('show');

  if (STATE.toastTimer) window.clearTimeout(STATE.toastTimer);
  STATE.toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
    STATE.toastTimer = null;
  }, 3400);
}

/* -----------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */

function init() {
  const car = getCar();
  STATE.score = car.baseScore;
  STATE.saved = car.saved;
  STATE.lastScan = new Date();

  $$('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  $$('[data-trend-range]').forEach((button) => {
    button.addEventListener('click', () => setTrendRange(button.dataset.trendRange));
  });

  const form = document.getElementById('assistant-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('assistant-input-field');
      if (input) sendChatMessage(input.value);
    });
  }

  $$('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) closeModal(overlay);
    });
  });

  $$('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const overlay = button.closest('.modal-overlay');
      if (overlay) closeModal(overlay);
    });
  });

  document.addEventListener('keydown', handleModalKeydown);

  document.addEventListener('click', (event) => {
    if (!STATE.assistantMenuOpen) return;

    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest('#assistant-menu-toggle') || target.closest('#assistant-side-panel'))
    ) {
      return;
    }

    closeAssistantMenu(false);
  });

  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const handleDesktopChange = (event) => {
    if (event.matches) closeAssistantMenu(false);
  };
  if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', handleDesktopChange);
  else if (desktopQuery.addListener) desktopQuery.addListener(handleDesktopChange);

  renderAll();
  initLiveTelemetry();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Inline handlers in the markup call these functions. */
window.switchTab = switchTab;
window.runScan = runScan;
window.simulateRepair = simulateRepair;
window.selectCar = selectCar;
window.openGarageModal = openGarageModal;
window.connectEsp32 = connectEsp32;
window.openCertModal = openCertModal;
window.openSimModal = openSimModal;
window.triggerTestScenario = triggerTestScenario;
window.setDriverStyle = setDriverStyle;
window.askMechanicQuestion = askMechanicQuestion;
window.toggleAssistantMenu = toggleAssistantMenu;
window.openAssistantTool = openAssistantTool;
window.setTrendRange = setTrendRange;
window.reconnectDevice = reconnectDevice;
window.pingDevice = pingDevice;
window.resetDeviceTamper = resetDeviceTamper;
