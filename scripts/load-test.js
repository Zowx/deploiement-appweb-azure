import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// --- Configuration ---
const BASE_URL =
  __ENV.TARGET_URL || "https://app-cloudazure-backend-dev.azurewebsites.net";

// Métriques personnalisées
const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency", true);

// --- Scénario de montée en charge progressive ---
// Objectif : déclencher l'autoscale (CPU > 70% pendant 5 min)
export const options = {
  stages: [
    // Phase 1 : Warm-up (1 min)
    { duration: "1m", target: 10 },
    // Phase 2 : Montée progressive (3 min)
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "1m", target: 150 },
    // Phase 3 : Charge soutenue (5 min) - déclenche le scale-out
    { duration: "5m", target: 150 },
    // Phase 4 : Pic de charge (2 min)
    { duration: "1m", target: 200 },
    { duration: "1m", target: 200 },
    // Phase 5 : Redescente (3 min) - observe le scale-in
    { duration: "1m", target: 100 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"], // 95% des requêtes < 5s
    errors: ["rate<0.3"], // Moins de 30% d'erreurs (WAF rate limiting)
  },
};

// --- Requêtes ---
export default function () {
  // Test 1 : Health check (sollicite DB + Storage)
  const healthRes = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });
  healthLatency.add(healthRes.timings.duration);
  check(healthRes, {
    "health status 200": (r) => r.status === 200,
    "health response < 3s": (r) => r.timings.duration < 3000,
  });
  errorRate.add(healthRes.status !== 200);

  sleep(0.5);

  // Test 2 : Page d'accueil API
  const apiRes = http.get(`${BASE_URL}/api/auth/me`, { tags: { name: "auth_me" } });
  check(apiRes, {
    "api responds": (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(apiRes.status >= 500);

  sleep(0.5);
}

// --- Résumé final ---
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    target_url: BASE_URL,
    duration_seconds: data.state ? data.state.testRunDurationMs / 1000 : 0,
    total_requests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
    avg_response_ms: data.metrics.http_req_duration
      ? Math.round(data.metrics.http_req_duration.values.avg)
      : 0,
    p95_response_ms: data.metrics.http_req_duration
      ? Math.round(data.metrics.http_req_duration.values["p(95)"])
      : 0,
    max_response_ms: data.metrics.http_req_duration
      ? Math.round(data.metrics.http_req_duration.values.max)
      : 0,
    error_rate: data.metrics.errors
      ? (data.metrics.errors.values.rate * 100).toFixed(2) + "%"
      : "0%",
    health_avg_ms: data.metrics.health_latency
      ? Math.round(data.metrics.health_latency.values.avg)
      : 0,
  };

  console.log("\n========== RÉSUMÉ DU TEST DE CHARGE ==========");
  console.log(`URL cible        : ${summary.target_url}`);
  console.log(`Durée totale     : ${summary.duration_seconds}s`);
  console.log(`Total requêtes   : ${summary.total_requests}`);
  console.log(`Latence moyenne  : ${summary.avg_response_ms}ms`);
  console.log(`Latence P95      : ${summary.p95_response_ms}ms`);
  console.log(`Latence max      : ${summary.max_response_ms}ms`);
  console.log(`Taux d'erreur    : ${summary.error_rate}`);
  console.log(`Health avg       : ${summary.health_avg_ms}ms`);
  console.log("================================================\n");

  return {
    "scripts/load-test-results.json": JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 génère automatiquement le résumé texte par défaut
  return "";
}
