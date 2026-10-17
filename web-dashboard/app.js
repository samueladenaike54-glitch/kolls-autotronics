/**
 * ==============================================================================
 * KOLLS AUTOTRONICS — DUAL-ROLE FLEET & DRIVER INTELLIGENCE PLATFORM
 * Core Engine: Geospatial Fleet Dispatcher, In-Cab Prognostics & AI Copilot
 * ==============================================================================
 */

// Global Application State
const APP = {
  currentRole: 'fleet',         // 'fleet' | 'driver'
  activeFleetDivision: 'midwest',
  currentDriverScreen: 'health',
  selectedTruckId: '402',
  inspectorOpen: false,
  drivingStyle: 'highway',       // 'severe' | 'urban' | 'highway'
  audioEnabled: true,
  isPhoneFrame: false,
  oscilloscopeInterval: null,
  oscilloscopeTimer: 120,        // 2 minutes in seconds
  
  // Audio Context (Synthesizer Chimes)
  audioCtx: null,

  // Map & Markers Reference
  map: null,
  markers: {},
  depotCircles: [],
  weatherOverlay: null,
  trafficOverlay: null,

  // Chart Instances
  charts: {
    vibration: null,
    driverCoolant: null,
    driverRpm: null,
    driverVoltage: null
  },

  // Fleet Asset Registry (8 Detailed Sample Trucks in Midwest I-80 Corridor)
  trucks: [
    {
      id: '402',
      driver: 'John Doe',
      phone: '+1 (515) 890-4412',
      cdl: 'CDL-A #IA-90488214',
      vin: '1FUJBBC97NL62881',
      model: '2024 Peterbilt 579 UltraLoft',
      location: 'I-80 Westbound near Grinnell, IA (MP 182)',
      lat: 41.7431,
      lng: -92.7222,
      speed: 64,
      heading: '274° WNW',
      headingDeg: 274,
      voltage: 13.8,
      severity: 'critical',
      rulHours: 3.5,
      problem: 'Alternator Bearing Failure Imminent',
      impact: 'Stator lockup in 3.5 hrs; complete bus blackout on I-80.',
      subsystem: 'Electrical & Charging',
      subsystemScores: { powertrain: 98, electrical: 42, brakes: 91, transmission: 89 },
      vibrationFreq: 120, // 120 Hz peak
      telemetry: { rpm: 1480, coolantF: 198, oilPressPsi: 46, fuelGph: 7.2, defPct: 82, boostPsi: 24.5 },
      hos: { driveUsed: '5h 18m', driveLimit: '11h 00m', shiftUsed: '6h 45m', shiftLimit: '14h 00m', weeklyUsed: '42h 10m', weeklyLimit: '70h 00m' },
      safetyScore: 98,
      tpms: [108, 107, 102, 103, 102, 104, 101, 101, 103, 102, 105, 104, 106, 105, 104, 103, 105, 104],
      workOrder: {
        id: 'WO-8902-TR402',
        hub: 'Des Moines Logistics Hub (Exit 137)',
        bay: 'Bay 3',
        tech: 'Marcus Vance (ASE Master)',
        downtime: '1.5 Hours',
        status: 'PRE-DISPATCH STAGED'
      }
    },
    {
      id: '612',
      driver: 'Sarah Jenkins',
      phone: '+1 (319) 552-9011',
      cdl: 'CDL-A #IL-77291034',
      vin: '2WKDC29X8PM39102',
      model: '2023 Kenworth T680 Next Gen',
      location: 'I-80 Eastbound near Iowa City, IA (MP 244)',
      lat: 41.6611,
      lng: -91.5302,
      speed: 62,
      heading: '94° E',
      headingDeg: 94,
      voltage: 14.1,
      severity: 'critical',
      rulHours: 1.8,
      problem: 'Steer Axle Hub Bearing Overheating (+85°C)',
      impact: 'Bearing thermal seizure risk in 1.8 hrs; steer lockup hazard.',
      subsystem: 'Brakes & Steer Axle',
      subsystemScores: { powertrain: 94, electrical: 96, brakes: 38, transmission: 92 },
      vibrationFreq: 180,
      telemetry: { rpm: 1520, coolantF: 194, oilPressPsi: 48, fuelGph: 7.6, defPct: 78, boostPsi: 26.0 },
      hos: { driveUsed: '7h 12m', driveLimit: '11h 00m', shiftUsed: '8h 30m', shiftLimit: '14h 00m', weeklyUsed: '51h 20m', weeklyLimit: '70h 00m' },
      safetyScore: 94,
      tpms: [118, 108, 102, 101, 102, 103, 101, 100, 102, 102, 105, 105, 104, 105, 103, 104, 104, 103],
      workOrder: {
        id: 'WO-8903-TR612',
        hub: 'Cedar Rapids Maintenance Hub (Exit 246)',
        bay: 'Bay 1',
        tech: 'David Miller',
        downtime: '2.0 Hours',
        status: 'READY FOR DISPATCH'
      }
    },
    {
      id: '108',
      driver: 'Carlos Ramirez',
      phone: '+1 (515) 334-1189',
      cdl: 'CDL-A #MO-44019281',
      vin: '1FUJBBC93PL19844',
      model: '2023 Freightliner Cascadia 126',
      location: 'I-35 Northbound near Ames, IA (MP 113)',
      lat: 42.0308,
      lng: -93.6319,
      speed: 66,
      heading: '04° N',
      headingDeg: 4,
      voltage: 13.9,
      severity: 'warning',
      rulHours: 18.5,
      problem: 'Engine Fuel Trim Drift (+14.2% Lean Spike)',
      impact: 'Intake vacuum leak causing +8% fuel penalty and hot exhaust.',
      subsystem: 'Powertrain & Air Intake',
      subsystemScores: { powertrain: 76, electrical: 94, brakes: 92, transmission: 90 },
      vibrationFreq: 45,
      telemetry: { rpm: 1450, coolantF: 204, oilPressPsi: 44, fuelGph: 8.4, defPct: 88, boostPsi: 22.0 },
      hos: { driveUsed: '3h 40m', driveLimit: '11h 00m', shiftUsed: '4h 15m', shiftLimit: '14h 00m', weeklyUsed: '34h 00m', weeklyLimit: '70h 00m' },
      safetyScore: 96,
      tpms: [106, 105, 102, 102, 103, 102, 101, 101, 103, 102, 104, 104, 105, 104, 103, 103, 104, 104],
      workOrder: {
        id: 'WO-8904-TR108',
        hub: 'Ames Logistics Depot',
        bay: 'Bay 2',
        tech: 'Frank Castle',
        downtime: '1.0 Hour',
        status: 'MONITORING'
      }
    },
    {
      id: '255',
      driver: 'Marcus Brody',
      phone: '+1 (319) 480-2299',
      cdl: 'CDL-A #NE-88129033',
      vin: '3AKJHHDR5LS98210',
      model: '2022 Volvo VNL 860',
      location: 'I-80 Westbound near Davenport, IA (MP 292)',
      lat: 41.5236,
      lng: -90.5776,
      speed: 65,
      heading: '268° W',
      headingDeg: 268,
      voltage: 14.0,
      severity: 'warning',
      rulHours: 24.0,
      problem: 'DPF Soot Loading Delta +78% Backpressure',
      impact: 'High exhaust backpressure; manual parked regeneration required.',
      subsystem: 'Exhaust & Emissions',
      subsystemScores: { powertrain: 81, electrical: 98, brakes: 95, transmission: 92 },
      vibrationFreq: 30,
      telemetry: { rpm: 1390, coolantF: 201, oilPressPsi: 45, fuelGph: 7.9, defPct: 65, boostPsi: 23.0 },
      hos: { driveUsed: '6h 10m', driveLimit: '11h 00m', shiftUsed: '7h 00m', shiftLimit: '14h 00m', weeklyUsed: '39h 15m', weeklyLimit: '70h 00m' },
      safetyScore: 92,
      tpms: [108, 107, 103, 102, 102, 103, 101, 101, 102, 103, 105, 105, 104, 104, 103, 104, 104, 103],
      workOrder: { id: 'WO-8905-TR255', hub: 'Quad Cities Logistics Hub', bay: 'Bay 4', tech: 'Gary Ross', downtime: '1.0 Hour', status: 'STAGED' }
    },
    {
      id: '789',
      driver: 'Elena Rostova',
      phone: '+1 (515) 789-0021',
      cdl: 'CDL-A #IA-19028374',
      vin: '1FUJBBC98NL90124',
      model: '2024 Peterbilt 579',
      location: 'I-35 Southbound near Des Moines, IA (MP 78)',
      lat: 41.5868,
      lng: -93.6250,
      speed: 58,
      heading: '185° S',
      headingDeg: 185,
      voltage: 13.9,
      severity: 'warning',
      rulHours: 32.0,
      problem: 'Transmission Oil Temperature +12°C Elevated',
      impact: 'Fluid shearing risk under haulage loading; cooler flush recommended.',
      subsystem: 'Transmission & Drive',
      subsystemScores: { powertrain: 92, electrical: 95, brakes: 88, transmission: 74 },
      vibrationFreq: 60,
      telemetry: { rpm: 1420, coolantF: 196, oilPressPsi: 47, fuelGph: 7.4, defPct: 90, boostPsi: 21.0 },
      hos: { driveUsed: '2h 15m', driveLimit: '11h 00m', shiftUsed: '3h 00m', shiftLimit: '14h 00m', weeklyUsed: '22h 30m', weeklyLimit: '70h 00m' },
      safetyScore: 99,
      tpms: [107, 107, 102, 102, 103, 103, 101, 101, 102, 102, 104, 104, 105, 105, 104, 104, 103, 103],
      workOrder: { id: 'WO-8906-TR789', hub: 'Des Moines Logistics Hub', bay: 'Bay 2', tech: 'Marcus Vance', downtime: '1.2 Hours', status: 'STAGED' }
    },
    {
      id: '331',
      driver: 'Trevor Belmont',
      phone: '+1 (319) 902-3311',
      cdl: 'CDL-A #WI-55091823',
      vin: '2WKDC29X5PM11904',
      model: '2023 Kenworth T680',
      location: 'I-80 Westbound near Newton, IA (MP 164)',
      lat: 41.6997,
      lng: -93.0477,
      speed: 65,
      heading: '272° W',
      headingDeg: 272,
      voltage: 14.1,
      severity: 'warning',
      rulHours: 48.0,
      problem: 'Coolant Heat Dissipation Lag (Thermostat Sticky)',
      impact: 'Sluggish thermostat cycle causing slow temp rise on climbs.',
      subsystem: 'Thermal & Cooling',
      subsystemScores: { powertrain: 94, electrical: 97, brakes: 93, transmission: 91 },
      vibrationFreq: 25,
      telemetry: { rpm: 1490, coolantF: 208, oilPressPsi: 43, fuelGph: 7.5, defPct: 76, boostPsi: 25.0 },
      hos: { driveUsed: '8h 20m', driveLimit: '11h 00m', shiftUsed: '9h 40m', shiftLimit: '14h 00m', weeklyUsed: '58h 10m', weeklyLimit: '70h 00m' },
      safetyScore: 91,
      tpms: [106, 106, 102, 101, 102, 103, 100, 101, 102, 102, 105, 104, 104, 105, 103, 103, 104, 104],
      workOrder: { id: 'WO-8907-TR331', hub: 'Newton Service Depot', bay: 'Bay 1', tech: 'Tom Sterling', downtime: '0.8 Hours', status: 'SCHEDULED' }
    },
    {
      id: '044',
      driver: 'David Kim',
      phone: '+1 (515) 441-9988',
      cdl: 'CDL-A #IL-30192844',
      vin: '1FUJBBC92ML88219',
      model: '2022 Freightliner Cascadia',
      location: 'I-80 Eastbound near Altoona, IA (MP 142)',
      lat: 41.6442,
      lng: -93.4994,
      speed: 63,
      heading: '92° E',
      headingDeg: 92,
      voltage: 14.2,
      severity: 'scheduled',
      rulHours: 72.0,
      problem: 'Routine PM-B Synthetic Oil Service in 1,200 KM',
      impact: 'Scheduled maintenance interval approaching statutory limit.',
      subsystem: 'Lubrication System',
      subsystemScores: { powertrain: 96, electrical: 98, brakes: 92, transmission: 95 },
      vibrationFreq: 20,
      telemetry: { rpm: 1430, coolantF: 195, oilPressPsi: 48, fuelGph: 7.1, defPct: 89, boostPsi: 23.5 },
      hos: { driveUsed: '4h 10m', driveLimit: '11h 00m', shiftUsed: '5h 00m', shiftLimit: '14h 00m', weeklyUsed: '28h 00m', weeklyLimit: '70h 00m' },
      safetyScore: 98,
      tpms: [108, 108, 103, 103, 102, 102, 101, 101, 103, 103, 105, 105, 104, 104, 104, 103, 104, 104],
      workOrder: { id: 'WO-8908-TR044', hub: 'Des Moines Logistics Hub', bay: 'Bay 5', tech: 'Marcus Vance', downtime: '1.0 Hour', status: 'SCHEDULED' }
    },
    {
      id: '517',
      driver: 'Rachel Adams',
      phone: '+1 (319) 517-8820',
      cdl: 'CDL-A #IA-99201834',
      vin: '3AKJHHDR9KS11942',
      model: '2023 Volvo VNL 760',
      location: 'I-80 Westbound near Coralville, IA (MP 240)',
      lat: 41.6781,
      lng: -91.5833,
      speed: 64,
      heading: '271° W',
      headingDeg: 271,
      voltage: 13.7,
      severity: 'scheduled',
      rulHours: 96.0,
      problem: 'Pneumatic Air Dryer Desiccant Cartridge Saturation',
      impact: 'Recommended desiccant cartridge exchange at next scheduled bay.',
      subsystem: 'Pneumatic Brake Supply',
      subsystemScores: { powertrain: 98, electrical: 97, brakes: 86, transmission: 94 },
      vibrationFreq: 15,
      telemetry: { rpm: 1460, coolantF: 197, oilPressPsi: 46, fuelGph: 7.3, defPct: 84, boostPsi: 24.0 },
      hos: { driveUsed: '5h 00m', driveLimit: '11h 00m', shiftUsed: '6h 15m', shiftLimit: '14h 00m', weeklyUsed: '36h 40m', weeklyLimit: '70h 00m' },
      safetyScore: 97,
      tpms: [107, 108, 102, 103, 103, 102, 101, 101, 102, 103, 105, 104, 105, 104, 103, 103, 104, 104],
      workOrder: { id: 'WO-8909-TR517', hub: 'Iowa City Service Hub', bay: 'Bay 2', tech: 'Paul Walker', downtime: '0.7 Hours', status: 'SCHEDULED' }
    }
  ],

  // Driver Consumables Base Data
  driverConsumables: {
    oil: { name: 'Synthetic Heavy Engine Oil', currentKm: 5800, baseLimitKm: 12000, unit: 'km', cost: 180 },
    brakes: { name: 'Front Ceramic Brake Pads', currentMm: 6.8, baseLimitMm: 12.0, minMm: 2.0, unit: 'mm', cost: 220 },
    tires: { name: 'Steer Axle Commercial Tires', currentPct: 82, baseLimitKm: 60000, unit: '% tread', cost: 950 },
    plugs: { name: 'High-Energy Spark/Glow Plugs', currentKm: 32000, baseLimitKm: 80000, unit: 'km', cost: 140 },
    coolant: { name: 'Extended Life OAT Coolant Mix', currentPct: 78, baseLimitKm: 100000, unit: '% purity', cost: 90 },
    trans: { name: 'Heavy Transmission Fluid', currentPct: 88, baseLimitKm: 120000, unit: '% viscosity', cost: 350 }
  },

  // Raw OBD-II PID Registry (12 standard channels)
  pidChannels: [
    { pid: '0x0C', name: 'Engine Speed (RPM)', hex: '01 0C', val: 1480, unit: 'RPM', norm: '600-2200', status: 'ok' },
    { pid: '0x05', name: 'Engine Coolant Temp (ECT)', hex: '01 05', val: 92.2, unit: '°C', norm: '82-95°C', status: 'ok' },
    { pid: '0x04', name: 'Calculated Engine Load', hex: '01 04', val: 45.0, unit: '%', norm: '20-85%', status: 'ok' },
    { pid: '0x0F', name: 'Intake Air Temperature (IAT)', hex: '01 0F', val: 28.5, unit: '°C', norm: '15-45°C', status: 'ok' },
    { pid: '0x42', name: 'Control Module Voltage', hex: '01 42', val: 13.84, unit: 'V', norm: '13.2-14.4V', status: 'ok' },
    { pid: '0x06', name: 'Short-Term Fuel Trim (STFT)', hex: '01 06', val: +1.6, unit: '%', norm: '-10% to +10%', status: 'ok' },
    { pid: '0x07', name: 'Long-Term Fuel Trim (LTFT)', hex: '01 07', val: +4.2, unit: '%', norm: '-10% to +10%', status: 'ok' },
    { pid: '0x0D', name: 'Vehicle Speed Sensor (VSS)', hex: '01 0D', val: 103, unit: 'km/h', norm: '0-120 km/h', status: 'ok' },
    { pid: '0x10', name: 'Mass Air Flow (MAF)', hex: '01 10', val: 84.2, unit: 'g/s', norm: '15-220 g/s', status: 'ok' },
    { pid: '0x33', name: 'Absolute Barometric Pressure', hex: '01 33', val: 99.1, unit: 'kPa', norm: '95-105 kPa', status: 'ok' },
    { pid: '0x1F', name: 'Engine Run Time Since Start', hex: '01 1F', val: 19080, unit: 'sec', norm: 'N/A', status: 'ok' },
    { pid: '0x46', name: 'Ambient Air Temperature', hex: '01 46', val: 21.0, unit: '°C', norm: 'Ambient', status: 'ok' }
  ]
};

