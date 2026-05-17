import { AlertTriangle, ArrowUpRight, Download, FolderKanban, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { formatDate, getProgress } from "../utils/formatters";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reportExporting, setReportExporting] = useState("");
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    api
      .getDashboardSummary()
      .then(setData)
      .catch((dashboardError) => setLoadError(dashboardError.message));
  }, []);

  async function handleExport(format) {
    try {
      setActionError("");
      setReportMessage("");
      setReportExporting(format);
      await api.downloadDashboardReport(format);
      setReportMessage(`Rapport ${format.toUpperCase()} telecharge.`);
    } catch (exportError) {
      setActionError(exportError.message);
    } finally {
      setReportExporting("");
    }
  }

  if (loadError) {
    return <p className="error-text">{loadError}</p>;
  }

  if (!data) {
    return <div className="screen-center">Chargement du tableau de bord...</div>;
  }

  const stats = normalizeStats(data?.stats);
  const recentTasks = ensureArray(data?.recentTasks);
  const statusBreakdown = ensureArray(data?.statusBreakdown);
  const priorityBreakdown = ensureArray(data?.priorityBreakdown);
  const teamPerformance = ensureArray(data?.teamPerformance);
  const roleDistribution = ensureArray(data?.roleDistribution);
  const overdueTasks = ensureArray(data?.overdueTasks);
  const upcomingTasks = ensureArray(data?.upcomingTasks);

  const focusTasks = overdueTasks.length ? overdueTasks : upcomingTasks;
  const strongestTeam = [...teamPerformance].sort(
    (left, right) => toNumber(right?.completed_tasks) - toNumber(left?.completed_tasks)
  )[0];

  return (
    <section className="page-stack">
      <header className="hero-surface page-hero dashboard-hero">
        <div className="hero-copy">
          <span className="section-kicker">Pilotage</span>
          <h2>Tableau de bord operationnel</h2>
          <p className="page-copy">
            Vue consolidée de l&apos;execution, des goulots et de la capacité équipe pour décider vite.
          </p>
          <div className="hero-chip-row">
            <span className="feature-chip">
              <Users size={14} />
              Collaboration
            </span>
            <span className="feature-chip">
              <FolderKanban size={14} />
              Delivery
            </span>
            <span className="feature-chip">
              <AlertTriangle size={14} />
              Alertes
            </span>
          </div>
        </div>

        <Card className="hero-focus-card">
          <CardContent className="space-y-4 p-4">
            <div>
              <span className="hero-focus-label">Completion globale</span>
              <strong>{stats.completion_rate}%</strong>
              <p>{stats.completed_tasks} taches completees sur {stats.total_tasks} ouvertes.</p>
            </div>

            <div className="hero-focus-grid">
              <div>
                <span>En retard</span>
                <strong>{stats.overdue_tasks}</strong>
              </div>
              <div>
                <span>En cours</span>
                <strong>{stats.in_progress_tasks}</strong>
              </div>
            </div>

            <div className="action-row">
              <Button
                type="button"
                disabled={Boolean(reportExporting)}
                onClick={() => handleExport("csv")}
              >
                <Download size={15} />
                {reportExporting === "csv" ? "Export..." : "CSV"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(reportExporting)}
                onClick={() => handleExport("json")}
              >
                <Download size={15} />
                {reportExporting === "json" ? "Export..." : "JSON"}
              </Button>
            </div>
            {actionError ? <p className="error-text">{actionError}</p> : null}
            {reportMessage ? <p className="success-text">{reportMessage}</p> : null}
          </CardContent>
        </Card>
      </header>

      <div className="stats-grid">
        <StatCard label="Utilisateurs" value={stats.total_users} helper="Comptes actifs" />
        <StatCard label="Equipes" value={stats.total_teams} tone="amber" helper="Structures suivies" />
        <StatCard label="Taches" value={stats.total_tasks} helper="Backlog visible" />
        <StatCard label="Terminees" value={stats.completed_tasks} tone="green" helper="Execution aboutie" />
        <StatCard label="En cours" value={stats.in_progress_tasks} tone="amber" helper="Actions ouvertes" />
        <StatCard label="En retard" value={stats.overdue_tasks} tone="red" helper="Attention immediate" />
      </div>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">Execution</span>
              <h3>Progression par statut</h3>
              <p>Poids de chaque file dans la charge globale.</p>
            </div>
            <strong className="panel-number">{stats.completion_rate}%</strong>
          </div>

          <div className="metric-list">
            {statusBreakdown.map((item) => (
              <article className="metric-row" key={item.status}>
                <div className="metric-label">
                  <StatusBadge value={item.status} />
                  <span>{toNumber(item?.total)} taches</span>
                </div>
                <div className="metric-track">
                  <span className="metric-fill" style={{ width: `${getProgress(toNumber(item?.total), stats.total_tasks)}%` }} />
                </div>
                <strong>{getProgress(toNumber(item?.total), stats.total_tasks)}%</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">Structure</span>
              <h3>Roles & priorites</h3>
              <p>Couverture des profils et pression backlog.</p>
            </div>
          </div>

          <div className="chip-grid">
            {roleDistribution.map((item) => (
              <article className="chip-card rich" key={item.role}>
                <StatusBadge value={item.role} />
                <strong>{toNumber(item?.total)}</strong>
                <small>acteur(s)</small>
              </article>
            ))}
          </div>

          <div className="chip-grid">
            {priorityBreakdown.map((item) => (
              <article className="chip-card rich" key={item.priority}>
                <StatusBadge value={item.priority} />
                <strong>{toNumber(item?.total)} taches</strong>
                <small>niveau de priorite</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">Performance</span>
              <h3>Equipes</h3>
              <p>Charge et taux de completion par structure.</p>
            </div>
          </div>

          <div className="table-list">
            {teamPerformance.map((team) => (
              <article className="team-card" key={team.id}>
                <div className="card-heading">
                  <div>
                    <strong>{team.name}</strong>
                    <p>Responsable: {team.manager_name || "Non defini"}</p>
                  </div>
                  <span className="pill-label">{getProgress(team.completed_tasks, team.total_tasks)}%</span>
                </div>

                <div className="metric-track">
                  <span className="metric-fill" style={{ width: `${getProgress(toNumber(team?.completed_tasks), toNumber(team?.total_tasks))}%` }} />
                </div>

                <div className="split-details">
                  <span>{toNumber(team?.total_tasks)} total</span>
                  <span>{toNumber(team?.in_progress_tasks)} en cours</span>
                  <span>{toNumber(team?.completed_tasks)} done</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">Attention</span>
              <h3>Priorite immediate</h3>
              <p>Elements a traiter en priorité cette semaine.</p>
            </div>
          </div>

          {strongestTeam ? (
            <div className="insight-banner">
              <span>Top equipe</span>
              <strong>{strongestTeam.name}</strong>
              <p>{strongestTeam.completed_tasks} taches finalisees actuellement.</p>
            </div>
          ) : null}

          <div className="table-list">
            {focusTasks.map((task) => (
              <article className="table-row stack-mobile" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.team_name || "Sans equipe"} - {task.assignee_name || "Non assigne"}</p>
                </div>
                <div className="row-badges">
                  <span className="pill-label">
                    <AlertTriangle size={12} />
                    {formatDate(task.due_date)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-eyebrow">Activite</span>
            <h3>Taches recentes</h3>
            <p>Dernieres mises a jour du systeme.</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1">
            Voir tout
            <ArrowUpRight size={14} />
          </Button>
        </div>

        <div className="table-list">
          {recentTasks.map((task) => (
            <article className="table-row stack-mobile" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>
                  {task.team_name || "Sans equipe"} - {task.assignee_name || "Non assigne"} - Echeance {formatDate(task.due_date)}
                </p>
              </div>
              <div className="row-badges">
                <StatusBadge value={task.priority} />
                <StatusBadge value={task.status} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry != null) : [];
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStats(stats) {
  return {
    completion_rate: toNumber(stats?.completion_rate),
    completed_tasks: toNumber(stats?.completed_tasks),
    total_tasks: toNumber(stats?.total_tasks),
    overdue_tasks: toNumber(stats?.overdue_tasks),
    in_progress_tasks: toNumber(stats?.in_progress_tasks),
    total_users: toNumber(stats?.total_users),
    total_teams: toNumber(stats?.total_teams)
  };
}
