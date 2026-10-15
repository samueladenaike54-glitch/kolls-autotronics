/**
 * ============================================================================
 * KOLLS AUTOTRONICS — AI VEHICLE HEALTH MONITORING SYSTEM
 * Core Application Logic, MQTT Stream Ingestion, Gauge Physics & Chart.js Engine
 * ============================================================================
 * 
 * Target Telemetry Payload:
 * {
 *   "rpm": 2400,
 *   "coolant_temp": 85,
 *   "oil_temp": 92,
 *   "battery_voltage": 13.8,
 *   "engine_load": 45,
 *   "stft": 2.3,
 *   "ltft": 4.1,
 *   "intake_air_temp": 35,
 *   "status": "NOMINAL",
 *   "vehicle_id": "KA-TRUCK-001",
 *   "timestamp": 1697000000
 * }
 */

'use strict';

// ============================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ============================================================================
const CONFIG = {
  mqtt: {
    // Primary public broker with secure WebSockets
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    // Fallback alternative broker
    fallbackBrokerUrl: 'wss://test.mosquitto.org:8081/mqtt',
    topic: 'kolls/vehicle/telemetry',
    clientId: 'kolls_telemetry_' + Math.random().toString(16).substring(2, 9),
    connectTimeoutMs: 5000,
    keepalive: 60
  },
  charts: {
    maxThermalPoints: 30,
    maxFuelTrimPoints: 50,
    stftThreshold: 10.0,
    ltftThreshold: 10.0
  },
  feed: {
    maxEntries: 50
  },
  gaugeConstants: {
    rpmMax: 8000,
    // Semi-circle arc circumference: pi * 105 ~ 329.87
    rpmArcCircumference: 330,
    loadMax: 100,
    voltMin: 10.0,
    voltMax: 15.0
  }
};

const STATE = {
  isMqttConnected: false,
  isSimulationMode: false,
  mqttClient: null,
  mqttTimeoutTimer: null,
  simulationInterval: null,
  audioEnabled: false,
  autoScrollEnabled: true,
  packetsReceived: 0,
  packetTimes: [],
  maxRpmObserved: 0,
  audioCtx: null,
  
  // Real-time telemetry buffer
  telemetry: {
    rpm: 2400,
    coolant_temp: 85,
    oil_temp: 92,
    battery_voltage: 13.8,
    engine_load: 45,
    stft: 2.3,
    ltft: 4.1,
    intake_air_temp: 35,
    status: 'NOMINAL',
    vehicle_id: 'KA-TRUCK-001',
    timestamp: Date.now()
  },

  // Simulator Physics State Machine
  simPhysics: {
    baseRpm: 2400,
    gear: 3,
    speedMph: 45,
    throttleTarget: 45,
    simTime: 0,
    anomalyActive: null,
    anomalyDuration: 0
  }
};

// ============================================================================
// 2. DOM ELEMENT REFERENCES
// ============================================================================
const DOM = {
  // Header Elements
  vehicleId: document.getElementById('vehicleIdDisplay'),
  systemHealthBadge: document.getElementById('systemHealthBadge'),
  systemHealthDot: document.getElementById('systemHealthDot'),
  systemHealthText: document.getElementById('systemHealthText'),
  mqttStatusDot: document.getElementById('mqttStatusDot'),
  mqttStatusText: document.getElementById('mqttStatusText'),
  modeToggleBtn: document.getElementById('modeToggleBtn'),
  modeIcon: document.getElementById('modeIcon'),
  modeText: document.getElementById('modeText'),
  audioToggleBtn: document.getElementById('audioToggleBtn'),
  audioIcon: document.getElementById('audioIcon'),
  digitalClock: document.getElementById('digitalClock'),

  // Quick Metric Ribbon
  ribbonRpm: document.getElementById('ribbonRpm'),
  ribbonRpmZone: document.getElementById('ribbonRpmZone'),
  ribbonCoolant: document.getElementById('ribbonCoolant'),
  ribbonCoolantStatus: document.getElementById('ribbonCoolantStatus'),
  ribbonOil: document.getElementById('ribbonOil'),
  ribbonThermalDelta: document.getElementById('ribbonThermalDelta'),
  ribbonVoltage: document.getElementById('ribbonVoltage'),
  aiHealthIndex: document.getElementById('aiHealthIndex'),

  // RPM Gauge
  rpmProgressArc: document.getElementById('rpmProgressArc'),
  rpmNeedleGroup: document.getElementById('rpmNeedleGroup'),
  rpmValue: document.getElementById('rpmValue'),
  rpmZonePill: document.getElementById('rpmZonePill'),
  rpmRedlineAlert: document.getElementById('rpmRedlineAlert'),
  maxRpmRecorded: document.getElementById('maxRpmRecorded'),

  // Vertical Gauges
  engineLoadFill: document.getElementById('engineLoadFill'),
  engineLoadValue: document.getElementById('engineLoadValue'),
  loadStatusBadge: document.getElementById('loadStatusBadge'),
  batteryVoltageFill: document.getElementById('batteryVoltageFill'),
  batteryVoltageValue: document.getElementById('batteryVoltageValue'),
  voltageStatusBadge: document.getElementById('voltageStatusBadge'),

  // Thermal Cluster
  coolantTempValue: document.getElementById('coolantTempValue'),
  coolantZoneFill: document.getElementById('coolantZoneFill'),
  coolantStatusText: document.getElementById('coolantStatusText'),
  oilTempValue: document.getElementById('oilTempValue'),
  oilZoneFill: document.getElementById('oilZoneFill'),
  oilStatusText: document.getElementById('oilStatusText'),
  intakeAirValue: document.getElementById('intakeAirValue'),

  // AI Inference Banner & Sub-metrics
  aiInferenceBox: document.getElementById('aiInferenceBox'),
  aiInferenceText: document.getElementById('aiInferenceText'),
  lambdaValue: document.getElementById('lambdaValue'),
  anomalyRiskVal: document.getElementById('anomalyRiskVal'),
  stftCurrentVal: document.getElementById('stftCurrentVal'),
  ltftCurrentVal: document.getElementById('ltftCurrentVal'),

  // Activity Feed
  activityFeed: document.getElementById('activityFeed'),
  logCountBadge: document.getElementById('logCountBadge'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  pauseScrollBtn: document.getElementById('pauseScrollBtn'),
  pauseScrollIcon: document.getElementById('pauseScrollIcon'),
  pauseScrollText: document.getElementById('pauseScrollText'),

  // Demo Injector Buttons
  injectRevBtn: document.getElementById('injectRevBtn'),
  injectLeanBtn: document.getElementById('injectLeanBtn'),
  injectOverheatBtn: document.getElementById('injectOverheatBtn'),
  injectBattSagBtn: document.getElementById('injectBattSagBtn'),
  restoreNominalBtn: document.getElementById('restoreNominalBtn'),

  // Footer Elements
  footerBrokerAddress: document.getElementById('footerBrokerAddress'),
  packetsReceivedCount: document.getElementById('packetsReceivedCount'),
  ingestHzRate: document.getElementById('ingestHzRate')
};

// ============================================================================
// 3. CHART.JS INITIALIZATION (LIQUID GLASS THEMED)
// ============================================================================
let thermalTrendChart = null;
let stftChart = null;
let ltftChart = null;

// Common Glass Chart Styling Options
const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 300,
    easing: 'easeOutQuad'
  },
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(10, 18, 36, 0.85)',
      titleColor: '#00d4ff',
      bodyColor: '#e6f1ff',
      borderColor: 'rgba(0, 200, 255, 0.3)',
      borderWidth: 1,
      padding: 8,
      titleFont: { family: 'JetBrains Mono', size: 10, weight: 'bold' },
      bodyFont: { family: 'JetBrains Mono', size: 10 },
      boxPadding: 4,
      usePointStyle: true
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(0, 200, 255, 0.05)',
        tickColor: 'transparent'
      },
      ticks: {
        color: '#536b8e',
        font: { family: 'JetBrains Mono', size: 9 },
        maxTicksLimit: 6
      }
    },
    y: {
      grid: {
        color: 'rgba(0, 200, 255, 0.08)',
        tickColor: 'transparent'
      },
      ticks: {
        color: '#88a0c5',
        font: { family: 'JetBrains Mono', size: 9 }
      }
    }
  }
};