// ==============================================================================
// 1. INITIALIZATION & AUTHENTICATION ROUTINES
// ==============================================================================

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  initLoginScreen();
});

function initLoginScreen() {
  document.getElementById('role-fleet-btn').classList.add('selected');
}

function selectRole(role) {
  APP.currentRole = role;
  document.getElementById('role-fleet-btn').classList.toggle('selected', role === 'fleet');
  document.getElementById('role-driver-btn').classList.toggle('selected', role === 'driver');
  
  const btnText = document.getElementById('login-btn-text');
  if (role === 'fleet') {
    btnText.innerText = 'INITIALIZE MISSION CONTROL';
  } else {
    btnText.innerText = 'ENTER IN-CAB COCKPIT';
  }
}

function handleLogin() {
  if (APP.currentRole === 'fleet') {
    launchFleetManager();
  } else {
    launchDriverApp();
  }
}

function quickLaunch(role) {
  selectRole(role);
  handleLogin();
}

function switchRoleToLogin() {
  document.getElementById('fleet-view').classList.remove('active-screen');
  document.getElementById('driver-view').classList.remove('active-screen');
  document.getElementById('login-screen').classList.add('active-screen');
}

function switchToDriverView() {
  document.getElementById('fleet-view').classList.remove('active-screen');
  launchDriverApp();
}

