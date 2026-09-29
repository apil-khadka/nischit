import type { PageId, RoleSession } from "./shared";
import { pageMeta } from "./shared";

function SidebarIcon({ page }: { page: PageId }) {
  const iconProps = { className: "sidebar-icon", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.75 } as const;
  switch (page) {
    case "overview":
      return <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "purchase-orders":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case "receiving":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case "qa":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
    case "inventory":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
    case "settlement":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "audit":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>;
    case "integrations":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V4m8 3V4M6 10h12M7 20h10a2 2 0 002-2v-7a3 3 0 00-3-3H8a3 3 0 00-3 3v7a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 14h2m2 0h2" /></svg>;
    case "settings":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "public":
      return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>;
  }
}

export function WorkspaceSidebar({
  activePage,
  selectPage,
  session,
  queueCounts,
}: {
  activePage: PageId;
  selectPage: (page: PageId) => void;
  session: RoleSession;
  queueCounts: Record<PageId, number>;
}) {
  const tenantInitials = session.tenantName
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "NL";
  const workItems: PageId[] = ["overview", "purchase-orders", "receiving", "qa", "inventory", "settlement"];
  const recordItems: PageId[] = ["audit", "integrations", "settings", "public"];

  const renderItems = (pages: PageId[]) => pages.map((page) => {
    const count = queueCounts[page];
    const isActive = activePage === page;
    return (
      <button
        key={page}
        type="button"
        className={`modern-sidebar-item ${isActive ? "active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={() => selectPage(page)}
      >
        <div className="sidebar-item-left">
          <SidebarIcon page={page} />
          <span className="sidebar-item-text">{pageMeta[page].label}</span>
        </div>
        {count > 0 ? <span className="sidebar-count-badge">{count}</span> : null}
      </button>
    );
  });

  return (
    <aside className="modern-sidebar" aria-label="Workspace navigation">
      <div className="modern-sidebar-tenant">
        <div className="tenant-avatar">{tenantInitials}</div>
        <div className="tenant-info">
          <span className="tenant-name">{session.tenantName}</span>
          <span className="tenant-role-pill">{session.role.toUpperCase()}</span>
        </div>
      </div>
      <div className="modern-sidebar-section">
        <span className="modern-sidebar-label">WORKBENCH</span>
        {renderItems(workItems)}
      </div>
      <div className="modern-sidebar-section">
        <span className="modern-sidebar-label">SYSTEM</span>
        {renderItems(recordItems)}
      </div>
      <div className="modern-sidebar-footer">
        <div className={`sidebar-status-beacon ${session.kind === "preview" ? "preview" : ""}`}>
          <span className="sidebar-status-dot" />
          <span>{session.kind === "preview" ? "Preview data" : "Verified session"}</span>
        </div>
        <span className="sidebar-compliance-note">Role permissions enforced by the API</span>
        <a href="/" className="sidebar-public-link">Public site <span aria-hidden="true">↗</span></a>
      </div>
    </aside>
  );
}
