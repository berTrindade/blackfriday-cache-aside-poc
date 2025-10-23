import React from 'react';

interface GrafanaPanelProps {
  dashboardUid: string;
  panelId: number;
  orgId?: number;
  width?: string;
  height?: string;
  from?: string;
  to?: string;
  refresh?: string;
  theme?: 'light' | 'dark';
}

export default function GrafanaPanel({
  dashboardUid,
  panelId,
  orgId = 1,
  width = '100%',
  height = '300px',
  from = 'now-15m',
  to = 'now',
  refresh = '5s',
  theme = 'light',
}: GrafanaPanelProps) {
  const base = import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3001';
  const qs = new URLSearchParams({
    orgId: String(orgId),
    panelId: String(panelId),
    from,
    to,
    refresh,
    theme,
  });
  const src = `${base}/d-solo/${dashboardUid}?${qs.toString()}`;

  return (
    <iframe
      title={`Grafana Panel ${panelId}`}
      src={src}
      width={width}
      height={height}
      style={{
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#1a1a1a',
      }}
    />
  );
}