function switchToFleetView() {
  document.getElementById('driver-view').classList.remove('active-screen');
  launchFleetManager();
}

function launchFleetManager() {
  document.getElementById('login-screen').classList.remove('active-screen');
  document.getElementById('driver-view').classList.remove('active-screen');
  document.getElementById('fleet-view').classList.add('active-screen');
  
  setTimeout(() => {
    initFleetManager();
  }, 100);
}

function launchDriverApp() {
  document.getElementById('login-screen').classList.remove('active-screen');
  document.getElementById('fleet-view').classList.remove('active-screen');
  document.getElementById('driver-view').classList.add('active-screen');
  
  setTimeout(() => {
    initDriverApp();
  }, 100);
}

// Global UTC Clock
function initClock() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toISOString().substring(11, 19);
    const clockEl = document.getElementById('fm-clock');
    if (clockEl) clockEl.innerText = timeStr;
  }, 1000);
}

// Audio Synthesizer (880Hz / 659Hz Dual-Tone Chime)
function playAudioChime() {
  if (!APP.audioEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!APP.audioCtx) APP.audioCtx = new AudioCtx();
    
    const now = APP.audioCtx.currentTime;
    
    // Tone 1: 880 Hz (A5)
    const osc1 = APP.audioCtx.createOscillator();
    const gain1 = APP.audioCtx.createGain();
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(APP.audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: 659 Hz (E5)
    const osc2 = APP.audioCtx.createOscillator();
    const gain2 = APP.audioCtx.createGain();
    osc2.frequency.setValueAtTime(659, now + 0.08);
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(APP.audioCtx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.log('Audio chime error:', e);
  }
}

function toggleAudioChimes() {
  APP.audioEnabled = !APP.audioEnabled;
  const btn = document.getElementById('fm-audio-btn');
  if (APP.audioEnabled) {
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    btn.style.color = 'var(--accent-cyan)';
    playAudioChime();
  } else {
    btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    btn.style.color = 'var(--text-muted)';
  }
}

// ==============================================================================
// 2. FLEET MANAGER SOFTWARE APP (AEGIS COMMAND CENTER)
// ==============================================================================

function initFleetManager() {
  renderTriageQueue('all');
  initLeafletMap();
  openInspector('402'); // Open Truck #402 by default
  startFleetSimulationLoop();
  
  // Trigger sample high-priority toast after 6 seconds for pitch demo
  setTimeout(() => {
    triggerCriticalToast(APP.trucks[1]); // Truck #612 Hub Bearing Toast
  }, 6000);
}

// Zone 2: Render Triage Queue
function renderTriageQueue(filter = 'all', searchTerm = '') {
  const container = document.getElementById('fm-triage-list');
  if (!container) return;
  
  let list = [...APP.trucks];
  
  // Apply category filter
  if (filter !== 'all') {
    list = list.filter(t => t.severity === filter);
  }

  // Apply search query
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(t => 
      t.id.toLowerCase().includes(q) ||
      t.driver.toLowerCase().includes(q) ||
      t.vin.toLowerCase().includes(q) ||
      t.problem.toLowerCase().includes(q)
    );
  }

  // Priority Sort: Critical (lowest RUL first) -> Warning -> Scheduled
  list.sort((a, b) => a.rulHours - b.rulHours);

  container.innerHTML = list.map(truck => {
    let rulClass = 'rul-warn';
    let cardClass = 'warning';
    if (truck.severity === 'critical') {
      rulClass = 'rul-crit';
      cardClass = 'critical';
    } else if (truck.severity === 'scheduled') {
      rulClass = 'rul-sched';
      cardClass = 'scheduled';
    }

    return `
      <div class="triage-card ${cardClass}" onclick="inspectTruck('${truck.id}')" id="tcard-${truck.id}">
        <div class="tcard-top">
          <span class="tcard-truck"><i class="fa-solid fa-truck"></i> TRUCK #${truck.id}</span>
          <span class="tcard-rul ${rulClass}"><i class="fa-solid fa-clock"></i> RUL: ${truck.rulHours.toFixed(1)}h</span>
        </div>
        <div class="tcard-problem">${truck.problem}</div>
        <div class="tcard-impact">${truck.impact}</div>
        <div class="tcard-footer">
          <span class="tcard-subsystem"><i class="fa-solid fa-microchip"></i> ${truck.subsystem}</span>
          <button class="btn-inspect-pill" onclick="event.stopPropagation(); inspectTruck('${truck.id}')">
            INSPECT ASSET <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterTriage(category) {
  document.querySelectorAll('.triage-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === category);
  });
  renderTriageQueue(category);
}

function handleFleetSearch(query) {
  renderTriageQueue('all', query);
}

// Zone 3: Geospatial Leaflet Map
function initLeafletMap() {
  if (APP.map) return; // Prevent re-initialization

  const mapContainer = document.getElementById('fm-map');
  if (!mapContainer) return;

  // Center on Midwest I-80 corridor (Des Moines, IA)
  APP.map = L.map('fm-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([41.65, -92.5], 8);

  // CartoDB Dark Matter Vector Tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(APP.map);

  // Zoom control on bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(APP.map);

  // Render Service Hub Depots (Geofences)
  renderDepotGeofences();

  // Render Trucks on Map
  renderTruckMarkers();
}

function renderDepotGeofences() {
  const depots = [
    { name: 'Des Moines Logistics Hub (Exit 137)', lat: 41.5868, lng: -93.6250, radius: 4500 },
    { name: 'Iowa City Regional Maintenance', lat: 41.6611, lng: -91.5302, radius: 3500 },
    { name: 'Cedar Rapids Freight Depot', lat: 41.9779, lng: -91.6656, radius: 3000 },
    { name: 'Davenport Riverfront Terminal', lat: 41.5236, lng: -90.5776, radius: 4000 }
  ];

  depots.forEach(depot => {
    const circle = L.circle([depot.lat, depot.lng], {
      color: '#00d4ff',
      fillColor: '#00d4ff',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 4',
      radius: depot.radius
    }).addTo(APP.map);

    circle.bindTooltip(`🏢 ${depot.name}`, { permanent: false, direction: 'top', className: 'map-tooltip' });
    APP.depotCircles.push(circle);
  });
}

function renderTruckMarkers() {
  APP.trucks.forEach(truck => {
    let pinColor = 'pin-green';
    let iconSymbol = 'fa-arrow-up';
    if (truck.severity === 'critical') {
      pinColor = 'pin-red';
      iconSymbol = 'fa-triangle-exclamation';
    } else if (truck.severity === 'warning') {
      pinColor = 'pin-yellow';
      iconSymbol = 'fa-circle-exclamation';
    }

    // Custom HTML Marker with Directional Heading Rotation
    const customIcon = L.divIcon({
      className: 'truck-marker-icon',
      html: `
        <div class="truck-pin ${pinColor}" style="transform: rotate(${truck.headingDeg}deg);">
          <i class="fa-solid ${iconSymbol}"></i>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([truck.lat, truck.lng], { icon: customIcon }).addTo(APP.map);
    
    marker.on('click', () => {
      inspectTruck(truck.id);
    });

    marker.bindPopup(`
      <div style="font-family: monospace; color: #fff; background: #111827; padding: 6px; border-radius: 4px;">
        <strong style="color: #00d4ff;">TRUCK #${truck.id}</strong><br>
        Driver: ${truck.driver}<br>
        Speed: ${truck.speed} MPH (${truck.heading})<br>
        Status: <span style="color: ${truck.severity === 'critical' ? '#ff3344' : '#00ff88'};">${truck.severity.toUpperCase()}</span>
      </div>
    `);

    APP.markers[truck.id] = marker;
  });
}

