/**
 * =============================================================================
 * ORION FLEET BY KOLLS — MULTI-VEHICLE OPERATIONS PORTAL
 * A local-first fleet demo with live-style telemetry, tracking, service and
 * alert workflows. Sample records live in this file; added vehicles persist in
 * localStorage so the experience survives a refresh.
 * =============================================================================
 */

'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const STORAGE_KEYS = {
  vehicles: 'kollsFleetCustomVehiclesV1',
  acknowledged: 'kollsFleetAcknowledgedAlertsV1'
};

/* -----------------------------------------------------------------------------
   Sample fleet
   -------------------------------------------------------------------------- */

const BASE_VEHICLES = [
  {
    id: 'v-rav4',
    make: 'Toyota',
    model: 'RAV4 Hybrid',
    year: 2024,
    type: 'SUV',
    plate: 'LAG-482-KJ',
    vin: 'JTMB3RFV70J123456',
    driver: 'Tunde Adebayo',
    branch: 'Lekki',
    status: 'active',
    health: 87,
    battery: 13.8,
    fuel: 75,
    odometer: 12480,
    speed: 48,
    coolant: 88,
    lastSeen: '2 min ago',
    location: 'Lekki Phase 1',
    x: 69,
    y: 64,
    energy: 'Hybrid',
    serviceItem: 'Cooling system check',
    serviceDays: 6,
    serviceCost: 45000,
    trend: [80, 81, 83, 82, 84, 85, 86, 86, 87, 87],
    addedAt: 0
  },
  {
    id: 'v-civic',
    make: 'Honda',
    model: 'Civic 2.0L',
    year: 2023,
    type: 'Sedan',
    plate: 'KJA-219-YT',
    vin: '2HGFE2F59PH123987',
    driver: 'Chiamaka Eze',
    branch: 'Yaba',
    status: 'active',
    health: 95,
    battery: 14.1,
    fuel: 62,
    odometer: 22410,
    speed: 56,
    coolant: 86,
    lastSeen: '1 min ago',
    location: 'Herbert Macaulay Way',
    x: 37,
    y: 52,
    energy: 'Petrol',
    serviceItem: 'Front brake pads',
    serviceDays: 12,
    serviceCost: 85000,
    trend: [92, 93, 92, 94, 94, 95, 95, 94, 95, 95],
    addedAt: 0
  },
  {
    id: 'v-f150',
    make: 'Ford',
    model: 'F-150 SuperCrew',
    year: 2022,
    type: 'Pickup',
    plate: 'APP-704-RS',
    vin: '1FTFW1E85NFA20418',
    driver: 'Musa Bello',
    branch: 'Apapa',
    status: 'service',
    health: 74,
    battery: 13.5,
    fuel: 48,
    odometer: 48920,
    speed: 0,
    coolant: 92,
    lastSeen: '18 min ago',
    location: 'Apapa workshop',
    x: 18,
    y: 86,
    energy: 'Diesel',
    serviceItem: 'Transmission fluid service',
    serviceDays: 1,
    serviceCost: 120000,
    trend: [79, 78, 77, 77, 76, 75, 75, 74, 74, 74],
    addedAt: 0
  },
  {
    id: 'v-sprinter',
    make: 'Mercedes-Benz',
    model: 'Sprinter 315',
    year: 2021,
    type: 'Van',
    plate: 'IKE-893-BC',
    vin: 'W1Y4ECHY4MT123456',
    driver: 'Ifeanyi Obi',
    branch: 'Ikeja',
    status: 'active',
    health: 82,
    battery: 13.7,
    fuel: 71,
    odometer: 63780,
    speed: 42,
    coolant: 84,
    lastSeen: '3 min ago',
    location: 'Oba Akran Avenue',
    x: 22,
    y: 20,
    energy: 'Diesel',
    serviceItem: 'Tyre rotation',
    serviceDays: 9,
    serviceCost: 30000,
    trend: [84, 84, 83, 83, 82, 83, 82, 82, 82, 82],
    addedAt: 0
  },
  {
    id: 'v-ioniq',
    make: 'Hyundai',
    model: 'Ioniq 5',
    year: 2024,
    type: 'EV',
    plate: 'VIC-551-EV',
    vin: 'KM8KRDAF5PU123456',
    driver: 'Zainab Yusuf',
    branch: 'Victoria Island',
    status: 'idle',
    health: 91,
    battery: 13.9,
    fuel: 68,
    odometer: 8960,
    speed: 0,
    coolant: 31,
    lastSeen: '12 min ago',
    location: 'Eko Atlantic depot',
    x: 57,
    y: 82,
    energy: 'Electric',
    serviceItem: 'Tyre pressure calibration',
    serviceDays: 18,
    serviceCost: 15000,
    trend: [88, 89, 89, 90, 90, 91, 91, 90, 91, 91],
    addedAt: 0
  },
  {
    id: 'v-npr',
    make: 'Isuzu',
    model: 'NPR 75',
    year: 2020,
    type: 'Truck',
    plate: 'APP-118-LG',
    vin: 'JAANPR75LL7100118',
    driver: 'Sani Ibrahim',
    branch: 'Apapa',
    status: 'alert',
    health: 61,
    battery: 12.9,
    fuel: 35,
    odometer: 118460,
    speed: 0,
    coolant: 112,
    lastSeen: '4 min ago',
    location: 'Apapa Port gate',
    x: 12,
    y: 74,
    energy: 'Diesel',
    serviceItem: 'Coolant system repair',
    serviceDays: -1,
    serviceCost: 185000,
    trend: [72, 71, 69, 68, 67, 65, 64, 63, 62, 61],
    addedAt: 0
  },
  {
    id: 'v-3008',
    make: 'Peugeot',
    model: '3008 GT',
    year: 2023,
    type: 'SUV',
    plate: 'GBG-660-PG',
    vin: 'VF3MRHNWPNS123456',
    driver: 'Damilola Okafor',
    branch: 'Gbagada',
    status: 'active',
    health: 89,
    battery: 13.8,
    fuel: 81,
    odometer: 18720,
    speed: 51,
    coolant: 87,
    lastSeen: '1 min ago',
    location: 'Gbagada expressway',
    x: 48,
    y: 31,
    energy: 'Petrol',
    serviceItem: 'Oil and filter change',
    serviceDays: 22,
    serviceCost: 65000,
    trend: [86, 87, 87, 88, 88, 89, 89, 88, 89, 89],
    addedAt: 0
  },
  {
    id: 'v-model3',
    make: 'Tesla',
    model: 'Model 3 Long Range',
    year: 2024,
    type: 'EV',
    plate: 'IKY-304-TS',
    vin: '5YJ3E1EA7PF123456',
    driver: 'Ada Nwosu',
    branch: 'Ikoyi',
    status: 'active',
    health: 96,
    battery: 14.2,
    fuel: 72,
    odometer: 7410,
    speed: 64,
    coolant: 29,
    lastSeen: 'Just now',
    location: 'Bourdillon Road',
    x: 64,
    y: 72,
    energy: 'Electric',
    serviceItem: 'Tyre rotation',
    serviceDays: 28,
    serviceCost: 12000,
    trend: [94, 95, 95, 96, 96, 95, 96, 96, 96, 96],
    addedAt: 0
  },
  {
    id: 'v-hiace',
    make: 'Toyota',
    model: 'Hiace 15-seat',
    year: 2019,
    type: 'Bus',
    plate: 'OSH-782-HC',
    vin: 'JTFSK22P3K0123456',
    driver: 'Unassigned',
    branch: 'Oshodi',
    status: 'service',
    health: 69,
    battery: 13.2,
    fuel: 27,
    odometer: 76500,
    speed: 0,
    coolant: 91,
    lastSeen: '1 hr ago',
    location: 'Oshodi depot',
    x: 26,
    y: 35,
    energy: 'Petrol',
    serviceItem: 'Overdue inspection',
    serviceDays: -5,
    serviceCost: 65000,
    trend: [76, 75, 74, 73, 72, 71, 70, 70, 69, 69],
    addedAt: 0
  },
  {
    id: 'v-sorento',
    make: 'Kia',
    model: 'Sorento',
    year: 2022,
    type: 'SUV',
    plate: 'SUR-509-KA',
    vin: '5XYRKDLF5NG123456',
    driver: 'Kelechi Anyanwu',
    branch: 'Surulere',
    status: 'active',
    health: 84,
    battery: 13.6,
    fuel: 58,
    odometer: 34890,
    speed: 39,
    coolant: 89,
    lastSeen: '2 min ago',
    location: 'Western Avenue',
    x: 29,
    y: 66,
    energy: 'Petrol',
    serviceItem: 'Air filter replacement',
    serviceDays: 15,
    serviceCost: 25000,
    trend: [82, 82, 83, 83, 84, 84, 83, 84, 84, 84],
    addedAt: 0
  }
];

