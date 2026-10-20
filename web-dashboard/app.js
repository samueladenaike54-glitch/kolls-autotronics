/**
 * ==============================================================================
 * KOLLS — SMART CAR HEALTH MONITOR APP LOGIC
 * Dark Neumorphism (Soft UI) — Pure White & Dark Blue Automotive Cockpit
 * ==============================================================================
 */

// Application State
const STATE = {
  currentTab: 'health',           // 'health' | 'repairs' | 'assistant'
  drivingStyle: 'gentle',         // 'gentle' | 'city' | 'heavy'
  healthScore: 87,
  totalSaved: 2300,
  
  // Selected Vehicle
  currentCar: 'suv',
  cars: {
    suv: {
      name: '2024 Toyota RAV4 Hybrid',
      headerName: '2024 Toyota RAV4 • Connected',
      baseScore: 87,
      battery: '13.8 V',
      temp: '88°C',
      range: '680 KM'
    },
    sedan: {
      name: '2023 Honda Civic 2.0L',
      headerName: '2023 Honda Civic • Connected',
      baseScore: 95,
      battery: '14.1 V',
      temp: '86°C',
      range: '540 KM'
    },
    truck: {
      name: '2022 Ford F-150 SuperCrew',
      headerName: '2022 Ford F-150 • Connected',
      baseScore: 74,
      battery: '13.5 V',
      temp: '92°C',
      range: '420 KM'
    }
  },

  // Part Lifespan Base Data
  consumables: [
    { title: 'Engine Oil', baseKm: 10000, usedKm: 3800 },
    { title: 'Brake Pads', baseKm: 25000, usedKm: 19200 },
    { title: 'Tires Tread', baseKm: 50000, usedKm: 32000 },
    { title: 'Spark Plugs', baseKm: 80000, usedKm: 42000 },
    { title: 'Coolant Fluid', baseKm: 60000, usedKm: 20000 }
  ]
};

// ==============================================================================
// 1. INITIALIZATION & TAB SWITCHER
// ==============================================================================

window.addEventListener('DOMContentLoaded', () => {
  renderWearBars();
  startSubtleSensorsDrift();
});

/**
 * Switch between the 3 main tabs: 'health', 'repairs', 'assistant'
 */