function toggleMapLayer(layer) {
  if (layer === 'depots') {
    const toggle = document.getElementById('layer-depots-toggle').checked;
    APP.depotCircles.forEach(circle => {
      if (toggle) circle.addTo(APP.map);
      else APP.map.removeLayer(circle);
    });
  }
}

// Zone 4: Deep Asset Inspector Drawer
function inspectTruck(truckId) {
  APP.selectedTruckId = truckId;
  const truck = APP.trucks.find(t => t.id === truckId);
  if (!truck) return;

  // Center map on this truck
  if (APP.map && APP.markers[truckId]) {
    APP.map.panTo([truck.lat, truck.lng], { animate: true, duration: 0.8 });
    APP.markers[truckId].openPopup();
  }

  // Populate Header Data
  document.getElementById('insp-truck-id').innerText = `TRUCK #${truck.id}`;
  document.getElementById('insp-driver').innerText = truck.driver;
  document.getElementById('insp-vin').innerText = truck.vin;
  document.getElementById('insp-voltage').innerText = `${truck.voltage.toFixed(1)}V`;
  document.getElementById('insp-location').innerText = truck.location;
  document.getElementById('insp-speed').innerText = `${truck.speed} MPH`;
  document.getElementById('insp-heading').innerText = truck.heading;

  // Status Badge
  const statusBadge = document.getElementById('insp-status-badge');
  if (truck.severity === 'critical') {
    statusBadge.className = 'truck-status-badge status-crit';
    statusBadge.innerText = 'CRITICAL ALERT';
  } else if (truck.severity === 'warning') {
    statusBadge.className = 'truck-status-badge status-warn';
    statusBadge.innerText = 'WARNING ADVISORY';
  } else {
    statusBadge.className = 'truck-status-badge status-ok';
    statusBadge.innerText = 'NOMINAL';
  }

  // Tab 1: AI Diagnostics
  document.getElementById('diag-powertrain-val').innerText = `${truck.subsystemScores.powertrain}% ${truck.subsystemScores.powertrain < 80 ? 'Warning' : 'Nominal'}`;
  document.getElementById('diag-powertrain').style.width = `${truck.subsystemScores.powertrain}%`;

  document.getElementById('diag-electrical-val').innerText = `${truck.subsystemScores.electrical}% ${truck.subsystemScores.electrical < 50 ? 'Critical Alert' : 'Nominal'}`;
  document.getElementById('diag-electrical').style.width = `${truck.subsystemScores.electrical}%`;

  document.getElementById('diag-brakes-val').innerText = `${truck.subsystemScores.brakes}% Nominal`;
  document.getElementById('diag-brakes').style.width = `${truck.subsystemScores.brakes}%`;

  document.getElementById('diag-transmission-val').innerText = `${truck.subsystemScores.transmission}% Nominal`;
  document.getElementById('diag-transmission').style.width = `${truck.subsystemScores.transmission}%`;

  document.getElementById('diag-rul-val').innerText = `${truck.rulHours.toFixed(1)} Hours remaining`;

  // Render Vibration Spectrum Chart
  renderVibrationChart(truck.vibrationFreq);

  // Tab 2: Live Telemetry
  document.getElementById('tele-rpm').innerText = truck.telemetry.rpm;
  document.getElementById('tele-coolant').innerText = truck.telemetry.coolantF;
  document.getElementById('tele-oil-press').innerText = truck.telemetry.oilPressPsi;
  document.getElementById('tele-fuel-burn').innerText = truck.telemetry.fuelGph;
  document.getElementById('tele-def').innerText = `${truck.telemetry.defPct}%`;
  document.getElementById('tele-boost').innerText = truck.telemetry.boostPsi;

  // Populate 18-Wheel TPMS
  truck.tpms.forEach((psi, idx) => {
    const tireEl = document.getElementById(`tire-${idx + 1}`);
    if (tireEl) {
      tireEl.querySelector('.t-psi').innerText = psi;
      tireEl.className = psi < 95 ? 'tire-node crit' : (psi < 100 ? 'tire-node warn' : 'tire-node ok');
    }
  });

  // Tab 3: Driver & HOS
  document.getElementById('driver-full-name').innerText = truck.driver;
  document.getElementById('driver-safety-score').innerText = truck.safetyScore;
  document.getElementById('hos-drive-used').innerText = truck.hos.driveUsed;
  document.getElementById('hos-shift-used').innerText = truck.hos.shiftUsed;
  document.getElementById('hos-weekly-used').innerText = truck.hos.weeklyUsed;

  // Tab 4: Work Order
  document.getElementById('wo-title').innerText = `Emergency Work Order #${truck.workOrder.id}`;
  document.getElementById('wo-hub').innerText = truck.workOrder.hub;
  document.getElementById('wo-bay').innerText = truck.workOrder.bay;
  document.getElementById('wo-tech').innerText = truck.workOrder.tech;
  document.getElementById('wo-downtime').innerText = truck.workOrder.downtime;
  document.getElementById('wo-status-pill').innerText = truck.workOrder.status;

  // Slide drawer open
  document.getElementById('fm-inspector').classList.add('open');
  APP.inspectorOpen = true;
}

