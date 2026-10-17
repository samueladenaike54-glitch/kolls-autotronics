/**
 * ==============================================================================
 * KOLLS AUTOTRONICS — DUAL-ROLE FLEET & DRIVER APP CONTROLLER
 * Mobile-First Fleet Intelligence & Personal Vehicle Cockpit
 * ==============================================================================
 */

// Application Global State
const STATE = {
  currentRole: null,             // null (role selector) | 'fleet' | 'driver'
  fleetMobileView: 'map',        // 'map' | 'triage'
  currentDriverMenu: 'health',   // 'health' | 'predict' | 'copilot'
  selectedTruckId: '402',
  drivingStyle: 'highway',       // 'severe' | 'urban' | 'highway'
  currentFilter: 'all',
  
  // Instance references
  map: null,
  markers: {},
  depotCircles: [],
  charts: {
    vibration: null,
    dCoolant: null,
    dRpm: null,
    dVolt: null
  },
  oscilloscopeTimer: null,
  scanSecondsLeft: 120,
  toastInterval: null,
  clockInterval: null,
  telemetryInterval: null,

  // 8 Real-world Fleet Vehicles on the I-80 & I-35 Midwest Corridors
  trucks: [
    {
      id: '402',
      driver: 'John Doe',
      phone: '(515) 890-4412',
      model: '2024 Peterbilt 579 UltraLoft',
      location: 'I-80 near Grinnell, IA (Mile 182)',
      lat: 41.7431, lng: -92.7222,
      speed: 64, heading: 274,
      voltage: 13.8,
      severity: 'critical',
      rulHours: 3.5,
      problem: 'Alternator Needle Bearing Failure Imminent (120Hz Resonance)',
      subsystem: 'Electrical & Charging',
      scores: { powertrain: 98, electrical: 42, brakes: 91, transmission: 89 },
      telemetry: { rpm: 1480, coolant: 198, oil: 46, fuel: 7.2, def: 82, boost: 24.5 },
      hos: { drive: '5h 18m / 11h', shift: '6h 45m / 14h', weekly: '42h 10m / 70h' },
      safetyScore: 98,
      workOrder: { hub: 'Des Moines Logistics Hub (Exit 137)', bay: 'Diagnostic Bay 3', tech: 'Marcus Vance', downtime: '1.5 Hours', status: 'PRE-DISPATCH STAGED' }
    },
    {
      id: '612',
      driver: 'Sarah Jenkins',
      phone: '(319) 552-9011',
      model: '2023 Kenworth T680 Next-Gen',
      location: 'I-80 near Iowa City, IA (Mile 242)',
      lat: 41.6611, lng: -91.5302,
      speed: 62, heading: 94,
      voltage: 14.1,
      severity: 'critical',
      rulHours: 1.8,
      problem: 'Steer Axle Hub Bearing Thermal Runaway (+85°C)',
      subsystem: 'Pneumatic Brakes & Steer Axle',
      scores: { powertrain: 94, electrical: 96, brakes: 38, transmission: 92 },
      telemetry: { rpm: 1520, coolant: 194, oil: 48, fuel: 7.6, def: 78, boost: 26.0 },
      hos: { drive: '7h 12m / 11h', shift: '8h 30m / 14h', weekly: '51h 20m / 70h' },
      safetyScore: 94,
      workOrder: { hub: 'Cedar Rapids Maintenance Hub', bay: 'Heavy Bay 1', tech: 'David Miller', downtime: '2.0 Hours', status: 'READY FOR DISPATCH' }
    },
    {
      id: '108',
      driver: 'Carlos Ramirez',
      phone: '(515) 334-1189',
      model: '2023 Freightliner Cascadia DD15',
      location: 'I-35 near Ames, IA (Mile 111)',
      lat: 42.0308, lng: -93.6319,
      speed: 66, heading: 4,
      voltage: 13.9,
      severity: 'warning',
      rulHours: 18.5,
      problem: 'Intake Vacuum Leak — Fuel Trim Drift (+14.2% LTFT)',
      subsystem: 'Powertrain & Air Intake',
      scores: { powertrain: 76, electrical: 94, brakes: 92, transmission: 90 },
      telemetry: { rpm: 1450, coolant: 204, oil: 44, fuel: 8.4, def: 88, boost: 22.0 },
      hos: { drive: '3h 40m / 11h', shift: '4h 15m / 14h', weekly: '34h 00m / 70h' },
      safetyScore: 96,
      workOrder: { hub: 'Ames Logistics Depot', bay: 'Bay 2', tech: 'Frank Castle', downtime: '1.0 Hour', status: 'MONITORING' }
    },
    {
      id: '255',
      driver: 'Marcus Brody',
      phone: '(319) 480-2299',
      model: '2022 Volvo VNL 860 Globetrotter',
      location: 'I-80 near Davenport, IA (Mile 292)',
      lat: 41.5236, lng: -90.5776,
      speed: 65, heading: 268,
      voltage: 14.0,
      severity: 'warning',
      rulHours: 24.0,
      problem: 'DPF Soot Backpressure Delta (+78% Differential)',
      subsystem: 'Exhaust & Aftertreatment',
      scores: { powertrain: 81, electrical: 98, brakes: 95, transmission: 92 },
      telemetry: { rpm: 1390, coolant: 201, oil: 45, fuel: 7.9, def: 65, boost: 23.0 },
      hos: { drive: '6h 10m / 11h', shift: '7h 00m / 14h', weekly: '39h 15m / 70h' },
      safetyScore: 92,
      workOrder: { hub: 'Quad Cities Logistics Hub', bay: 'Bay 4', tech: 'Gary Ross', downtime: '1.0 Hour', status: 'STAGED' }
    },
    {
      id: '789',
      driver: 'Elena Rostova',
      phone: '(515) 789-0021',
      model: '2024 Peterbilt 579 UltraLoft',
      location: 'I-35 near Des Moines, IA (Mile 68)',
      lat: 41.5868, lng: -93.6250,
      speed: 58, heading: 185,
      voltage: 13.9,
      severity: 'warning',
      rulHours: 32.0,
      problem: 'Transmission Fluid Temperature Elevated (+12°C)',
      subsystem: 'Heavy Transmission & Driveline',
      scores: { powertrain: 92, electrical: 95, brakes: 88, transmission: 74 },
      telemetry: { rpm: 1420, coolant: 196, oil: 47, fuel: 7.4, def: 90, boost: 21.0 },
      hos: { drive: '2h 15m / 11h', shift: '3h 00m / 14h', weekly: '22h 30m / 70h' },
      safetyScore: 99,
      workOrder: { hub: 'Des Moines Logistics Hub', bay: 'Bay 2', tech: 'Marcus Vance', downtime: '1.2 Hours', status: 'STAGED' }
    },
    {
      id: '331',
      driver: 'Trevor Belmont',
      phone: '(319) 902-3311',
      model: '2023 Kenworth T680',
      location: 'I-80 near Newton, IA (Mile 164)',
      lat: 41.6997, lng: -93.0477,
      speed: 65, heading: 272,
      voltage: 14.1,
      severity: 'warning',
      rulHours: 48.0,
      problem: 'Coolant Heat Dissipation Lag (Sluggish Thermostat)',
      subsystem: 'Thermal Management & Cooling',
      scores: { powertrain: 94, electrical: 97, brakes: 93, transmission: 91 },
      telemetry: { rpm: 1490, coolant: 208, oil: 43, fuel: 7.5, def: 76, boost: 25.0 },
      hos: { drive: '8h 20m / 11h', shift: '9h 40m / 14h', weekly: '58h 10m / 70h' },
      safetyScore: 91,
      workOrder: { hub: 'Newton Service Depot', bay: 'Bay 1', tech: 'Tom Sterling', downtime: '0.8 Hours', status: 'SCHEDULED' }
    },
    {
      id: '044',
      driver: 'David Kim',
      phone: '(515) 441-9988',
      model: '2022 Freightliner Cascadia',
      location: 'I-80 near Altoona, IA (Mile 142)',
      lat: 41.6442, lng: -93.4994,
      speed: 63, heading: 92,
      voltage: 14.2,
      severity: 'scheduled',
      rulHours: 72.0,
      problem: 'Routine PM-B Synthetic Oil Service in 1,200 KM',
      subsystem: 'Lubrication System',
      scores: { powertrain: 96, electrical: 98, brakes: 92, transmission: 95 },
      telemetry: { rpm: 1430, coolant: 195, oil: 48, fuel: 7.1, def: 89, boost: 23.5 },
      hos: { drive: '4h 10m / 11h', shift: '5h 00m / 14h', weekly: '28h 00m / 70h' },
      safetyScore: 98,
      workOrder: { hub: 'Des Moines Logistics Hub', bay: 'Bay 5', tech: 'Marcus Vance', downtime: '1.0 Hour', status: 'SCHEDULED' }
    },
    {
      id: '517',
      driver: 'Rachel Adams',
      phone: '(319) 517-8820',
      model: '2023 Volvo VNL 760',
      location: 'I-80 near Coralville, IA (Mile 240)',
      lat: 41.6781, lng: -91.5833,
      speed: 64, heading: 271,
      voltage: 13.7,
      severity: 'scheduled',
      rulHours: 96.0,
      problem: 'Pneumatic Air Dryer Desiccant Saturation',
      subsystem: 'Pneumatic Brake Supply',
      scores: { powertrain: 98, electrical: 97, brakes: 86, transmission: 94 },
      telemetry: { rpm: 1460, coolant: 197, oil: 46, fuel: 7.3, def: 84, boost: 24.0 },
      hos: { drive: '5h 00m / 11h', shift: '6h 15m / 14h', weekly: '36h 40m / 70h' },
      safetyScore: 97,
      workOrder: { hub: 'Iowa City Service Hub', bay: 'Bay 2', tech: 'Paul Walker', downtime: '0.7 Hours', status: 'SCHEDULED' }
    }
  ],

  // Consumables Wear Base Data (Driver App)
  consumables: [
    { title: 'Synthetic Engine Oil', baseKm: 12000, currentKm: 5800 },
    { title: 'Front Ceramic Brake Pads', baseKm: 25000, currentKm: 19200 },
    { title: 'Steer Axle Tires', baseKm: 60000, currentKm: 42000 },
    { title: 'Spark / Glow Plugs', baseKm: 80000, currentKm: 48000 },
    { title: 'Coolant Purity Index', baseKm: 100000, currentKm: 22000 },
    { title: 'Transmission Fluid', baseKm: 120000, currentKm: 34000 }
  ],

  // OBD-II PID Registry (Driver App)
  pids: [
    { pid: '0x0C', name: 'Engine Speed', val: '1,480', unit: 'RPM' },
    { pid: '0x05', name: 'Coolant Temperature', val: '88.2', unit: '°C' },
    { pid: '0x04', name: 'Calculated Engine Load', val: '42.0', unit: '%' },
    { pid: '0x0F', name: 'Intake Air Temp (IAT)', val: '28.5', unit: '°C' },
    { pid: '0x42', name: 'Control Module Voltage', val: '13.84', unit: 'V' },
    { pid: '0x06', name: 'Short-Term Fuel Trim (STFT)', val: '+1.6', unit: '%' },
    { pid: '0x07', name: 'Long-Term Fuel Trim (LTFT)', val: '+4.2', unit: '%' },
    { pid: '0x0D', name: 'Vehicle Speed', val: '103', unit: 'km/h' },
    { pid: '0x10', name: 'Mass Air Flow (MAF)', val: '84.2', unit: 'g/s' },
    { pid: '0x33', name: 'Barometric Pressure', val: '99.1', unit: 'kPa' },
    { pid: '0x1F', name: 'Runtime Since Start', val: '19,080', unit: 's' },
    { pid: '0x46', name: 'Ambient Air Temp', val: '21.0', unit: '°C' }
  ]
};