const BASE_ALERTS = [
  {
    id: 'alt-npr-coolant',
    vehicleId: 'v-npr',
    severity: 'critical',
    icon: 'fa-temperature-high',
    title: 'Coolant temperature above limit',
    detail: '112°C recorded for 42 seconds. Stop the vehicle safely and inspect the cooling system.',
    time: '4 min ago',
    sort: 4
  },
  {
    id: 'alt-f150-transmission',
    vehicleId: 'v-f150',
    severity: 'warning',
    icon: 'fa-gears',
    title: 'Transmission fluid life low',
    detail: 'Fluid life is at 18%. Schedule a service before the next heavy-load trip.',
    time: '26 min ago',
    sort: 26
  },
  {
    id: 'alt-rav4-thermostat',
    vehicleId: 'v-rav4',
    severity: 'warning',
    icon: 'fa-temperature-arrow-up',
    title: 'Thermostat response is slow',
    detail: 'Warm-up time is 24% longer than this vehicle baseline. Book a cooling check.',
    time: '1 hr ago',
    sort: 60
  },
  {
    id: 'alt-hiace-service',
    vehicleId: 'v-hiace',
    severity: 'warning',
    icon: 'fa-calendar-xmark',
    title: 'Scheduled service is overdue',
    detail: 'The inspection is 5 days overdue and the vehicle is still marked in service.',
    time: '2 hr ago',
    sort: 120
  },
  {
    id: 'alt-sprinter-tyre',
    vehicleId: 'v-sprinter',
    severity: 'info',
    icon: 'fa-circle-check',
    title: 'Tyre pressure corrected',
    detail: 'Front-left tyre returned to 36 PSI after inflation. No further action needed.',
    time: '3 hr ago',
    sort: 180
  },
  {
    id: 'alt-ioniq-charge',
    vehicleId: 'v-ioniq',
    severity: 'info',
    icon: 'fa-bolt',
    title: 'Charging session complete',
    detail: 'Battery reached 68% during the off-peak charging window.',
    time: '5 hr ago',
    sort: 300
  }
];

const MAP_PLACES = [
  { name: 'Ikeja', x: 21, y: 16 },
  { name: 'Oshodi', x: 30, y: 29 },
  { name: 'Gbagada', x: 47, y: 25 },
  { name: 'Yaba', x: 26, y: 45 },
  { name: 'Surulere', x: 24, y: 61 },
  { name: 'Apapa', x: 9, y: 79 },
  { name: 'Ikoyi', x: 65, y: 69 },
  { name: 'Victoria Island', x: 52, y: 88 },
  { name: 'Lekki', x: 77, y: 55 }
];

const ACTIVITY = [
  { label: 'Mon', trips: 31 },
  { label: 'Tue', trips: 36 },
  { label: 'Wed', trips: 29 },
  { label: 'Thu', trips: 42 },
  { label: 'Fri', trips: 38 },
  { label: 'Sat', trips: 37 },
  { label: 'Sun', trips: 35 }
];

const BRANCH_COORDS = {
  'Lekki': { x: 71, y: 60 },
  'Victoria Island': { x: 56, y: 80 },
  'Ikoyi': { x: 64, y: 70 },
  'Ikeja': { x: 22, y: 21 },
  'Yaba': { x: 36, y: 50 },
  'Gbagada': { x: 47, y: 31 },
  'Apapa': { x: 15, y: 82 },
  'Surulere': { x: 29, y: 63 },
  'Oshodi': { x: 27, y: 34 }
};

const STATUS_META = {
  active: { label: 'Moving', className: 'active' },
  idle: { label: 'Idle', className: 'idle' },
  service: { label: 'Service', className: 'service' },
  alert: { label: 'Attention', className: 'alert' }
};

const STATE = {
  vehicles: [],
  customVehicles: [],
  acknowledged: new Set(),
  page: 'overview',
  search: '',
  status: 'all',
  brand: 'all',
  sort: 'attention',
  alertFilter: 'all',
  trackFilter: 'all',
  selectedVehicleId: null,
  lastFocused: null,
  toastTimer: null
};

/* -----------------------------------------------------------------------------
   Formatting helpers
   -------------------------------------------------------------------------- */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function money(value) {
  return '\u20A6' + Number(value || 0).toLocaleString('en-US');
}

function number(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function titleCase(value) {
  return String(value || '').trim().replace(/\w\S*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));
}

function normalizePlate(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function initials(value) {
  const words = String(value || 'Unassigned').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'UN';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function brandInitials(make) {
  const words = String(make || '').trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return '--';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function shortModel(model) {
  const value = String(model || '').trim();
  const first = value.split(/\s+/)[0];
  return first.length >= 3 ? first.slice(0, 11) : value.slice(0, 11);
}

function healthTone(health) {
  if (health >= 80) return 'good';
  if (health >= 70) return 'warn';
  return 'danger';
}

function healthLabel(health) {
  if (health >= 90) return 'Excellent condition';
  if (health >= 80) return 'Good condition';
  if (health >= 70) return 'Monitor closely';
  return 'Needs attention';
}

function statusChip(status, extraClass = '') {
  const meta = STATUS_META[status] || STATUS_META.idle;
  return `<span class="fleet-status fleet-status--${meta.className} ${extraClass}"><span class="status-dot" aria-hidden="true"></span>${meta.label}</span>`;
}

function getVehicle(id) {
  return STATE.vehicles.find((vehicle) => vehicle.id === id);
}

function vehicleName(vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function serviceDate(vehicle) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Number(vehicle.serviceDays || 0));
  return date;
}

function serviceDateParts(vehicle) {
  const date = serviceDate(vehicle);
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date),
    full: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  };
}

function serviceLabel(days) {
  const value = Number(days);
  if (value < 0) return `Overdue by ${Math.abs(value)} ${Math.abs(value) === 1 ? 'day' : 'days'}`;
  if (value === 0) return 'Due today';
  if (value === 1) return 'Due tomorrow';
  return `Due in ${value} days`;
}

function serviceTone(days) {
  if (days < 0) return 'is-overdue';
  if (days <= 7) return 'is-soon';
  return 'is-planned';
}

/* -----------------------------------------------------------------------------
   Persistence
   -------------------------------------------------------------------------- */

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* The demo still works for this session if storage is unavailable. */
  }
}

function loadCustomVehicles() {
  const stored = readStorage(STORAGE_KEYS.vehicles, []);
  return Array.isArray(stored) ? stored.filter((vehicle) => vehicle && vehicle.id && vehicle.make && vehicle.model) : [];
}

function loadAcknowledged() {
  const stored = readStorage(STORAGE_KEYS.acknowledged, []);
  return Array.isArray(stored) ? stored : [];
}

function refreshVehicles() {
  STATE.vehicles = BASE_VEHICLES.concat(STATE.customVehicles);
  if (STATE.selectedVehicleId && !getVehicle(STATE.selectedVehicleId)) {
    STATE.selectedVehicleId = null;
  }
}

function saveCustomVehicles() {
  writeStorage(STORAGE_KEYS.vehicles, STATE.customVehicles);
}

function saveAcknowledged() {
  writeStorage(STORAGE_KEYS.acknowledged, Array.from(STATE.acknowledged));
}

/* -----------------------------------------------------------------------------
   Derived data
   -------------------------------------------------------------------------- */

function getAlerts() {
  return BASE_ALERTS
    .filter((alert) => !STATE.acknowledged.has(alert.id))
    .sort((a, b) => a.sort - b.sort);
}

function getVehicleAlerts(vehicleId) {
  return BASE_ALERTS
    .filter((alert) => alert.vehicleId === vehicleId && !STATE.acknowledged.has(alert.id))
    .sort((a, b) => a.sort - b.sort);
}

function getBrands() {
  return Array.from(new Set(STATE.vehicles.map((vehicle) => vehicle.make))).sort((a, b) => a.localeCompare(b));
}

function getAttentionCount() {
  return STATE.vehicles.filter((vehicle) => vehicle.status === 'alert' || vehicle.status === 'service' || vehicle.health < 75).length;
}

