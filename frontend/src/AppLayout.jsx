import React from 'react';

export default function AppLayout({ sidebar, children }) {
  // Root uses flex row and fills viewport; aside and main manage their own scrolling
  return (
    <div
      className="layout-container app-shell"
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}
    >
      <aside
        className="sidebar"
        style={{ width: 260, minWidth: 260, flexShrink: 0, height: '100%', overflowY: 'auto', position: 'relative', zIndex: 2, background: 'var(--sidebar-bg)' }}
      >
        {sidebar || null}
      </aside>

      <main
        className="content"
        style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: 24 }}
      >
        {children}
      </main>
    </div>
  );
}