/**
 * Initialize all three Chart.js visualizers
 */
function initCharts() {
  const ctxThermal = document.getElementById('thermalTrendChart').getContext('2d');
  const ctxStft = document.getElementById('stftChart').getContext('2d');
  const ctxLtft = document.getElementById('ltftChart').getContext('2d');

  // Gradient for Coolant
  const coolantGradient = ctxThermal.createLinearGradient(0, 0, 0, 140);
  coolantGradient.addColorStop(0, 'rgba(0, 212, 255, 0.28)');
  coolantGradient.addColorStop(1, 'rgba(0, 212, 255, 0.0)');

  // Gradient for Oil
  const oilGradient = ctxThermal.createLinearGradient(0, 0, 0, 140);
  oilGradient.addColorStop(0, 'rgba(255, 170, 0, 0.2)');
  oilGradient.addColorStop(1, 'rgba(255, 170, 0, 0.0)');

  // 1. Oil vs Coolant Temperature Trend Chart (Dual Line, 30 points)
  thermalTrendChart = new Chart(ctxThermal, {
    type: 'line',
    data: {
      labels: Array(CONFIG.charts.maxThermalPoints).fill(''),
      datasets: [
        {
          label: 'Coolant Temp (°C)',
          data: Array(CONFIG.charts.maxThermalPoints).fill(85),
          borderColor: '#00d4ff',
          backgroundColor: coolantGradient,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4,
          tension: 0.35
        },
        {
          label: 'Oil Temp (°C)',
          data: Array(CONFIG.charts.maxThermalPoints).fill(92),
          borderColor: '#ffaa00',
          backgroundColor: oilGradient,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4,
          tension: 0.35
        }
      ]
    },
    options: {
      ...commonChartOptions,
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          min: 60,
          max: 125,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            callback: (val) => val + '°C'
          }
        }
      }
    }
  });

  // Gradients for Fuel Trim
  const stftGradient = ctxStft.createLinearGradient(0, 0, 0, 120);
  stftGradient.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
  stftGradient.addColorStop(1, 'rgba(0, 212, 255, 0.0)');

  // 2. Short-Term Fuel Trim (STFT) Chart (50 points, ±10% threshold lines)
  const stftThresholdUpper = Array(CONFIG.charts.maxFuelTrimPoints).fill(10);
  const stftThresholdLower = Array(CONFIG.charts.maxFuelTrimPoints).fill(-10);
  const stftBaseline = Array(CONFIG.charts.maxFuelTrimPoints).fill(0);

  stftChart = new Chart(ctxStft, {
    type: 'line',
    data: {
      labels: Array(CONFIG.charts.maxFuelTrimPoints).fill(''),
      datasets: [
        {
          label: 'STFT (%)',
          data: Array(CONFIG.charts.maxFuelTrimPoints).fill(2.3),
          borderColor: '#00d4ff',
          backgroundColor: stftGradient,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          tension: 0.25
        },
        {
          label: '+10% Limit',
          data: stftThresholdUpper,
          borderColor: 'rgba(255, 204, 0, 0.65)',
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: '-10% Limit',
          data: stftThresholdLower,
          borderColor: 'rgba(255, 204, 0, 0.65)',
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Stoichiometric 0%',
          data: stftBaseline,
          borderColor: 'rgba(0, 200, 255, 0.18)',
          borderDash: [2, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...commonChartOptions,
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          min: -16,
          max: 16,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            stepSize: 8,
            callback: (val) => (val > 0 ? '+' : '') + val + '%'
          }
        }
      }
    }
  });

  // Gradients for LTFT
  const ltftGradient = ctxLtft.createLinearGradient(0, 0, 0, 120);
  ltftGradient.addColorStop(0, 'rgba(168, 85, 247, 0.22)');
  ltftGradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

  // 3. Long-Term Fuel Trim (LTFT) Chart (50 points, ±10% threshold lines in warning colors)
  ltftChart = new Chart(ctxLtft, {
    type: 'line',
    data: {
      labels: Array(CONFIG.charts.maxFuelTrimPoints).fill(''),
      datasets: [
        {
          label: 'LTFT Drift (%)',
          data: Array(CONFIG.charts.maxFuelTrimPoints).fill(4.1),
          borderColor: '#c084fc',
          backgroundColor: ltftGradient,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          tension: 0.25
        },
        {
          label: '+10% Drift Limit',
          data: Array(CONFIG.charts.maxFuelTrimPoints).fill(10),
          borderColor: 'rgba(255, 51, 68, 0.75)',
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: '-10% Drift Limit',
          data: Array(CONFIG.charts.maxFuelTrimPoints).fill(-10),
          borderColor: 'rgba(255, 51, 68, 0.75)',
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Zero Baseline',
          data: Array(CONFIG.charts.maxFuelTrimPoints).fill(0),
          borderColor: 'rgba(168, 85, 247, 0.2)',
          borderDash: [2, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...commonChartOptions,
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          min: -16,
          max: 16,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            stepSize: 8,
            callback: (val) => (val > 0 ? '+' : '') + val + '%'
          }
        }
      }
    }
  });
}

