// src/components/layout/TopBar.jsx
import { formatBadgeLabel } from "../../utils/formatters";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../ui/button";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "2-digit", month: "long",
});

export default function TopBar({
  user, workspace, currentPage, items,
  isMobileNav, isCompactDesktop, isOpen, onToggle,
}) {
  const navIndex = items.findIndex((i) => i.path === currentPage?.path);
  const today = DATE_FMT.format(new Date());

  const toggleLabel = isMobileNav
    ? (isOpen ? "Fermer le menu" : "Ouvrir le menu")
    : (isCompactDesktop ? "Etendre le menu" : "Compacter le menu");
  const toggleExpanded = isMobileNav ? isOpen : !isCompactDesktop;

  return (
    <header className="rounded-xl border border-border bg-card/90 p-3 shadow-sm backdrop-blur md:p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto,1fr,auto] lg:items-center">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onToggle}
            aria-label={toggleLabel}
            aria-expanded={toggleExpanded}
            aria-controls="app-sidebar"
          >
            {isMobileNav ? <Menu size={15} /> : isCompactDesktop ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            <span>{isMobileNav ? "Menu" : (isCompactDesktop ? "Etendre" : "Compacter")}</span>
          </Button>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground">
            {formatBadgeLabel(user?.role)}
          </span>
        </div>

        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-semibold tracking-tight">
            {currentPage?.label || "Accueil"}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {currentPage?.description || workspace.description}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
          <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
            <p className="text-sm font-semibold">{today}</p>
          </div>
          <div className="rounded-lg border border-transparent bg-primary px-3 py-2 text-primary-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/80">Role actif</span>
            <p className="text-sm font-semibold">
              {navIndex >= 0
                ? `${formatBadgeLabel(user?.role)} · ${navIndex + 1}/${items.length}`
                : formatBadgeLabel(user?.role)}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