function getVisibleVehicles() {
  const query = STATE.search.trim().toLowerCase();

  return STATE.vehicles
    .filter((vehicle) => {
      if (STATE.status !== 'all' && vehicle.status !== STATE.status) return false;
      if (STATE.brand !== 'all' && vehicle.make !== STATE.brand) return false;
      if (!query) return true;

      return [
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.plate,
        vehicle.driver,
        vehicle.branch,
        vehicle.vin,
        vehicle.type
      ].join(' ').toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (STATE.sort === 'name') {
        return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      }
      if (STATE.sort === 'recent') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      if (STATE.sort === 'health') {
        return a.health - b.health;
      }
      const statusWeight = { alert: 0, service: 1, idle: 2, active: 3 };
      const difference = (statusWeight[a.status] ?? 4) - (statusWeight[b.status] ?? 4);
      return difference || a.health - b.health;
    });
}

/* -----------------------------------------------------------------------------
   Rendering — shared pieces
   -------------------------------------------------------------------------- */

const leafletMaps = {};
const leafletMarkers = {};
const orionLiveMarkers = {};

function getVehicleLatLng(vehicle) {
  if (vehicle.lat && vehicle.lng) return [vehicle.lat, vehicle.lng];
  const defaults = {
    'v-rav4': [6.4474, 3.4705],
    'v-civic': [6.5165, 3.3765],
    'v-f150': [6.4485, 3.3642],
    'v-sprinter': [6.6018, 3.3515],
    'v-ioniq': [6.4215, 3.4110],
    'v-npr': [6.4420, 3.3600],
    'v-3008': [6.5562, 3.3885],
    'v-model3': [6.4523, 3.4354],
    'v-hiace': [6.5541, 3.3520],
    'v-sorento': [6.4975, 3.3585]
  };
  return defaults[vehicle.id] || [6.5244, 3.3792];
}