// ==============================================================================
// 1. LIFECYCLE & ROLE SELECTION CONTROLLER
// ==============================================================================

window.addEventListener('DOMContentLoaded', () => {
  // Always default to role selection screen first
  returnToRoleSelect();
  startGlobalClock();
});

function startGlobalClock() {
  if (STATE.clockInterval) clearInterval(STATE.clockInterval);
  STATE.clockInterval = setInterval(() => {
    const el = document.getElementById('fleet-clock');
    if (el) {
      el.innerText = new Date().toISOString().substring(11, 19);
    }
  }, 1000);
}

/**
 * Enter selected role ('fleet' or 'driver')
 */
function enterRole(role) {
  STATE.currentRole = role;

  // Hide all screens
  document.getElementById('role-select-screen').classList.remove('active');
  document.getElementById('fleet-app-screen').classList.remove('active');
  document.getElementById('driver-app-screen').classList.remove('active');

  if (role === 'fleet') {
    document.getElementById('fleet-app-screen').classList.add('active');
    initFleetApp();
  } else if (role === 'driver') {
    document.getElementById('driver-app-screen').classList.add('active');
    initDriverApp();
  }
}

/**
 * Return to the initial portal selector
 */
function returnToRoleSelect() {
  STATE.currentRole = null;
  document.getElementById('role-select-screen').classList.add('active');
  document.getElementById('fleet-app-screen').classList.remove('active');
  document.getElementById('driver-app-screen').classList.remove('active');

  // Close open inspector or modals
  closeInspector();
  closeAllModals();
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}