function closeInspector() {
  document.getElementById('fm-inspector').classList.remove('open');
  APP.inspectorOpen = false;
}

function switchInspectorTab(tabId) {
  // Update Tab Buttons
  document.querySelectorAll('#insp-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.currentTarget.classList.add('active');

  // Update Tab Panels
  document.querySelectorAll('.drawer-tab-content .tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`insp-tab-${tabId}`).classList.add('active');
}

// Vibration Spectrum FFT Chart (Chart.js)
function renderVibrationChart(peakFreq = 120) {
  const ctx = document.getElementById('diag-vibration-chart');
  if (!ctx) return;

  if (APP.charts.vibration) {
    APP.charts.vibration.destroy();
  }

  // Generate Frequency Data (0 to 300 Hz)
  const labels = [];
  const baselineData = [];
  const abnormalData = [];

  for (let f = 10; f <= 250; f += 10) {
    labels.push(`${f}Hz`);
    // Baseline smooth curve
    baselineData.push(1.2 + Math.sin(f / 30) * 0.4);

    // Abnormal curve with sharp resonant spike at peakFreq
    let spike = 0;
    if (Math.abs(f - peakFreq) <= 15) {
      spike = 5.8 - Math.abs(f - peakFreq) * 0.25;
    }
    abnormalData.push(spike > 0 ? spike : 1.3 + Math.random() * 0.3);
  }

  APP.charts.vibration = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Normal Baseline Tolerance',
          data: baselineData,
          borderColor: '#5f6e8c',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Live Harmonic Vibration Sensor (120Hz Bearing Spike)',
          data: abnormalData,
          borderColor: '#ff3344',
          borderWidth: 2.5,
          backgroundColor: 'rgba(255, 51, 68, 0.15)',
          fill: true,
          pointRadius: abnormalData.map(v => v > 4 ? 4 : 0),
          pointBackgroundColor: '#ff3344'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9aa7c0', font: { size: 10 } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5f6e8c', font: { size: 9 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5f6e8c', font: { size: 9 } } }
      }
    }
  });
}