// ============================================================================
// 4. GAUGE UPDATE IMPLEMENTATIONS
// ============================================================================

/**
 * Updates the semi-circular RPM gauge (0-8000 range)
 * Changes color zones: green < 3000, yellow 3000-5500, red > 5500
 * @param {number} rpm - Current engine RPM
 */
function updateRPMGauge(rpm) {
  const clampedRpm = Math.max(0, Math.min(CONFIG.gaugeConstants.rpmMax, rpm));
  const ratio = clampedRpm / CONFIG.gaugeConstants.rpmMax;

  // Track max RPM observed
  if (clampedRpm > STATE.maxRpmObserved) {
    STATE.maxRpmObserved = Math.round(clampedRpm);
    if (DOM.maxRpmRecorded) {
      DOM.maxRpmRecorded.textContent = STATE.maxRpmObserved.toLocaleString();
    }
  }

  // 1. Calculate SVG Arc Stroke Dashoffset
  // Arc length is ~330px. 0 RPM = 330 offset (empty), 8000 RPM = 0 offset (full)
  const offset = CONFIG.gaugeConstants.rpmArcCircumference - (ratio * CONFIG.gaugeConstants.rpmArcCircumference);
  if (DOM.rpmProgressArc) {
    DOM.rpmProgressArc.style.strokeDashoffset = offset;
  }

  // 2. Rotate Needle: -90deg (0 RPM) to +90deg (8000 RPM)
  const needleAngle = -90 + (ratio * 180);
  if (DOM.rpmNeedleGroup) {
    DOM.rpmNeedleGroup.setAttribute('transform', `rotate(${needleAngle} 140 145)`);
  }

  // 3. Update Digital Display
  if (DOM.rpmValue) {
    DOM.rpmValue.textContent = Math.round(clampedRpm).toLocaleString();
  }
  if (DOM.ribbonRpm) {
    DOM.ribbonRpm.innerHTML = `${Math.round(clampedRpm).toLocaleString()} <span class="unit">RPM</span>`;
  }

  // 4. Color Zones Logic (green < 3000, yellow 3000-5500, red > 5500)
  if (clampedRpm < 3000) {
    // NOMINAL ZONE (< 3000)
    if (DOM.rpmProgressArc) DOM.rpmProgressArc.setAttribute('stroke', 'url(#rpmGradientNominal)');
    if (DOM.rpmZonePill) {
      DOM.rpmZonePill.className = 'rpm-zone-pill nominal';
      DOM.rpmZonePill.textContent = 'NOMINAL CRUISE';
    }
    if (DOM.ribbonRpmZone) {
      DOM.ribbonRpmZone.className = 'ribbon-trend positive';
      DOM.ribbonRpmZone.textContent = 'NORMAL';
    }
    if (DOM.rpmRedlineAlert) DOM.rpmRedlineAlert.style.display = 'none';

  } else if (clampedRpm <= 5500) {
    // WARNING ZONE (3000 - 5500)
    if (DOM.rpmProgressArc) DOM.rpmProgressArc.setAttribute('stroke', 'url(#rpmGradientWarning)');
    if (DOM.rpmZonePill) {
      DOM.rpmZonePill.className = 'rpm-zone-pill warning';
      DOM.rpmZonePill.textContent = 'POWER BAND';
    }
    if (DOM.ribbonRpmZone) {
      DOM.ribbonRpmZone.className = 'ribbon-trend warning';
      DOM.ribbonRpmZone.textContent = 'HIGH REV';
    }
    if (DOM.rpmRedlineAlert) DOM.rpmRedlineAlert.style.display = 'none';

  } else {
    // DANGER ZONE (> 5500)
    if (DOM.rpmProgressArc) DOM.rpmProgressArc.setAttribute('stroke', 'url(#rpmGradientDanger)');
    if (DOM.rpmZonePill) {
      DOM.rpmZonePill.className = 'rpm-zone-pill danger';
      DOM.rpmZonePill.textContent = 'NEAR REDLINE';
    }
    if (DOM.ribbonRpmZone) {
      DOM.ribbonRpmZone.className = 'ribbon-trend danger';
      DOM.ribbonRpmZone.textContent = 'CRITICAL';
    }

    // Trigger Over-Rev Redline Alert if > 6500 RPM
    if (clampedRpm > 6500) {
      if (DOM.rpmRedlineAlert) DOM.rpmRedlineAlert.style.display = 'flex';
      playChime('critical');
    } else {
      if (DOM.rpmRedlineAlert) DOM.rpmRedlineAlert.style.display = 'none';
    }
  }
}

/**
 * Updates Engine Load vertical bar gauge (0-100%)
 * @param {number} percent - Engine load percentage
 */
function updateEngineLoad(percent) {
  const load = Math.max(0, Math.min(100, Math.round(percent)));

  // Update Bar Height
  if (DOM.engineLoadFill) {
    DOM.engineLoadFill.style.height = `${load}%`;
    
    // Color shift on high load
    if (load > 85) {
      DOM.engineLoadFill.className = 'v-tube-fill load-gradient danger';
    } else if (load > 65) {
      DOM.engineLoadFill.className = 'v-tube-fill load-gradient warning';
    } else {
      DOM.engineLoadFill.className = 'v-tube-fill load-gradient';
    }
  }

  // Update Numeric Readout
  if (DOM.engineLoadValue) {
    DOM.engineLoadValue.textContent = load;
  }

  // Update Status Badge
  if (DOM.loadStatusBadge) {
    if (load < 25) {
      DOM.loadStatusBadge.textContent = 'LIGHT / IDLE';
      DOM.loadStatusBadge.className = 'v-status-badge';
    } else if (load < 70) {
      DOM.loadStatusBadge.textContent = 'MODERATE LOAD';
      DOM.loadStatusBadge.className = 'v-status-badge';
    } else if (load < 88) {
      DOM.loadStatusBadge.textContent = 'HEAVY DEMAND';
      DOM.loadStatusBadge.className = 'v-status-badge warning';
    } else {
      DOM.loadStatusBadge.textContent = 'WOT PEAK LOAD';
      DOM.loadStatusBadge.className = 'v-status-badge danger';
    }
  }
}

/**
 * Updates Battery Voltage vertical bar (10-15V range) with color zones
 * @param {number} volts - Battery/alternator voltage in volts
 */
