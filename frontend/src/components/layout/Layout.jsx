// src/components/layout/Layout.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { getWorkspace, hasPermission } from "../../constants/permissions";
import { NAV_ITEMS, BREAKPOINTS } from "../../config/navigation";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { cx } from "../../utils/cx";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Layout({ children, navItems = NAV_ITEMS }) {
  const { user, logout, authLoading } = useAuth();
  const location = useLocation();

  const isMobileNav = useMediaQuery(`(max-width: ${BREAKPOINTS.mobileNav}px)`);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useLocalStorageState(
    "shell.sidebar.compact",
    false,
  );

  // close drawer on route change and when leaving mobile breakpoint
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => { if (!isMobileNav) setSidebarOpen(false); }, [isMobileNav]);

  useBodyScrollLock(isMobileNav && sidebarOpen);
  useEscapeKey(() => setSidebarOpen(false), isMobileNav && sidebarOpen);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasPermission(user?.role, item.permission)),
    [navItems, user?.role],
  );
  const workspace = useMemo(() => getWorkspace(user?.role), [user?.role]);
  const currentPage =
    visibleNavItems.find((i) => i.path === location.pathname) ?? visibleNavItems[0];

  const isCompactDesktop = !isMobileNav && sidebarCompact;

  // early return AFTER all hooks
  if (authLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        Chargement...
      </div>
    );
  }

  const toggleSidebar = () =>
    isMobileNav ? setSidebarOpen((v) => !v) : setSidebarCompact((v) => !v);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isMobileNav ? (
        <button
          type="button"
          className={cx(
            "fixed inset-0 z-40 border-0 bg-black/50 backdrop-blur-[1px] transition-opacity",
            sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
          aria-label="Fermer la navigation"
          aria-hidden={!sidebarOpen}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-[1800px] lg:min-h-screen">
        <Sidebar
          user={user}
          workspace={workspace}
          items={visibleNavItems}
          isMobileNav={isMobileNav}
          isOpen={sidebarOpen}
          isCompact={isCompactDesktop}
          onClose={() => setSidebarOpen(false)}
          onToggleCompact={() => setSidebarCompact((v) => !v)}
          onLogout={logout}
        />

        <main className="min-w-0 flex-1 p-2 sm:p-3 lg:p-5">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3">
            <TopBar
              user={user}
              workspace={workspace}
              currentPage={currentPage}
              items={visibleNavItems}
              isMobileNav={isMobileNav}
              isCompactDesktop={isCompactDesktop}
              isOpen={sidebarOpen}
              onToggle={toggleSidebar}
            />
            <div>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