// Zone 4 Actions: 2-Minute Live Oscilloscope Test
function startLiveInspect() {
  document.getElementById('inspect-modal').classList.add('open');
  APP.oscilloscopeTimer = 120;
  
  const canvas = document.getElementById('oscilloscope-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  
  if (APP.oscilloscopeInterval) clearInterval(APP.oscilloscopeInterval);

  let phase = 0;
  APP.oscilloscopeInterval = setInterval(() => {
    APP.oscilloscopeTimer--;
    const mins = Math.floor(APP.oscilloscopeTimer / 60);
    const secs = APP.oscilloscopeTimer % 60;
    document.getElementById('inspect-countdown').innerText = 
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (APP.oscilloscopeTimer <= 0) {
      clearInterval(APP.oscilloscopeInterval);
    }

    // Draw Oscilloscope Waveform on Canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Green CRT Grid
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Oscilloscope Cyan Waveform
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    
    phase += 0.15;
    for (let x = 0; x < canvas.width; x++) {
      const y = canvas.height / 2 + 
                Math.sin(x * 0.05 + phase) * 35 + 
                Math.sin(x * 0.12 - phase * 2) * 15 + 
                (Math.random() - 0.5) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, 1000 / 30);
}

function closeLiveInspectModal() {
  document.getElementById('inspect-modal').classList.remove('open');
  if (APP.oscilloscopeInterval) clearInterval(APP.oscilloscopeInterval);
}

// Zone 4 Actions: SMS Dispatcher Dialog
function openSMSDialog() {
  document.getElementById('sms-modal').classList.add('open');
}
function closeSMSModal() {
  document.getElementById('sms-modal').classList.remove('open');
}
function fillSMSTemplate(num) {
  const input = document.getElementById('sms-text-input');
  if (num === 1) input.value = "REROUTE ADVISORY: Alternator bearing alert. Divert to Des Moines Logistics Hub (Exit 137). Bay 3 & Master Tech Marcus Vance pre-staged.";
  if (num === 2) input.value = "SPEED REDUCTION ADVISORY: Reduce highway speed to 55 MPH immediately to mitigate bearing thermal rise until next exit.";
  if (num === 3) input.value = "SAFE HARBOR NOTICE: Pull over safely at Love's Travel Stop (Exit 182). Mobile field rescue unit dispatched.";
}
function sendSMSToDriver() {
  closeSMSModal();
  triggerToastSimple("IN-CAB TRANSMISSION SENT", "Reroute instructions successfully dispatched to Driver in-cab telematics terminal.", "green");
}

// Zone 4 Actions: Generate 1-Click Work Order
function generateOneClickWorkOrder() {
  const truck = APP.trucks.find(t => t.id === APP.selectedTruckId);
  if (!truck) return;
  truck.workOrder.status = "DISPATCHED TO BAY 3";
  document.getElementById('wo-status-pill').className = "badge-status-green";
  document.getElementById('wo-status-pill').innerText = "DISPATCHED TO BAY 3";
  
  // Switch to Work Order Tab
  switchInspectorTab('workorder');
  triggerToastSimple("WORK ORDER DISPATCHED", `Work order #${truck.workOrder.id} dispatched to ${truck.workOrder.hub} with OEM parts reserved.`, "green");
}

// Automated Critical Pop-Up Notification System (Top-Right Toast Banner)
function triggerCriticalToast(truck) {
  playAudioChime();

  const container = document.getElementById('fm-toast-container');
  if (!container) return;

  const toastId = `toast-${Date.now()}`;
  const toastEl = document.createElement('div');
  toastEl.className = 'toast-alert';
  toastEl.id = toastId;

  toastEl.innerHTML = `
    <div class="toast-header">
      <div class="toast-beacon">
        <span class="radar-pulse"></span>
        <span>HIGHWAY MECHANICAL EMERGENCY</span>
      </div>
      <button onclick="dismissToast('${toastId}')" style="background:none; border:none; color:#5f6e8c; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="toast-body">
      <h4>TRUCK #${truck.id} (${truck.driver})</h4>
      <p><strong>${truck.problem}</strong> on ${truck.location}. Imminent breakdown risk!</p>
    </div>
    <div class="toast-actions">
      <span class="toast-rul"><i class="fa-solid fa-hourglass-half"></i> RUL: ${truck.rulHours.toFixed(1)} Hours</span>
      <button class="toast-btn" onclick="inspectTruck('${truck.id}'); dismissToast('${toastId}');">
        INSPECT ASSET
      </button>
    </div>
    <div class="toast-progress" id="progress-${toastId}"></div>
  `;

  container.appendChild(toastEl);

  // 8-Second Hover-to-Pause Countdown Bar
  let remainingMs = 8000;
  let isPaused = false;
  const progressEl = document.getElementById(`progress-${toastId}`);

  toastEl.addEventListener('mouseenter', () => { isPaused = true; });
  toastEl.addEventListener('mouseleave', () => { isPaused = false; });

  const interval = setInterval(() => {
    if (!isPaused) {
      remainingMs -= 100;
      if (progressEl) progressEl.style.width = `${(remainingMs / 8000) * 100}%`;
      if (remainingMs <= 0) {
        clearInterval(interval);
        dismissToast(toastId);
      }
    }
  }, 100);
}

function dismissToast(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function triggerToastSimple(title, body, color = "green") {
  const container = document.getElementById('fm-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.style.borderColor = color === "green" ? "#00ff88" : "#00d4ff";
  toast.style.borderLeftColor = color === "green" ? "#00ff88" : "#00d4ff";
  toast.innerHTML = `
    <div class="toast-body">
      <h4 style="color: ${color === "green" ? "#00ff88" : "#00d4ff"};">${title}</h4>
      <p>${body}</p>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Background Simulation Loop for Fleet Mode
function startFleetSimulationLoop() {
  setInterval(() => {
    // Slightly nudge truck coordinates to simulate motion along I-80
    APP.trucks.forEach(truck => {
      // Decrement RUL countdown timers gradually
      truck.rulHours = Math.max(0.1, truck.rulHours - 0.005);

      // Micro-telemetry fluctuations
      truck.telemetry.rpm += Math.floor(Math.random() * 20 - 10);
      truck.voltage = 13.8 + (Math.random() * 0.2 - 0.1);

      // Move markers slightly
      if (APP.markers[truck.id]) {
        truck.lat += (Math.random() - 0.5) * 0.0008;
        truck.lng += (truck.headingDeg > 180 ? -1 : 1) * 0.0006;
        APP.markers[truck.id].setLatLng([truck.lat, truck.lng]);
      }
    });

    // Refresh RUL labels on Triage list
    APP.trucks.forEach(truck => {
      const card = document.getElementById(`tcard-${truck.id}`);
      if (card) {
        const rulEl = card.querySelector('.tcard-rul');
        if (rulEl) rulEl.innerHTML = `<i class="fa-solid fa-clock"></i> RUL: ${truck.rulHours.toFixed(1)}h`;
      }
    });
  }, 3000);
}

// ==============================================================================
// 3. DRIVER SOFTWARE APP (IN-CAB PERSONAL VEHICLE INTELLIGENCE)
// ==============================================================================

function initDriverApp() {
  renderConsumables();
  renderPidTable();
  initDriverCharts();
  startDriverSimulationLoop();
}

function switchDriverScreen(screenId) {
  APP.currentDriverScreen = screenId;

  // Bottom Nav active state
  document.querySelectorAll('#driver-nav .d-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  event.currentTarget.classList.add('active');

  // Sub-screen visibility
  document.querySelectorAll('.driver-sub-screen').forEach(screen => {
    screen.classList.remove('active-sub-screen');
  });
  document.getElementById(`driver-tab-${screenId}`).classList.add('active-sub-screen');
}

// Screen B: 1-Click Fix Simulation (Financial Avoidance Engine)
function simulateFixAlert(alertId) {
  playAudioChime();
  const card = document.getElementById(`alert-card-${alertId}`);
  if (card) {
    card.style.transition = 'all 0.5s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      card.remove();
      // Animate Master Health Rating Upward!
      let currentScore = parseInt(document.getElementById('driver-health-number').innerText);
      currentScore = Math.min(100, currentScore + 4);
      document.getElementById('driver-health-number').innerText = currentScore;
      document.getElementById('driver-health-gauge').setAttribute('stroke-dasharray', `${currentScore}, 100`);
      
      triggerToastSimple("PROACTIVE REPAIR RESOLVED", `Vehicle Health Score increased to ${currentScore}/100. Avoided catastrophic secondary damage!`, "green");
    }, 500);
  }
}

// Screen C: Predictive Maintenance (Driving Style Wear Simulator)
function setDrivingStyle(style) {
  APP.drivingStyle = style;
  document.getElementById('style-severe').classList.toggle('active', style === 'severe');
  document.getElementById('style-urban').classList.toggle('active', style === 'urban');
  document.getElementById('style-highway').classList.toggle('active', style === 'highway');

  renderConsumables();
}

function renderConsumables() {
  const container = document.getElementById('consumables-container');
  if (!container) return;

  // Multiplier based on driving style
  let multiplier = 1.0;
  if (APP.drivingStyle === 'severe') multiplier = 0.55; // 45% shorter life
  if (APP.drivingStyle === 'urban') multiplier = 0.77;  // 23% shorter life

  const c = APP.driverConsumables;
  const items = [
    { title: 'Motor Oil Life', remaining: Math.round((c.oil.baseLimitKm - c.oil.currentKm) * multiplier), unit: 'km remaining', pct: Math.round(52 * multiplier) },
    { title: 'Front Brake Pads', remaining: (c.brakes.currentMm * multiplier).toFixed(1), unit: 'mm remaining', pct: Math.round((c.brakes.currentMm / c.brakes.baseLimitMm) * 100 * multiplier) },
    { title: 'Tire Tread Geometry', remaining: Math.round(c.tires.currentPct * multiplier), unit: '% remaining', pct: Math.round(c.tires.currentPct * multiplier) },
    { title: 'Spark / Glow Plugs', remaining: Math.round((c.plugs.baseLimitKm - c.plugs.currentKm) * multiplier), unit: 'km remaining', pct: Math.round(60 * multiplier) },
    { title: 'Coolant Purity', remaining: Math.round(c.coolant.currentPct * multiplier), unit: '% integrity', pct: Math.round(c.coolant.currentPct * multiplier) },
    { title: 'Transmission Fluid', remaining: Math.round(c.trans.currentPct * multiplier), unit: '% viscosity', pct: Math.round(c.trans.currentPct * multiplier) }
  ];

  container.innerHTML = items.map(item => `
    <div class="consumable-card">
      <div class="con-top">
        <span>${item.title}</span>
        <strong class="${item.pct < 40 ? 'text-yellow' : 'text-green'}">${item.pct}%</strong>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${item.pct < 40 ? 'fill-yellow' : 'fill-green'}" style="width: ${item.pct}%"></div>
      </div>
      <span class="con-countdown"><i class="fa-solid fa-hourglass-half"></i> ${item.remaining} ${item.unit}</span>
    </div>
  `).join('');
}

// Screen D: AI Diagnostic Copilot (Virtual Master Mechanic Chat)
function askCopilot(question) {
  document.getElementById('copilot-input').value = question;
  sendCopilotMessage();
}

function handleCopilotKey(e) {
  if (e.key === 'Enter') sendCopilotMessage();
}

function sendCopilotMessage() {
  const input = document.getElementById('copilot-input');
  const text = input.value.trim();
  if (!text) return;

  const stream = document.getElementById('copilot-msg-stream');

  // Append User Bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user-msg';
  userMsg.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-user"></i></div>
    <div class="msg-content">
      <p>${text}</p>
      <span class="msg-timestamp">Just now</span>
    </div>
  `;
  stream.appendChild(userMsg);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  // Simulate AI Thinking Delay
  setTimeout(() => {
    let reply = "I've cross-referenced your vehicle's live CAN bus telemetry. All secondary cylinder pressures are nominal.";
    
    if (text.toLowerCase().includes('engine') || text.toLowerCase().includes('hot') || text.toLowerCase().includes('104')) {
      reply = "💡 <strong>Diagnosis:</strong> Your engine is currently at 104°C (safe limit is 98°C). This is an early thermostat stickiness issue. <em>Analogy:</em> It's like a home furnace damper that only opens halfway. You can safely drive another 45 km to your destination, but swap the $20 thermostat before next week to avoid a $1,850 head gasket warp.";
    } else if (text.toLowerCase().includes('brake') || text.toLowerCase().includes('pad')) {
      reply = "🛑 <strong>Brake Health:</strong> Your front pads measure 2.7mm. Safe legal minimum is 1.5mm. You have approximately 1,200 km of normal driving left. If you replace them now for ~$180, you save the rotors. If you wait until they grind metal-on-metal, you'll need $650 in new rotors.";
    } else if (text.toLowerCase().includes('fuel trim') || text.toLowerCase().includes('trim')) {
      reply = "💨 <strong>Fuel Trim:</strong> Your Long-Term Fuel Trim (LTFT) is at +14.2%. This means the engine computer is squirting 14% extra fuel to compensate for unmetered air entering via a cracked vacuum hose. It wastes ~$850/year in diesel if unaddressed.";
    } else if (text.toLowerCase().includes('battery') || text.toLowerCase().includes('alternator')) {
      reply = "⚡ <strong>Electrical System:</strong> Your bus voltage is 13.8V with 880 CCA cold-cranking capacity. The alternator is charging properly, but harmonic sensors show slight bearing wear that should be inspected at your next scheduled 10,000 km service.";
    }

    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai-msg';
    aiMsg.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="msg-content">
        <p>${reply}</p>
        <span class="msg-timestamp">Grounded in 50Hz live CAN bus stream</span>
      </div>
    `;
    stream.appendChild(aiMsg);
    stream.scrollTop = stream.scrollHeight;
  }, 900);
}

// Screen F: Live CAN Bus Charts & PID Table
function initDriverCharts() {
  const chartConfigs = [
    { id: 'driver-chart-coolant', label: 'Coolant °C', color: '#00d4ff', min: 70, max: 110, initial: 88 },
    { id: 'driver-chart-rpm', label: 'RPM', color: '#00ff88', min: 600, max: 3000, initial: 1480 },
    { id: 'driver-chart-voltage', label: 'Volts', color: '#ffb800', min: 11, max: 16, initial: 13.8 }
  ];

  chartConfigs.forEach(cfg => {
    const ctx = document.getElementById(cfg.id);
    if (!ctx) return;
    
    const initialData = Array(20).fill(cfg.initial).map(v => v + (Math.random() * 2 - 1));

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(20).fill(''),
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
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, min: cfg.min, max: cfg.max, ticks: { color: '#5f6e8c', font: { size: 9 } } }
        }
      }
    });

    if (cfg.id.includes('coolant')) APP.charts.driverCoolant = chart;
    if (cfg.id.includes('rpm')) APP.charts.driverRpm = chart;
    if (cfg.id.includes('voltage')) APP.charts.driverVoltage = chart;
  });
}

function renderPidTable() {
  const tbody = document.getElementById('pid-table-body');
  if (!tbody) return;

  tbody.innerHTML = APP.pidChannels.map(p => `
    <tr>
      <td class="font-mono text-cyan">${p.pid}</td>
      <td><strong>${p.name}</strong></td>
      <td class="font-mono text-muted">${p.hex}</td>
      <td class="font-mono text-green" id="pid-val-${p.pid}">${p.val}</td>
      <td class="font-mono text-muted">${p.unit}</td>
      <td><span class="badge-status-green"><i class="fa-solid fa-check"></i> ${p.norm}</span></td>
    </tr>
  `).join('');
}

function startDriverSimulationLoop() {
  setInterval(() => {
    // Dynamic Micro-fluctuations
    const rpm = 1480 + Math.floor(Math.random() * 40 - 20);
    const temp = 88 + (Math.random() * 0.4 - 0.2);
    const volt = 13.8 + (Math.random() * 0.1 - 0.05);

    // Update charts
    if (APP.charts.driverRpm) {
      APP.charts.driverRpm.data.datasets[0].data.shift();
      APP.charts.driverRpm.data.datasets[0].data.push(rpm);
      APP.charts.driverRpm.update('none');
    }
    if (APP.charts.driverCoolant) {
      APP.charts.driverCoolant.data.datasets[0].data.shift();
      APP.charts.driverCoolant.data.datasets[0].data.push(temp);
      APP.charts.driverCoolant.update('none');
    }
    if (APP.charts.driverVoltage) {
      APP.charts.driverVoltage.data.datasets[0].data.shift();
      APP.charts.driverVoltage.data.datasets[0].data.push(volt);
      APP.charts.driverVoltage.update('none');
    }

    // Update Sensors Ribbon
    const sTemp = document.getElementById('driver-sens-temp');
    if (sTemp) sTemp.innerText = `${temp.toFixed(1)}°C`;
    const sSpeed = document.getElementById('driver-sens-speed');
    if (sSpeed) sSpeed.innerText = `${64 + Math.floor(Math.random() * 2)} MPH`;
  }, 2000);
}

// Presentation Mode: Toggle Phone Frame vs Desktop
function togglePresentationMode() {
  APP.isPhoneFrame = !APP.isPhoneFrame;
  const frame = document.getElementById('driver-app-frame');
  const label = document.getElementById('pres-mode-label');
  
  if (APP.isPhoneFrame) {
    frame.classList.add('phone-frame');
    label.innerText = 'Desktop View';
  } else {
    frame.classList.remove('phone-frame');
    label.innerText = 'Phone Frame';
  }
}

// Operational Tools: Simulation Lab
function openSimLabModal() { document.getElementById('sim-lab-modal').classList.add('open'); }
function closeSimLabModal() { document.getElementById('sim-lab-modal').classList.remove('open'); }

function injectSimAnomaly(type) {
  closeSimLabModal();
  playAudioChime();

  if (type === 'overheat') {
    document.getElementById('driver-sens-temp').innerText = '116.4°C';
    document.getElementById('sub-therm-pct').innerText = '32%';
    document.getElementById('sub-therm-bar').style.width = '32%';
    document.getElementById('sub-therm-bar').className = 'progress-fill fill-red pulse-fill';
    triggerCriticalToast(APP.trucks[0]);
  } else if (type === 'bearing') {
    inspectTruck('402');
    triggerCriticalToast(APP.trucks[0]);
  } else if (type === 'misfire') {
    document.getElementById('driver-sens-misfire').innerText = '4';
    document.getElementById('sub-power-pct').innerText = '61%';
    document.getElementById('sub-power-bar').style.width = '61%';
    document.getElementById('sub-power-bar').className = 'progress-fill fill-yellow';
    triggerToastSimple("CYLINDER MISFIRE INJECTED", "P0303 Cylinder 3 Combustion Misfire detected in high-speed sampling.", "yellow");
  } else if (type === 'voltage') {
    document.getElementById('insp-voltage').innerText = '11.2V';
    triggerToastSimple("VOLTAGE SAG INJECTED", "Alternator diode ripple detected. Battery voltage dropped to 11.2V.", "red");
  } else if (type === 'tire') {
    const tire = document.getElementById('tire-1');
    if (tire) {
      tire.className = 'tire-node crit';
      tire.querySelector('.t-psi').innerText = '18';
    }
    triggerToastSimple("TPMS BLOWOUT HAZARD", "Steer axle tire pressure dropped to 18 PSI on I-80.", "red");
  } else if (type === 'tamper') {
    triggerToastSimple("ANTI-TAMPER ACTIVATED", "OBD-II port disconnected! 18650 Battery backup engaged.", "red");
  }
}

function resetSimToNominal() {
  closeSimLabModal();
  document.getElementById('driver-sens-temp').innerText = '88°C';
  document.getElementById('driver-sens-misfire').innerText = '0';
  document.getElementById('sub-therm-pct').innerText = '78%';
  document.getElementById('sub-therm-bar').style.width = '78%';
  document.getElementById('sub-therm-bar').className = 'progress-fill fill-yellow';
  document.getElementById('sub-power-pct').innerText = '95%';
  document.getElementById('sub-power-bar').style.width = '95%';
  document.getElementById('sub-power-bar').className = 'progress-fill fill-green';
  triggerToastSimple("SIMULATION RESTORED", "All systems restored to baseline factory tolerances.", "green");
}

// Operational Tools: Multi-Car Garage
function openGarageModal() { document.getElementById('garage-modal').classList.add('open'); }
function closeGarageModal() { document.getElementById('garage-modal').classList.remove('open'); }

function selectGarageVehicle(carKey) {
  closeGarageModal();
  playAudioChime();

  const titleEl = document.getElementById('driver-active-vehicle');
  const certVehEl = document.getElementById('cert-vehicle-name');

  if (carKey === 'peterbilt') {
    titleEl.innerText = '2024 Peterbilt 579 UltraLoft (Unit #402)';
    if (certVehEl) certVehEl.innerText = '2024 Peterbilt 579 UltraLoft';
    document.getElementById('driver-health-number').innerText = '87';
    document.getElementById('driver-health-gauge').setAttribute('stroke-dasharray', '87, 100');
  } else if (carKey === 'ford') {
    titleEl.innerText = '2023 Ford F-150 Lightning EV';
    if (certVehEl) certVehEl.innerText = '2023 Ford F-150 Lightning EV';
    document.getElementById('driver-health-number').innerText = '96';
    document.getElementById('driver-health-gauge').setAttribute('stroke-dasharray', '96, 100');
  } else if (carKey === 'bmw') {
    titleEl.innerText = '2022 BMW 330i xDrive Sedan';
    if (certVehEl) certVehEl.innerText = '2022 BMW 330i xDrive Sedan';
    document.getElementById('driver-health-number').innerText = '74';
    document.getElementById('driver-health-gauge').setAttribute('stroke-dasharray', '74, 100');
  }

  triggerToastSimple("VEHICLE PROFILE LOADED", `Telematics switched to ${titleEl.innerText}`, "cyan");
}

// Operational Tools: Printable Health Audit Certificate
function openReportModal() { document.getElementById('report-modal').classList.add('open'); }
function closeReportModal() { document.getElementById('report-modal').classList.remove('open'); }