function renderMap(containerId, vehicles, variant) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (typeof L === 'undefined') {
    container.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--muted);font-size:12px;">Connecting to map network...</div>';
    return;
  }

  let map = leafletMaps[containerId];
  if (!map) {
    container.innerHTML = '';
    map = L.map(containerId, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: variant === 'tracking'
    }).setView([6.50, 3.39], variant === 'overview' ? 11 : 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    leafletMaps[containerId] = map;
    leafletMarkers[containerId] = [];

    setTimeout(() => map.invalidateSize(), 300);
  }

  // Clear existing markers
  if (leafletMarkers[containerId]) {
    leafletMarkers[containerId].forEach(m => m.remove());
    leafletMarkers[containerId] = [];
  }

  // Add vehicle markers with real coordinates
  vehicles.forEach((vehicle) => {
    const latlng = getVehicleLatLng(vehicle);
    const meta = STATUS_META[vehicle.status] || STATUS_META.idle;
    const isSelected = vehicle.id === STATE.selectedVehicleId;

    const iconHtml = `
      <div class="map-pin map-pin--${meta.className}${isSelected ? ' is-selected' : ''}" style="position:relative;left:0;top:0;transform:none;" role="button">
        <i class="fa-solid fa-car-side" aria-hidden="true"></i>
        <span class="map-pin-label" style="opacity:1;">${escapeHtml(shortModel(vehicle.model))}</span>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'leaflet-fleet-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker(latlng, { icon: customIcon }).addTo(map);

    const popupContent = `
      <div style="font-family:inherit;font-size:12px;line-height:1.45;color:#111;">
        <strong style="font-size:13px;display:block;margin-bottom:2px;">${escapeHtml(vehicleName(vehicle))}</strong>
        <span style="color:#555;">${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.branch)}</span><br>
        <span>Status: <strong style="text-transform:capitalize;">${meta.label}</strong></span><br>
        <span>Health score: <strong>${vehicle.health}/100</strong></span><br>
        <span>Speed: <strong>${vehicle.speed} km/h</strong></span><br>
        <button style="margin-top:6px;padding:4px 10px;background:#0d6efd;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:11px;" onclick="openVehicle('${escapeHtml(vehicle.id)}')">View details</button>
      </div>
    `;
    marker.bindPopup(popupContent);
    leafletMarkers[containerId].push(marker);
  });

  const live = window.OrionLive ? window.OrionLive.status() : null;
  if (live && live.data) updateLiveMapPin(live.data.location);
}

function renderBadges() {
  const alertCount = getAlerts().length;
  ['nav-alert-count', 'bell-alert-count', 'mobile-alert-count'].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = String(alertCount);
    element.hidden = alertCount === 0;
  });

  const vehicleCount = STATE.vehicles.length;
  ['nav-vehicle-count', 'tracking-list-count'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(vehicleCount);
  });

  const context = document.getElementById('context-vehicle-count');
  if (context) context.textContent = `${vehicleCount} ${vehicleCount === 1 ? 'vehicle' : 'vehicles'}`;
}

function renderKPIs() {
  const total = STATE.vehicles.length;
  const active = STATE.vehicles.filter((vehicle) => vehicle.status === 'active').length;
  const attention = getAttentionCount();
  const average = total ? Math.round(STATE.vehicles.reduce((sum, vehicle) => sum + vehicle.health, 0) / total) : 0;
  const brands = getBrands().length;

  const totalElement = document.getElementById('kpi-total');
  if (totalElement) totalElement.textContent = String(total);
  const totalMeta = document.getElementById('kpi-total-meta');
  if (totalMeta) totalMeta.textContent = `across ${brands} ${brands === 1 ? 'brand' : 'brands'}`;

  const activeElement = document.getElementById('kpi-active');
  if (activeElement) activeElement.textContent = String(active);
  const activeDetail = document.getElementById('kpi-active-detail');
  if (activeDetail) activeDetail.textContent = `${total ? Math.round((active / total) * 100) : 0}% of fleet`;

  const attentionElement = document.getElementById('kpi-attention');
  if (attentionElement) attentionElement.textContent = String(attention);
  const attentionDetail = document.getElementById('kpi-attention-detail');
  if (attentionDetail) attentionDetail.textContent = `${STATE.vehicles.filter((vehicle) => vehicle.status === 'service' || vehicle.serviceDays < 0).length} need service`;

  const healthElement = document.getElementById('kpi-health');
  if (healthElement) healthElement.textContent = String(average);

  const donutValue = document.getElementById('fleet-donut-value');
  if (donutValue) donutValue.textContent = String(average);

  const chip = document.getElementById('fleet-health-chip');
  if (chip) {
    const tone = average >= 80 ? 'good' : average >= 70 ? 'warn' : 'danger';
    const label = average >= 80 ? 'Healthy' : average >= 70 ? 'Watch' : 'Critical';
    chip.className = `chip chip--${tone}`;
    chip.textContent = label;
  }

  const good = STATE.vehicles.filter((vehicle) => vehicle.health >= 80).length;
  const watch = STATE.vehicles.filter((vehicle) => vehicle.health >= 70 && vehicle.health < 80).length;
  const critical = STATE.vehicles.filter((vehicle) => vehicle.health < 70).length;

  ['legend-good', 'legend-watch', 'legend-critical'].forEach((id, index) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String([good, watch, critical][index]);
  });

  const donut = document.getElementById('fleet-health-donut');
  if (donut) {
    const goodEnd = total ? (good / total) * 100 : 0;
    const watchEnd = total ? ((good + watch) / total) * 100 : 0;
    donut.style.background = total
      ? `conic-gradient(var(--accent) 0 ${goodEnd}%, var(--warn-bright) ${goodEnd}% ${watchEnd}%, var(--danger-bright) ${watchEnd}% 100%)`
      : 'var(--surface-3)';
    donut.setAttribute('aria-label', `Fleet health: ${average} average score. ${good} healthy, ${watch} on watch, ${critical} critical.`);
  }

  const brandChips = document.getElementById('fleet-brand-chips');
  if (brandChips) {
    const brandsList = getBrands();
    const shown = brandsList.slice(0, 6);
    const more = brandsList.length - shown.length;
    brandChips.innerHTML = shown.map((brand) => `<span class="fleet-brand-chip">${escapeHtml(brand)}</span>`).join('')
      + (more > 0 ? `<span class="fleet-brand-chip">+${more} more</span>` : '');
  }

  const mapMoving = document.getElementById('map-moving-count');
  if (mapMoving) mapMoving.textContent = String(active);

  const overviewDate = document.getElementById('overview-date');
  if (overviewDate) {
    overviewDate.textContent = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date());
  }
}

function renderBrandFilter() {
  const select = document.getElementById('brand-filter');
  if (!select) return;

  const brands = getBrands();
  if (STATE.brand !== 'all' && !brands.includes(STATE.brand)) {
    STATE.brand = 'all';
  }

  select.innerHTML = '<option value="all">All brands</option>'
    + brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('');
  select.value = STATE.brand;
}

/* -----------------------------------------------------------------------------
   Rendering — overview
   -------------------------------------------------------------------------- */

function renderOverview() {
  renderKPIs();

  const activeVehicles = STATE.vehicles.filter((vehicle) => vehicle.status === 'active').slice(0, 6);
  renderMap('overview-map', activeVehicles.length ? activeVehicles : STATE.vehicles.slice(0, 6), 'overview');

  const alertList = document.getElementById('overview-alert-list');
  if (alertList) {
    const alerts = getAlerts().slice(0, 4);
    alertList.innerHTML = alerts.length
      ? alerts.map((alert) => {
        const vehicle = getVehicle(alert.vehicleId);
        return `
          <button class="fleet-mini-alert" type="button" onclick="openVehicle('${escapeHtml(alert.vehicleId)}')">
            <span class="fleet-mini-alert-icon fleet-mini-alert-icon--${alert.severity}"><i class="fa-solid ${alert.icon}" aria-hidden="true"></i></span>
            <span class="fleet-mini-alert-copy">
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(vehicle ? vehicleName(vehicle) : 'Unknown vehicle')}</span>
            </span>
            <span class="fleet-mini-alert-time">${escapeHtml(alert.time)}</span>
          </button>
        `;
      }).join('')
      : '<p class="fleet-mini-empty">No open alerts. The fleet is clear.</p>';
  }

  const tbody = document.getElementById('overview-vehicle-rows');
  if (tbody) {
    const vehicles = [...STATE.vehicles]
      .sort((a, b) => {
        const statusWeight = { alert: 0, service: 1, idle: 2, active: 3 };
        return (statusWeight[a.status] ?? 4) - (statusWeight[b.status] ?? 4) || a.health - b.health;
      })
      .slice(0, 5);

    tbody.innerHTML = vehicles.map((vehicle) => {
      const tone = healthTone(vehicle.health);
      return `
        <tr>
          <td>
            <div class="fleet-table-vehicle">
              <span class="fleet-brand-mark fleet-brand-mark--sm">${escapeHtml(brandInitials(vehicle.make))}</span>
              <span class="fleet-table-vehicle-copy">
                <strong>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</strong>
                <span>${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.type)}</span>
              </span>
            </div>
          </td>
          <td>${statusChip(vehicle.status)}</td>
          <td class="fleet-col-driver"><span class="fleet-driver">${escapeHtml(vehicle.driver || 'Unassigned')}</span></td>
          <td class="fleet-col-location"><span class="fleet-location">${escapeHtml(vehicle.branch)}</span></td>
          <td>
            <span class="fleet-health-cell">
              <strong>${vehicle.health}</strong>
              <span class="fleet-health-bar"><span class="${tone === 'good' ? '' : `is-${tone}`}" style="width:${vehicle.health}%"></span></span>
            </span>
          </td>
          <td><button class="fleet-row-open" type="button" onclick="openVehicle('${escapeHtml(vehicle.id)}')" aria-label="Open ${escapeHtml(vehicleName(vehicle))}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></td>
        </tr>
      `;
    }).join('');
  }

  const activityChart = document.getElementById('fleet-activity-chart');
  if (activityChart) {
    const max = Math.max(...ACTIVITY.map((day) => day.trips), 1);
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1;

    activityChart.innerHTML = ACTIVITY.map((day, index) => `
      <div class="fleet-activity-day">
        <div class="fleet-activity-track">
          <span class="fleet-activity-fill${index === todayIndex ? ' is-today' : ''}" style="height:${Math.max(8, (day.trips / max) * 100)}%"></span>
        </div>
        <span>${escapeHtml(day.label)}</span>
      </div>
    `).join('');

    activityChart.setAttribute('aria-label', `Trips this week: ${ACTIVITY.map((day) => `${day.label} ${day.trips}`).join(', ')}.`);
  }
}

/* -----------------------------------------------------------------------------
   Rendering — vehicle inventory
   -------------------------------------------------------------------------- */

function renderVehicles() {
  const grid = document.getElementById('vehicle-grid');
  const empty = document.getElementById('vehicle-empty');
  if (!grid) return;

  const vehicles = getVisibleVehicles();
  const total = STATE.vehicles.length;
  const hasFilters = Boolean(STATE.search.trim()) || STATE.status !== 'all' || STATE.brand !== 'all' || STATE.sort !== 'attention';

  const resultCount = document.getElementById('vehicle-result-count');
  if (resultCount) {
    resultCount.textContent = vehicles.length === total
      ? `Showing all ${total} ${total === 1 ? 'vehicle' : 'vehicles'}`
      : `Showing ${vehicles.length} of ${total} vehicles`;
  }

  const count = document.getElementById('vehicles-count');
  if (count) count.textContent = `${total} ${total === 1 ? 'vehicle' : 'vehicles'}`;

  const clear = document.getElementById('clear-filters');
  if (clear) clear.hidden = !hasFilters;

  grid.innerHTML = vehicles.map((vehicle) => {
    const tone = healthTone(vehicle.health);
    const energyLabel = vehicle.energy === 'Electric' ? 'Charge' : 'Fuel';
    return `
      <article class="vehicle-card" data-vehicle-id="${escapeHtml(vehicle.id)}">
        <div class="vehicle-card-top">
          <span class="fleet-brand-mark">${escapeHtml(brandInitials(vehicle.make))}</span>
          <div class="vehicle-card-identity">
            <h3>${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</h3>
            <p>${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.type)}</p>
          </div>
          <span class="vehicle-card-status">${statusChip(vehicle.status)}</span>
        </div>

        <div class="vehicle-card-health">
          <div class="vehicle-card-health-label"><span>Health score</span><strong>${vehicle.health}/100</strong></div>
          <div class="vehicle-card-health-bar">
            <span class="${tone === 'good' ? '' : `is-${tone}`}" style="width:${vehicle.health}%"></span>
          </div>
        </div>

        <dl class="vehicle-card-meta">
          <div><dt>Driver</dt><dd>${escapeHtml(vehicle.driver || 'Unassigned')}</dd></div>
          <div><dt>Branch</dt><dd>${escapeHtml(vehicle.branch)}</dd></div>
          <div><dt>Odometer</dt><dd>${number(vehicle.odometer)} km</dd></div>
          <div><dt>${energyLabel}</dt><dd>${number(vehicle.fuel)}%</dd></div>
        </dl>

        <div class="vehicle-card-foot">
          <span class="vehicle-card-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${escapeHtml(vehicle.branch)} · ${escapeHtml(vehicle.lastSeen)}</span></span>
          <button class="vehicle-card-open" type="button" onclick="openVehicle('${escapeHtml(vehicle.id)}')">View <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </div>
      </article>
    `;
  }).join('');

  grid.hidden = vehicles.length === 0;
  if (empty) empty.hidden = vehicles.length !== 0;
}

/* -----------------------------------------------------------------------------
   Rendering — tracking
   -------------------------------------------------------------------------- */

function renderTracking() {
  const filtered = STATE.vehicles.filter((vehicle) => {
    if (STATE.trackFilter === 'all') return true;
    if (STATE.trackFilter === 'service') return vehicle.status === 'service' || vehicle.status === 'alert';
    return vehicle.status === STATE.trackFilter;
  });

  renderMap('tracking-map', filtered, 'tracking');

  const visible = document.getElementById('tracking-visible-count');
  if (visible) visible.textContent = String(filtered.length);

  const list = document.getElementById('tracking-list');
  if (list) {
    list.innerHTML = filtered.length
      ? filtered.map((vehicle) => `
        <button class="fleet-tracking-vehicle" type="button" onclick="openVehicle('${escapeHtml(vehicle.id)}')">
          <span class="fleet-brand-mark fleet-brand-mark--sm">${escapeHtml(brandInitials(vehicle.make))}</span>
          <span class="fleet-tracking-copy">
            <strong>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</strong>
            <span>${escapeHtml(vehicle.location)} · ${escapeHtml(vehicle.lastSeen)}</span>
          </span>
          <span class="fleet-tracking-health">
            <strong>${vehicle.health}</strong>
            <span>health</span>
          </span>
        </button>
      `).join('')
      : '<p class="fleet-mini-empty">No vehicles in this view.</p>';
  }

  const listCount = document.getElementById('tracking-list-count');
  if (listCount) listCount.textContent = String(filtered.length);
}

/* -----------------------------------------------------------------------------
   Rendering — maintenance
   -------------------------------------------------------------------------- */

function renderMaintenance() {
  const queue = STATE.vehicles
    .filter((vehicle) => Number.isFinite(Number(vehicle.serviceDays)))
    .sort((a, b) => Number(a.serviceDays) - Number(b.serviceDays));

  const due = queue.filter((vehicle) => Number(vehicle.serviceDays) >= 0 && Number(vehicle.serviceDays) <= 7).length;
  const overdue = queue.filter((vehicle) => Number(vehicle.serviceDays) < 0).length;
  const estimate = queue.reduce((sum, vehicle) => sum + Number(vehicle.serviceCost || 0), 0);

  const dueElement = document.getElementById('service-due-count');
  if (dueElement) dueElement.textContent = String(due);
  const overdueElement = document.getElementById('service-overdue-count');
  if (overdueElement) overdueElement.textContent = String(overdue);
  const estimateElement = document.getElementById('service-estimate-total');
  if (estimateElement) estimateElement.textContent = money(estimate);

  const list = document.getElementById('maintenance-list');
  if (!list) return;

  const queueCount = document.getElementById('service-queue-count');
  if (queueCount) queueCount.textContent = `${queue.length} ${queue.length === 1 ? 'item' : 'items'}`;

  list.innerHTML = queue.length
    ? queue.map((vehicle) => {
      const date = serviceDateParts(vehicle);
      const overdueClass = Number(vehicle.serviceDays) < 0 ? ' is-overdue' : '';
      return `
        <div class="fleet-service-row">
          <div class="fleet-service-date${overdueClass}">
            <strong>${escapeHtml(date.day)}</strong>
            <small>${escapeHtml(date.month)}</small>
          </div>
          <div class="fleet-service-copy">
            <strong>${escapeHtml(vehicle.serviceItem)}</strong>
            <span>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} · ${escapeHtml(vehicle.plate)}</span>
          </div>
          <div class="fleet-service-cost"><span>Estimate</span><strong>${money(vehicle.serviceCost)}</strong></div>
          <div class="fleet-service-actions">
            <span class="fleet-service-due ${serviceTone(vehicle.serviceDays)}">${escapeHtml(serviceLabel(vehicle.serviceDays))}</span>
            <button class="btn btn-secondary btn-sm" type="button" onclick="openVehicle('${escapeHtml(vehicle.id)}')">View</button>
          </div>
        </div>
      `;
    }).join('')
    : '<p class="fleet-mini-empty">No service items are scheduled.</p>';
}

/* -----------------------------------------------------------------------------
   Rendering — alerts
   -------------------------------------------------------------------------- */

function renderAlerts() {
  const allAlerts = getAlerts();
  const alerts = STATE.alertFilter === 'all'
    ? allAlerts
    : allAlerts.filter((alert) => alert.severity === STATE.alertFilter);

  const count = document.getElementById('open-alert-count');
  if (count) count.textContent = `${allAlerts.length} open ${allAlerts.length === 1 ? 'alert' : 'alerts'}`;

  const list = document.getElementById('alert-list');
  const empty = document.getElementById('alert-empty');

  if (list) {
    list.innerHTML = alerts.map((alert) => {
      const vehicle = getVehicle(alert.vehicleId);
      return `
        <article class="fleet-alert-card fleet-alert-card--${alert.severity}">
          <span class="fleet-alert-icon fleet-alert-icon--${alert.severity}"><i class="fa-solid ${alert.icon}" aria-hidden="true"></i></span>
          <div class="fleet-alert-main">
            <div class="fleet-alert-heading">
              <strong>${escapeHtml(alert.title)}</strong>
              <span class="fleet-severity fleet-severity--${alert.severity}">${escapeHtml(alert.severity)}</span>
            </div>
            <p>${escapeHtml(alert.detail)}</p>
            <div class="fleet-alert-meta">
              <span><i class="fa-solid fa-car-side" aria-hidden="true"></i> ${escapeHtml(vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown vehicle')}</span>
              <span><i class="fa-solid fa-clock" aria-hidden="true"></i> ${escapeHtml(alert.time)}</span>
              <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(vehicle ? vehicle.branch : '—')}</span>
            </div>
          </div>
          <div class="fleet-alert-actions">
            <button class="btn btn-secondary btn-sm" type="button" onclick="openVehicle('${escapeHtml(alert.vehicleId)}')">View</button>
            <button class="fleet-review-btn" type="button" onclick="dismissAlert('${escapeHtml(alert.id)}')">Dismiss</button>
          </div>
        </article>
      `;
    }).join('');
  }

  if (list) list.hidden = alerts.length === 0;
  if (empty) empty.hidden = alerts.length !== 0;
}

/* -----------------------------------------------------------------------------
   Vehicle drawer
   -------------------------------------------------------------------------- */

function sparkline(values) {
  const data = values.length ? values : [80];
  const width = 320;
  const height = 58;
  const padding = 4;
  const min = Math.min(...data) - 3;
  const max = Math.max(...data) + 3;
  const spread = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / spread) * (height - padding * 2);
    return { x, y };
  });

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width - padding},${height} L${padding},${height} Z`;
  const last = points[points.length - 1];

  return `
    <svg class="fleet-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Health trend over the last ${data.length} days">
      <path class="fleet-sparkline-area" d="${area}"></path>
      <path class="fleet-sparkline-line" d="${line}"></path>
      <circle class="fleet-sparkline-dot" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.2"></circle>
    </svg>
  `;
}

