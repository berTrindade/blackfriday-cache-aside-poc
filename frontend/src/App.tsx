import { useState, useEffect } from 'react';
import GrafanaPanel from './components/GrafanaPanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

function App() {
  const [stats, setStats] = useState<CacheStats>({
    hits: 0,
    misses: 0,
    hitRate: 0,
  });
  const [loading, setLoading] = useState(false);

  // Fetch cache stats from metrics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);
      if (!response.ok) return;
      const metricsText = await response.text();

      const hits = (metricsText.match(
        /cache_hits_total{route="\/cache\/:sku"} (\d+)/
      ) || [0, '0'])[1];
      const misses = (metricsText.match(
        /cache_misses_total{route="\/cache\/:sku"} (\d+)/
      ) || [0, '0'])[1];
      const totalRequests = Number.parseInt(hits) + Number.parseInt(misses);
      const hitRate =
        totalRequests > 0
          ? Math.round((Number.parseInt(hits) / totalRequests) * 100)
          : 0;

      setStats({
        hits: Number.parseInt(hits),
        misses: Number.parseInt(misses),
        hitRate,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Simulate load test
  const simulateLoad = async () => {
    setLoading(true);
    try {
      alert(
        'Running benchmark...\n\nThis will generate traffic for ~10 seconds.\nWatch the chart below!'
      );

      // Use the backend simulate-load endpoint
      await fetch(`${API_BASE_URL}/simulate-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 }),
      });

      await fetchStats();

      alert(
        'Benchmark complete!\n\nCheck the chart to see the performance difference.'
      );
    } catch (err) {
      console.error('Error simulating load:', err);
      alert('Error running benchmark');
    } finally {
      setLoading(false);
    }
  };

  // Reset cache and metrics
  const resetAll = async () => {
    const confirmed = confirm(
      'Reset Cache & Charts?\n\n' +
        'This will clear:\n' +
        '• Redis cache\n' +
        '• Prometheus metrics\n' +
        '• Grafana charts\n' +
        '\nAre you sure?'
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reset`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Reset local state
      setStats({ hits: 0, misses: 0, hitRate: 0 });

      alert(
        'Reset completed!\n\n' +
          'Cache and metrics cleared.\n' +
          'Charts will update in ~60 seconds.'
      );
    } catch (err) {
      console.error('Error during reset:', err);
      alert(
        `Reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchStats();
  }, []);

  // Auto-refresh stats every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const cacheWarmed = stats.hitRate >= 80;

  return (
    <div className="wrap" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ marginBottom: '8px', fontSize: '32px' }}>
          Black Friday Cache-Aside POC
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '16px', margin: 0 }}>
          Showing how Redis makes requests 16× faster
        </p>
      </div>

      {/* Key Metrics - 3 Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="panel" style={{ textAlign: 'center', padding: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '8px',
            }}
          >
            Cache Hits
          </div>
          <div
            style={{ fontSize: '48px', fontWeight: 'bold', color: '#4ade80' }}
          >
            {stats.hits.toLocaleString()}
          </div>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '8px',
            }}
          >
            Cache Misses
          </div>
          <div
            style={{ fontSize: '48px', fontWeight: 'bold', color: '#fbbf24' }}
          >
            {stats.misses.toLocaleString()}
          </div>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '8px',
            }}
          >
            From Cache
          </div>
          <div
            style={{ fontSize: '48px', fontWeight: 'bold', color: '#4ade80' }}
          >
            {stats.hitRate}%
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <button
          className="btn primary"
          onClick={simulateLoad}
          disabled={loading}
          style={{ padding: '12px 24px', fontSize: '16px' }}
          title="Generate a short burst of traffic"
        >
          {loading ? 'Running...' : 'Simulate Load'}
        </button>
        <button
          className="btn danger"
          onClick={resetAll}
          disabled={loading}
          style={{ padding: '12px 24px', fontSize: '16px' }}
          title="Clear cache and reset metrics"
        >
          Reset Cache & Charts
        </button>
      </div>

      {/* Status Badge */}
      {cacheWarmed && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: '24px',
            padding: '12px',
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: '8px',
          }}
        >
          <span style={{ fontSize: '16px' }}>
            Cache warmed up |{' '}
            {Math.round(stats.hits / Math.max(stats.misses, 1))}× more requests
            handled
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="panel">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>
            Request Throughput
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', margin: 0 }}>
            Shows requests per second after cache warmup
          </p>
        </div>
        <GrafanaPanel
          dashboardUid="blackfriday"
          panelId={2}
          height="500px"
          theme="dark"
        />
      </div>
    </div>
  );
}

export default App;
