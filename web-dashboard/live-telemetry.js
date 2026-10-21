/* ==========================================================================
   ORION BY KOLLS — LIVE ESP32 TELEMETRY BRIDGE
   Subscribes to the firmware's raw MQTT feed and its app-shaped topic.
   The ESP32 remains the source of truth; this file only transports and
   shapes the readings for the UI.
   ========================================================================== */

(function (global) {
  'use strict';

  const DEFAULT_BROKER = 'wss://l90668f6.ala.us-east-1.emqxsl.com:8084/mqtt';
  const DEFAULT_USERNAME = 'orionx';
  const DEFAULT_PASSWORD = 'samuel123';
  const DEFAULT_GATEWAY = 'http://192.168.43.123';
  const GATEWAY_STORAGE_KEY = 'orion.gatewayUrl';
  const GATEWAY_POLL_MS = 1000;
  const GATEWAY_TIMEOUT_MS = 2500;
  const RAW_TOPIC = 'kolls/vehicle/telemetry';
  const DEFAULT_VEHICLE_ID = 'KA-TRUCK-001';
  const APP_TOPIC_FORMAT = (vehicleId) => `kolls/vehicle/${vehicleId}/app`;
  const COMMAND_TOPIC_FORMAT = (vehicleId) => `kolls/vehicle/${vehicleId}/commands`;
  const STALE_AFTER_MS = 9000;
  const WAITING_AFTER_MS = 10000;

  function gatewayOverride() {
    try {
      return normaliseGatewayUrl(new URLSearchParams(global.location.search).get('gateway'));
    } catch (error) {
      return '';
    }
  }

  function storedGateway() {
    const override = gatewayOverride();
    if (override) return override;
    try {
      const saved = global.localStorage.getItem(GATEWAY_STORAGE_KEY);
      return saved ? normaliseGatewayUrl(saved) : DEFAULT_GATEWAY;
    } catch (error) {
      return DEFAULT_GATEWAY;
    }
  }

  function normaliseGatewayUrl(value) {
    let url = String(value || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
    return url.replace(/\/+$/, '');
  }

  const state = {
    status: 'idle',
    mode: 'gateway',
    connected: false,
    brokerUrl: DEFAULT_BROKER,
    gatewayUrl: storedGateway(),
    gatewayConnected: false,
    gatewayError: null,
    lastGatewayAt: 0,
    gatewayFailures: 0,
    topic: RAW_TOPIC,
    appTopic: APP_TOPIC_FORMAT(DEFAULT_VEHICLE_ID),
    vehicleId: DEFAULT_VEHICLE_ID,
    rawData: null,
    appData: null,
    data: null,
    lastRawAt: 0,
    lastAppAt: 0,
    lastMessageAt: 0,
    connectedAt: 0,
    lastCommand: null,
    lastCommandResponse: null,
    error: null,
    connectAttempts: 0
  };

  let client = null;
  let watchdog = null;
  let telemetryTimer = null;
  let gatewayTimer = null;
  let gatewayPolling = false;
  const listeners = new Set();

  function now() {
    return Date.now();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toNumber(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    return Boolean(value);
  }

  function appTopic(vehicleId) {
    return APP_TOPIC_FORMAT(vehicleId || state.vehicleId || DEFAULT_VEHICLE_ID);
  }

  function ageMs() {
    return state.lastMessageAt ? Math.max(0, now() - state.lastMessageAt) : null;
  }

  function isFresh() {
    const age = ageMs();
    return state.connected && age !== null && age < STALE_AFTER_MS;
  }

  function status() {
    const age = ageMs();
    return {
      status: state.status,
      mode: state.mode,
      connected: state.connected,
      fresh: isFresh(),
      brokerUrl: state.brokerUrl,
      gatewayUrl: state.gatewayUrl,
      gatewayConnected: state.gatewayConnected,
      gatewayError: state.gatewayError,
      gatewayFailures: state.gatewayFailures,
      lastGatewayAt: state.lastGatewayAt,
      topic: state.topic,
      appTopic: state.appTopic,
      vehicleId: state.vehicleId,
      data: state.data,
      lastMessageAt: state.lastMessageAt,
      ageMs: age,
      lastCommand: state.lastCommand,
      lastCommandResponse: state.lastCommandResponse,
      error: state.error,
      connectAttempts: state.connectAttempts
    };
  }

  function emit(event, detail) {
    const payload = Object.assign({ event }, detail || {}, { state: status() });
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        if (global.console && console.warn) console.warn('OrionLive listener failed', error);
      }
    });

    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      global.dispatchEvent(new CustomEvent('orion:telemetry', { detail: payload }));
    }
  }

  function normaliseLocation(value) {
    if (!value || typeof value !== 'object') return null;

    const source = String(value.source || 'none').toLowerCase();
    const lat = toNumber(value.lat, null);
    const lon = toNumber(value.lon, null);
    const hasCoords = lat !== null && lon !== null
      && Math.abs(lat) <= 90
      && Math.abs(lon) <= 180;

    return {
      source: ['ip', 'app', 'gps'].includes(source) ? source : 'none',
      lat: hasCoords ? lat : null,
      lon: hasCoords ? lon : null,
      city: value.city ? String(value.city) : '',
      country: value.country ? String(value.country) : '',
      speedKmh: toNumber(value.speed_kmh, 0),
      altM: toNumber(value.alt_m, 0),
      sats: Math.max(0, Math.round(toNumber(value.sats, 0))),
      fix: clamp(Math.round(toNumber(value.fix, 0)), 0, 2),
      ageS: Math.max(0, Math.round(toNumber(value.age_s, 0)))
    };
  }

  function locationRank(location) {
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return -1;
    if (location.source === 'app' || location.source === 'gps') {
      return location.fix > 0 && location.ageS <= 120 ? 4 : 1;
    }
    if (location.source === 'ip') return 2;
    return 1;
  }

  function bestLocation(appLocation, rawLocation) {
    if (!appLocation) return rawLocation || null;
    if (!rawLocation) return appLocation;
    return locationRank(rawLocation) > locationRank(appLocation) ? rawLocation : appLocation;
  }

  function normaliseRaw(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // A PING response is published on the telemetry topic by the firmware.
    if (raw.response) {
      return {
        packetType: 'command-response',
        response: String(raw.response),
        statusText: raw.status ? String(raw.status) : 'ONLINE',
        receivedAt: now()
      };
    }

    const metrics = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : raw;
    const diagnostics = raw.diagnostics && typeof raw.diagnostics === 'object' ? raw.diagnostics : raw;

    const coolant = toNumber(metrics.coolant_c ?? metrics.coolant_temp ?? metrics.coolant, null);
    const battery = toNumber(metrics.battery_v ?? metrics.battery_voltage ?? metrics.battery, null);
    const rpm = toNumber(metrics.rpm ?? raw.rpm, 0);
    const oil = toNumber(metrics.oil_c ?? metrics.oil_temp ?? raw.oil_temp, null);
    const load = toNumber(metrics.load_pct ?? metrics.engine_load ?? raw.engine_load, null);
    const deviceV = toNumber(metrics.device_v, null);
    const devicePct = toNumber(metrics.device_pct, null);
    const hasLocation = Boolean(raw.location && typeof raw.location === 'object');

    if (coolant === null && battery === null && !rpm && !hasLocation) return null;

    return {
      packetType: 'telemetry',
      source: 'raw',
      vehicleId: String(raw.vehicle_id || DEFAULT_VEHICLE_ID),
      name: raw.name ? String(raw.name) : '',
      timestampMs: toNumber(raw.timestamp_ms, 0),
      uptimeSec: toNumber(raw.uptime_sec, 0),
      canFeed: String(raw.can_feed || 'UNKNOWN'),
      fwVersion: String(raw.fw_version || '1.0'),
      score: null,
      fuel: null,
      range: null,
      odometerKm: null,
      systems: null,
      tone: null,
      rpm,
      coolant: coolant === null ? 0 : coolant,
      oil: oil === null ? 0 : oil,
      battery: battery === null ? 0 : battery,
      load: load === null ? 0 : clamp(load, 0, 100),
      stft: toNumber(metrics.stft_pct ?? raw.stft, 0),
      ltft: toNumber(metrics.ltft_pct ?? raw.ltft, 0),
      iat: toNumber(metrics.iat_c ?? raw.intake_air_temp, 0),
      deviceV: deviceV === null ? 0 : deviceV,
      devicePct: devicePct === null ? 0 : clamp(devicePct, 0, 100),
      statusText: String(diagnostics.status || raw.status || 'UNKNOWN'),
      severity: clamp(toNumber(diagnostics.severity ?? raw.severity, 0), 0, 2),
      tamper: toBoolean(diagnostics.tamper_alert ?? raw.tamper_alert),
      obdDetached: toBoolean(diagnostics.obd_detached ?? raw.obd_detached),
      disconnectCount: toNumber(diagnostics.disconnect_count, 0),
      deviceLow: toBoolean(diagnostics.device_low ?? raw.device_low),
      location: normaliseLocation(raw.location),
      receivedAt: now()
    };
  }

  function normaliseApp(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const gateway = raw.gateway && typeof raw.gateway === 'object' ? raw.gateway : {};
    const systems = raw.systems && typeof raw.systems === 'object' ? raw.systems : {};
    const score = toNumber(raw.score, null);
    const coolant = toNumber(raw.coolant, null);
    const battery = toNumber(raw.battery, null);
    const rpm = toNumber(raw.rpm, 0);
    const hasLocation = Boolean(raw.location && typeof raw.location === 'object');

    if (score === null && coolant === null && battery === null && !rpm && !hasLocation) return null;

    const systemValue = (key) => {
      const value = toNumber(systems[key], null);
      return value === null ? null : clamp(Math.round(value), 0, 100);
    };

    return {
      packetType: 'telemetry',
      source: 'app',
      vehicleId: String(raw.vehicle_id || DEFAULT_VEHICLE_ID),
      name: raw.name ? String(raw.name) : '',
      score: score === null ? null : clamp(Math.round(score), 0, 100),
      battery: battery === null ? 0 : battery,
      coolant: coolant === null ? 0 : coolant,
      oil: toNumber(raw.oil_temp, 0),
      rpm,
      fuel: toNumber(raw.fuel, null),
      range: toNumber(raw.range, null),
      odometerKm: toNumber(raw.odometer_km, null),
      systems: {
        engine: systemValue('engine'),
        cooling: systemValue('cooling'),
        electrical: systemValue('electrical'),
        brakes: systemValue('brakes')
      },
      statusText: String(raw.status || 'UNKNOWN'),
      severity: clamp(toNumber(raw.severity, 0), 0, 2),
      tone: raw.tone ? String(raw.tone) : null,
      deviceV: toNumber(gateway.device_v, null),
      devicePct: toNumber(gateway.device_pct, null),
      obdDetached: toBoolean(gateway.obd_detached),
      disconnectCount: toNumber(gateway.disconnect_count, 0),
      canFeed: String(gateway.can_feed || 'UNKNOWN'),
      fwVersion: String(gateway.fw_version || '1.0'),
      tiresAvailable: gateway.tires_available !== undefined ? Boolean(gateway.tires_available) : false,
      location: normaliseLocation(raw.location),
      load: null,
      stft: null,
      ltft: null,
      iat: null,
      tamper: false,
      deviceLow: false,
      receivedAt: now()
    };
  }

  function composeData() {
    if (!state.rawData && !state.appData) return null;

    const app = state.appData || {};
    const raw = state.rawData || {};
    const systemValues = app.systems ? Object.values(app.systems).filter((value) => Number.isFinite(value)) : [];
    const hasSystems = systemValues.length > 0;
    const severity = app.severity !== undefined && app.severity !== null ? app.severity : raw.severity || 0;

    return {
      packetType: 'telemetry',
      source: app.vehicleId ? 'app' : 'raw',
      vehicleId: app.vehicleId || raw.vehicleId || state.vehicleId || DEFAULT_VEHICLE_ID,
      name: app.name || raw.name || 'Kolls Autotronics Test Vehicle',
      timestampMs: raw.timestampMs || 0,
      uptimeSec: raw.uptimeSec || 0,
      score: Number.isFinite(app.score) ? app.score : null,
      battery: app.battery > 0 ? app.battery : raw.battery || 0,
      coolant: app.coolant > 0 ? app.coolant : raw.coolant || 0,
      oil: app.oil > 0 ? app.oil : raw.oil || 0,
      rpm: app.rpm > 0 ? app.rpm : raw.rpm || 0,
      fuel: app.fuel !== null && app.fuel !== undefined ? app.fuel : null,
      range: app.range !== null && app.range !== undefined ? app.range : null,
      odometerKm: app.odometerKm !== null && app.odometerKm !== undefined ? app.odometerKm : null,
      systems: hasSystems ? app.systems : null,
      load: raw.load !== null && raw.load !== undefined ? raw.load : 0,
      stft: raw.stft || 0,
      ltft: raw.ltft || 0,
      iat: raw.iat || 0,
      deviceV: app.deviceV !== null && app.deviceV !== undefined ? app.deviceV : raw.deviceV || 0,
      devicePct: app.devicePct !== null && app.devicePct !== undefined ? app.devicePct : raw.devicePct || 0,
      statusText: app.statusText && app.statusText !== 'UNKNOWN' ? app.statusText : raw.statusText || 'UNKNOWN',
      severity: clamp(severity, 0, 2),
      tone: app.tone || null,
      tamper: Boolean(raw.tamper) || Boolean(app.tamper) || app.statusText === 'POWER TAMPER',
      obdDetached: app.obdDetached !== undefined ? app.obdDetached : Boolean(raw.obdDetached),
      disconnectCount: app.disconnectCount !== undefined ? app.disconnectCount : raw.disconnectCount || 0,
      deviceLow: Boolean(raw.deviceLow),
      canFeed: app.canFeed && app.canFeed !== 'UNKNOWN' ? app.canFeed : raw.canFeed || 'UNKNOWN',
      fwVersion: app.fwVersion && app.fwVersion !== '1.0' ? app.fwVersion : raw.fwVersion || app.fwVersion || '1.0',
      tiresAvailable: app.tiresAvailable !== undefined ? app.tiresAvailable : false,
      location: bestLocation(app.location, raw.location),
      receivedAt: now()
    };
  }

  function scheduleTelemetryEmit() {
    if (telemetryTimer) return;
    telemetryTimer = global.setTimeout(() => {
      telemetryTimer = null;
      if (state.data) emit('telemetry', { data: state.data });
    }, 90);
  }

  function handlePayload(topic, payload) {
    let raw;
    try {
      raw = JSON.parse(payload);
    } catch (error) {
      state.error = 'The ESP32 sent a payload that is not valid JSON.';
      emit('error');
      return;
    }

    const isAppTopic = topic === state.appTopic || /\/app$/.test(topic);
    const data = isAppTopic ? normaliseApp(raw) : normaliseRaw(raw);

    if (!data) {
      state.error = 'The ESP32 payload did not contain recognisable telemetry.';
      emit('error');
      return;
    }

    if (data.packetType === 'command-response') {
      state.lastCommandResponse = data;
      state.error = null;
      emit('command-response', { response: data });
      return;
    }

    if (data.vehicleId && data.vehicleId !== state.vehicleId) {
      state.vehicleId = data.vehicleId;
      const nextAppTopic = appTopic(data.vehicleId);
      if (nextAppTopic !== state.appTopic) {
        state.appTopic = nextAppTopic;
        if (client && state.connected) client.subscribe(state.appTopic, { qos: 0 });
      }
    }

    if (isAppTopic) {
      state.appData = data;
      state.lastAppAt = now();
    } else {
      state.rawData = data;
      state.lastRawAt = now();
    }

    state.data = composeData();
    state.lastMessageAt = now();
    state.status = 'live';
    state.error = null;
    scheduleTelemetryEmit();
  }

  function commandTopic() {
    return COMMAND_TOPIC_FORMAT((state.data && state.data.vehicleId) || state.vehicleId || DEFAULT_VEHICLE_ID);
  }

  function sendCommand(command) {
    const clean = String(command || '').trim().toUpperCase();
    if (!clean || !client || !state.connected) return false;

    state.lastCommand = clean;
    client.publish(commandTopic(), clean, { qos: 0, retain: false }, (error) => {
      if (error) {
        state.error = `Command failed: ${error.message || error}`;
        emit('error');
        return;
      }
      emit('command-sent', { command: clean, topic: commandTopic() });
    });
    return true;
  }

  function publishJson(payload, label) {
    if (!payload || !client || !state.connected) return false;

    client.publish(commandTopic(), JSON.stringify(payload), { qos: 1, retain: false }, (error) => {
      if (error) {
        state.error = `Command failed: ${error.message || error}`;
        emit('error');
        return;
      }
      emit('command-sent', { command: label || payload.action || 'COMMAND', topic: commandTopic() });
    });
    return true;
  }

  function sendLocation(location) {
    const source = location && typeof location === 'object' ? location : {};
    const lat = toNumber(source.lat, null);
    const lon = toNumber(source.lon, null);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;

    const payload = {
      action: 'location',
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      sats: Math.max(0, Math.round(toNumber(source.sats, 0))),
      fix: toNumber(source.fix, 1) === 2 ? 2 : 1
    };

    const speed = toNumber(source.speedKmh, null);
    if (speed !== null) payload.speed = Number(speed.toFixed(1));

    const alt = toNumber(source.altM, null);
    if (alt !== null) payload.alt = Number(alt.toFixed(1));

    state.lastCommand = 'LOCATION';
    return publishJson(payload, 'LOCATION');
  }

  function startWatchdog() {
    stopWatchdog();
    watchdog = global.setInterval(() => {
      if (!state.connected) return;
      const age = ageMs();

      if (age !== null && age >= STALE_AFTER_MS) {
        if (state.status !== 'stale') {
          state.status = 'stale';
          emit('status');
        }
        return;
      }

      if (age === null && state.status === 'connected' && now() - state.connectedAt >= WAITING_AFTER_MS) {
        state.status = 'waiting';
        emit('status');
      }
    }, 1500);
  }

  function stopWatchdog() {
    if (watchdog) {
      global.clearInterval(watchdog);
      watchdog = null;
    }
  }

  function gatewayUrl() {
    return state.gatewayUrl;
  }

  function setGateway(url) {
    const next = normaliseGatewayUrl(url);
    if (!next) return false;

    state.gatewayUrl = next;
    try {
      global.localStorage.setItem(GATEWAY_STORAGE_KEY, next);
    } catch (error) {
      /* storage can be unavailable on file:// pages */
    }

    if (gatewayTimer) {
      stopGateway();
      startGateway();
    }

    return true;
  }

  function stopGateway() {
    if (gatewayTimer) {
      global.clearInterval(gatewayTimer);
      gatewayTimer = null;
    }
    gatewayPolling = false;
    state.gatewayConnected = false;
  }

  async function pollGateway() {
    if (gatewayPolling || !state.gatewayUrl) return false;

    gatewayPolling = true;
    const wasConnected = state.gatewayConnected;
    let timeoutId = null;
    let controller = null;

    try {
      if (typeof global.AbortController === 'function') {
        controller = new global.AbortController();
        timeoutId = global.setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
      }

      const response = await global.fetch(`${state.gatewayUrl}/telemetry?t=${now()}`, {
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
        headers: { Accept: 'application/json' }
      });

      if (timeoutId) global.clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const raw = await response.json();
      if (!raw || typeof raw !== 'object') throw new Error('Gateway returned an empty payload.');

      const previousMessageAt = state.lastMessageAt;
      state.gatewayConnected = true;
      state.gatewayFailures = 0;
      state.gatewayError = null;
      state.lastGatewayAt = now();
      state.connected = true;
      state.connectedAt = state.connectedAt || now();

      handlePayload(state.appTopic, JSON.stringify(raw));

      if (state.lastMessageAt === previousMessageAt) {
        throw new Error('Gateway payload did not contain telemetry.');
      }

      if (!wasConnected) emit('status');
      return true;
    } catch (error) {
      if (timeoutId) global.clearTimeout(timeoutId);

      state.gatewayConnected = false;
      state.gatewayFailures += 1;
      state.gatewayError = `No reply from ${state.gatewayUrl}. Check the IP on the TFT NET page.`;

      if (!state.data) {
        state.status = 'offline';
        state.error = state.gatewayError;
      } else if (state.lastMessageAt && now() - state.lastMessageAt >= STALE_AFTER_MS) {
        state.status = 'stale';
      }

      if (wasConnected || !state.data) emit('status');
      return false;
    } finally {
      gatewayPolling = false;
    }
  }

  function startGateway() {
    if (gatewayTimer) return true;

    state.mode = 'gateway';
    state.connected = true;
    state.connectedAt = state.connectedAt || now();
    state.status = state.data ? 'live' : 'connecting';
    state.error = null;

    startWatchdog();
    pollGateway();
    gatewayTimer = global.setInterval(pollGateway, GATEWAY_POLL_MS);
    emit('status');
    return true;
  }

  function start() {
    if (gatewayOverride()) return startGateway();
    return startMqtt();
  }

  function refresh() {
    if (state.mode === 'gateway') return pollGateway();
    if (state.mode === 'mqtt') return startMqtt();
    return false;
  }

  function startMqtt() {
    if (client) return true;

    stopGateway();

    if (!global.mqtt || typeof global.mqtt.connect !== 'function') {
      state.status = 'unavailable';
      state.error = 'MQTT library did not load. Live telemetry is unavailable.';
      emit('status');
      return false;
    }

    state.mode = 'mqtt';
    state.connected = false;
    state.status = 'connecting';
    state.error = null;
    state.connectAttempts += 1;
    emit('status');

    try {
      client = global.mqtt.connect(state.brokerUrl, {
        clientId: `orion_web_${Math.random().toString(16).slice(2, 10)}`,
        username: DEFAULT_USERNAME,
        password: DEFAULT_PASSWORD,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 5000,
        keepalive: 30,
        protocolVersion: 4
      });
    } catch (error) {
      state.status = 'error';
      state.error = `Could not connect to ${state.brokerUrl}. ${error.message || error}`;
      client = null;
      emit('status');
      return false;
    }

    client.on('connect', () => {
      state.connected = true;
      state.connectedAt = now();
      state.status = state.data ? 'live' : 'connected';
      state.error = null;
      startWatchdog();

      const topics = [RAW_TOPIC, state.appTopic];
      client.subscribe(topics, { qos: 0 }, (error) => {
        if (error) {
          state.error = `Subscribed to MQTT but could not join ${topics.join(' and ')}.`;
          state.status = 'error';
        }
        emit('status');
      });
    });

    client.on('message', (topic, payload) => {
      if (topic === RAW_TOPIC || topic === state.appTopic || /\/app$/.test(topic)) {
        handlePayload(topic, payload.toString());
      }
    });

    client.on('reconnect', () => {
      state.connected = false;
      state.status = 'reconnecting';
      emit('status');
    });

    client.on('offline', () => {
      state.connected = false;
      state.status = 'offline';
      emit('status');
    });

    client.on('close', () => {
      state.connected = false;
      if (state.status !== 'error' && state.status !== 'reconnecting') {
        state.status = 'offline';
      }
      emit('status');
    });

    client.on('error', (error) => {
      state.error = error && error.message ? error.message : String(error);
      if (state.status !== 'reconnecting') state.status = 'error';
      emit('status');
    });

    return true;
  }

  function stop() {
    stopGateway();
    stopWatchdog();
    if (telemetryTimer) {
      global.clearTimeout(telemetryTimer);
      telemetryTimer = null;
    }
    if (client) {
      try {
        client.end(true);
      } catch (error) {
        /* ignore shutdown errors */
      }
      client = null;
    }
    state.connected = false;
    state.status = 'idle';
    emit('status');
  }

  function restart() {
    stop();
    state.connectAttempts = 0;
    return start();
  }

  function setBroker(url) {
    const next = String(url || '').trim();
    if (!next) return false;
    state.brokerUrl = next;
    if (client) {
      stop();
      startMqtt();
    }
    return true;
  }

  function healthyScore(data) {
    if (!data) return 100;
    if (Number.isFinite(data.score)) return clamp(Math.round(data.score), 0, 100);

    let score = 100;

    if (data.coolant >= 106) score -= 38;
    else if (data.coolant >= 100) score -= 24;
    else if (data.coolant >= 95) score -= 12;

    if (data.battery > 0 && data.battery < 11.8) score -= 25;
    else if (data.battery > 0 && data.battery < 12.2) score -= 12;
    else if (data.battery > 0 && data.battery < 12.6) score -= 5;

    if (data.rpm >= 4500) score -= 8;
    else if (data.rpm >= 3800) score -= 4;

    if (data.load >= 90) score -= 5;
    if (data.tamper || data.obdDetached) score -= 35;
    if (data.devicePct > 0 && data.devicePct < 20) score -= 5;

    if (data.severity === 2) score = Math.min(score, 58);
    else if (data.severity === 1) score = Math.min(score, 78);

    return clamp(Math.round(score), 20, 100);
  }

  global.OrionLive = {
    start,
    startMqtt,
    startGateway,
    stop,
    restart,
    refresh,
    setBroker,
    setGateway,
    gatewayUrl,
    sendCommand,
    sendLocation,
    status,
    healthyScore,
    on(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
})(window);