function renderVehicleDrawer(vehicle) {
  const body = document.getElementById('vehicle-drawer-body');
  if (!body) return;

  const alerts = getVehicleAlerts(vehicle.id);
  const date = serviceDateParts(vehicle);
  const energyLabel = vehicle.energy === 'Electric' ? 'Charge' : 'Fuel';
  const tone = healthTone(vehicle.health);

  body.innerHTML = `
    <div class="fleet-drawer-identity">
      <span class="fleet-brand-mark">${escapeHtml(brandInitials(vehicle.make))}</span>
      <div class="fleet-drawer-identity-copy">
        <p class="eyebrow">${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)}</p>
        <h2 id="drawer-vehicle-name">${escapeHtml(vehicle.model)}</h2>
        <p>${escapeHtml(vehicle.plate)}<span aria-hidden="true">·</span>${escapeHtml(vehicle.type)}<span aria-hidden="true">·</span>${escapeHtml(vehicle.branch)}</p>
      </div>
    </div>

    <div class="fleet-drawer-statusline">
      ${statusChip(vehicle.status)}
      <span class="fleet-drawer-lastseen"><i class="fa-solid fa-clock" aria-hidden="true"></i> ${escapeHtml(vehicle.lastSeen)}</span>
      <span class="fleet-drawer-lastseen"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(vehicle.location)}</span>
    </div>

    <div class="fleet-drawer-overview">
      <div class="fleet-drawer-score" style="--score:${vehicle.health}">
        <span class="fleet-drawer-score-inner"><strong>${vehicle.health}</strong><small>/ 100</small></span>
      </div>
      <div class="fleet-drawer-overview-copy">
        <span>Overall health</span>
        <strong>${healthLabel(vehicle.health)}</strong>
        <p>${alerts.length ? `${alerts.length} open ${alerts.length === 1 ? 'alert' : 'alerts'} on this vehicle.` : 'No open alerts. All monitored systems are within range.'}</p>
      </div>
    </div>

    <div class="fleet-drawer-metrics">
      <div class="fleet-drawer-metric"><span>Driver</span><strong>${escapeHtml(vehicle.driver || 'Unassigned')}</strong></div>
      <div class="fleet-drawer-metric"><span>Odometer</span><strong>${number(vehicle.odometer)} km</strong></div>
      <div class="fleet-drawer-metric"><span>${energyLabel}</span><strong>${number(vehicle.fuel)}%</strong></div>
      <div class="fleet-drawer-metric"><span>Next service</span><strong>${escapeHtml(date.full)}</strong></div>
    </div>

    <section class="fleet-drawer-section">
      <div class="fleet-drawer-section-head">
        <h3>Live data</h3>
        <span>${vehicle.status === 'active' ? 'Streaming' : 'Last sample'}</span>
      </div>
      <div class="fleet-drawer-telemetry">
        <div><span>Speed</span><strong>${number(vehicle.speed)} km/h</strong></div>
        <div><span>Battery</span><strong>${Number(vehicle.battery).toFixed(1)} V</strong></div>
        <div><span>Coolant</span><strong>${number(vehicle.coolant)}°C</strong></div>
      </div>
    </section>

    <section class="fleet-drawer-section">
      <div class="fleet-drawer-section-head">
        <h3>Health trend</h3>
        <span>Last 10 days</span>
      </div>
      ${sparkline(vehicle.trend)}
    </section>

    <section class="fleet-drawer-section">
      <div class="fleet-drawer-section-head">
        <h3>Service plan</h3>
        <span class="${serviceTone(vehicle.serviceDays)}">${escapeHtml(serviceLabel(vehicle.serviceDays))}</span>
      </div>
      <div class="fleet-drawer-service">
        <div class="fleet-drawer-service-top">
          <strong>${escapeHtml(vehicle.serviceItem)}</strong>
          <span class="fleet-service-due ${serviceTone(vehicle.serviceDays)}">${escapeHtml(date.full)}</span>
        </div>
        <p>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} · ${escapeHtml(vehicle.plate)}</p>
        <div class="fleet-drawer-service-cost"><span>Estimated workshop cost</span><strong>${money(vehicle.serviceCost)}</strong></div>
      </div>
    </section>

    <section class="fleet-drawer-section">
      <div class="fleet-drawer-section-head">
        <h3>Open alerts</h3>
        <span>${alerts.length} ${alerts.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div class="fleet-drawer-alerts">
        ${alerts.length ? alerts.map((alert) => `
          <div class="fleet-drawer-alert fleet-drawer-alert--${alert.severity}">
            <i class="fa-solid ${alert.icon}" aria-hidden="true"></i>
            <span><strong>${escapeHtml(alert.title)}.</strong> ${escapeHtml(alert.detail)}</span>
          </div>
        `).join('') : '<div class="fleet-drawer-empty">No open alerts. This vehicle is running clean.</div>'}
      </div>
    </section>

    <div class="fleet-drawer-actions">
      <button class="btn btn-primary" type="button" onclick="runDiagnostic('${escapeHtml(vehicle.id)}')"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> Run diagnostic</button>
      <button class="btn btn-secondary" type="button" onclick="scheduleService('${escapeHtml(vehicle.id)}')"><i class="fa-solid fa-calendar-plus" aria-hidden="true"></i> Schedule service</button>
    </div>
  `;
}