function switchTab(tabId) {
  STATE.currentTab = tabId;

  // Toggle Tab Pages
  document.querySelectorAll('.tab-page').forEach(page => {
    page.classList.remove('active');
  });
  const activePage = document.getElementById(`page-${tabId}`);
  if (activePage) activePage.classList.add('active');

  // Toggle Bottom Navigation
  document.querySelectorAll('.app-bottom-nav .nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Scroll to top of app body
  const body = document.querySelector('.app-body');
  if (body) body.scrollTop = 0;
}


// ==============================================================================
// 2. TAB 1: CAR HEALTH FUNCTIONS
// ==============================================================================

function updateHealthScoreDisplay(newScore) {
  STATE.healthScore = Math.max(10, Math.min(100, newScore));
  
  // Update number and circular bar
  const numEl = document.getElementById('health-score-number');
  if (numEl) numEl.innerText = STATE.healthScore;

  const barEl = document.getElementById('health-circle-bar');
  if (barEl) {
    barEl.setAttribute('stroke-dasharray', `${STATE.healthScore}, 100`);
    barEl.style.stroke = 'var(--text-white)';
    barEl.style.filter = 'drop-shadow(0 0 6px var(--accent-blue-glow))';
  }

  // Update Status Pill
  const pillEl = document.getElementById('health-status-badge');
  const summaryEl = document.getElementById('health-summary-text');
  if (pillEl) {
    if (STATE.healthScore >= 90) {
      pillEl.className = 'status-pill status-good';
      pillEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Optimal Condition';
      if (summaryEl) summaryEl.innerText = 'All vehicle subsystems are operating at optimal factory performance.';
    } else if (STATE.healthScore >= 75) {
      pillEl.className = 'status-pill status-good';
      pillEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Nominal Condition';
      if (summaryEl) summaryEl.innerText = 'No critical faults detected. One preventative maintenance item suggested soon.';
    } else {
      pillEl.className = 'status-pill status-warn';
      pillEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Inspection Recommended';
      if (summaryEl) summaryEl.innerText = 'Attention required: cooling or battery system requires driver inspection.';
    }
  }
}


// ==============================================================================
// 3. TAB 2: REPAIRS & WEAR SIMULATOR
// ==============================================================================

/**
 * Simulate fixing an alert to see instant savings and score improvement
 */
function simulateRepair(alertId, savedDollars) {
  const alertCard = document.getElementById(`repair-alert-${alertId}`);
  if (!alertCard) return;

  // Smooth fade out
  alertCard.style.opacity = '0';
  alertCard.style.transform = 'translateY(-10px)';

  setTimeout(() => {
    alertCard.remove();

    // If thermostat was fixed, also update cooling row on Health screen
    if (alertId === 1) {
      const coolingRow = document.getElementById('comp-row-cooling');
      if (coolingRow) {
        coolingRow.classList.remove('alert-row');
        const pDesc = coolingRow.querySelector('.comp-info p');
        if (pDesc) {
          pDesc.className = 'text-sub';
          pDesc.innerText = 'Thermostat operating at peak nominal efficiency';
        }
        const stStrong = coolingRow.querySelector('.comp-status strong');
        if (stStrong) {
          stStrong.innerText = '96%';
          stStrong.className = 'text-white';
        }
        const stSpan = coolingRow.querySelector('.comp-status span');
        if (stSpan) stSpan.innerText = 'Optimal';
      }
    }

    // Update Saved Total
    STATE.totalSaved += savedDollars;
    const disp = document.getElementById('total-saved-display');
    if (disp) disp.innerText = `$${STATE.totalSaved.toLocaleString()}+`;

    // Improve overall health score
    updateHealthScoreDisplay(STATE.healthScore + 6);

    showToast(`Repair simulated! Saved $${savedDollars.toLocaleString()} and restored car health.`);
  }, 300);
}

/**
 * Driving style toggle (Gentle Highway / Urban City / Stop & Go)
 */
function setDriverStyle(style) {
  STATE.drivingStyle = style;

  document.getElementById('btn-style-gentle').classList.toggle('active', style === 'gentle');
  document.getElementById('btn-style-city').classList.toggle('active', style === 'city');
  document.getElementById('btn-style-heavy').classList.toggle('active', style === 'heavy');

  renderWearBars();
}

function renderWearBars() {
  const container = document.getElementById('wear-bars-container');
  if (!container) return;

  // Multiplier based on driving habits
  let multiplier = 1.0;
  if (STATE.drivingStyle === 'city') multiplier = 0.75;
  if (STATE.drivingStyle === 'heavy') multiplier = 0.55;

  container.innerHTML = STATE.consumables.map(c => {
    const remainingKm = Math.round((c.baseKm - c.usedKm) * multiplier);
    const pct = Math.max(5, Math.min(100, Math.round((remainingKm / c.baseKm) * 100)));

    return `
      <div class="wear-card">
        <div class="wear-head">
          <span>${c.title}</span>
          <strong>${pct}% Life</strong>
        </div>
        <div class="wear-bar-track">
          <div class="wear-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <span class="wear-sub">${remainingKm.toLocaleString()} KM remaining before recommended change</span>
      </div>
    `;
  }).join('');
}


// ==============================================================================
// 4. TAB 3: ASSISTANT (CHAT SUB-FEATURE, HABITS & TOOLS)
// ==============================================================================

function askMechanicQuestion(questionText) {
  const input = document.getElementById('assistant-input-field');
  if (input) {
    input.value = questionText;
    sendAssistantMessage();
  }
}

function sendAssistantMessage() {
  const input = document.getElementById('assistant-input-field');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const chatStream = document.getElementById('assistant-chat-stream');

  // Append user bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'msg-bubble msg-user';
  userMsg.innerHTML = `<p>${text}</p>`;
  chatStream.appendChild(userMsg);
  input.value = '';
  chatStream.scrollTop = chatStream.scrollHeight;

  // Bot response with clear, simple analogies
  setTimeout(() => {
    let reply = "Your vehicle diagnostics show everything is generally running well and combustion is clean.";
    const q = text.toLowerCase();

    if (q.includes('warm') || q.includes('hot') || q.includes('temp') || q.includes('thermostat')) {
      reply = "💡 <strong>Engine Warmth:</strong> Your thermostat is like a home radiator valve. Right now it's opening slowly.<br><br>It's safe to drive for now, but changing the $20 part soon prevents the engine from overheating and warping costly cylinder heads.";
    } else if (q.includes('brake') || q.includes('pad')) {
      reply = "🛑 <strong>Brake Pads:</strong> Think of brake pads like shoe soles. Right now you have 2.7 mm left before the metal backing touches the rotor.<br><br>You have about 1,200 km of normal driving left. A $180 pad change today avoids gouging your metal rotors which would cost $650.";
    } else if (q.includes('battery') || q.includes('volt')) {
      reply = "⚡ <strong>Battery & Charging:</strong> Your battery is resting at a healthy 13.8V and the alternator is recharging it smoothly whenever you drive. No replacement needed.";
    } else if (q.includes('fuel') || q.includes('gas') || q.includes('save')) {
      reply = "⛽ <strong>Fuel Saving Tip:</strong> Smooth coasting when you see red lights ahead saves up to 15% on gas and takes stress off your brake pads.";
    }

    const botMsg = document.createElement('div');
    botMsg.className = 'msg-bubble msg-bot';
    botMsg.innerHTML = `<p>${reply}</p>`;
    chatStream.appendChild(botMsg);
    chatStream.scrollTop = chatStream.scrollHeight;
  }, 600);
}


// ==============================================================================
// 5. MODALS (GARAGE, AUDIT CERTIFICATE, TEST LAB)
// ==============================================================================

function openGarageModal() { document.getElementById('garage-modal').classList.add('open'); }
function closeGarageModal() { document.getElementById('garage-modal').classList.remove('open'); }

function selectCar(carKey) {
  closeGarageModal();
  STATE.currentCar = carKey;
  const car = STATE.cars[carKey];
  if (!car) return;

  // Update header and vitals
  document.getElementById('header-car-name').innerText = car.headerName;
  document.getElementById('val-battery').innerText = car.battery;
  document.getElementById('val-temp').innerText = car.temp;
  document.getElementById('val-range').innerText = car.range;

  // Update certificate
  document.getElementById('cert-title').innerText = car.name;
  document.getElementById('cert-score').innerText = `${car.baseScore} / 100 (Optimal)`;

  updateHealthScoreDisplay(car.baseScore);
  showToast(`Switched vehicle to ${car.name}`);
}

function openCertModal() { document.getElementById('cert-modal').classList.add('open'); }
function closeCertModal() { document.getElementById('cert-modal').classList.remove('open'); }

function openSimModal() { document.getElementById('sim-modal').classList.add('open'); }
function closeSimModal() { document.getElementById('sim-modal').classList.remove('open'); }

function triggerTestScenario(type) {
  closeSimModal();

  if (type === 'overheat') {
    document.getElementById('val-temp').innerText = '112°C';
    updateHealthScoreDisplay(68);
    showToast("⚠️ Warning: Elevated engine temperature (112°C). Thermostat valve sluggish.");
  } else if (type === 'battery') {
    document.getElementById('val-battery').innerText = '11.4 V';
    updateHealthScoreDisplay(72);
    showToast("⚠️ Notice: Low battery bus voltage detected (11.4V).");
  } else if (type === 'tire') {
    const tireFl = document.getElementById('tire-fl');
    if (tireFl) {
      tireFl.innerText = '24 PSI';
    }
    showToast("⚠️ Notice: Front Left tire pressure dropped to 24 PSI.");
  } else if (type === 'reset') {
    document.getElementById('val-temp').innerText = '88°C';
    document.getElementById('val-battery').innerText = '13.8 V';
    const tireFl = document.getElementById('tire-fl');
    if (tireFl) {
      tireFl.innerText = '35 PSI';
    }
    updateHealthScoreDisplay(87);
    showToast("All vehicle systems restored to nominal.");
  }
}


// ==============================================================================
// 6. SENSORS SIMULATION & TOAST NOTIFICATION
// ==============================================================================

function showToast(message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function startSubtleSensorsDrift() {
  // Live subtle drift to show realistic vehicle connectivity
  setInterval(() => {
    if (STATE.healthScore >= 80) {
      const tempVariation = (88 + (Math.random() * 0.4 - 0.2)).toFixed(1);
      const voltVariation = (13.8 + (Math.random() * 0.08 - 0.04)).toFixed(1);
      
      const tempEl = document.getElementById('val-temp');
      const voltEl = document.getElementById('val-battery');
      if (tempEl) tempEl.innerText = `${tempVariation}°C`;
      if (voltEl) voltEl.innerText = `${voltVariation} V`;
    }
  }, 3000);
}