function updateBatteryVoltage(volts) {
  const v = Math.max(10.0, Math.min(15.0, Number(volts)));
  const percentage = ((v - 10.0) / (15.0 - 10.0)) * 100;

  // Update Fill Height
  if (DOM.batteryVoltageFill) {
    DOM.batteryVoltageFill.style.height = `${percentage}%`;
  }

  // Update Readout
  const formattedV = v.toFixed(1);
  if (DOM.batteryVoltageValue) {
    DOM.batteryVoltageValue.textContent = formattedV;
  }
  if (DOM.ribbonVoltage) {
    DOM.ribbonVoltage.innerHTML = `${formattedV} <span class="unit">V</span>`;
  }

  // Color Zones Evaluation:
  // Under-voltage < 11.8V (Red)
  // Marginal 11.8V - 12.0V (Yellow)
  // Optimal Charging 12.0V - 14.4V (Green)
  // Over-voltage > 14.5V (Yellow / Warning)
  if (v < 11.8) {
    if (DOM.batteryVoltageFill) DOM.batteryVoltageFill.className = 'v-tube-fill voltage-danger';
    if (DOM.voltageStatusBadge) {
      DOM.voltageStatusBadge.className = 'v-status-badge danger';
      DOM.voltageStatusBadge.textContent = 'UNDER-VOLTAGE';
    }
  } else if (v < 12.0) {
    if (DOM.batteryVoltageFill) DOM.batteryVoltageFill.className = 'v-tube-fill voltage-warning';
    if (DOM.voltageStatusBadge) {
      DOM.voltageStatusBadge.className = 'v-status-badge warning';
      DOM.voltageStatusBadge.textContent = 'BATTERY LOW';
    }
  } else if (v <= 14.4) {
    if (DOM.batteryVoltageFill) DOM.batteryVoltageFill.className = 'v-tube-fill voltage-nominal';
    if (DOM.voltageStatusBadge) {
      DOM.voltageStatusBadge.className = 'v-status-badge positive';
      DOM.voltageStatusBadge.textContent = 'OPTIMAL CHARGING';
    }
  } else {
    if (DOM.batteryVoltageFill) DOM.batteryVoltageFill.className = 'v-tube-fill voltage-warning';
    if (DOM.voltageStatusBadge) {
      DOM.voltageStatusBadge.className = 'v-status-badge warning';
      DOM.voltageStatusBadge.textContent = 'OVER-CHARGE ALERT';
    }
  }
}

/**
 * Updates Coolant Temperature, Oil Temperature and Intake Air values with color codes
 */
function updateThermalCluster(coolant, oil, intake) {
  const c = Math.round(coolant);
  const o = Math.round(oil);
  const i = Math.round(intake);

  // Coolant Display
  if (DOM.coolantTempValue) {
    DOM.coolantTempValue.textContent = c;
    if (c < 80) {
      DOM.coolantTempValue.className = 'kpi-big-val';
      if (DOM.coolantStatusText) DOM.coolantStatusText.textContent = 'WARMUP PHASE (<80°C)';
      if (DOM.coolantZoneFill) DOM.coolantZoneFill.className = 'kpi-zone-fill cyan';
    } else if (c <= 95) {
      DOM.coolantTempValue.className = 'kpi-big-val nominal';
      if (DOM.coolantStatusText) DOM.coolantStatusText.textContent = 'OPTIMAL (80-95°C)';
      if (DOM.coolantZoneFill) DOM.coolantZoneFill.className = 'kpi-zone-fill';
    } else if (c <= 105) {
      DOM.coolantTempValue.className = 'kpi-big-val warning';
      if (DOM.coolantStatusText) DOM.coolantStatusText.textContent = 'HIGH THERMAL LOAD';
      if (DOM.coolantZoneFill) DOM.coolantZoneFill.className = 'kpi-zone-fill amber';
    } else {
      DOM.coolantTempValue.className = 'kpi-big-val danger';
      if (DOM.coolantStatusText) DOM.coolantStatusText.textContent = 'OVERHEAT CRITICAL!';
      if (DOM.coolantZoneFill) DOM.coolantZoneFill.className = 'kpi-zone-fill danger';
      playChime('critical');
    }
  }

  // Ribbon Coolant
  if (DOM.ribbonCoolant) {
    DOM.ribbonCoolant.innerHTML = `${c} <span class="unit">°C</span>`;
  }
  if (DOM.ribbonCoolantStatus) {
    if (c > 105) {
      DOM.ribbonCoolantStatus.className = 'ribbon-trend danger';
      DOM.ribbonCoolantStatus.textContent = 'OVERHEAT';
    } else if (c > 95) {
      DOM.ribbonCoolantStatus.className = 'ribbon-trend warning';
      DOM.ribbonCoolantStatus.textContent = 'ELEVATED';
    } else {
      DOM.ribbonCoolantStatus.className = 'ribbon-trend positive';
      DOM.ribbonCoolantStatus.textContent = 'OPTIMAL';
    }
  }

  // Oil Display
  if (DOM.oilTempValue) {
    DOM.oilTempValue.textContent = o;
    if (o > 115) {
      DOM.oilTempValue.className = 'kpi-big-val danger';
      if (DOM.oilStatusText) DOM.oilStatusText.textContent = 'DEGRADATION RISK (>115°C)';
    } else {
      DOM.oilTempValue.className = 'kpi-big-val nominal';
      if (DOM.oilStatusText) DOM.oilStatusText.textContent = 'OPTIMAL VISCOSITY';
    }
  }
  if (DOM.ribbonOil) {
    DOM.ribbonOil.innerHTML = `${o} <span class="unit">°C</span>`;
  }

  // Thermal Delta
  const deltaT = o - c;
  if (DOM.ribbonThermalDelta) {
    DOM.ribbonThermalDelta.textContent = `ΔT ${deltaT >= 0 ? '+' : ''}${deltaT}°C`;
  }

  // Intake Air
  if (DOM.intakeAirValue) {
    DOM.intakeAirValue.textContent = i;
  }
}

/**
 * Updates AI Fuel Trim readings & Neural Diagnostics Inference
 */