/* -----------------------------------------------------------------------------
   Overlays and focus management
   -------------------------------------------------------------------------- */

function openOverlay(element) {
  if (!element) return;
  STATE.lastFocused = document.activeElement;
  element.classList.add('open');
  element.setAttribute('aria-hidden', 'false');
  document.body.classList.add('fleet-overlay-open');

  const focusable = element.querySelector('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])');
  if (focusable) {
    window.setTimeout(() => focusable.focus(), 40);
  }
}

function closeOverlay(element) {
  if (!element) return;
  element.classList.remove('open');
  element.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('fleet-overlay-open');

  if (STATE.lastFocused && typeof STATE.lastFocused.focus === 'function') {
    STATE.lastFocused.focus();
  }
  STATE.lastFocused = null;
}

function closeDrawer() {
  closeOverlay(document.getElementById('vehicle-drawer-overlay'));
  STATE.selectedVehicleId = null;
}

function openVehicle(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  STATE.selectedVehicleId = id;
  renderVehicleDrawer(vehicle);
  openOverlay(document.getElementById('vehicle-drawer-overlay'));
}

function openAddVehicleModal() {
  const modal = document.getElementById('add-vehicle-modal');
  const error = document.getElementById('add-vehicle-error');
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
  openOverlay(modal);
}

function openImportModal() {
  const modal = document.getElementById('import-vehicles-modal');
  const error = document.getElementById('import-vehicles-error');
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
  openOverlay(modal);
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const overlay = $('.fleet-drawer-overlay.open, .modal-overlay.open');
  if (!overlay) return;

  const focusables = $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', overlay)
    .filter((element) => element.offsetParent !== null);

  if (focusables.length === 0) return;
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

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    const drawer = document.querySelector('.fleet-drawer-overlay.open');
    if (drawer) {
      closeDrawer();
      return;
    }
    const modal = document.querySelector('.modal-overlay.open');
    if (modal) closeOverlay(modal);
    return;
  }

  if (event.key === 'Tab') {
    trapFocus(event);
    return;
  }

  if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    const search = document.getElementById('global-vehicle-search');
    if (search && window.getComputedStyle(search.closest('.fleet-search')).display !== 'none') {
      event.preventDefault();
      search.focus();
    }
  }
}

/* -----------------------------------------------------------------------------
   Vehicle actions
   -------------------------------------------------------------------------- */

function runDiagnostic(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  vehicle.lastSeen = 'Updated just now';
  renderVehicleDrawer(vehicle);
  showToast(`Diagnostic started for ${vehicle.make} ${vehicle.model}.`, 'good');
}

function scheduleService(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  showToast(`Service request logged for ${vehicle.model} (${vehicle.plate}).`, 'good');
}

function dismissAlert(id) {
  STATE.acknowledged.add(id);
  saveAcknowledged();
  renderAlerts();
  renderOverview();
  renderBadges();
  showToast('Alert marked as reviewed.', 'good');
}

function markAllAlertsReviewed() {
  const alerts = getAlerts();
  if (alerts.length === 0) {
    showToast('There are no open alerts.', 'good');
    return;
  }

  alerts.forEach((alert) => STATE.acknowledged.add(alert.id));
  saveAcknowledged();
  renderAlerts();
  renderOverview();
  renderBadges();
  showToast(`${alerts.length} ${alerts.length === 1 ? 'alert' : 'alerts'} marked as reviewed.`, 'good');
}

