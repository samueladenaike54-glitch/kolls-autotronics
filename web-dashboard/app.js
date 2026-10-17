/**
 * ==============================================================================
 * KOLLS AUTOTRONICS — MINIMALIST RESPONSIVE APP CONTROLLER
 * Mobile-First Fleet Management & Personal In-Cab Diagnostics Platform
 * ==============================================================================
 */

// Application State
const STATE = {
  currentRole: 'fleet',         // 'fleet' | 'driver'
  fleetMobileTab: 'map',        // 'map' | 'triage'
  currentDriverTab: 'health',
  selectedTruckId: '402',
  drivingStyle: 'highway',       // 'severe' | 'urban' | 'highway'
  
  // References
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

  // Fleet Asset Data (Midwest I-80 corridor)
  trucks: [
    {
      id: '402',
      driver: 'John Doe',
      phone: '(515) 890-4412',
      model: '2024 Peterbilt 579',
      location: 'I-80 near Grinnell, IA',
      lat: 41.7431, lng: -92.7222,
      speed: 64, heading: 274,
      voltage: 13.8,
      severity: 'critical',
      rulHours: 3.5,
      problem: 'Alternator Bearing Degradation (120Hz FFT Spike)',
      subsystem: 'Electrical & Charging',
      scores: { powertrain: 98, electrical: 42, brakes: 91, transmission: 89 },
      telemetry: { rpm: 1480, coolant: 198, oil: 46, fuel: 7.2, def: 82, boost: 24.5 },
      hos: { drive: '5h 18m / 11h', shift: '6h 45m / 14h', weekly: '42h 10m / 70h' },
      safetyScore: 98,
      workOrder: { hub: 'Des Moines Logistics Hub (Exit 137)', bay: 'Bay 3', tech: 'Marcus Vance', downtime: '1.5 Hours', status: 'PRE-DISPATCH STAGED' }
    },
    {
      id: '612',
      driver: 'Sarah Jenkins',
      phone: '(319) 552-9011',
      model: '2023 Kenworth T680',
      location: 'I-80 near Iowa City, IA',
      lat: 41.6611, lng: -91.5302,
      speed: 62, heading: 94,
      voltage: 14.1,
      severity: 'critical',
      rulHours: 1.8,
      problem: 'Steer Axle Hub Bearing Thermal Runaway (+85°C)',
      subsystem: 'Brakes & Steer Axle',
      scores: { powertrain: 94, electrical: 96, brakes: 38, transmission: 92 },
      telemetry: { rpm: 1520, coolant: 194, oil: 48, fuel: 7.6, def: 78, boost: 26.0 },
      hos: { drive: '7h 12m / 11h', shift: '8h 30m / 14h', weekly: '51h 20m / 70h' },
      safetyScore: 94,
      workOrder: { hub: 'Cedar Rapids Maintenance Hub', bay: 'Bay 1', tech: 'David Miller', downtime: '2.0 Hours', status: 'READY FOR DISPATCH' }
    },
    {
      id: '108',
      driver: 'Carlos Ramirez',
      phone: '(515) 334-1189',
      model: '2023 Freightliner Cascadia',
      location: 'I-35 near Ames, IA',
      lat: 42.0308, lng: -93.6319,
      speed: 66, heading: 4,
      voltage: 13.9,
      severity: 'warning',
      rulHours: 18.5,
      problem: 'Engine Fuel Trim Drift (+14.2% Vacuum Leak)',
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
      model: '2022 Volvo VNL 860',
      location: 'I-80 near Davenport, IA',
      lat: 41.5236, lng: -90.5776,
      speed: 65, heading: 268,
      voltage: 14.0,
      severity: 'warning',
      rulHours: 24.0,
      problem: 'DPF Soot Backpressure Delta +78%',
      subsystem: 'Exhaust & Emissions',
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
      model: '2024 Peterbilt 579',
      location: 'I-35 near Des Moines, IA',
      lat: 41.5868, lng: -93.6250,
      speed: 58, heading: 185,
      voltage: 13.9,
      severity: 'warning',
      rulHours: 32.0,
      problem: 'Transmission Oil Temperature Elevated (+12°C)',
      subsystem: 'Transmission & Drive',
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
      location: 'I-80 near Newton, IA',
      lat: 41.6997, lng: -93.0477,
      speed: 65, heading: 272,
      voltage: 14.1,
      severity: 'warning',
      rulHours: 48.0,
      problem: 'Coolant Heat Dissipation Lag (Sticky Thermostat)',
      subsystem: 'Thermal & Cooling',
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
      location: 'I-80 near Altoona, IA',
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
      location: 'I-80 near Coralville, IA',
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
    { title: 'Front Brake Pads', baseKm: 25000, currentKm: 19000 },
    { title: 'Steer Axle Tires', baseKm: 60000, currentKm: 42000 },
    { title: 'Spark / Glow Plugs', baseKm: 80000, currentKm: 48000 },
    { title: 'Coolant Purity', baseKm: 100000, currentKm: 22000 },
    { title: 'Transmission Fluid', baseKm: 120000, currentKm: 34000 }
  ],

  // OBD-II PID Registry
  pids: [
    { pid: '0x0C', name: 'Engine Speed', val: '1,480', unit: 'RPM' },
    { pid: '0x05', name: 'Coolant Temperature', val: '88.2', unit: '°C' },
    { pid: '0x04', name: 'Calculated Engine Load', val: '42.0', unit: '%' },
    { pid: '0x0F', name: 'Intake Air Temp (IAT)', val: '28.5', unit: '°C' },
    { pid: '0x42', name: 'Control Module Voltage', val: '13.84', unit: 'V' },
    { pid: '0x06', name: 'Short-Term Fuel Trim', val: '+1.6', unit: '%' },
    { pid: '0x07', name: 'Long-Term Fuel Trim', val: '+4.2', unit: '%' },
    { pid: '0x0D', name: 'Vehicle Speed', val: '103', unit: 'km/h' },
    { pid: '0x10', name: 'Mass Air Flow (MAF)', val: '84.2', unit: 'g/s' },
    { pid: '0x33', name: 'Barometric Pressure', val: '99.1', unit: 'kPa' },
    { pid: '0x1F', name: 'Runtime Since Start', val: '19,080', unit: 's' },
    { pid: '0x46', name: 'Ambient Air Temp', val: '21.0', unit: '°C' }
  ]
};

// ==============================================================================
// 1. LIFECYCLE & PORTAL SWITCHING
// ==============================================================================

window.addEventListener('DOMContentLoaded', () => {
  initClock();
});

function initClock() {
  setInterval(() => {
    const clockEl = document.getElementById('fm-clock');
    if (clockEl) {
      clockEl.innerText = new Date().toISOString().substring(11, 19);
    }
  }, 1000);
}

function setRole(role) {
  STATE.currentRole = role;
  document.getElementById('btn-role-fleet').classList.toggle('active', role === 'fleet');
  document.getElementById('btn-role-driver').classList.toggle('active', role === 'driver');
  document.getElementById('btn-login-label').innerText = role === 'fleet' ? 'LAUNCH FLEET COMMAND' : 'ENTER DRIVER COCKPIT';
}

function submitLogin() {
  if (STATE.currentRole === 'fleet') {
    showFleet();
  } else {
    showDriver();
  }
}

function quickEnter(role) {
  setRole(role);
  submitLogin();
}

function showLogin() {
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.getElementById('login-view').classList.add('active');
}

function showFleet() {
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.getElementById('fleet-view').classList.add('active');
  initFleetApp();
}

function showDriver() {
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.getElementById('driver-view').classList.add('active');
  initDriverApp();
}

// ==============================================================================
// 2. FLEET MANAGER SOFTWARE APP
// ==============================================================================

function initFleetApp() {
  renderTriageList('all');
  initLeaflet();
  setFleetMobileView(STATE.fleetMobileTab);
  openInspector('402'); // Open first truck by default
  startFleetSimLoop();

  // Trigger demo toast alert after 6 seconds
  setTimeout(() => {
    showToastNotification(STATE.trucks[1]); // Truck #612 Hub Bearing
  }, 6000);
}

function setFleetMobileView(tab) {
  STATE.fleetMobileTab = tab;
  document.getElementById('v-toggle-map').classList.toggle('active', tab === 'map');
  document.getElementById('v-toggle-triage').classList.toggle('active', tab === 'triage');

  const mapPanel = document.getElementById('fleet-map-panel');
  const triagePanel = document.getElementById('fleet-triage-panel');

  if (tab === 'map') {
    mapPanel.classList.add('mobile-active');
    triagePanel.classList.remove('mobile-active');
    if (STATE.map) {
      setTimeout(() => STATE.map.invalidateSize(), 200);
    }
  } else {
    triagePanel.classList.add('mobile-active');
    mapPanel.classList.remove('mobile-active');
  }
}

function renderTriageList(filter = 'all') {
  const container = document.getElementById('triage-cards-container');
  if (!container) return;

  let list = [...STATE.trucks];
  if (filter !== 'all') {
    list = list.filter(t => t.severity === filter);
  }
  list.sort((a, b) => a.rulHours - b.rulHours);

  container.innerHTML = list.map(truck => `
    <div class="triage-card ${truck.severity}" onclick="openInspector('${truck.id}')">
      <div class="tc-row-top">
        <span class="tc-truck-id"><i class="fa-solid fa-truck"></i> TRUCK #${truck.id}</span>
        <span class="tc-rul-tag ${truck.severity === 'critical' ? 'crit' : (truck.severity === 'warning' ? 'warn' : 'sched')}">
          <i class="fa-solid fa-clock"></i> RUL: ${truck.rulHours.toFixed(1)}h
        </span>
      </div>
      <div class="tc-problem">${truck.problem}</div>
      <div class="tc-subsystem"><i class="fa-solid fa-microchip"></i> ${truck.subsystem} • ${truck.location}</div>
      <button class="tc-btn-inspect" onclick="event.stopPropagation(); openInspector('${truck.id}')">
        INSPECT ASSET <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  `).join('');
}

function filterTriage(category) {
  document.querySelectorAll('#triage-filters .f-pill').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.toLowerCase().includes(category) || (category === 'all' && btn.innerText === 'All'));
  });
  renderTriageList(category);
}