// ==============================================================================
// 2. FLEET MANAGER COMMAND APP (AEGIS 4-ZONE)
// ==============================================================================

function initFleetApp() {
  renderTriageCards();
  initLeafletMap();
  setFleetMobileView(STATE.fleetMobileView);
  startFleetSimLoop();
}

function switchFleetRegion(region) {
  showSimpleAlert("FLEET REGION SWITCHED", `Telemetry updated for division: ${region.toUpperCase()}`, "cyan");
}

function setFleetMobileView(view) {
  STATE.fleetMobileView = view;
  const fleetScreen = document.getElementById('fleet-app-screen');
  const btnMap = document.getElementById('btn-fmt-map');
  const btnTriage = document.getElementById('btn-fmt-triage');

  if (view === 'map') {
    fleetScreen.classList.remove('mobile-view-triage');
    fleetScreen.classList.add('mobile-view-map');
    btnMap.classList.add('active');
    btnTriage.classList.remove('active');
    if (STATE.map) {
      setTimeout(() => STATE.map.invalidateSize(), 150);
    }
  } else {
    fleetScreen.classList.remove('mobile-view-map');
    fleetScreen.classList.add('mobile-view-triage');
    btnTriage.classList.add('active');
    btnMap.classList.remove('active');
  }
}

function renderTriageCards() {
  const container = document.getElementById('triage-cards-container');
  if (!container) return;

  const filtered = STATE.trucks.filter(t => {
    if (STATE.currentFilter === 'all') return true;
    return t.severity === STATE.currentFilter;
  });

  container.innerHTML = filtered.map(t => {
    let borderClass = 'border-blue';
    let tagHtml = '<span class="tag-ok">PM DUE</span>';
    let rulColor = 'text-cyan';

    if (t.severity === 'critical') {
      borderClass = 'border-red';
      tagHtml = '<span class="tag-crit"><i class="fa-solid fa-triangle-exclamation"></i> CRITICAL</span>';
      rulColor = 'text-red';
    } else if (t.severity === 'warning') {
      borderClass = 'border-yellow';
      tagHtml = '<span class="tag-warn"><i class="fa-solid fa-circle-exclamation"></i> WARNING</span>';
      rulColor = 'text-yellow';
    }

    return `
      <div class="triage-card ${borderClass}" onclick="openInspector('${t.id}')">
        <div class="tc-top">
          <span class="tc-truck-tag"><i class="fa-solid fa-truck"></i> TRUCK #${t.id}</span>
          ${tagHtml}
        </div>
        <div class="tc-prob-desc">${t.problem}</div>
        <div class="tc-meta-row">
          <span class="${rulColor} font-mono"><strong>RUL: ${t.rulHours.toFixed(1)}h</strong></span>
          <button class="btn-inspect-sm" onclick="event.stopPropagation(); openInspector('${t.id}')">
            INSPECT <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterTriage(category) {
  STATE.currentFilter = category;
  document.querySelectorAll('#triage-filters .fbtn').forEach(b => {
    b.classList.toggle('active', b.innerText.toLowerCase().includes(category));
  });
  renderTriageCards();
}

function initLeafletMap() {
  if (STATE.map) {
    setTimeout(() => STATE.map.invalidateSize(), 200);
    return;
  }

  const mapEl = document.getElementById('fleet-leaflet-map');
  if (!mapEl) return;

  // Center on US Midwest corridor (Iowa I-80 / I-35)
  STATE.map = L.map('fleet-leaflet-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([41.65, -92.5], 7);

  L.control.zoom({ position: 'bottomright' }).addTo(STATE.map);

  // High contrast obsidian dark tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd'
  }).addTo(STATE.map);

  // Add 8 Truck Markers
  STATE.trucks.forEach(t => {
    let markerColorClass = 'marker-healthy';
    if (t.severity === 'critical') markerColorClass = 'marker-critical';
    if (t.severity === 'warning') markerColorClass = 'marker-warning';

    const customIcon = L.divIcon({
      className: 'custom-truck-divicon',
      html: `<div class="truck-map-marker ${markerColorClass}"><i class="fa-solid fa-location-arrow" style="transform: rotate(${t.heading - 45}deg);"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([t.lat, t.lng], { icon: customIcon }).addTo(STATE.map);
    
    marker.bindPopup(`
      <div style="background: #111726; color: #fff; padding: 6px; font-family: 'Inter', sans-serif; font-size: 11px; border-radius: 6px;">
        <strong style="color: #00e5ff;">TRUCK #${t.id} (${t.model})</strong><br>
        <span>Driver: ${t.driver}</span><br>
        <span>Speed: ${t.speed} MPH</span><br>
        <button style="margin-top: 6px; width: 100%; padding: 4px; background: #00e5ff; color: #000; font-weight: 700; border: none; border-radius: 4px; cursor: pointer;" onclick="openInspector('${t.id}')">Deep Inspect</button>
      </div>
    `);

    marker.on('click', () => openInspector(t.id));
    STATE.markers[t.id] = marker;
  });

  // Depot Wi-Fi / Service Hub Circles
  const depots = [
    { name: 'Des Moines Logistics Hub', lat: 41.5868, lng: -93.6250, radius: 18000 },
    { name: 'Iowa City Service Hub', lat: 41.6611, lng: -91.5302, radius: 15000 },
    { name: 'Quad Cities Hub', lat: 41.5236, lng: -90.5776, radius: 16000 }
  ];

  depots.forEach(d => {
    const circle = L.circle([d.lat, d.lng], {
      color: '#00e5ff',
      fillColor: '#00e5ff',
      fillOpacity: 0.08,
      weight: 1,
      dashArray: '4, 6',
      radius: d.radius
    }).addTo(STATE.map);
    STATE.depotCircles.push(circle);
  });
}