function showToast(message, tone = 'good') {
  const toast = document.getElementById('fleet-toast');
  const text = document.getElementById('fleet-toast-text');
  const icon = document.getElementById('fleet-toast-icon');
  if (!toast || !text) return;

  text.textContent = message;
  toast.classList.remove('is-warn', 'is-danger');
  if (tone === 'warn') toast.classList.add('is-warn');
  if (tone === 'danger') toast.classList.add('is-danger');
  if (icon) {
    icon.className = tone === 'danger' ? 'fa-solid fa-triangle-exclamation' : tone === 'warn' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-check';
  }

  window.clearTimeout(STATE.toastTimer);
  toast.classList.add('show');
  STATE.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

/* -----------------------------------------------------------------------------
   Add and import vehicles
   -------------------------------------------------------------------------- */

function nextVehicleId() {
  return `v-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function mapCoordinate(branch, id) {
  const base = BRANCH_COORDS[branch] || BRANCH_COORDS.Lekki;
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return {
    x: Math.min(88, Math.max(8, base.x + ((hash % 9) - 4))),
    y: Math.min(89, Math.max(9, base.y + (((hash * 7) % 9) - 4)))
  };
}

function makeVehicleRecord(values) {
  const id = nextVehicleId();
  const coordinate = mapCoordinate(values.branch, id);
  const branch = values.branch || 'Lekki';
  return {
    id,
    make: values.make,
    model: values.model,
    year: Number(values.year),
    type: values.type || 'SUV',
    plate: values.plate,
    vin: values.vin || '',
    driver: values.driver || 'Unassigned',
    branch,
    status: 'idle',
    health: 100,
    battery: 12.6,
    fuel: 100,
    odometer: Number(values.odometer) || 0,
    speed: 0,
    coolant: 29,
    lastSeen: 'Just added',
    location: `${branch} branch`,
    x: coordinate.x,
    y: coordinate.y,
    energy: values.energy || 'Petrol',
    serviceItem: 'First inspection',
    serviceDays: 14,
    serviceCost: 45000,
    trend: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    addedAt: Date.now()
  };
}

function plateExists(plate, extraVehicles = []) {
  const normalised = normalizePlate(plate);
  return [...STATE.vehicles, ...extraVehicles].some((vehicle) => normalizePlate(vehicle.plate) === normalised);
}

function showFormError(id, message) {
  const error = document.getElementById(id);
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
}

function handleAddVehicle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const make = titleCase(data.get('make'));
  const model = String(data.get('model') || '').trim();
  const year = Number(data.get('year'));
  const plate = String(data.get('plate') || '').trim().toUpperCase();
  const vin = String(data.get('vin') || '').trim().toUpperCase();
  const driver = String(data.get('driver') || '').trim() || 'Unassigned';
  const branch = String(data.get('branch') || 'Lekki');
  const odometer = Number(data.get('odometer')) || 0;
  const type = String(data.get('type') || 'SUV');
  const energy = String(data.get('energy') || 'Petrol');

  if (!make || !model || !plate) {
    showFormError('add-vehicle-error', 'Brand, model and plate number are required.');
    return;
  }

  if (!Number.isFinite(year) || year < 1980 || year > 2027) {
    showFormError('add-vehicle-error', 'Enter a vehicle year between 1980 and 2027.');
    return;
  }

  if (plateExists(plate)) {
    showFormError('add-vehicle-error', `A vehicle with plate ${plate} is already in the fleet.`);
    return;
  }

  if (odometer < 0) {
    showFormError('add-vehicle-error', 'Odometer cannot be negative.');
    return;
  }

  const vehicle = makeVehicleRecord({ make, model, year, plate, vin, driver, branch, odometer, type, energy });
  STATE.customVehicles.push(vehicle);
  saveCustomVehicles();
  refreshVehicles();

  form.reset();
  closeOverlay(document.getElementById('add-vehicle-modal'));
  renderAll();
  showPage('vehicles');
  showToast(`${make} ${model} added to the fleet.`, 'good');
}

function parseImportRow(row, lineNumber) {
  const cells = row.split(',').map((cell) => cell.trim());
  if (cells.length < 5) {
    return { error: `Line ${lineNumber} needs at least brand, model, year, type and plate.` };
  }

  const [makeValue, model, yearValue, type, plateValue, driver, branch, odometerValue] = cells;
  const make = titleCase(makeValue);
  const year = Number(yearValue);
  const plate = String(plateValue || '').toUpperCase();

  if (!make || !model || !plate) {
    return { error: `Line ${lineNumber} is missing a brand, model or plate.` };
  }

  if (!Number.isFinite(year) || year < 1980 || year > 2027) {
    return { error: `Line ${lineNumber} has an invalid year.` };
  }

  return {
    values: {
      make,
      model,
      year,
      type: type || 'SUV',
      plate,
      driver: driver || 'Unassigned',
      branch: branch || 'Lekki',
      odometer: Number(odometerValue) || 0,
      energy: 'Petrol'
    }
  };
}

function handleImportVehicles(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const raw = String(data.get('rows') || '').trim();

  if (!raw) {
    showFormError('import-vehicles-error', 'Paste at least one vehicle row to import.');
    return;
  }

  const rows = raw.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const imported = [];
  const skipped = [];
  let errors = 0;

  rows.forEach((row, index) => {
    if (index === 0 && /^brand\s*,\s*model/i.test(row)) return;

    const parsed = parseImportRow(row, index + 1);
    if (parsed.error) {
      errors += 1;
      return;
    }

    if (plateExists(parsed.values.plate, imported)) {
      skipped.push(parsed.values.plate);
      return;
    }

    imported.push(makeVehicleRecord(parsed.values));
  });

  if (imported.length === 0) {
    const detail = errors > 0 ? 'Check the column order and try again.' : 'All rows were duplicates.';
    showFormError('import-vehicles-error', `No vehicles were imported. ${detail}`);
    return;
  }

  STATE.customVehicles.push(...imported);
  saveCustomVehicles();
  refreshVehicles();

  form.reset();
  closeOverlay(document.getElementById('import-vehicles-modal'));
  renderAll();
  showPage('vehicles');

  const skippedText = skipped.length ? ` ${skipped.length} duplicate ${skipped.length === 1 ? 'row was' : 'rows were'} skipped.` : '';
  const errorText = errors ? ` ${errors} ${errors === 1 ? 'row could not be read' : 'rows could not be read'}.` : '';
  showToast(`Imported ${imported.length} ${imported.length === 1 ? 'vehicle' : 'vehicles'}.${skippedText}${errorText}`, 'good');
}

/* -----------------------------------------------------------------------------
   Navigation and filters
   -------------------------------------------------------------------------- */

const PAGE_TITLES = {
  overview: 'Overview',
  vehicles: 'Vehicles',
  tracking: 'Live tracking',
  maintenance: 'Maintenance',
  alerts: 'Alerts'
};

function showPage(page) {
  if (!PAGE_TITLES[page]) page = 'overview';
  STATE.page = page;

  $$('.page').forEach((section) => {
    section.classList.toggle('active', section.id === `fleet-page-${page}`);
  });

  $$('[data-fleet-page]').forEach((button) => {
    const active = button.dataset.fleetPage === page;
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (window.location.hash !== `#${page}`) {
    window.history.replaceState(null, '', `#${page}`);
  }

  document.title = `${PAGE_TITLES[page]} · Orion Fleet`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearVehicleFilters() {
  STATE.search = '';
  STATE.status = 'all';
  STATE.brand = 'all';
  STATE.sort = 'attention';

  const globalSearch = document.getElementById('global-vehicle-search');
  const vehicleSearch = document.getElementById('vehicle-search');
  const status = document.getElementById('status-filter');
  const brand = document.getElementById('brand-filter');
  const sort = document.getElementById('sort-filter');
  if (globalSearch) globalSearch.value = '';
  if (vehicleSearch) vehicleSearch.value = '';
  if (status) status.value = 'all';
  if (brand) brand.value = 'all';
  if (sort) sort.value = 'attention';

  renderVehicles();
}

/* -----------------------------------------------------------------------------
   Master render
   -------------------------------------------------------------------------- */

function renderAll() {
  renderBrandFilter();
  renderKPIs();
  renderOverview();
  renderVehicles();
  renderTracking();
  renderMaintenance();
  renderAlerts();
  renderBadges();
}

function fleetLocationLabel(location) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return '';
  const source = location.source === 'app'
    ? 'Live location'
    : location.source === 'gps'
      ? 'Live location'
      : location.source === 'ip'
        ? 'Approximate area'
        : '';
  if (!source) return '';
  const expired = (location.source === 'app' || location.source === 'gps') && location.fix > 0 && location.ageS > 120;
  const place = location.city || `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`;
  return `${source}${expired ? ' (expired)' : ''} · ${place}`;
}

function liveMapPosition(location) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return null;
  const isIp = location.source === 'ip';
  const isFix = (location.source === 'app' || location.source === 'gps') && location.fix > 0 && location.ageS <= 120;
  if (!isIp && !isFix) return null;

  const lonMin = 3.18;
  const lonMax = 3.66;
  const latMin = 6.40;
  const latMax = 6.72;
  if (location.lon < lonMin || location.lon > lonMax || location.lat < latMin || location.lat > latMax) {
    return null;
  }

  return {
    x: Math.max(4, Math.min(96, ((location.lon - lonMin) / (lonMax - lonMin)) * 100)),
    y: Math.max(4, Math.min(96, ((latMax - location.lat) / (latMax - latMin)) * 100))
  };
}