function updateFuelTrims(stft, ltft) {
  const s = Number(stft);
  const l = Number(ltft);

  if (DOM.stftCurrentVal) {
    DOM.stftCurrentVal.textContent = (s >= 0 ? '+' : '') + s.toFixed(1) + '%';
    DOM.stftCurrentVal.style.color = Math.abs(s) > CONFIG.charts.stftThreshold ? 'var(--warning-yellow)' : 'var(--cyan-glow)';
  }

  if (DOM.ltftCurrentVal) {
    DOM.ltftCurrentVal.textContent = (l >= 0 ? '+' : '') + l.toFixed(1) + '%';
    DOM.ltftCurrentVal.style.color = Math.abs(l) > CONFIG.charts.ltftThreshold ? 'var(--danger-red)' : '#c084fc';
  }

  // Calculate synthetic Lambda estimate: λ ≈ 1.0 - (stft + ltft) / 100
  const estimatedLambda = (1.0 - ((s + l) * 0.007)).toFixed(3);
  if (DOM.lambdaValue) {
    DOM.lambdaValue.textContent = estimatedLambda;
  }

  // AI Diagnostic assessment text & risk score
  let riskScore = 0.8;
  if (Math.abs(s) > 12.0 || Math.abs(l) > 10.0) {
    riskScore = 84.5;
    if (DOM.aiInferenceText) {
      DOM.aiInferenceText.textContent = `ANOMALY DETECTED: Bank 1 unmetered air leak suspected! Fuel trim drift STFT (${s > 0 ? '+' : ''}${s}%) exceeds ±10% threshold. Closed-loop adaptation reaching ceiling.`;
    }
    if (DOM.aiInferenceBox) {
      DOM.aiInferenceBox.style.borderLeftColor = 'var(--danger-red)';
    }
    if (DOM.anomalyRiskVal) {
      DOM.anomalyRiskVal.className = 'val warning';
      DOM.anomalyRiskVal.textContent = riskScore + '%';
    }
  } else if (Math.abs(s) > 8.0 || Math.abs(l) > 7.0) {
    riskScore = 24.2;
    if (DOM.aiInferenceText) {
      DOM.aiInferenceText.textContent = `ADVISORY: Moderate fuel trim compensation active. STFT (${s > 0 ? '+' : ''}${s}%). Monitoring MAF sensor calibration and oxygen sensor switching rate.`;
    }
    if (DOM.aiInferenceBox) {
      DOM.aiInferenceBox.style.borderLeftColor = 'var(--warning-yellow)';
    }
    if (DOM.anomalyRiskVal) {
      DOM.anomalyRiskVal.className = 'val warning';
      DOM.anomalyRiskVal.textContent = riskScore + '%';
    }
  } else {
    riskScore = 0.8;
    if (DOM.aiInferenceText) {
      DOM.aiInferenceText.textContent = `ECU closed-loop stoichiometric fuel correction stable. STFT (${s > 0 ? '+' : ''}${s}%) and LTFT (${l > 0 ? '+' : ''}${l}%) are well within ±10% tolerance band. Lambda λ = ${estimatedLambda}.`;
    }
    if (DOM.aiInferenceBox) {
      DOM.aiInferenceBox.style.borderLeftColor = 'var(--purple-ai)';
    }
    if (DOM.anomalyRiskVal) {
      DOM.anomalyRiskVal.className = 'val green';
      DOM.anomalyRiskVal.textContent = riskScore + '%';
    }
  }

  // AI Health Score
  if (DOM.aiHealthIndex) {
    const health = Math.max(72.0, (100 - (riskScore * 0.3))).toFixed(1);
    DOM.aiHealthIndex.innerHTML = `${health} <span class="unit">%</span>`;
  }
}

/**
 * Pushes new data points into Chart.js datasets with smooth streaming
 */
function updateChartDatasets(coolant, oil, stft, ltft) {
  // 1. Thermal Chart Update (Last 30 points)
  if (thermalTrendChart) {
    const coolantData = thermalTrendChart.data.datasets[0].data;
    const oilData = thermalTrendChart.data.datasets[1].data;

    coolantData.push(coolant);
    oilData.push(oil);

    if (coolantData.length > CONFIG.charts.maxThermalPoints) {
      coolantData.shift();
      oilData.shift();
    }
    thermalTrendChart.update('none'); // Update without full redraw animation for performance
  }

  // 2. STFT Chart Update (Last 50 points)
  if (stftChart) {
    const sData = stftChart.data.datasets[0].data;
    sData.push(stft);
    if (sData.length > CONFIG.charts.maxFuelTrimPoints) {
      sData.shift();
    }
    stftChart.update('none');
  }

  // 3. LTFT Chart Update (Last 50 points)
  if (ltftChart) {
    const lData = ltftChart.data.datasets[0].data;
    lData.push(ltft);
    if (lData.length > CONFIG.charts.maxFuelTrimPoints) {
      lData.shift();
    }
    ltftChart.update('none');
  }
}

// ============================================================================
// 5. ACTIVITY FEED IMPLEMENTATION (COLOR CODED LOGS)
// ============================================================================

/**
 * Prepends a new timestamped activity log entry with severity border coding
 * @param {string} message - Message description
 * @param {string} severity - 'nominal' | 'advisory' | 'anomaly' | 'critical' | 'system'
 */
