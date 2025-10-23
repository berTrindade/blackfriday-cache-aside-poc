import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request latency (ms)',
  labelNames: ['method', 'route', 'status'],
  buckets: [
    0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100,
  ],
});

export const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests total',
  labelNames: ['method', 'route', 'status'],
});

export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Cache hits',
  labelNames: ['route'],
});

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Cache misses',
  labelNames: ['route'],
});

export const dbReads = new client.Counter({
  name: 'db_reads_total',
  help: 'DB reads',
  labelNames: ['route'],
});

register.registerMetric(httpDuration);
register.registerMetric(httpRequests);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);
register.registerMetric(dbReads);

export function timeRoute(method: string, route: string) {
  const end = httpDuration.startTimer({ method, route });
  return (status: number) => {
    end({ status });
    httpRequests.inc({ method, route, status }, 1);
  };
}
