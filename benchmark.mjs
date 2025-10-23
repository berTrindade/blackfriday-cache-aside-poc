#!/usr/bin/env node

import autocannon from 'autocannon';

const API_BASE = 'http://localhost:3000';
const DURATION = 10; // seconds
const CONNECTIONS = 10;
const PIPELINING = 1;

console.log('Black Friday Cache-Aside Performance Benchmark\n');

async function runBenchmark(name, url, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}`);
  console.log(`${description}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise(resolve => {
    const instance = autocannon(
      {
        url,
        connections: CONNECTIONS,
        pipelining: PIPELINING,
        duration: DURATION,
        title: name,
      },
      (err, result) => {
        if (err) {
          console.error('Error:', err);
          resolve(null);
          return;
        }

        console.log(`\nResults:`);
        console.log(`   Requests:     ${result.requests.total} total`);
        console.log(
          `   Throughput:   ${result.requests.average.toFixed(2)} req/sec`
        );
        console.log(`   Latency:`);
        console.log(`     - Average:  ${result.latency.mean.toFixed(2)} ms`);
        console.log(
          `     - p50:      ${result.latency.p50 || result.latency.median || 0} ms`
        );
        console.log(
          `     - p97.5:    ${result.latency.p97_5 || result.latency.p975 || 0} ms`
        );
        console.log(`     - p99:      ${result.latency.p99 || 0} ms`);
        console.log(
          `   Throughput:   ${(result.throughput.mean / 1024 / 1024).toFixed(2)} MB/sec\n`
        );

        resolve(result);
      }
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log('Test Configuration:');
  console.log(`   Duration:     ${DURATION} seconds`);
  console.log(`   Connections:  ${CONNECTIONS}`);
  console.log(`   Target:       ${API_BASE}`);
  console.log('');

  // Test 1: With Cache (Cache-Aside Pattern)
  console.log('Testing WITH cache (/cache/:sku)...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const withCache = await runBenchmark(
    'WITH Cache (Cache-Aside Pattern)',
    `${API_BASE}/cache/SKU-1`,
    'First request populates cache from DB (~50ms), subsequent requests served from Redis (~2ms)'
  );

  // Wait between tests
  console.log('\nWaiting 3 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Without Cache (Direct DB)
  console.log('Testing WITHOUT cache (/nocache/:sku)...');

  const withoutCache = await runBenchmark(
    'WITHOUT Cache (Direct DB Access)',
    `${API_BASE}/nocache/SKU-2`,
    'Every request hits the database directly (~50ms per request)'
  );

  // Summary Comparison
  if (withCache && withoutCache) {
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE COMPARISON');
    console.log('='.repeat(60) + '\n');

    const speedup = withCache.requests.average / withoutCache.requests.average;
    const latencyReduction =
      ((withoutCache.latency.mean - withCache.latency.mean) /
        withoutCache.latency.mean) *
      100;

    console.log('Throughput:');
    console.log(
      `   WITH cache:     ${withCache.requests.average.toFixed(2)} req/sec`
    );
    console.log(
      `   WITHOUT cache:  ${withoutCache.requests.average.toFixed(2)} req/sec`
    );
    console.log(`   Speedup:        ${speedup.toFixed(1)}x faster`);

    console.log('\nLatency:');
    console.log(`   WITH cache:     ${withCache.latency.mean.toFixed(2)} ms`);
    console.log(
      `   WITHOUT cache:  ${withoutCache.latency.mean.toFixed(2)} ms`
    );
    console.log(
      `   Reduction:      ${latencyReduction.toFixed(1)}% lower latency`
    );

    console.log('\nKey Takeaway:');
    console.log(
      `   Cache-aside pattern delivers ${speedup.toFixed(1)}x higher throughput`
    );
    console.log(
      `   and ${latencyReduction.toFixed(1)}% lower latency under load!\n`
    );
  }

  console.log(
    'Benchmark complete! Check Grafana dashboards for real-time metrics.\n'
  );
}

main().catch(console.error);