function addLogEntry(message, severity = 'nominal') {
  if (!DOM.activityFeed) return;

  const validSeverities = ['nominal', 'advisory', 'anomaly', 'critical', 'system'];
  const safeSeverity = validSeverities.includes(severity) ? severity : 'nominal';

  // Format Timestamp HH:MM:SS
  const now = new Date();
  const timeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  // Create Log Element
  const item = document.createElement('div');
  item.className = `log-entry ${safeSeverity}`;
  item.innerHTML = `
    <span class="log-timestamp">${timeStr}</span>
    <span class="log-badge ${safeSeverity}">${safeSeverity.toUpperCase()}</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

  // Prepend to top of activity container
  DOM.activityFeed.insertBefore(item, DOM.activityFeed.firstChild);

  // Maintain max limit (50 entries)
  while (DOM.activityFeed.children.length > CONFIG.feed.maxEntries) {
    DOM.activityFeed.removeChild(DOM.activityFeed.lastChild);
  }

  // Update Counter Badge
  if (DOM.logCountBadge) {
    DOM.logCountBadge.textContent = `${DOM.activityFeed.children.length} EVENTS`;
  }

  // Auto-scroll to top if enabled
  if (STATE.autoScrollEnabled) {
    DOM.activityFeed.scrollTop = 0;
  }

  // Trigger audio feedback chime
  if (safeSeverity === 'anomaly' || safeSeverity === 'critical') {
    playChime(safeSeverity);
  }
}

/**
 * HTML Escaping helper
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// 6. AUDIO SYNTHESIZER (ZERO-DEPENDENCY WEB AUDIO API)
// ============================================================================

/**
 * Initializes or resumes the AudioContext
 */
function initAudio() {
  if (!STATE.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      STATE.audioCtx = new AudioContextClass();
    }
  }
  if (STATE.audioCtx && STATE.audioCtx.state === 'suspended') {
    STATE.audioCtx.resume();
  }
}

/**
 * Plays futuristic synth chimes for HUD alerts
 */
function playChime(type = 'click') {
  if (!STATE.audioEnabled || !STATE.audioCtx) return;

  try {
    const ctx = STATE.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'critical') {
      // High-pitched double alert beep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);

    } else if (type === 'anomaly' || type === 'warning') {
      // Sci-fi two-tone notification
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.15);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);

    } else {
      // Soft UI Click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1040, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (err) {
    console.debug('Audio synth error:', err);
  }
}

// ============================================================================
// 7. TELEMETRY INGESTION DISPATCHER
// ============================================================================

/**
 * Ingests and routes a validated telemetry payload
 * @param {Object} data - Telemetry JSON payload
 */
function processTelemetryPayload(data) {
  if (!data || typeof data !== 'object') return;

  STATE.packetsReceived++;
  const now = Date.now();
  STATE.packetTimes.push(now);

  // Calculate packet frequency (Hz)
  const oneSecAgo = now - 1000;
  STATE.packetTimes = STATE.packetTimes.filter(t => t > oneSecAgo);
  const hzRate = STATE.packetTimes.length.toFixed(1);

  if (DOM.packetsReceivedCount) DOM.packetsReceivedCount.textContent = STATE.packetsReceived.toLocaleString();
  if (DOM.ingestHzRate) DOM.ingestHzRate.textContent = hzRate;

  // Extract fields with fallbacks
  const rpm = Number(data.rpm !== undefined ? data.rpm : 2400);
  const coolant = Number(data.coolant_temp !== undefined ? data.coolant_temp : 85);
  const oil = Number(data.oil_temp !== undefined ? data.oil_temp : 92);
  const voltage = Number(data.battery_voltage !== undefined ? data.battery_voltage : 13.8);
  const load = Number(data.engine_load !== undefined ? data.engine_load : 45);
  const stft = Number(data.stft !== undefined ? data.stft : 2.3);
  const ltft = Number(data.ltft !== undefined ? data.ltft : 4.1);
  const intake = Number(data.intake_air_temp !== undefined ? data.intake_air_temp : 35);
  const vehicleId = data.vehicle_id || 'KA-TRUCK-001';
  const status = data.status || 'NOMINAL';

  // Update State Buffer
  STATE.telemetry = {
    rpm, coolant_temp: coolant, oil_temp: oil, battery_voltage: voltage,
    engine_load: load, stft, ltft, intake_air_temp: intake,
    status, vehicle_id: vehicleId, timestamp: data.timestamp || now
  };

  // 1. Vehicle ID Update
  if (DOM.vehicleId && DOM.vehicleId.textContent !== vehicleId) {
    DOM.vehicleId.textContent = vehicleId;
  }

  // 2. System Status Badge
  updateSystemHealth(status, coolant, voltage, stft);

  // 3. Central Gauges Update
  updateRPMGauge(rpm);
  updateEngineLoad(load);
  updateBatteryVoltage(voltage);

  // 4. Thermal & AI Panels
  updateThermalCluster(coolant, oil, intake);
  updateFuelTrims(stft, ltft);

  // 5. Update Real-Time Charts
  updateChartDatasets(coolant, oil, stft, ltft);
}

/**
 * Updates Overall Vehicle Status Indicator in Header
 */
function updateSystemHealth(status, coolant, voltage, stft) {
  let computedStatus = status.toUpperCase();

  // Automatic severity escalation based on physical limits
  if (coolant > 105 || voltage < 11.5) {
    computedStatus = 'CRITICAL';
  } else if (coolant > 98 || Math.abs(stft) > 10.0 || voltage < 12.0) {
    if (computedStatus !== 'CRITICAL') computedStatus = 'ADVISORY';
  }

  if (DOM.systemHealthText) DOM.systemHealthText.textContent = `SYSTEM ${computedStatus}`;
  
  if (DOM.systemHealthDot) {
    if (computedStatus === 'CRITICAL') {
      DOM.systemHealthDot.className = 'status-pulse-dot danger';
      if (DOM.systemHealthBadge) DOM.systemHealthBadge.style.borderColor = 'rgba(255, 51, 68, 0.4)';
    } else if (computedStatus === 'ADVISORY' || computedStatus === 'WARNING') {
      DOM.systemHealthDot.className = 'status-pulse-dot warning';
      if (DOM.systemHealthBadge) DOM.systemHealthBadge.style.borderColor = 'rgba(255, 204, 0, 0.4)';
    } else {
      DOM.systemHealthDot.className = 'status-pulse-dot';
      if (DOM.systemHealthBadge) DOM.systemHealthBadge.style.borderColor = 'rgba(0, 255, 136, 0.35)';
    }
  }
}

// ============================================================================
// 8. MQTT NETWORK CLIENT CONFIGURATION
// ============================================================================

/**
 * Configures and connects to MQTT Broker over WebSockets
 */
function initMQTT() {
  setConnectionStatus('connecting', 'CONNECTING...');

  addLogEntry(`Initializing MQTT connection to ${CONFIG.mqtt.brokerUrl}`, 'system');

  try {
    // Check if mqtt library is loaded from CDN
    if (typeof mqtt === 'undefined') {
      throw new Error('MQTT.js library not loaded from CDN.');
    }

    const options = {
      clientId: CONFIG.mqtt.clientId,
      clean: true,
      connectTimeout: CONFIG.mqtt.connectTimeoutMs,
      keepalive: CONFIG.mqtt.keepalive,
      reconnectPeriod: 5000
    };

    STATE.mqttClient = mqtt.connect(CONFIG.mqtt.brokerUrl, options);

    // Watchdog timer: If not connected within 5s, start simulation mode
    STATE.mqttTimeoutTimer = setTimeout(() => {
      if (!STATE.isMqttConnected) {
        addLogEntry('MQTT broker connection timed out after 5s. Starting Autonomous Simulation Mode.', 'advisory');
        startSimulationMode('MQTT Broker Offline');
      }
    }, CONFIG.mqtt.connectTimeoutMs);

    // Event: Connect
    STATE.mqttClient.on('connect', () => {
      clearTimeout(STATE.mqttTimeoutTimer);
      STATE.isMqttConnected = true;
      setConnectionStatus('connected', 'MQTT CONNECTED');
      addLogEntry(`Connected to MQTT broker. Subscribing to '${CONFIG.mqtt.topic}'`, 'nominal');

      STATE.mqttClient.subscribe(CONFIG.mqtt.topic, (err) => {
        if (err) {
          addLogEntry(`Failed to subscribe to topic: ${err.message}`, 'critical');
        } else {
          addLogEntry(`Subscribed to topic: ${CONFIG.mqtt.topic}`, 'nominal');
        }
      });
    });

    // Event: Message Received
    STATE.mqttClient.on('message', (topic, payload) => {
      try {
        const messageStr = payload.toString();
        const data = JSON.parse(messageStr);
        processTelemetryPayload(data);
      } catch (err) {
        addLogEntry(`Payload JSON parse error: ${err.message}`, 'advisory');
      }
    });

    // Event: Error
    STATE.mqttClient.on('error', (err) => {
      console.warn('MQTT client error:', err);
      if (!STATE.isSimulationMode) {
        setConnectionStatus('disconnected', 'BROKER ERROR');
        addLogEntry(`MQTT socket error: ${err.message || 'Connection failure'}`, 'advisory');
      }
    });

    // Event: Offline / Close
    STATE.mqttClient.on('offline', () => {
      if (!STATE.isSimulationMode) {
        setConnectionStatus('connecting', 'RECONNECTING...');
      }
    });

  } catch (error) {
    console.error('MQTT initialization exception:', error);
    addLogEntry(`MQTT init error: ${error.message}. Engaging simulation.`, 'advisory');
    startSimulationMode('Library Load Fault');
  }
}

/**
 * Update header connection indicator
 */
function setConnectionStatus(stateClass, text) {
  if (DOM.mqttStatusDot) {
    DOM.mqttStatusDot.className = `status-dot ${stateClass}`;
  }
  if (DOM.mqttStatusText) {
    DOM.mqttStatusText.textContent = text;
  }
}

// ============================================================================
// 9. AUTONOMOUS SIMULATION MODE (INVESTOR DEMO ENGINE)
// ============================================================================

/**
 * Starts realistic autonomous vehicle telemetry simulation
 */
function startSimulationMode(reason = 'Demo Mode') {
  if (STATE.isSimulationMode && STATE.simulationInterval) return;

  STATE.isSimulationMode = true;
  setConnectionStatus('simulation', 'SIMULATION ACTIVE');
  
  if (DOM.modeToggleBtn) {
    DOM.modeToggleBtn.classList.add('simulating');
    if (DOM.modeText) DOM.modeText.textContent = 'SIMULATOR';
    if (DOM.modeIcon) DOM.modeIcon.className = 'fa-solid fa-microchip';
  }

  addLogEntry(`Autonomous telemetry simulation engine engaged [${reason}].`, 'system');

  // Realistic Simulation Physics Loop (every 850ms)
  STATE.simulationInterval = setInterval(() => {
    generateSimulatedTelemetryTick();
  }, 850);
}

/**
 * Stops simulation mode and attempts to rejoin live MQTT
 */
function stopSimulationMode() {
  if (!STATE.isSimulationMode) return;

  clearInterval(STATE.simulationInterval);
  STATE.simulationInterval = null;
  STATE.isSimulationMode = false;

  if (DOM.modeToggleBtn) {
    DOM.modeToggleBtn.classList.remove('simulating');
    if (DOM.modeText) DOM.modeText.textContent = 'LIVE MQTT';
    if (DOM.modeIcon) DOM.modeIcon.className = 'fa-solid fa-satellite-dish';
  }

  if (STATE.isMqttConnected) {
    setConnectionStatus('connected', 'MQTT CONNECTED');
    addLogEntry('Simulation ended. Restored live MQTT feed.', 'nominal');
  } else {
    setConnectionStatus('connecting', 'CONNECTING...');
    addLogEntry('Simulation ended. Attempting broker handshake...', 'system');
    initMQTT();
  }
}

/**
 * Generates a realistic telemetry frame with engine rpm curves, shifting gears,
 * thermal thermodynamics and natural sensor micro-noise.
 */
function generateSimulatedTelemetryTick() {
  const sim = STATE.simPhysics;
  sim.simTime += 0.85;

  // Handle active injected anomalies
  if (sim.anomalyActive) {
    sim.anomalyDuration--;
    if (sim.anomalyDuration <= 0) {
      addLogEntry(`Injected condition [${sim.anomalyActive}] resolved. Returning to baseline.`, 'nominal');
      sim.anomalyActive = null;
    }
  }

  // Natural engine speed oscillation and cruise dynamics
  let targetRpm = 2400;
  let targetLoad = 42;
  let targetCoolant = 87 + Math.sin(sim.simTime * 0.05) * 3;
  let targetOil = targetCoolant + 7.2 + Math.sin(sim.simTime * 0.03) * 1.5;
  let targetVoltage = 13.85 + (Math.sin(sim.simTime * 0.3) * 0.15);
  let targetStft = Math.sin(sim.simTime * 0.2) * 2.8 + (Math.random() - 0.5);
  let targetLtft = 4.1 + (Math.sin(sim.simTime * 0.02) * 0.4);
  let targetIntake = 34 + Math.round(Math.sin(sim.simTime * 0.01) * 2);
  let vehicleStatus = 'NOMINAL';

  // Apply Anomaly Injector Overrides
  if (sim.anomalyActive === 'rev_spike') {
    targetRpm = 5850 + Math.random() * 200;
    targetLoad = 88;
    vehicleStatus = 'ADVISORY';
  } else if (sim.anomalyActive === 'lean_spike') {
    targetStft = 14.8 + Math.random() * 1.2;
    targetLtft = 7.5;
    targetLoad = 62;
    vehicleStatus = 'WARNING';
  } else if (sim.anomalyActive === 'overheat') {
    targetCoolant = 108.4;
    targetOil = 118.6;
    vehicleStatus = 'CRITICAL';
  } else if (sim.anomalyActive === 'batt_sag') {
    targetVoltage = 11.2;
    targetLoad = 70;
    vehicleStatus = 'WARNING';
  } else {
    // Standard driving cycle: subtle gear shifts
    const cyclePhase = Math.floor(sim.simTime / 12) % 4;
    if (cyclePhase === 0) {
      // Gentle Acceleration
      targetRpm = 2200 + ((sim.simTime % 12) * 120);
      targetLoad = 55;
    } else if (cyclePhase === 1) {
      // Upshift drop
      targetRpm = 1950 + ((sim.simTime % 12) * 40);
      targetLoad = 38;
    } else if (cyclePhase === 2) {
      // Steady High-speed Highway Cruise
      targetRpm = 2450 + (Math.random() - 0.5) * 40;
      targetLoad = 44;
    } else {
      // Deceleration / coasting
      targetRpm = 1450 + (Math.random() - 0.5) * 60;
      targetLoad = 18;
    }
  }

  // Construct Synthetic Payload
  const payload = {
    rpm: Math.round(targetRpm),
    coolant_temp: Number(targetCoolant.toFixed(1)),
    oil_temp: Number(targetOil.toFixed(1)),
    battery_voltage: Number(targetVoltage.toFixed(1)),
    engine_load: Math.round(targetLoad),
    stft: Number(targetStft.toFixed(1)),
    ltft: Number(targetLtft.toFixed(1)),
    intake_air_temp: targetIntake,
    status: vehicleStatus,
    vehicle_id: 'KA-TRUCK-001',
    timestamp: Date.now()
  };

  // Dispatch into normal ingestion pipeline
  processTelemetryPayload(payload);
}

/**
 * Trigger deliberate anomalies for live investor presentations
 */
function triggerAnomaly(type) {
  playChime('click');
  initAudio();

  STATE.simPhysics.anomalyActive = type;
  STATE.simPhysics.anomalyDuration = 14; // Frames

  if (type === 'rev_spike') {
    addLogEntry('[ANOMALY INJECTED] High RPM transient throttle blip (5,800 RPM). Near redline.', 'advisory');
  } else if (type === 'lean_spike') {
    addLogEntry('[CRITICAL ANOMALY INJECTED] Bank 1 STFT spike (+14.8%). Lean fuel mixture fault detected!', 'anomaly');
  } else if (type === 'overheat') {
    addLogEntry('[CRITICAL ANOMALY INJECTED] Coolant temperature surged to 108°C! Thermostat restriction alert.', 'critical');
  } else if (type === 'batt_sag') {
    addLogEntry('[ANOMALY INJECTED] Alternator rail sag (11.2V). Insufficient battery charging voltage.', 'anomaly');
  }
}

/**
 * Restores nominal cruise
 */
function resetToNominal() {
  playChime('click');
  STATE.simPhysics.anomalyActive = null;
  STATE.simPhysics.anomalyDuration = 0;
  addLogEntry('[SYSTEM RESET] Vehicle telemetry restored to baseline nominal operating parameters.', 'nominal');
}

// ============================================================================
// 10. USER INTERACTION & EVENT LISTENERS
// ============================================================================

function attachEventListeners() {
  // Mode Switch Button (Live MQTT <-> Simulator)
  if (DOM.modeToggleBtn) {
    DOM.modeToggleBtn.addEventListener('click', () => {
      playChime('click');
      if (STATE.isSimulationMode) {
        stopSimulationMode();
      } else {
        startSimulationMode('User Requested');
      }
    });
  }

  // Audio Toggle Button
  if (DOM.audioToggleBtn) {
    DOM.audioToggleBtn.addEventListener('click', () => {
      initAudio();
      STATE.audioEnabled = !STATE.audioEnabled;
      if (STATE.audioEnabled) {
        DOM.audioToggleBtn.classList.add('active');
        if (DOM.audioIcon) DOM.audioIcon.className = 'fa-solid fa-volume-high';
        playChime('nominal');
        addLogEntry('Acoustic telemetry synthesizer enabled.', 'system');
      } else {
        DOM.audioToggleBtn.classList.remove('active');
        if (DOM.audioIcon) DOM.audioIcon.className = 'fa-solid fa-volume-xmark';
      }
    });
  }

  // Clear Activity Feed
  if (DOM.clearLogBtn) {
    DOM.clearLogBtn.addEventListener('click', () => {
      playChime('click');
      if (DOM.activityFeed) {
        DOM.activityFeed.innerHTML = '';
      }
      if (DOM.logCountBadge) {
        DOM.logCountBadge.textContent = '0 EVENTS';
      }
    });
  }

  // Toggle Auto-Scroll
  if (DOM.pauseScrollBtn) {
    DOM.pauseScrollBtn.addEventListener('click', () => {
      playChime('click');
      STATE.autoScrollEnabled = !STATE.autoScrollEnabled;
      if (STATE.autoScrollEnabled) {
        if (DOM.pauseScrollText) DOM.pauseScrollText.textContent = 'Auto-Scroll ON';
        if (DOM.pauseScrollIcon) DOM.pauseScrollIcon.className = 'fa-solid fa-angles-down';
      } else {
        if (DOM.pauseScrollText) DOM.pauseScrollText.textContent = 'Auto-Scroll PAUSED';
        if (DOM.pauseScrollIcon) DOM.pauseScrollIcon.className = 'fa-solid fa-pause';
      }
    });
  }

  // Demo Injector Buttons
  if (DOM.injectRevBtn) {
    DOM.injectRevBtn.addEventListener('click', () => triggerAnomaly('rev_spike'));
  }
  if (DOM.injectLeanBtn) {
    DOM.injectLeanBtn.addEventListener('click', () => triggerAnomaly('lean_spike'));
  }
  if (DOM.injectOverheatBtn) {
    DOM.injectOverheatBtn.addEventListener('click', () => triggerAnomaly('overheat'));
  }
  if (DOM.injectBattSagBtn) {
    DOM.injectBattSagBtn.addEventListener('click', () => triggerAnomaly('batt_sag'));
  }
  if (DOM.restoreNominalBtn) {
    DOM.restoreNominalBtn.addEventListener('click', () => resetToNominal());
  }

  // Digital Clock Updater (every second)
  setInterval(() => {
    if (DOM.digitalClock) {
      const now = new Date();
      DOM.digitalClock.textContent = now.toUTCString().split(' ')[4] + ' UTC';
    }
  }, 1000);
}

// ============================================================================
// 11. APPLICATION BOOTSTRAP
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
  console.log('[Kolls Autotronics] Dashboard Core Initializing...');

  // 1. Initialize Visualizers
  initCharts();

  // 2. Attach UI Handlers
  attachEventListeners();

  // 3. Populate Initial Baseline Readings
  processTelemetryPayload(STATE.telemetry);

  // 4. Seed Activity Feed with System Boot Logs
  addLogEntry('Kolls Autotronics AI Vehicle Health Monitoring Core online.', 'system');
  addLogEntry('Neural model LAMBDA-PREDICT v2.8 loaded. Closed-loop monitoring active.', 'nominal');
  addLogEntry('Calibrated SAE J1979 CAN-bus telemetry interface initialized.', 'nominal');

  // 5. Connect to MQTT Broker (HiveMQ WebSockets)
  initMQTT();
});
