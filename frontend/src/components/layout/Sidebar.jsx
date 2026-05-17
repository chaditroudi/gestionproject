import { LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { formatBadgeLabel } from "../../utils/formatters";
import { getInitials } from "../../utils/initials";
import { cx } from "../../utils/cx";

export default function Sidebar({
  user,
  workspace,
  items,
  isMobileNav,
  isOpen,
  isCompact,
  onClose,
  onToggleCompact,
  onLogout,
}) {
  const compact = isCompact && !isMobileNav;

  return (
    <aside
      id="app-sidebar"
      aria-hidden={isMobileNav ? !isOpen : false}
      className={cx(
        "z-50 h-dvh border-r border-slate-800/80 bg-slate-950 text-slate-100 transition-all duration-300",
        isMobileNav
          ? cx(
              "fixed inset-y-0 left-0 w-[280px] shadow-2xl",
              isOpen ? "translate-x-0" : "-translate-x-full"
            )
          : cx("sticky top-0 shrink-0", compact ? "w-20" : "w-72")
      )}
    >
      <div className="flex h-full flex-col gap-4 p-3">
        <header className={cx("flex items-center justify-between gap-2", compact && "justify-center")}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-orange-400 text-sm font-extrabold text-slate-950">
              WF
            </span>
            {!compact ? (
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  Workflow Sphere
                </p>
                <p className="truncate font-display text-sm font-semibold text-slate-100">Operations Hub</p>
              </div>
            ) : null}
          </div>

          {isMobileNav ? (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-300" onClick={onClose}>
              <X size={14} />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cx("h-8 w-8 text-slate-300", compact && "hidden")}
              onClick={onToggleCompact}
              aria-label={compact ? "Etendre la barre laterale" : "Compacter la barre laterale"}
            >
              {compact ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </Button>
          )}
        </header>

        {!compact ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <Badge variant="secondary" className="mb-2 bg-cyan-900/40 text-cyan-200">
              {formatBadgeLabel(user?.role)}
            </Badge>
            <p className="truncate font-display text-sm font-semibold text-slate-100">{workspace?.title || "Workspace"}</p>
            <p className="mt-1 text-xs text-slate-400">
              {workspace?.description || "Pilotage intelligent des operations."}
            </p>
          </section>
        ) : null}

        <nav className="grid gap-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={isMobileNav ? onClose : undefined}
                title={compact ? item.label : undefined}
                className={({ isActive }) =>
                  cx(
                    "group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 transition",
                    compact && "justify-center px-2",
                    isActive
                      ? "border-cyan-500/40 bg-cyan-500/10 text-slate-50"
                      : "text-slate-300 hover:border-slate-700 hover:bg-slate-900/80 hover:text-white"
                  )
                }
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-800 bg-slate-900">
                  {Icon ? <Icon size={16} /> : <span className="text-xs font-bold">{getInitials(item.label, "N")}</span>}
                </span>
                {!compact ? (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{item.description}</span>
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {!compact ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
              <Sparkles size={12} />
              Flow Hint
            </p>
            <p className="text-xs text-slate-400">Priorisez les elements bloques dans Tasks pour accelerer l'execution.</p>
          </section>
        ) : null}

        <footer className="mt-auto rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
          <div className={cx("flex items-center gap-2", compact && "justify-center")}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-orange-400 text-xs font-bold text-slate-950">
              {getInitials(user?.fullName, "WF")}
            </span>
            {!compact ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{user?.fullName || "Utilisateur"}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email || "-"}</p>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className={cx(
              "mt-2 h-9 w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white",
              compact && "mt-0 h-8 w-8 border-0 bg-transparent p-0 hover:bg-slate-800"
            )}
            title="Deconnexion"
          >
            <LogOut size={14} />
            {!compact ? <span>Deconnexion</span> : null}
          </Button>
        </footer>
      </div>
    </aside>
  );
}