function toggleMapDepots() {
  const btn = document.getElementById('btn-layer-depots');
  const isActive = btn.classList.toggle('active');
  STATE.depotCircles.forEach(c => {
    if (isActive) c.addTo(STATE.map);
    else STATE.map.removeLayer(c);
  });
}

// Zone 4: Deep Asset Inspector Drawer
function openInspector(truckId) {
  STATE.selectedTruckId = truckId;
  const truck = STATE.trucks.find(t => t.id === truckId);
  if (!truck) return;

  // Center Map on Truck
  if (STATE.map) {
    STATE.map.panTo([truck.lat, truck.lng], { animate: true });
  }

  // Populate Header
  document.getElementById('insp-truck-id').innerText = `TRUCK #${truck.id}`;
  document.getElementById('insp-truck-subtitle').innerText = `${truck.model} • Driver: ${truck.driver}`;
  document.getElementById('insp-voltage').innerText = `${truck.voltage.toFixed(1)}V`;
  document.getElementById('insp-location').innerText = truck.location;
  document.getElementById('insp-speed').innerText = `${truck.speed} MPH`;

  // Tab 1: AI Diagnostics
  document.getElementById('diag-score-powertrain').innerText = `${truck.scores.powertrain}%`;
  document.getElementById('diag-bar-powertrain').style.width = `${truck.scores.powertrain}%`;

  document.getElementById('diag-score-electrical').innerText = `${truck.scores.electrical}% ${truck.scores.electrical < 50 ? '(Critical Alert)' : ''}`;
  document.getElementById('diag-bar-electrical').style.width = `${truck.scores.electrical}%`;

  document.getElementById('diag-score-brakes').innerText = `${truck.scores.brakes}%`;
  document.getElementById('diag-bar-brakes').style.width = `${truck.scores.brakes}%`;

  document.getElementById('diag-score-transmission').innerText = `${truck.scores.transmission}%`;
  document.getElementById('diag-bar-transmission').style.width = `${truck.scores.transmission}%`;

  document.getElementById('diag-ai-text').innerText = truck.problem;
  document.getElementById('diag-rul-val').innerText = `${truck.rulHours.toFixed(1)} Hours`;

  renderVibrationFFT();

  // Tab 2: Live Telemetry
  document.getElementById('tele-val-rpm').innerText = truck.telemetry.rpm.toLocaleString();
  document.getElementById('tele-val-coolant').innerText = `${truck.telemetry.coolant}°F`;
  document.getElementById('tele-val-oil').innerText = `${truck.telemetry.oil} PSI`;
  document.getElementById('tele-val-fuel').innerText = `${truck.telemetry.fuel} GPH`;
  document.getElementById('tele-val-def').innerText = `${truck.telemetry.def}%`;
  document.getElementById('tele-val-boost').innerText = `${truck.telemetry.boost} PSI`;

  // Tab 3: Driver & HOS
  document.getElementById('driver-card-name').innerText = truck.driver;
  document.getElementById('driver-card-score').innerText = truck.safetyScore;
  document.getElementById('hos-lbl-drive').innerText = truck.hos.drive;
  document.getElementById('hos-lbl-shift').innerText = truck.hos.shift;
  document.getElementById('hos-lbl-weekly').innerText = truck.hos.weekly;

  // Tab 4: Work Order
  document.getElementById('wo-card-id').innerText = `Work Order #WO-8902-TR${truck.id}`;
  document.getElementById('wo-card-status').innerText = truck.workOrder.status;
  document.getElementById('wo-spec-hub').innerText = truck.workOrder.hub;
  document.getElementById('wo-spec-bay').innerText = truck.workOrder.bay;
  document.getElementById('wo-spec-tech').innerText = truck.workOrder.tech;
  document.getElementById('wo-spec-downtime').innerText = truck.workOrder.downtime;

  document.getElementById('asset-inspector').classList.add('open');
}