function updateLiveMapPin(location) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return;
  const latlng = [location.lat, location.lon];

  ['overview-map', 'tracking-map'].forEach((containerId) => {
    const map = leafletMaps[containerId];
    if (!map) return;

    if (orionLiveMarkers[containerId]) {
      orionLiveMarkers[containerId].setLatLng(latlng);
    } else {
      const orionIcon = L.divIcon({
        html: `
          <div class="map-pin map-pin--live map-pin--active" style="position:relative;left:0;top:0;transform:none;">
            <i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i>
            <span class="map-pin-label" style="opacity:1;background:#ef4444;color:#fff;font-weight:700;">ORION X · LIVE</span>
          </div>
        `,
        className: 'leaflet-orion-live-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const liveMarker = L.marker(latlng, { icon: orionIcon, zIndexOffset: 1000 }).addTo(map);
      liveMarker.bindPopup(`
        <div style="font-family:inherit;font-size:12px;color:#111;">
          <strong style="color:#ef4444;font-size:13px;">Orion X Live Hardware</strong><br>
          <span>Real-time GPS / Geolocation</span><br>
          <span>Coordinates: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}</span>
        </div>
      `);
      orionLiveMarkers[containerId] = liveMarker;
    }
  });
}

function friendlyLiveMode(data) {
  const text = String(data && data.statusText ? data.statusText : '').trim();
  if (/BENCH|SIM/i.test(text)) return 'Demo mode';
  if (data && data.obdDetached) return 'Check vehicle';
  if (data && data.severity >= 2) return 'Alert';
  if (data && data.severity === 1) return 'Warning';
  if (/NOMINAL|OK|ONLINE|CONNECTED/i.test(text)) return 'Connected';
  return text || 'Connected';
}

function triggerOrionXBuzzer() {
  const status = window.OrionLive ? window.OrionLive.status() : null;
  const button = document.getElementById('fleet-buzzer-btn');
  if (!status || !status.connected) {
    showToast('Orion X is not connected yet.', 'warn');
    return;
  }

  const pulse = () => {
    if (!button) return;
    button.classList.add('is-sounding');
    window.setTimeout(() => button.classList.remove('is-sounding'), 1100);
  };

  if (status.mode === 'gateway') {
    fetch(status.gatewayUrl + '/buzzer', { method: 'POST', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No reply');
        pulse();
        showToast('Orion X is sounding.', 'good');
      })
      .catch(() => showToast('Could not reach Orion X. Try again.', 'warn'));
    return;
  }

  const sent = window.OrionLive.sendBuzzer
    ? window.OrionLive.sendBuzzer(900)
    : window.OrionLive.sendCommand('BUZZER');
  if (!sent) {
    showToast('Could not reach Orion X. Try again.', 'warn');
    return;
  }

  pulse();
  showToast('Orion X is sounding.', 'good');
}

function updateFleetLive() {
  const card = document.getElementById('fleet-live-device');
  if (!card) return;

  const status = window.OrionLive ? window.OrionLive.status() : null;
  const data = status && status.data ? status.data : null;
  const fresh = Boolean(status && status.fresh);
  const age = status && status.ageMs !== null ? Math.max(0, Math.round(status.ageMs / 1000)) : null;
  const chip = document.getElementById('fleet-device-chip');
  const title = document.getElementById('fleet-device-title');
  const sub = document.getElementById('fleet-device-sub');
  const button = document.getElementById('fleet-buzzer-btn');

  if (button) button.disabled = !(status && status.connected);

  const setChip = (tone, text) => {
    if (chip) {
      chip.className = 'chip chip--' + tone;
      chip.textContent = text;
    }
  };

  if (data) {
    const tone = data.tone || (data.severity === 2 ? 'danger' : data.severity === 1 ? 'warn' : 'good');
    const locationText = fleetLocationLabel(data.location);
    const mode = friendlyLiveMode(data);
    card.dataset.state = tone;
    if (title) title.textContent = fresh ? `${data.vehicleId} · Orion X connected` : `${data.vehicleId} · last seen`;
    if (sub) {
      sub.textContent = fresh
        ? `${mode}${locationText ? ` · ${locationText}` : ''} · updated ${age}s ago`
        : `Last reading ${age}s ago${locationText ? ` · last location: ${locationText}` : ''}. Sample fleet records remain editable while Orion X reconnects.`;
    }
    document.getElementById('fleet-device-rpm').textContent = data.rpm > 0 ? Math.round(data.rpm).toLocaleString('en-US') : '--';
    document.getElementById('fleet-device-coolant').textContent = data.coolant > 0 ? `${data.coolant.toFixed(1)}°C` : '--';
    document.getElementById('fleet-device-battery').textContent = data.battery > 0 ? data.battery.toFixed(2) + ' V' : '--';
    document.getElementById('fleet-device-status').textContent = mode;
    setChip(fresh ? tone : 'warn', fresh ? (tone === 'danger' ? 'Alert' : tone === 'warn' ? 'Warning' : 'Live') : 'Offline');

    const label = document.getElementById('fleet-sample-label');
    if (label) {
      label.innerHTML = '<span class="status-dot" aria-hidden="true"></span> ' + (fresh ? 'Orion X connected' : 'Sample data');
    }
    const note = document.getElementById('fleet-data-note');
    if (note) {
      note.innerHTML = fresh
        ? '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> Live data is coming from Orion X. Sample fleet records remain editable below.'
        : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> Showing the last Orion X reading plus the editable sample fleet records.';
    }
    updateLiveMapPin(data.location);
    return;
  }

  card.dataset.state = 'offline';
  updateLiveMapPin(null);
  document.getElementById('fleet-device-rpm').textContent = '--';
  document.getElementById('fleet-device-coolant').textContent = '--';
  document.getElementById('fleet-device-battery').textContent = '--';
  document.getElementById('fleet-device-status').textContent = '--';

  const sampleLabel = document.getElementById('fleet-sample-label');
  if (sampleLabel) {
    sampleLabel.innerHTML = '<span class="status-dot" aria-hidden="true"></span> Sample data';
  }
  const sampleNote = document.getElementById('fleet-data-note');
  if (sampleNote) {
    sampleNote.innerHTML = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> Sample data for demonstration. Orion X updates this portal when it connects.';
  }

  if (status && status.connected) {
    if (title) title.textContent = 'Waiting for Orion X';
    if (sub) sub.textContent = 'Orion X is connected. Waiting for live vehicle data…';
    setChip('quiet', 'Waiting');
  } else {
    if (title) title.textContent = 'Waiting for Orion X';
    if (sub) sub.textContent = 'The fleet sample records are shown below. They will update automatically when Orion X connects.';
    setChip('quiet', 'Offline');
  }
}

function initFleetLive() {
  updateFleetLive();
  if (!window.OrionLive) return;
  window.OrionLive.start();
  window.addEventListener('orion:telemetry', updateFleetLive);
  window.setInterval(updateFleetLive, 2000);
}

/* -----------------------------------------------------------------------------
   Events and boot
   -------------------------------------------------------------------------- */

function bindEvents() {
  document.addEventListener('keydown', handleGlobalKeydown);

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => closeOverlay(button.closest('.modal-overlay')));
  });

  document.querySelectorAll('[data-drawer-close]').forEach((button) => {
    button.addEventListener('click', closeDrawer);
  });

  document.querySelectorAll('.modal-overlay, .fleet-drawer-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      if (overlay.id === 'vehicle-drawer-overlay') {
        closeDrawer();
      } else {
        closeOverlay(overlay);
      }
    });
  });

  $$('[data-fleet-page]').forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.fleetPage));
  });

  const globalSearch = document.getElementById('global-vehicle-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', () => {
      STATE.search = globalSearch.value;
      const pageSearch = document.getElementById('vehicle-search');
      if (pageSearch) pageSearch.value = globalSearch.value;
      if (STATE.page !== 'vehicles') showPage('vehicles');
      renderVehicles();
    });
  }

  const vehicleSearch = document.getElementById('vehicle-search');
  if (vehicleSearch) {
    vehicleSearch.addEventListener('input', () => {
      STATE.search = vehicleSearch.value;
      if (globalSearch) globalSearch.value = vehicleSearch.value;
      renderVehicles();
    });
  }

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      STATE.status = statusFilter.value;
      renderVehicles();
    });
  }

  const brandFilter = document.getElementById('brand-filter');
  if (brandFilter) {
    brandFilter.addEventListener('change', () => {
      STATE.brand = brandFilter.value;
      renderVehicles();
    });
  }

  const sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      STATE.sort = sortFilter.value;
      renderVehicles();
    });
  }

  $$('[data-track-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      STATE.trackFilter = button.dataset.trackFilter;
      $$('[data-track-filter]').forEach((item) => item.classList.toggle('active', item === button));
      renderTracking();
    });
  });

  $$('[data-alert-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      STATE.alertFilter = button.dataset.alertFilter;
      $$('[data-alert-filter]').forEach((item) => item.classList.toggle('active', item === button));
      renderAlerts();
    });
  });

  const addForm = document.getElementById('add-vehicle-form');
  if (addForm) addForm.addEventListener('submit', handleAddVehicle);

  const importForm = document.getElementById('import-vehicles-form');
  if (importForm) importForm.addEventListener('submit', handleImportVehicles);
}

function init() {
  STATE.customVehicles = loadCustomVehicles();
  STATE.acknowledged = new Set(loadAcknowledged());
  refreshVehicles();

  const hashPage = window.location.hash.replace('#', '');
  if (PAGE_TITLES[hashPage]) STATE.page = hashPage;

  renderAll();
  bindEvents();
  initFleetLive();

  showPage(STATE.page);
}

window.triggerOrionXBuzzer = triggerOrionXBuzzer;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