function initLeaflet() {
  if (STATE.map) {
    STATE.map.invalidateSize();
    return;
  }

  const mapEl = document.getElementById('fleet-leaflet-map');
  if (!mapEl) return;

  STATE.map = L.map('fleet-leaflet-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([41.65, -92.5], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(STATE.map);

  L.control.zoom({ position: 'bottomright' }).addTo(STATE.map);

  // Render Service Hub Geofences
  const depots = [
    { name: 'Des Moines Logistics Hub (Exit 137)', lat: 41.5868, lng: -93.6250, radius: 4500 },
    { name: 'Iowa City Maintenance Hub (Exit 244)', lat: 41.6611, lng: -91.5302, radius: 3500 },
    { name: 'Cedar Rapids Freight Depot', lat: 41.9779, lng: -91.6656, radius: 3000 },
    { name: 'Davenport Riverfront Terminal', lat: 41.5236, lng: -90.5776, radius: 4000 }
  ];

  depots.forEach(d => {
    const circle = L.circle([d.lat, d.lng], {
      color: '#00e5ff',
      fillColor: '#00e5ff',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 4',
      radius: d.radius
    }).addTo(STATE.map);
    circle.bindTooltip(`🏢 ${d.name}`, { direction: 'top' });
    STATE.depotCircles.push(circle);
  });

  // Render Truck Directional Markers
  STATE.trucks.forEach(t => {
    let dotClass = 'dot-green';
    if (t.severity === 'critical') dotClass = 'dot-red';
    if (t.severity === 'warning') dotClass = 'dot-yellow';

    const customIcon = L.divIcon({
      className: 'truck-div-marker',
      html: `<div class="truck-map-dot ${dotClass}" style="transform: rotate(${t.heading}deg);"><i class="fa-solid fa-arrow-up"></i></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const marker = L.marker([t.lat, t.lng], { icon: customIcon }).addTo(STATE.map);
    marker.on('click', () => openInspector(t.id));
    STATE.markers[t.id] = marker;
  });
}

function toggleMapLayer(layer) {
  if (layer === 'depots') {
    const btn = document.getElementById('btn-layer-depots');
    const isActive = btn.classList.toggle('active');
    STATE.depotCircles.forEach(c => {
      if (isActive) c.addTo(STATE.map);
      else STATE.map.removeLayer(c);
    });
  }
}

// Zone 4: Deep Asset Inspector Drawer
function openInspector(truckId) {
  STATE.selectedTruckId = truckId;
  const truck = STATE.trucks.find(t => t.id === truckId);
  if (!truck) return;

  // Center Map on Truck
  if (STATE.map && STATE.markers[truckId]) {
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

  document.getElementById('diag-rul-val').innerText = `${truck.rulHours.toFixed(1)} Hours`;

  renderVibrationFFT();

  // Tab 2: Live Telemetry
  document.getElementById('tele-val-rpm').innerText = truck.telemetry.rpm;
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
  document.getElementById('asset-inspector').classList.remove('open');
}

function setInspectorTab(tabName) {
  document.querySelectorAll('.drawer-tabs .d-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tabName));
  });
  document.querySelectorAll('.drawer-body .d-tab-panel').forEach(p => {
    p.classList.remove('active');
  });
  document.getElementById(`tab-insp-${tabName}`).classList.add('active');
}

function renderVibrationFFT() {
  const ctx = document.getElementById('chart-vibration-fft');
  if (!ctx) return;

  if (STATE.charts.vibration) {
    STATE.charts.vibration.destroy();
  }

  const freqs = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
  const normalCurve = [1.1, 1.3, 1.2, 1.4, 1.2, 1.3, 1.1, 1.2, 1.1, 1.0];
  const anomalyCurve = [1.2, 1.4, 1.3, 1.5, 2.1, 6.2, 2.3, 1.4, 1.2, 1.1]; // 120Hz peak

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
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;

  if (STATE.oscilloscopeTimer) clearInterval(STATE.oscilloscopeTimer);

  let phase = 0;
  STATE.oscilloscopeTimer = setInterval(() => {
    STATE.scanSecondsLeft--;
    const mins = Math.floor(STATE.scanSecondsLeft / 60);
    const secs = STATE.scanSecondsLeft % 60;
    document.getElementById('scan-timer-val').innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

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
  document.getElementById('wo-card-status').className = "badge-green";
  document.getElementById('wo-card-status').innerText = "DISPATCHED TO BAY 3";
  setInspectorTab('workorder');
  showSimpleAlert("WORK ORDER DISPATCHED", `Work order generated for ${truck.workOrder.hub}. Parts locked.`, "green");
}

function showToastNotification(truck) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-clean';
  toast.innerHTML = `
    <div class="tc-title">
      <span><i class="fa-solid fa-triangle-exclamation"></i> HIGHWAY MECHANICAL ALERT</span>
      <span class="font-mono">RUL: ${truck.rulHours.toFixed(1)}h</span>
    </div>
    <div><strong>TRUCK #${truck.id} (${truck.driver})</strong>: ${truck.problem} on ${truck.location}</div>
    <button class="btn-primary" style="padding: 6px; font-size: 11px; margin-top: 4px;" onclick="openInspector('${truck.id}'); this.parentElement.remove();">
      INSPECT ASSET
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);
}

function showSimpleAlert(title, text, color = "green") {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-clean';
  toast.style.borderColor = color === "green" ? "#00e676" : "#00e5ff";
  toast.style.borderLeftColor = color === "green" ? "#00e676" : "#00e5ff";
  toast.innerHTML = `<strong style="color: ${color === "green" ? "#00e676" : "#00e5ff"};">${title}</strong><p style="font-size: 11px; color: #9aa8c2;">${text}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function startFleetSimLoop() {
  setInterval(() => {
    STATE.trucks.forEach(t => {
      t.rulHours = Math.max(0.1, t.rulHours - 0.005);
      t.telemetry.rpm += Math.floor(Math.random() * 20 - 10);
    });
  }, 3000);
}

// ==============================================================================
// 3. DRIVER SOFTWARE APP
// ==============================================================================

function initDriverApp() {
  renderConsumables();
  renderDriverPids();
  initDriverCharts();
  startDriverSimLoop();
}

function setDriverTab(tabId) {
  STATE.currentDriverTab = tabId;

  // Update Bottom Nav
  document.querySelectorAll('.driver-bottom-nav .nav-tab').forEach(b => {
    b.classList.toggle('active', b.innerText.toLowerCase().includes(tabId));
  });

  // Update Sub Screens
  document.querySelectorAll('.driver-sub-screen').forEach(s => {
    s.classList.remove('active');
  });
  document.getElementById(`d-screen-${tabId}`).classList.add('active');
}

function resolveDriverAlert(id) {
  const card = document.getElementById(`d-alert-${id}`);
  if (card) {
    card.style.transition = 'all 0.4s';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      card.remove();
      const numEl = document.getElementById('driver-gauge-number');
      let score = parseInt(numEl.innerText);
      score = Math.min(100, score + 4);
      numEl.innerText = score;
      document.getElementById('driver-gauge-circle').setAttribute('stroke-dasharray', `${score}, 100`);
      showSimpleAlert("REPAIR SIMULATED", `Score restored to ${score}/100. Catastrophic cost avoided!`, "green");
    }, 400);
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
    const pct = Math.round((remaining / c.baseKm) * 100);
    return `
      <div class="c-item-card">
        <div class="c-item-top">
          <strong>${c.title}</strong>
          <span class="${pct < 35 ? 'text-yellow' : 'text-green'}">${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${pct < 35 ? 'fill-yellow' : 'fill-green'}" style="width: ${pct}%"></div>
        </div>
        <span>${remaining} km remaining</span>
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

  // User message
  const uBubble = document.createElement('div');
  uBubble.className = 'chat-bubble user';
  uBubble.innerHTML = `<p>${txt}</p>`;
  stream.appendChild(uBubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  // AI response
  setTimeout(() => {
    let reply = "I've analyzed your live CAN bus channels. Power delivery is running within normal limits.";
    if (txt.toLowerCase().includes('hot') || txt.toLowerCase().includes('engine') || txt.toLowerCase().includes('temp')) {
      reply = "💡 <strong>Diagnosis:</strong> Coolant is at 104°C (safe max: 98°C). The thermostat valve is sluggish. <em>Analogy:</em> It's like an oven damper stuck half-open. Safe for ~45 km, but change the $20 thermostat to prevent a $1,850 head gasket warp.";
    } else if (txt.toLowerCase().includes('brake') || txt.toLowerCase().includes('pad')) {
      reply = "🛑 <strong>Brakes:</strong> Front pads have 2.7mm remaining (safe limit 1.5mm). You have ~1,200 km before metal grinds on metal. A $180 pad change today saves $650 in dual rotor replacements.";
    } else if (txt.toLowerCase().includes('trim')) {
      reply = "💨 <strong>Fuel Trim:</strong> LTFT is at +14.2% due to unmetered air entering a vacuum crack. It wastes ~$850/year in excess fuel if not sealed.";
    }

    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble ai';
    aiBubble.innerHTML = `<p>${reply}</p>`;
    stream.appendChild(aiBubble);
    stream.scrollTop = stream.scrollHeight;
  }, 700);
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
    { id: 'dchart-coolant', color: '#00e5ff', init: 88 },
    { id: 'dchart-rpm', color: '#00e676', init: 1480 },
    { id: 'dchart-volt', color: '#ffb300', init: 13.8 }
  ];

  configs.forEach(cfg => {
    const ctx = document.getElementById(cfg.id);
    if (!ctx) return;
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
        scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5e6d8a', font: { size: 9 } } } }
      }
    });

    if (cfg.id.includes('coolant')) STATE.charts.dCoolant = chart;
    if (cfg.id.includes('rpm')) STATE.charts.dRpm = chart;
    if (cfg.id.includes('volt')) STATE.charts.dVolt = chart;
  });
}

function startDriverSimLoop() {
  setInterval(() => {
    const temp = 88 + (Math.random() * 0.4 - 0.2);
    const rpm = 1480 + Math.floor(Math.random() * 40 - 20);
    const volt = 13.8 + (Math.random() * 0.1 - 0.05);

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
  }, 2000);
}

// ==============================================================================
// 4. MODALS (SIM LAB, GARAGE, AUDIT CERTIFICATE)
// ==============================================================================

function openSimLabModal() { document.getElementById('sim-modal').classList.add('open'); }
function closeSimLabModal() { document.getElementById('sim-modal').classList.remove('open'); }

function triggerAnomaly(type) {
  closeSimLabModal();
  if (type === 'overheat') {
    document.getElementById('ds-sens-temp').innerText = '116°C';
    document.getElementById('ds-therm-val').innerText = '32%';
    document.getElementById('ds-therm-bar').style.width = '32%';
    document.getElementById('ds-therm-bar').className = 'bar-fill fill-red';
    showToastNotification(STATE.trucks[0]);
  } else if (type === 'bearing') {
    openInspector('402');
    showToastNotification(STATE.trucks[0]);
  } else if (type === 'misfire') {
    document.getElementById('ds-sens-misfire').innerText = '4';
    document.getElementById('ds-power-val').innerText = '61%';
    document.getElementById('ds-power-bar').style.width = '61%';
    document.getElementById('ds-power-bar').className = 'bar-fill fill-yellow';
    showSimpleAlert("CYLINDER MISFIRE", "P0303 Cylinder 3 misfire detected.", "yellow");
  } else if (type === 'voltage') {
    document.getElementById('insp-voltage').innerText = '11.2V';
    showSimpleAlert("VOLTAGE SAG", "Bus voltage dropped to 11.2V.", "red");
  } else if (type === 'tire') {
    showSimpleAlert("TIRE BLOWOUT HAZARD", "Steer tire pressure dropped to 18 PSI.", "red");
  } else if (type === 'tamper') {
    showSimpleAlert("OBD-II DISCONNECTED", "18650 Battery backup engaged.", "cyan");
  }
}

function resetSimToNominal() {
  closeSimLabModal();
  document.getElementById('ds-sens-temp').innerText = '88°C';
  document.getElementById('ds-sens-misfire').innerText = '0';
  document.getElementById('ds-therm-val').innerText = '78%';
  document.getElementById('ds-therm-bar').style.width = '78%';
  document.getElementById('ds-therm-bar').className = 'bar-fill fill-yellow';
  document.getElementById('ds-power-val').innerText = '95%';
  document.getElementById('ds-power-bar').style.width = '95%';
  document.getElementById('ds-power-bar').className = 'bar-fill fill-green';
  showSimpleAlert("SYSTEM RESTORED", "All parameters returned to nominal.", "green");
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
    certName.innerText = '2024 Peterbilt 579';
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