function closeInspector() {
  const el = document.getElementById('asset-inspector');
  if (el) el.classList.remove('open');
}

function setInspectorTab(tabName) {
  document.querySelectorAll('.drawer-tabs-row .dtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tabName));
  });
  document.querySelectorAll('.drawer-content-scroll .dtab-content').forEach(p => {
    p.classList.remove('active');
  });
  const target = document.getElementById(`tab-insp-${tabName}`);
  if (target) target.classList.add('active');
}

function renderVibrationFFT() {
  const ctx = document.getElementById('chart-vibration-fft');
  if (!ctx) return;

  if (STATE.charts.vibration) {
    try { STATE.charts.vibration.destroy(); } catch (e) {}
  }

  const freqs = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
  const normalCurve = [1.1, 1.3, 1.2, 1.4, 1.2, 1.3, 1.1, 1.2, 1.1, 1.0];
  const anomalyCurve = [1.2, 1.4, 1.3, 1.5, 2.1, 6.2, 2.3, 1.4, 1.2, 1.1]; // 120Hz spike

  STATE.charts.vibration = new Chart(ctx, {
    type: 'line',
    data: {
      labels: freqs.map(f => `${f}Hz`),
      datasets: [
        { label: 'Normal Baseline', data: normalCurve, borderColor: '#5e6d8a', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0 },
        { label: 'Harmonic FFT Sensor', data: anomalyCurve, borderColor: '#ff3d57', borderWidth: 2, backgroundColor: 'rgba(255, 61, 87, 0.15)', fill: true, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5e6d8a', font: { size: 9 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5e6d8a', font: { size: 9 } } }
      }
    }
  });
}

