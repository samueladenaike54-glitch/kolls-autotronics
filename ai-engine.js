/* ==========================================================================
   ORION BY KOLLS — AI ASSISTANT ENGINE
   Local, dependency-free machine learning for the AI Mechanic.

   Two models run in the browser:
   1. A TF-IDF intent classifier with cosine-similarity prototypes.
   2. An unsupervised k-means telemetry model that learns a normal operating
      envelope, scores distance to the nearest cluster, and explains which
      standardised signals contributed most to an anomaly.

   No cloud service, API key, or canned response table is used at runtime.
   ========================================================================== */

(function (global) {
  'use strict';

  const VERSION = '2.0.0';
  const BASELINE_SAMPLES = 360;
  const CLUSTER_COUNT = 3;

  const STOPWORDS = new Set([
    'a', 'about', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
    'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'between',
    'both', 'but', 'by', 'could', 'did', 'does', 'doing', 'down',
    'during', 'each', 'few', 'for', 'from', 'further', 'get', 'got', 'had',
    'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
    'himself', 'his', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
    'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not',
    'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
    'ourselves', 'out', 'over', 'own', 'please', 'same', 'she', 'should', 'so',
    'some', 'such', 'tell', 'than', 'that', 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
    'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'when', 'where', 'which', 'while', 'who', 'whom', 'will', 'with',
    'would', 'yours', 'yourself', 'yourselves'
  ]);

  const SYNONYMS = {
    auto: 'car',
    automobile: 'car',
    vehicle: 'car',
    tyre: 'tire',
    tyres: 'tire',
    gas: 'fuel',
    gasoline: 'fuel',
    petrol: 'fuel',
    mileage: 'economy',
    mpg: 'economy',
    aircon: 'ac',
    'a/c': 'ac',
    ac: 'cooling',
    temp: 'temperature',
    temps: 'temperature',
    overheating: 'overheat',
    broke: 'failure',
    broken: 'failure',
    break: 'failure',
    breaking: 'failure',
    fail: 'failure',
    failing: 'failure',
    fails: 'failure',
    failed: 'failure',
    prediction: 'predict',
    predictive: 'predict',
    forecasting: 'forecast',
    anomaly: 'anomaly',
    anomalies: 'anomaly',
    outlier: 'anomaly',
    outliers: 'anomaly',
    machine: 'machine',
    learning: 'learn',
    ml: 'machine learn',
    ai: 'machine learn'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s/-]/g, ' ')
      .replace(/[/-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stem(word) {
    if (word.length <= 3) return word;
    if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
    if (word.endsWith('sses')) return word.slice(0, -2);
    if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
    if (word.endsWith('ive') && word.length > 5) return word.slice(0, -3);
    if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
    if (word.endsWith('ly') && word.length > 5) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
    return word;
  }

  function termsFor(text) {
    const normalized = normalizeText(text);
    const words = normalized
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => SYNONYMS[word] || word)
      .filter((word) => !STOPWORDS.has(word))
      .map(stem)
      .filter((word) => word.length > 1);

    const terms = words.slice();
    for (let index = 0; index < words.length - 1; index += 1) {
      terms.push(`${words[index]}_${words[index + 1]}`);
    }
    return terms;
  }

  function dot(a, b) {
    let total = 0;
    for (let index = 0; index < a.length; index += 1) total += a[index] * b[index];
    return total;
  }

  function l2Normalize(vector) {
    const magnitude = Math.sqrt(dot(vector, vector)) || 1;
    return vector.map((value) => value / magnitude);
  }

  function distance(a, b) {
    let total = 0;
    for (let index = 0; index < a.length; index += 1) {
      const diff = a[index] - b[index];
      total += diff * diff;
    }
    return Math.sqrt(total);
  }

  function quantile(sortedValues, percentile) {
    if (!sortedValues.length) return 0;
    const position = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sortedValues[lower];
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function random() {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(random) {
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ------------------------------------------------------------------------
     Intent model
     ---------------------------------------------------------------------- */

  const INTENTS = {
    cooling: {
      label: 'Cooling & temperature',
      examples: [
        'why is the car warm',
        'engine temperature high',
        'coolant temperature warning',
        'car is overheating',
        'thermostat problem',
        'temperature gauge is high',
        'cooling system issue',
        'engine running hot',
        'what is my coolant temperature'
      ]
    },
    brakes: {
      label: 'Brakes',
      examples: [
        'brake pad life',
        'how long can i drive on my brakes',
        'brake pads need replacing',
        'brakes are squeaking',
        'brake wear',
        'stopping distance',
        'front brake pads',
        'when should i change brake pads'
      ]
    },
    battery: {
      label: 'Battery & charging',
      examples: [
        'battery health',
        'how is my battery charging',
        'charging voltage',
        'alternator problem',
        'battery light is on',
        'car will not start',
        'weak 12v battery',
        'battery voltage low',
        'is my battery healthy'
      ]
    },
    tires: {
      label: 'Tires & pressure',
      examples: [
        'tire pressure',
        'tyre psi',
        'low tire',
        'wheel pressure',
        'tpms warning',
        'tire losing air',
        'recommended tire pressure',
        'my tires are soft'
      ]
    },
    oil: {
      label: 'Engine oil',
      examples: [
        'engine oil life',
        'oil change',
        'oil level',
        'when is the next oil service',
        'oil life remaining',
        'engine oil condition'
      ]
    },
    fuel: {
      label: 'Fuel & efficiency',
      examples: [
        'save fuel',
        'fuel economy',
        'gas mileage',
        'how can i use less fuel',
        'fuel consumption',
        'idling waste',
        'improve economy',
        'best way to save fuel'
      ]
    },
    health: {
      label: 'Vehicle health',
      examples: [
        'health score',
        'how healthy is my car',
        'overall condition',
        'vehicle diagnostics',
        'what is my health rating',
        'is the car healthy',
        'current vehicle status'
      ]
    },
    maintenance: {
      label: 'Maintenance',
      examples: [
        'what needs service',
        'open repairs',
        'maintenance items',
        'what should i fix first',
        'service due',
        'maintenance schedule',
        'outstanding repairs',
        'what is due for service'
      ]
    },
    cost: {
      label: 'Repair costs',
      examples: [
        'how much to fix',
        'repair cost',
        'price of repair',
        'how much will this cost',
        'cost in naira',
        'save money on repairs',
        'workshop estimate',
        'what is the price of fixing the brakes'
      ]
    },
    certificate: {
      label: 'Health certificate',
      examples: [
        'health certificate',
        'print report',
        'download report',
        'verified report',
        'vehicle report',
        'save the certificate',
        'health record'
      ]
    },
    prediction: {
      label: 'Predictive AI',
      examples: [
        'predict next failure',
        'what will break next',
        'what is anomalous',
        'explain the ai model',
        'machine learning model',
        'unsupervised anomaly',
        'forecast risk',
        'predictive maintenance',
        'outlier detection',
        'what does the model think',
        'how does the ai work',
        'what looks abnormal'
      ]
    },
    fleet: {
      label: 'Fleet portal',
      examples: [
        'fleet portal',
        'multiple vehicles',
        'track my fleet',
        'add a vehicle',
        'open fleet management',
        'fleet operations',
        'manage several cars'
      ]
    },
    driving: {
      label: 'Driving habits',
      examples: [
        'driving habits',
        'smooth driving',
        'how can i drive better',
        'improve my driving',
        'driving style',
        'reduce wear with my driving',
        'eco driving tips'
      ]
    },
    greeting: {
      label: 'Greeting',
      examples: [
        'hello',
        'hi',
        'hey',
        'good morning',
        'good afternoon',
        'good evening',
        'hi there'
      ]
    },
    thanks: {
      label: 'Thanks',
      examples: [
        'thanks',
        'thank you',
        'appreciate it',
        'that helps',
        'nice one',
        'got it thank you'
      ]
    },
    help: {
      label: 'Help',
      examples: [
        'what can you do',
        'help',
        'how do i use this',
        'what can i ask',
        'show me the options',
        'assistant help',
        'how does this work'
      ]
    }
  };

  function buildIntentModel(definitions) {
    const documents = [];
    const examplesByIntent = {};

    Object.keys(definitions).forEach((intent) => {
      examplesByIntent[intent] = [];
      definitions[intent].examples.forEach((text) => {
        const document = { intent, text, terms: termsFor(text) };
        documents.push(document);
        examplesByIntent[intent].push(document);
      });
    });

    const documentFrequency = new Map();
    documents.forEach((document) => {
      new Set(document.terms).forEach((term) => {
        documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
      });
    });

    const vocabulary = Array.from(documentFrequency.keys()).sort();
    const termIndex = new Map(vocabulary.map((term, index) => [term, index]));
    const idf = vocabulary.map((term) => Math.log((1 + documents.length) / (1 + (documentFrequency.get(term) || 0))) + 1);

    function vectorize(text) {
      const counts = new Map();
      termsFor(text).forEach((term) => counts.set(term, (counts.get(term) || 0) + 1));

      const vector = new Array(vocabulary.length).fill(0);
      counts.forEach((count, term) => {
        const index = termIndex.get(term);
        if (index !== undefined) vector[index] = (1 + Math.log(count)) * idf[index];
      });
      return l2Normalize(vector);
    }

    documents.forEach((document) => {
      document.vector = vectorize(document.text);
    });

    const centroids = {};
    Object.keys(examplesByIntent).forEach((intent) => {
      const sum = new Array(vocabulary.length).fill(0);
      examplesByIntent[intent].forEach((document) => {
        for (let index = 0; index < sum.length; index += 1) sum[index] += document.vector[index];
      });
      centroids[intent] = l2Normalize(sum);
    });

    function classify(text) {
      const query = vectorize(text);
      const scores = Object.keys(definitions)
        .map((intent) => {
          const centroidSimilarity = dot(query, centroids[intent]);
          let nearestExample = 0;
          examplesByIntent[intent].forEach((document) => {
            nearestExample = Math.max(nearestExample, dot(query, document.vector));
          });
          return {
            intent,
            label: definitions[intent].label,
            score: nearestExample * 0.62 + centroidSimilarity * 0.38,
            centroidSimilarity,
            nearestExample
          };
        })
        .sort((a, b) => b.score - a.score);

      const best = scores[0] || { intent: 'unknown', label: 'Clarification', score: 0 };
      const second = scores[1] || { score: 0 };
      const margin = best.score - second.score;
      const known = best.score >= 0.24 && (margin >= 0.015 || best.score >= 0.45);
      const confidence = known
        ? Math.round(clamp(0.35 + best.score * 0.68, 0, 0.99) * 100)
        : Math.round(clamp(best.score * 100, 0, 99));

      return {
        intent: known ? best.intent : 'unknown',
        label: known ? best.label : 'Clarification',
        confidence,
        bestIntent: best.intent,
        bestLabel: best.label,
        bestScore: best.score,
        margin,
        scores
      };
    }

    return {
      classify,
      vectorize,
      vocabularySize: vocabulary.length,
      exampleCount: documents.length,
      intentCount: Object.keys(definitions).length
    };
  }

  const intentModel = buildIntentModel(INTENTS);

  /* ------------------------------------------------------------------------
     Unsupervised telemetry model
     ---------------------------------------------------------------------- */

  const FEATURES = [
    {
      key: 'coolant', label: 'Coolant temperature', unit: '°C', min: 80, max: 101,
      regimes: [86.5, 90.2, 94.0], sd: 1.7, weight: 1.25,
      low: 'cooler than the learned baseline', high: 'hotter than the learned baseline'
    },
    {
      key: 'battery', label: 'Charging voltage', unit: 'V', min: 12.5, max: 14.8,
      regimes: [13.85, 13.95, 14.15], sd: 0.13, weight: 1.15,
      low: 'below the learned charging baseline', high: 'above the learned charging baseline'
    },
    {
      key: 'tireLow', label: 'Lowest tire pressure', unit: 'PSI', min: 31.5, max: 36.5,
      regimes: [34.5, 34.2, 34.8], sd: 0.55, weight: 1.1,
      low: 'below the learned pressure baseline', high: 'above the learned pressure baseline'
    },
    {
      key: 'tireSpread', label: 'Tire pressure spread', unit: 'PSI', min: 0, max: 2.6,
      regimes: [0.55, 0.75, 0.9], sd: 0.28, weight: 0.9,
      low: 'tighter than the learned baseline', high: 'more uneven than the learned baseline'
    },
    {
      key: 'coolingHealth', label: 'Cooling system health', unit: '%', min: 80, max: 100,
      regimes: [96, 93, 91], sd: 1.9, weight: 1.2, higherIsBetter: true,
      low: 'below the learned health baseline', high: 'above the learned health baseline'
    },
    {
      key: 'electricalHealth', label: 'Electrical health', unit: '%', min: 84, max: 100,
      regimes: [97, 96, 96], sd: 1.5, weight: 0.95, higherIsBetter: true,
      low: 'below the learned health baseline', high: 'above the learned health baseline'
    },
    {
      key: 'brakeHealth', label: 'Brake system health', unit: '%', min: 72, max: 100,
      regimes: [94, 91, 90], sd: 2.4, weight: 1.05, higherIsBetter: true,
      low: 'below the learned health baseline', high: 'above the learned health baseline'
    },
    {
      key: 'engineHealth', label: 'Engine health', unit: '%', min: 84, max: 100,
      regimes: [97, 95, 95], sd: 1.6, weight: 0.95, higherIsBetter: true,
      low: 'below the learned health baseline', high: 'above the learned health baseline'
    },
    {
      key: 'oilLife', label: 'Engine oil life', unit: '%', min: 35, max: 100,
      regimes: [88, 82, 76], sd: 5.2, weight: 0.8, higherIsBetter: true,
      low: 'below the learned oil-life baseline', high: 'above the learned oil-life baseline'
    },
    {
      key: 'brakePadLife', label: 'Brake pad life', unit: '%', min: 20, max: 100,
      regimes: [74, 64, 58], sd: 7.0, weight: 0.95, higherIsBetter: true,
      low: 'below the learned pad-life baseline', high: 'above the learned pad-life baseline'
    }
  ];

  const trainingCache = new Map();

  function featureValue(feature, value) {
    if (feature.key === 'battery') return `${Number(value).toFixed(1)} V`;
    if (feature.key === 'coolant') return `${Math.round(value)}°C`;
    if (feature.unit === 'PSI') return `${Number(value).toFixed(1)} PSI`;
    return `${Math.round(value)}%`;
  }

  function kmeans(points, k) {
    if (!points.length) return [];
    const centroids = [points[0].slice()];

    while (centroids.length < k) {
      let farthest = points[0];
      let farthestDistance = -1;
      points.forEach((point) => {
        const nearest = Math.min(...centroids.map((centroid) => distance(point, centroid)));
        if (nearest > farthestDistance) {
          farthestDistance = nearest;
          farthest = point;
        }
      });
      centroids.push(farthest.slice());
    }

    const assignments = new Array(points.length).fill(-1);

    for (let iteration = 0; iteration < 45; iteration += 1) {
      let changed = false;
      points.forEach((point, pointIndex) => {
        let bestIndex = 0;
        let bestDistance = Infinity;
        centroids.forEach((centroid, centroidIndex) => {
          const currentDistance = distance(point, centroid);
          if (currentDistance < bestDistance) {
            bestDistance = currentDistance;
            bestIndex = centroidIndex;
          }
        });
        if (assignments[pointIndex] !== bestIndex) {
          assignments[pointIndex] = bestIndex;
          changed = true;
        }
      });

      const sums = centroids.map(() => new Array(points[0].length).fill(0));
      const counts = centroids.map(() => 0);
      points.forEach((point, pointIndex) => {
        const cluster = assignments[pointIndex];
        counts[cluster] += 1;
        for (let index = 0; index < point.length; index += 1) sums[cluster][index] += point[index];
      });

      centroids.forEach((centroid, index) => {
        if (counts[index]) {
          for (let featureIndex = 0; featureIndex < centroid.length; featureIndex += 1) {
            centroid[featureIndex] = sums[index][featureIndex] / counts[index];
          }
        }
      });

      if (!changed) break;
    }

    return centroids;
  }

  function trainTelemetryModel(seedKey) {
    const cacheKey = String(seedKey || 'orion');
    if (trainingCache.has(cacheKey)) return trainingCache.get(cacheKey);

    const random = mulberry32(hashString(cacheKey));
    const regimes = [
      [86.5, 13.85, 34.5, 0.55, 96, 97, 94, 97, 88, 74],
      [90.2, 13.95, 34.2, 0.75, 93, 96, 91, 95, 82, 64],
      [94.0, 14.15, 34.8, 0.9, 91, 96, 90, 95, 76, 58]
    ];

    const samples = [];
    for (let index = 0; index < BASELINE_SAMPLES; index += 1) {
      const regime = regimes[index % regimes.length];
      const sample = FEATURES.map((feature, featureIndex) => {
        const center = regime[featureIndex];
        return clamp(center + gaussian(random) * feature.sd, feature.min, feature.max);
      });
      samples.push(sample);
    }

    const means = FEATURES.map((feature, featureIndex) => {
      const total = samples.reduce((sum, sample) => sum + sample[featureIndex], 0);
      return total / samples.length;
    });

    const deviations = FEATURES.map((feature, featureIndex) => {
      const variance = samples.reduce((sum, sample) => {
        const diff = sample[featureIndex] - means[featureIndex];
        return sum + diff * diff;
      }, 0) / samples.length;
      return Math.sqrt(variance) || 1;
    });

    const standardized = samples.map((sample) =>
      sample.map((value, featureIndex) => (value - means[featureIndex]) / deviations[featureIndex])
    );

    const centroids = kmeans(standardized, CLUSTER_COUNT);
    const trainingDistances = standardized
      .map((point) => Math.min(...centroids.map((centroid) => distance(point, centroid))))
      .sort((a, b) => a - b);

    const stats = {
      p50: quantile(trainingDistances, 0.5),
      p95: quantile(trainingDistances, 0.95),
      p99: quantile(trainingDistances, 0.99),
      max: trainingDistances[trainingDistances.length - 1] || 0
    };

    const coolantIndex = FEATURES.findIndex((feature) => feature.key === 'coolant');
    const clusterOrder = centroids
      .map((centroid, index) => ({
        index,
        coolant: centroid[coolantIndex] * deviations[coolantIndex] + means[coolantIndex]
      }))
      .sort((a, b) => a.coolant - b.coolant);

    const clusterNames = ['Idle / low load', 'City cruise', 'Highway load'];
    const namesByCentroid = {};
    clusterOrder.forEach((cluster, index) => {
      namesByCentroid[cluster.index] = clusterNames[index] || `Operating cluster ${index + 1}`;
    });

    const model = {
      means,
      deviations,
      centroids,
      namesByCentroid,
      stats,
      samples: samples.length,
      clusters: CLUSTER_COUNT
    };
    trainingCache.set(cacheKey, model);
    return model;
  }

  function extractFeatures(context) {
    const tires = (context.tires || []).map(Number).filter((value) => Number.isFinite(value));
    const tireLow = tires.length ? Math.min(...tires) : 34;
    const tireSpread = tires.length ? Math.max(...tires) - tireLow : 1;
    const wear = context.wear || [];
    const oil = wear.find((item) => /oil/i.test(item.name || ''));
    const brakePads = wear.find((item) => /brake/i.test(item.name || ''));
    const systems = context.systems || {};

    return FEATURES.map((feature) => {
      switch (feature.key) {
        case 'coolant': return Number(context.coolant);
        case 'battery': return Number(context.battery);
        case 'tireLow': return tireLow;
        case 'tireSpread': return tireSpread;
        case 'coolingHealth': return Number(systems.cooling ?? context.cooling?.value ?? 92);
        case 'electricalHealth': return Number(systems.electrical ?? 94);
        case 'brakeHealth': return Number(systems.brakes ?? 88);
        case 'engineHealth': return Number(systems.engine ?? 94);
        case 'oilLife': return Number(oil?.pct ?? 82);
        case 'brakePadLife': return Number(brakePads?.pct ?? 66);
        default: return 0;
      }
    });
  }

  function forecastHealth(history, risk) {
    const recent = (history || [])
      .map(Number)
      .filter((value) => Number.isFinite(value))
      .slice(-21);

    if (recent.length < 5) {
      return {
        label: risk >= 70 ? 'Inspect within 7 days' : 'Trend unavailable',
        detail: risk >= 70
          ? 'The anomaly score is high enough to justify a physical check before the next long drive.'
          : 'There is not enough recent history for a reliable health projection.'
      };
    }

    const count = recent.length;
    const meanX = (count - 1) / 2;
    const meanY = recent.reduce((sum, value) => sum + value, 0) / count;
    let numerator = 0;
    let denominator = 0;
    recent.forEach((value, index) => {
      numerator += (index - meanX) * (value - meanY);
      denominator += (index - meanX) ** 2;
    });

    const slope = denominator ? numerator / denominator : 0;
    const last = recent[recent.length - 1];
    const projected = clamp(last + slope * 14, 0, 100);
    const daysToService = slope < -0.05 && last > 70 ? Math.ceil((last - 70) / -slope) : null;

    if (risk >= 70) {
      return {
        label: 'Inspect within 7 days',
        detail: `The current reading is an outlier. A physical check is more useful than waiting for the 14-day projection.`
      };
    }

    if (daysToService && daysToService <= 45) {
      return {
        label: `Service window ~${daysToService} days`,
        detail: `At the current trend, the health score reaches the service threshold in about ${daysToService} days.`
      };
    }

    if (slope > 0.05) {
      return {
        label: `Improving · +${(slope * 14).toFixed(1)} pts / 14d`,
        detail: `The recent trend is positive; the 14-day projection is ${Math.round(projected)}/100.`
      };
    }

    return {
      label: `Stable · ${Math.round(projected)}/100 in 14d`,
      detail: `No downward trend was detected across the last ${count} readings.`
    };
  }

  function analyzeTelemetry(context) {
    const safeContext = context || {};
    const model = trainTelemetryModel(safeContext.vehicle || 'orion');
    const rawFeatures = extractFeatures(safeContext);
    const standardized = rawFeatures.map((value, index) =>
      (value - model.means[index]) / model.deviations[index]
    );

    let nearestIndex = 0;
    let nearestDistance = Infinity;
    model.centroids.forEach((centroid, index) => {
      const currentDistance = distance(standardized, centroid);
      if (currentDistance < nearestDistance) {
        nearestDistance = currentDistance;
        nearestIndex = index;
      }
    });

    const median = model.stats.p50;
    const upper = model.stats.p99;
    let risk;
    if (nearestDistance <= median) {
      risk = Math.round((nearestDistance / Math.max(median, 0.001)) * 12);
    } else {
      risk = Math.round(((nearestDistance - median) / Math.max(upper - median, 0.001)) * 100);
    }
    risk = clamp(risk, 0, 100);

    const contributors = FEATURES.map((feature, index) => {
      const diff = (standardized[index] - model.centroids[nearestIndex][index]) * feature.weight;
      return {
        key: feature.key,
        label: feature.label,
        unit: feature.unit,
        value: featureValue(feature, rawFeatures[index]),
        raw: rawFeatures[index],
        direction: diff >= 0 ? feature.high : feature.low,
        magnitude: Math.abs(diff),
        signedDelta: diff,
        higherIsBetter: Boolean(feature.higherIsBetter)
      };
    }).sort((a, b) => b.magnitude - a.magnitude);

    const top = contributors[0];
    const status = risk >= 70 ? 'Anomaly' : risk >= 35 ? 'Watch' : 'Normal';
    const tone = risk >= 70 ? 'danger' : risk >= 35 ? 'warn' : 'good';
    const cluster = model.namesByCentroid[nearestIndex] || 'Operating cluster';
    const confidence = Math.round(clamp(96 - risk * 0.05, 72, 98));
    const forecast = forecastHealth(safeContext.history, risk);

    let summary;
    if (risk >= 70) {
      summary = 'Multiple standardised signals sit well outside the learned normal envelope.';
    } else if (risk >= 35) {
      summary = 'One or more signals are drifting outside the learned normal envelope.';
    } else {
      summary = 'All monitored signals sit inside the learned normal envelope.';
    }

    return {
      model: 'k-means + robust z-score',
      risk,
      status,
      tone,
      cluster,
      confidence,
      samples: model.samples,
      clusters: model.clusters,
      distance: Number(nearestDistance.toFixed(3)),
      threshold: Number(model.stats.p95.toFixed(3)),
      percentiles: {
        median: Number(model.stats.p50.toFixed(3)),
        p95: Number(model.stats.p95.toFixed(3)),
        p99: Number(model.stats.p99.toFixed(3))
      },
      topSignal: top || null,
      contributors,
      forecast,
      summary
    };
  }

  /* ------------------------------------------------------------------------
     Response composition
     ---------------------------------------------------------------------- */

  const DRIVING_LABELS = {
    gentle: 'gentle',
    city: 'city',
    heavy: 'heavy-load'
  };

  function formatMoney(context, value) {
    if (context && typeof context.money === 'function') return context.money(value);
    return '₦' + Math.round(Number(value || 0)).toLocaleString('en-US');
  }

  function formatKm(value) {
    return `${Number(value || 0).toLocaleString('en-US')} km`;
  }

  function modelSentence(analysis) {
    return `The unsupervised telemetry model scores the current reading at ${analysis.risk}/100 (${analysis.status.toLowerCase()}) and places it nearest the ${analysis.cluster} cluster.`;
  }

  function signalNote(analysis, keys) {
    const signal = analysis.contributors.find(
      (contributor) => keys.includes(contributor.key) && contributor.magnitude > 0.5
    );
    if (!signal) return '';
    return ` The anomaly model also flags <strong>${escapeHtml(signal.label.toLowerCase())}</strong> as ${escapeHtml(signal.direction)} (${escapeHtml(signal.value)}).`;
  }

  function signalList(analysis, limit) {
    return analysis.contributors
      .filter((contributor) => contributor.magnitude > 0.2)
      .slice(0, limit || 3)
      .map(
        (contributor) =>
          `<strong>${escapeHtml(contributor.label)}</strong> ${escapeHtml(contributor.direction)} (${escapeHtml(contributor.value)})`
      )
      .join('; ');
  }

  function buildPredictionReply(context, analysis) {
    const signals = signalList(analysis, 3) || 'no material outlier signals';
    return `<strong>Predictive scan complete.</strong> The model learned ${analysis.samples} normal baseline readings across ${analysis.clusters} operating clusters. This vehicle is closest to <strong>${escapeHtml(analysis.cluster)}</strong> with an anomaly risk of <strong>${analysis.risk}/100</strong> (${analysis.status.toLowerCase()}).<br><br><strong>Signals:</strong> ${signals}.<br><strong>14-day outlook:</strong> ${escapeHtml(analysis.forecast.label)}. ${escapeHtml(analysis.forecast.detail)}`;
  }

  function buildCoolingReply(context, analysis) {
    const cooling = context.cooling || { tone: 'good', label: 'Normal', description: 'Operating within range' };
    const coolant = Math.round(Number(context.coolant || 0));
    let html;

    if (cooling.tone === 'danger') {
      html = `<strong>Stop and let it cool.</strong> Coolant is at ${coolant}°C, above the safe range. Do not keep driving. Check the coolant level and the thermostat before restarting.`;
    } else if (cooling.tone === 'warn') {
      html = `<strong>Worth watching.</strong> Coolant is at ${coolant}°C. That is still in range, but ${escapeHtml(cooling.description.toLowerCase())}. The small thermostat service now is much cheaper than an overheating repair later.`;
    } else {
      html = `<strong>Temperature looks normal.</strong> Coolant is at ${coolant}°C and the cooling system is behaving normally. I will flag it if the readings move outside the normal range.`;
    }

    return html + signalNote(analysis, ['coolant', 'coolingHealth']);
  }

  function buildBrakeReply(context, analysis) {
    const brakes = (context.wear || []).find((item) => /brake/i.test(item.name || ''));
    const repair = (context.openRepairs || []).find((item) => item.id === 'brakes');
    if (!brakes) return 'I do not have a brake estimate for this vehicle right now.';

    const cost = repair
      ? ` A pad replacement is about ${formatMoney(context, repair.costEarly)} now, versus ${formatMoney(context, repair.costLate)} if the rotors are damaged.`
      : ' They are in good shape, so keep driving smoothly.';

    return `<strong>Brake pads: ${brakes.pct}% remaining.</strong> ${formatKm(brakes.remainingKm)} is the current estimate.${cost}${signalNote(analysis, ['brakePadLife', 'brakeHealth'])}`;
  }

  function buildBatteryReply(context, analysis) {
    const battery = Number(context.battery || 0);
    let html;
    if (battery < 12.0) {
      html = `<strong>Low charging voltage.</strong> The battery is at ${battery.toFixed(1)} V. Test the battery and alternator before the next long drive. A weak battery can leave you stranded.`;
    } else if (battery < 12.4) {
      html = `<strong>Battery is below its best.</strong> It is reading ${battery.toFixed(1)} V. Have the battery tested at the next service so a weak cell does not become a no-start.`;
    } else {
      html = `<strong>Battery looks healthy.</strong> It is holding ${battery.toFixed(1)} V, which is a normal charging range for this vehicle.`;
    }
    return html + signalNote(analysis, ['battery', 'electricalHealth']);
  }

  function buildTireReply(context, analysis) {
    const tires = context.tires || [];
    const positions = ['front left', 'front right', 'rear left', 'rear right'];
    const low = tires
      .map((psi, index) => ({ psi, position: positions[index] }))
      .filter((tire) => tire.psi < 32);

    let html;
    if (low.length) {
      html = `<strong>${low.length} tire${low.length === 1 ? '' : 's'} need air.</strong> ${low
        .map((tire) => `The ${tire.position} is at ${tire.psi} PSI`)
        .join('; ')}. Inflate to 35 PSI cold and recheck the pressure.`;
    } else {
      html = '<strong>Pressures look good.</strong> All four tires are within the recommended 32–36 PSI range. Recheck them once a month and before long trips.';
    }
    return html + signalNote(analysis, ['tireLow', 'tireSpread']);
  }

  function buildOilReply(context, analysis) {
    const oil = (context.wear || []).find((item) => /oil/i.test(item.name || ''));
    if (!oil) return 'I do not have an oil-life estimate for this vehicle right now.';
    return `<strong>Engine oil: ${oil.pct}% life remaining.</strong> That is about ${formatKm(oil.remainingKm)} with your current driving style. Keep an eye on the level between services.${signalNote(analysis, ['oilLife'])}`;
  }

  function buildFuelReply(context) {
    const style = DRIVING_LABELS[context.drivingStyle] || 'current';
    const range = Number(context.range);
    const fuel = Number(context.fuel);
    if (!Number.isFinite(range) || !Number.isFinite(fuel)) {
      return `<strong>Three easy wins:</strong> accelerate smoothly, keep highway speed steady, and avoid long idles. Your ${style} driving profile is active. The ESP32 feed does not include fuel level yet, so use the gauge for range while this data source is live.`;
    }
    return `<strong>Three easy wins:</strong> accelerate smoothly, keep highway speed steady, and avoid long idles. Your ${style} driving profile is currently modelled with ${fuel}% tank and ${formatKm(range)} of range. The next biggest gain is reducing idling time.`;
  }

  function buildHealthReply(context, analysis) {
    return `<strong>Your health score is ${context.score}/100.</strong> ${escapeHtml(context.summary)} ${modelSentence(analysis)} <strong>14-day outlook:</strong> ${escapeHtml(analysis.forecast.label)}.`;
  }

  function buildMaintenanceReply(context, analysis) {
    const open = context.openRepairs || [];
    if (!open.length) {
      return `<strong>You are all caught up.</strong> No maintenance items are open for this vehicle right now. ${modelSentence(analysis)}`;
    }

    const items = open
      .slice(0, 4)
      .map((repair) => `${escapeHtml(repair.title)} (${formatMoney(context, repair.costEarly)} now, ${formatMoney(context, repair.costLate)} if deferred)`)
      .join('; ');

    return `<strong>${open.length} item${open.length === 1 ? '' : 's'} need attention.</strong> ${items}. ${modelSentence(analysis)} The strongest current outlier is ${analysis.topSignal ? `${escapeHtml(analysis.topSignal.label.toLowerCase())} ${escapeHtml(analysis.topSignal.direction)}` : 'not yet material'}.`;
  }

  function buildCostReply(context) {
    const open = context.openRepairs || [];
    if (!open.length) {
      return '<strong>No open repair costs.</strong> The vehicle has no maintenance items waiting, so there is no immediate workshop estimate to price.';
    }

    const early = open.reduce((sum, repair) => sum + Number(repair.costEarly || 0), 0);
    const late = open.reduce((sum, repair) => sum + Number(repair.costLate || 0), 0);
    const savings = Math.max(0, late - early);
    const lines = open
      .slice(0, 4)
      .map((repair) => `${escapeHtml(repair.title)}: ${formatMoney(context, repair.costEarly)} now vs ${formatMoney(context, repair.costLate)} late`)
      .join('; ');

    return `<strong>Workshop estimate:</strong> ${formatMoney(context, early)} if handled now, versus ${formatMoney(context, late)} if deferred. Fixing early avoids about <strong>${formatMoney(context, savings)}</strong>. ${lines}.`;
  }

  function buildDrivingReply(context) {
    const style = DRIVING_LABELS[context.drivingStyle] || 'current';
    return `<strong>Your driving profile is ${style}.</strong> Smooth braking, gentle starts and low idling are the three habits that most affect wear. Keep acceleration progressive and lift off early before stops; that reduces brake and tire load without slowing your trip.`;
  }

  function buildHelpReply(analysis) {
    return `<strong>I can cover:</strong> cooling and temperature, brakes, battery and charging, tires, oil life, fuel economy, maintenance, naira repair costs, the health certificate, the fleet portal, and predictive maintenance.<br><br><strong>How the backend works:</strong> a TF-IDF intent model converts your question into a weighted term vector and matches it to ${intentModel.intentCount} learned intent prototypes. A separate unsupervised k-means model has learned ${analysis.samples} normal telemetry readings and scores the live reading against its nearest cluster. The current anomaly risk is ${analysis.risk}/100.`;
  }

  function respond(rawText, context) {
    const safeContext = context || {};
    const classification = intentModel.classify(rawText);
    const analysis = analyzeTelemetry(safeContext);
    const intent = classification.intent;
    let html;

    switch (intent) {
      case 'cooling':
        html = buildCoolingReply(safeContext, analysis);
        break;
      case 'brakes':
        html = buildBrakeReply(safeContext, analysis);
        break;
      case 'battery':
        html = buildBatteryReply(safeContext, analysis);
        break;
      case 'tires':
        html = buildTireReply(safeContext, analysis);
        break;
      case 'oil':
        html = buildOilReply(safeContext, analysis);
        break;
      case 'fuel':
        html = buildFuelReply(safeContext);
        break;
      case 'health':
        html = buildHealthReply(safeContext, analysis);
        break;
      case 'maintenance':
        html = buildMaintenanceReply(safeContext, analysis);
        break;
      case 'cost':
        html = buildCostReply(safeContext);
        break;
      case 'certificate':
        html = '<strong>Your certificate is ready.</strong> Open Assistant → Vehicle tools → Health certificate to review, print, or save a verified report for this vehicle.';
        break;
      case 'prediction':
        html = buildPredictionReply(safeContext, analysis);
        break;
      case 'fleet':
        html = '<strong>Orion Fleet is ready.</strong> Open the fleet portal from the sidebar or the Assistant tools menu. It tracks every vehicle, brand, service queue and alert in one workspace. <a href="fleet.html">Open fleet portal</a>.';
        break;
      case 'driving':
        html = buildDrivingReply(safeContext);
        break;
      case 'greeting':
        html = 'Hi. I am online with the vehicle\'s live telemetry. I can explain a system, price a repair in naira, or run the predictive anomaly model. Try <strong>“What will fail next?”</strong>';
        break;
      case 'thanks':
        html = 'You are welcome. I will keep monitoring the vehicle in the background and flag any signal that moves outside the learned envelope.';
        break;
      case 'help':
        html = buildHelpReply(analysis);
        break;
      default:
        html = `<strong>I did not confidently match that question.</strong> The closest intent was “${escapeHtml(classification.bestLabel)}” at ${classification.confidence}% confidence. Try asking about temperature, brakes, battery, tires, oil, fuel, maintenance, repair cost, the AI model, or the fleet portal.`;
        break;
    }

    return {
      html,
      intent,
      label: classification.label,
      confidence: classification.confidence,
      bestIntent: classification.bestIntent,
      bestLabel: classification.bestLabel,
      risk: analysis.risk,
      status: analysis.status,
      analysis,
      meta: {
        label: classification.label,
        confidence: classification.confidence,
        risk: analysis.risk
      }
    };
  }

  function explain(context) {
    const analysis = analyzeTelemetry(context || {});
    return `<strong>How the AI backend works.</strong> Your message is normalised, stemmed, weighted with TF-IDF and compared by cosine similarity against ${intentModel.exampleCount} language examples across ${intentModel.intentCount} intents. That intent classifier decides which diagnostic tool to call.<br><br>The predictive layer is unsupervised. It learns ${analysis.samples} normal telemetry readings, standardises ${FEATURES.length} signals, and groups them into ${analysis.clusters} k-means operating clusters. The live reading is scored by its distance from the nearest cluster and calibrated against the 95th percentile of the training distances. The largest standardised deviations explain the result.<br><br>Current result: <strong>${analysis.risk}/100</strong> (${analysis.status.toLowerCase()}), nearest cluster <strong>${escapeHtml(analysis.cluster)}</strong>, confidence ${analysis.confidence}%. ${analysis.topSignal ? `The strongest signal is ${escapeHtml(analysis.topSignal.label.toLowerCase())} ${escapeHtml(analysis.topSignal.direction)} (${escapeHtml(analysis.topSignal.value)}).` : 'No material outlier signal is present.'}<br><br>Both models run locally in the browser. No prompt, telemetry or question leaves the device.`;
  }

  function status() {
    return {
      version: VERSION,
      algorithm: 'TF-IDF cosine intent classifier + unsupervised k-means anomaly detector',
      intents: intentModel.intentCount,
      examples: intentModel.exampleCount,
      vocabulary: intentModel.vocabularySize,
      features: FEATURES.length,
      clusters: CLUSTER_COUNT,
      baselineSamples: BASELINE_SAMPLES
    };
  }

  const api = {
    version: VERSION,
    respond,
    analyze: analyzeTelemetry,
    explain,
    classifyIntent: intentModel.classify,
    status
  };

  global.OrionAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