function startLiveScan() {
  document.getElementById('scan-modal').classList.add('open');
  STATE.scanSecondsLeft = 120;
  
  const canvas = document.getElementById('scan-oscilloscope-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth || 380;

  if (STATE.oscilloscopeTimer) clearInterval(STATE.oscilloscopeTimer);

  let phase = 0;
  STATE.oscilloscopeTimer = setInterval(() => {
    STATE.scanSecondsLeft--;
    const mins = Math.floor(STATE.scanSecondsLeft / 60);
    const secs = STATE.scanSecondsLeft % 60;
    const tVal = document.getElementById('scan-timer-val');
    if (tVal) tVal.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (STATE.scanSecondsLeft <= 0) clearInterval(STATE.oscilloscopeTimer);

    // Render Clean CRT Waveform
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    phase += 0.2;
    for (let x = 0; x < canvas.width; x++) {
      const y = canvas.height / 2 + Math.sin(x * 0.06 + phase) * 28 + (Math.random() - 0.5) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, 40);
}

function closeScanModal() {
  document.getElementById('scan-modal').classList.remove('open');
  if (STATE.oscilloscopeTimer) clearInterval(STATE.oscilloscopeTimer);
}

function openSmsModal() { document.getElementById('sms-modal').classList.add('open'); }
function closeSmsModal() { document.getElementById('sms-modal').classList.remove('open'); }
function setSmsText(t) { document.getElementById('sms-input-field').value = t; }
function transmitSms() {
  closeSmsModal();
  showSimpleAlert("DISPATCH TRANSMITTED", "In-cab reroute instructions sent to driver.", "green");
}

function generateWorkOrder() {
  const truck = STATE.trucks.find(t => t.id === STATE.selectedTruckId);
  if (!truck) return;
  truck.workOrder.status = "DISPATCHED TO BAY 3";
  const stBadge = document.getElementById('wo-card-status');
  stBadge.className = "tag-ok";
  stBadge.innerText = "DISPATCHED TO BAY 3";
  setInspectorTab('workorder');
  showSimpleAlert("WORK ORDER DISPATCHED", `Work order generated for ${truck.workOrder.hub}. Bay 3 locked.`, "green");
}

function showToastNotification(truck) {
  const container = document.getElementById('fleet-toast-container');
  if (!container) return;

  playChime();

  const toast = document.createElement('div');
  toast.className = 'toast-clean';
  toast.innerHTML = `
    <div class="tc-title">
      <span><i class="fa-solid fa-triangle-exclamation"></i> HIGHWAY ALERT</span>
      <span class="font-mono">RUL: ${truck.rulHours.toFixed(1)}h</span>
    </div>
    <div style="font-size: 11px; margin-bottom: 6px;"><strong>TRUCK #${truck.id} (${truck.driver})</strong>: ${truck.problem}</div>
    <button class="btn-primary" style="padding: 5px 10px; font-size: 10px;" onclick="openInspector('${truck.id}'); this.parentElement.remove();">
      DEEP INSPECT
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

function showSimpleAlert(title, text, color = "green") {
  const container = document.getElementById('fleet-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-clean';
  const cHex = color === "green" ? "#00e676" : "#00e5ff";
  toast.style.borderColor = cHex;
  toast.style.borderLeftColor = cHex;
  toast.innerHTML = `<strong style="color: ${cHex}; font-size: 11px;">${title}</strong><p style="font-size: 11px; color: #9aa8c2; margin-top: 2px;">${text}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(659, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function startFleetSimLoop() {
  setInterval(() => {
    STATE.trucks.forEach(t => {
      t.rulHours = Math.max(0.1, t.rulHours - 0.005);
      t.telemetry.rpm += Math.floor(Math.random() * 20 - 10);
    });
  }, 3000);

  // Periodic Highway Alert Toast
  if (STATE.toastInterval) clearInterval(STATE.toastInterval);
  STATE.toastInterval = setInterval(() => {
    if (STATE.currentRole === 'fleet') {
      const crit = STATE.trucks.find(t => t.severity === 'critical');
      if (crit) showToastNotification(crit);
    }
  }, 35000);
}


// ==============================================================================
// 3. DRIVER SOFTWARE APP (STREAMLINED 3-MENU MOBILE COCKPIT)
// ==============================================================================

function initDriverApp() {
  switchDriverMenu(STATE.currentDriverMenu);
  renderConsumables();
  renderDriverPids();
  initDriverCharts();
  startDriverSimLoop();
}

/**
 * Switch between the EXACT 3 menus requested by user:
 * 1. 'health'  -> General Health, 0-100 dial, 4 subsystems, sensors, 4-corner TPMS
 * 2. 'predict' -> AI Trend analysis, Smart Alerts with Financial Avoidance, Wear Simulator, live PIDs
 * 3. 'copilot' -> Master Mechanic Chatbot with analogies, Driving Longevity Optimizer, Garage
 */
function switchDriverMenu(menuName) {
  STATE.currentDriverMenu = menuName;

  // 1. Toggle Menu Sections
  const menuSections = document.querySelectorAll('.driver-menu-section');
  menuSections.forEach(sec => sec.classList.remove('active'));

  const activeSection = document.getElementById(`menu-driver-${menuName}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }

  // 2. Toggle Bottom Nav Tab Buttons
  const navTabs = document.querySelectorAll('.driver-3menu-bar .d3-tab');
  navTabs.forEach(tab => tab.classList.remove('active'));

  const activeTab = document.getElementById(`tab-btn-${menuName}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // 3. Resize charts if predict tab is activated
  if (menuName === 'predict') {
    setTimeout(() => {
      ['dCoolant', 'dRpm', 'dVolt'].forEach(k => {
        if (STATE.charts[k]) {
          try { STATE.charts[k].resize(); } catch(e) {}
        }
      });
    }, 150);
  }
}

function resolveDriverAlert(id) {
  const card = document.getElementById(`d-alert-${id}`);
  if (card) {
    card.style.transition = 'all 0.35s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      card.remove();
      const numEl = document.getElementById('driver-gauge-number');
      let score = parseInt(numEl.innerText);
      score = Math.min(100, score + 4);
      numEl.innerText = score;
      document.getElementById('driver-gauge-circle').setAttribute('stroke-dasharray', `${score}, 100`);
      showSimpleAlert("REPAIR SIMULATED", `Health score restored to ${score}/100. Catastrophic cost avoided!`, "green");
    }, 350);
  }
}

function changeDrivingStyle(style) {
  STATE.drivingStyle = style;
  document.getElementById('st-severe').classList.toggle('active', style === 'severe');
  document.getElementById('st-urban').classList.toggle('active', style === 'urban');
  document.getElementById('st-highway').classList.toggle('active', style === 'highway');

  renderConsumables();
}

function renderConsumables() {
  const container = document.getElementById('driver-consumables-grid');
  if (!container) return;

  let mult = 1.0;
  if (STATE.drivingStyle === 'severe') mult = 0.55;
  if (STATE.drivingStyle === 'urban') mult = 0.75;

  container.innerHTML = STATE.consumables.map(c => {
    const remaining = Math.round((c.baseKm - c.currentKm) * mult);
    const pct = Math.max(5, Math.round((remaining / c.baseKm) * 100));
    return `
      <div class="c-item-card">
        <div class="c-item-top">
          <strong>${c.title}</strong>
          <span class="${pct < 35 ? 'text-yellow' : 'text-green'}">${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${pct < 35 ? 'fill-yellow' : 'fill-green'}" style="width: ${pct}%"></div>
        </div>
        <span>${remaining.toLocaleString()} KM remaining</span>
      </div>
    `;
  }).join('');
}

function askCopilotMsg(msg) {
  document.getElementById('chat-input').value = msg;
  sendChatMessage();
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const txt = input.value.trim();
  if (!txt) return;

  const stream = document.getElementById('chat-messages-container');

  // User Message
  const uBubble = document.createElement('div');
  uBubble.className = 'chat-bubble user';
  uBubble.innerHTML = `<p>${txt}</p>`;
  stream.appendChild(uBubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  // AI Diagnostic Response with Real Layman Analogies
  setTimeout(() => {
    let reply = "I've analyzed your live CAN bus stream. Vehicle powertrain combustion and compression are within 98% nominal rating.";
    const q = txt.toLowerCase();

    if (q.includes('hot') || q.includes('engine') || q.includes('temp')) {
      reply = "💡 <strong>Diagnosis:</strong> Coolant is at 104°C (safe max: 98°C). The thermostat valve is sluggish.<br><br><em>Analogy:</em> It's like an oven damper stuck half-open. You're fine for ~45 km, but swapping the $20 thermostat now prevents a $1,850 head gasket warp.";
    } else if (q.includes('brake') || q.includes('pad')) {
      reply = "🛑 <strong>Brakes:</strong> Front pads have 2.7mm remaining (safe limit: 1.5mm). You have ~1,200 km before metal grinds on metal.<br><br><em>Analogy:</em> Pads are like shoe soles—replace them before you wear through to the leather. A $180 pad swap saves $650 in gouged rotors.";
    } else if (q.includes('trim') || q.includes('leak')) {
      reply = "💨 <strong>Fuel Trim:</strong> LTFT is at +14.2% due to unmetered air entering a vacuum crack.<br><br><em>Analogy:</em> It's like drinking through a straw with a pinhole. Your engine injects 8% extra fuel to compensate, wasting ~$1,050/year if not sealed.";
    } else if (q.includes('alternator') || q.includes('battery')) {
      reply = "⚡ <strong>Electrical:</strong> Alternator ripple shows a 120Hz vibration resonance with 13.8V charging output. Servicing bearing brushes now prevents a highway diode short.";
    }

    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble ai';
    aiBubble.innerHTML = `<p>${reply}</p>`;
    stream.appendChild(aiBubble);
    stream.scrollTop = stream.scrollHeight;
  }, 650);
}

function renderDriverPids() {
  const tbody = document.getElementById('driver-pids-body');
  if (!tbody) return;

  tbody.innerHTML = STATE.pids.map(p => `
    <tr>
      <td class="text-cyan">${p.pid}</td>
      <td>${p.name}</td>
      <td class="text-green" id="pid-live-${p.pid}">${p.val}</td>
      <td class="text-muted">${p.unit}</td>
    </tr>
  `).join('');
}

function initDriverCharts() {
  const configs = [
    { id: 'dchart-coolant', color: '#00e5ff', init: 88.2 },
    { id: 'dchart-rpm', color: '#00e676', init: 1480 },
    { id: 'dchart-volt', color: '#ffb300', init: 13.84 }
  ];

  configs.forEach(cfg => {
    const ctx = document.getElementById(cfg.id);
    if (!ctx) return;

    if (cfg.id.includes('coolant') && STATE.charts.dCoolant) {
      try { STATE.charts.dCoolant.destroy(); } catch(e) {}
    }
    if (cfg.id.includes('rpm') && STATE.charts.dRpm) {
      try { STATE.charts.dRpm.destroy(); } catch(e) {}
    }
    if (cfg.id.includes('volt') && STATE.charts.dVolt) {
      try { STATE.charts.dVolt.destroy(); } catch(e) {}
    }

    const initialData = Array(15).fill(cfg.init).map(v => v + (Math.random() * 2 - 1));

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(15).fill(''),
        datasets: [{
          data: initialData,
          borderColor: cfg.color,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: `${cfg.color}15`
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5e6d8a', font: { size: 9 } } }
        }
      }
    });

    if (cfg.id.includes('coolant')) STATE.charts.dCoolant = chart;
    if (cfg.id.includes('rpm')) STATE.charts.dRpm = chart;
    if (cfg.id.includes('volt')) STATE.charts.dVolt = chart;
  });
}

function startDriverSimLoop() {
  if (STATE.telemetryInterval) clearInterval(STATE.telemetryInterval);
  STATE.telemetryInterval = setInterval(() => {
    if (STATE.currentRole !== 'driver') return;

    const temp = 88 + (Math.random() * 0.4 - 0.2);
    const rpm = 1480 + Math.floor(Math.random() * 40 - 20);
    const volt = 13.84 + (Math.random() * 0.1 - 0.05);

    if (STATE.charts.dCoolant) {
      STATE.charts.dCoolant.data.datasets[0].data.shift();
      STATE.charts.dCoolant.data.datasets[0].data.push(temp);
      STATE.charts.dCoolant.update('none');
    }
    if (STATE.charts.dRpm) {
      STATE.charts.dRpm.data.datasets[0].data.shift();
      STATE.charts.dRpm.data.datasets[0].data.push(rpm);
      STATE.charts.dRpm.update('none');
    }

    const tEl = document.getElementById('ds-sens-temp');
    if (tEl) tEl.innerText = `${temp.toFixed(1)}°C`;
    const sEl = document.getElementById('ds-sens-speed');
    if (sEl) sEl.innerText = `${64 + Math.floor(Math.random() * 2)} MPH`;
  }, 2000);
}


// ==============================================================================
// 4. MODALS (SIM LAB, MULTI-CAR GARAGE, AUDIT CERTIFICATE)
// ==============================================================================

function openSimLabModal() { document.getElementById('sim-modal').classList.add('open'); }
function closeSimLabModal() { document.getElementById('sim-modal').classList.remove('open'); }

function triggerAnomaly(type) {
  closeSimLabModal();
  if (type === 'overheat') {
    const tEl = document.getElementById('ds-sens-temp');
    if (tEl) tEl.innerText = '116°C';
    const thEl = document.getElementById('ds-therm-val');
    if (thEl) thEl.innerText = '32%';
    const thBar = document.getElementById('ds-therm-bar');
    if (thBar) { thBar.style.width = '32%'; thBar.className = 'sbar-fill fill-red'; }
    showToastNotification(STATE.trucks[0]);
  } else if (type === 'bearing') {
    openInspector('402');
    showToastNotification(STATE.trucks[0]);
  } else if (type === 'misfire') {
    const misEl = document.getElementById('ds-sens-misfire');
    if (misEl) { misEl.innerText = '4'; misEl.className = 'text-yellow'; }
    const pEl = document.getElementById('ds-power-val');
    if (pEl) pEl.innerText = '61%';
    const pBar = document.getElementById('ds-power-bar');
    if (pBar) { pBar.style.width = '61%'; pBar.className = 'sbar-fill fill-yellow'; }
    showSimpleAlert("CYLINDER MISFIRE", "P0303 Cylinder 3 misfire detected on live stream.", "yellow");
  } else if (type === 'voltage') {
    const vEl = document.getElementById('insp-voltage');
    if (vEl) vEl.innerText = '11.2V';
    showSimpleAlert("VOLTAGE SAG", "Bus voltage dropped to 11.2V (Alternator regulator fault).", "red");
  } else if (type === 'tire') {
    showSimpleAlert("TIRE BLOWOUT HAZARD", "Steer axle tire pressure dropped to 18 PSI.", "red");
  } else if (type === 'tamper') {
    showSimpleAlert("OBD-II DISCONNECTED", "18650 Battery backup engaged seamlessly.", "cyan");
  }
}

function resetSimToNominal() {
  closeSimLabModal();
  const tEl = document.getElementById('ds-sens-temp');
  if (tEl) tEl.innerText = '88°C';
  const misEl = document.getElementById('ds-sens-misfire');
  if (misEl) { misEl.innerText = '0'; misEl.className = 'text-green'; }
  const thEl = document.getElementById('ds-therm-val');
  if (thEl) thEl.innerText = '78%';
  const thBar = document.getElementById('ds-therm-bar');
  if (thBar) { thBar.style.width = '78%'; thBar.className = 'sbar-fill fill-yellow'; }
  const pEl = document.getElementById('ds-power-val');
  if (pEl) pEl.innerText = '95%';
  const pBar = document.getElementById('ds-power-bar');
  if (pBar) { pBar.style.width = '95%'; pBar.className = 'sbar-fill fill-green'; }
  showSimpleAlert("SYSTEM RESTORED", "All sensor channels returned to nominal thresholds.", "green");
}

function openGarageModal() { document.getElementById('garage-modal').classList.add('open'); }
function closeGarageModal() { document.getElementById('garage-modal').classList.remove('open'); }

function pickGarageCar(car) {
  closeGarageModal();
  const title = document.getElementById('driver-vehicle-title');
  const certName = document.getElementById('cert-car-name');
  const num = document.getElementById('driver-gauge-number');

  if (car === 'peterbilt') {
    title.innerText = '2024 Peterbilt 579 (Unit #402)';
    certName.innerText = '2024 Peterbilt 579 UltraLoft';
    num.innerText = '87';
    document.getElementById('driver-gauge-circle').setAttribute('stroke-dasharray', '87, 100');
  } else if (car === 'ford') {
    title.innerText = '2023 Ford F-150 Lightning EV';
    certName.innerText = '2023 Ford F-150 Lightning EV';
    num.innerText = '96';
    document.getElementById('driver-gauge-circle').setAttribute('stroke-dasharray', '96, 100');
  } else if (car === 'bmw') {
    title.innerText = '2022 BMW 330i xDrive Sedan';
    certName.innerText = '2022 BMW 330i xDrive Sedan';
    num.innerText = '74';
    document.getElementById('driver-gauge-circle').setAttribute('stroke-dasharray', '74, 100');
  }
  showSimpleAlert("VEHICLE SWITCHED", title.innerText, "cyan");
}

function openCertModal() { document.getElementById('cert-modal').classList.add('open'); }
function closeCertModal() { document.getElementById('cert-modal').classList.remove('open'); }
