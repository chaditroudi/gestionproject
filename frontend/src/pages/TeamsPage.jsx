import { Building2, Layers3, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import AccessDenied from "../components/AccessDenied";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { hasPermission } from "../constants/permissions";
import { leadershipRoles } from "../constants/roles";
import { useAuth } from "../state/AuthContext";
import { formatBadgeLabel, getProgress } from "../utils/formatters";

const defaultForm = {
  name: "",
  description: "",
  managerId: "",
  memberIds: []
};

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [search, setSearch] = useState("");

  const canViewTeams = hasPermission(user?.role, "view_teams");
  const canManageTeams = hasPermission(user?.role, "manage_teams");

  async function loadData() {
    try {
      const [teamsResult, usersResult] = await Promise.all([
        api.getTeams(),
        hasPermission(user?.role, "view_users") ? api.getUsers() : Promise.resolve([])
      ]);
      setTeams(ensureArray(teamsResult).map(normalizeTeam));
      setUsers(ensureArray(usersResult));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadData();
  }, [user?.role]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        managerId: form.managerId ? Number(form.managerId) : null,
        memberIds: form.memberIds.map(Number)
      };

      if (editingTeamId) {
        await api.updateTeam(editingTeamId, payload);
        setSuccess("Equipe mise a jour avec succes.");
      } else {
        await api.createTeam(payload);
        setSuccess("Equipe creee avec succes.");
      }

      setForm(defaultForm);
      setEditingTeamId(null);
      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function handleMembersChange(selectedOptions) {
    const values = Array.from(selectedOptions).map((option) => option.value);
    setForm((current) => ({ ...current, memberIds: values }));
  }

  async function handleDelete(teamId) {
    const confirmed = window.confirm("Supprimer cette equipe ?");

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.deleteTeam(teamId);
      if (editingTeamId === teamId) {
        resetForm();
      }
      setSuccess("Equipe supprimee avec succes.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function handleEdit(team) {
    setEditingTeamId(team.id);
    setForm({
      name: team.name,
      description: team.description || "",
      managerId: team.manager_id ? String(team.manager_id) : "",
      memberIds: ensureArray(team.members).map((member) => String(member.id))
    });
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setEditingTeamId(null);
    setForm(defaultForm);
    setError("");
    setSuccess("");
  }

  const filteredTeams = teams.filter((team) => {
    const haystack = `${team?.name || ""} ${team?.description || ""} ${team?.manager_name || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const managerOptions = users.filter((listedUser) => leadershipRoles.includes(listedUser.role));
  const mostLoadedTeams = [...teams]
    .sort((left, right) => toNumber(right?.total_tasks) - toNumber(left?.total_tasks))
    .slice(0, 4);

  if (!canViewTeams) {
    return <AccessDenied message="Cet acteur ne dispose pas d'un espace equipes." />;
  }

  return (
    <section className="page-stack">
      <header className="hero-surface page-hero">
        <div className="hero-copy">
          <span className="section-kicker">Organisation</span>
          <h2>Gestion des equipes</h2>
          <p className="page-copy">
            Structure les squads, assigne les responsables et répartis la charge avec une vue claire.
          </p>
          <div className="hero-chip-row">
            <span className="feature-chip">
              <Building2 size={14} />
              Structure
            </span>
            <span className="feature-chip">
              <Users size={14} />
              Collaboration
            </span>
            <span className="feature-chip">
              <Layers3 size={14} />
              Capacite
            </span>
          </div>
        </div>

        <div className="hero-action-card">
          <span className="panel-eyebrow">Recherche</span>
          <div className="search-with-icon">
            <Search size={14} />
            <Input
              className="search-input"
              placeholder="Rechercher une equipe..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p>{filteredTeams.length} equipe(s) visibles.</p>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card compact tone-default">
          <span className="stat-label">Equipes actives</span>
          <strong className="stat-value">{teams.length}</strong>
          <small className="stat-helper">structures suivies</small>
        </article>
        <article className="stat-card compact tone-amber">
          <span className="stat-label">Responsables designes</span>
          <strong className="stat-value">{teams.filter((team) => team.manager_name).length}</strong>
          <small className="stat-helper">equipes avec owner</small>
        </article>
        <article className="stat-card compact tone-green">
          <span className="stat-label">Membres rattaches</span>
          <strong className="stat-value">{teams.reduce((total, team) => total + toNumber(team?.member_count), 0)}</strong>
          <small className="stat-helper">collaborateurs integres</small>
        </article>
      </div>

      <div className="split-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">Roster</span>
              <h3>Equipes</h3>
              <p>Vue detaillee de la progression, de l&apos;owner et de la charge.</p>
            </div>
          </div>

          <div className="table-list">
            {filteredTeams.map((team) => (
              <article className="team-card" key={team.id}>
                <div className="card-heading">
                  <div>
                    <strong>{team.name}</strong>
                    <p>{team.description || "Aucune description"}</p>
                  </div>
                  <span className="pill-label">{getProgress(team.completed_tasks, team.total_tasks)}% complete</span>
                </div>

                <div className="detail-grid">
                  <article className="detail-card">
                    <span>Responsable</span>
                    <strong>{team.manager_name || "Non defini"}</strong>
                  </article>
                  <article className="detail-card">
                    <span>Membres</span>
                    <strong>{team.member_count}</strong>
                  </article>
                  <article className="detail-card">
                    <span>Taches ouvertes</span>
                    <strong>{team.open_tasks}</strong>
                  </article>
                </div>

                <p className="meta-text">
                  Membres: {ensureArray(team.members).map((member) => member.fullName).join(", ") || "Aucun"}
                </p>

                <div className="metric-track">
                  <span className="metric-fill" style={{ width: `${getProgress(team.completed_tasks, team.total_tasks)}%` }} />
                </div>

                <div className="split-details">
                  <span>{team.member_count} membre(s)</span>
                  <span>{team.total_tasks} tache(s)</span>
                  <span>{team.open_tasks} ouverte(s)</span>
                </div>

                {canManageTeams ? (
                  <div className="action-row">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(team)}>
                      Modifier
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(team.id)}>
                      Supprimer
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <div className="side-stack">
          {canManageTeams ? (
            <form className="panel form-panel" onSubmit={handleSubmit}>
              <div className="panel-heading">
                <div>
                  <span className="panel-eyebrow">Edition</span>
                  <h3>{editingTeamId ? "Modifier une equipe" : "Nouvelle equipe"}</h3>
                  <p>Crée l&apos;equipe et affecte ses membres.</p>
                </div>
                {editingTeamId ? (
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                    Annuler
                  </Button>
                ) : null}
              </div>

              <label>
                Nom de l&apos;equipe
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>

              <label>
                Description
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>

              <label>
                Responsable
                <select
                  value={form.managerId}
                  onChange={(event) => setForm((current) => ({ ...current, managerId: event.target.value }))}
                >
                  <option value="">Selectionner</option>
                  {managerOptions.map((listedUser) => (
                    <option key={listedUser.id} value={listedUser.id}>
                      {listedUser.full_name} ({formatBadgeLabel(listedUser.role)})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Membres
                <select multiple value={form.memberIds} onChange={(event) => handleMembersChange(event.target.selectedOptions)}>
                  {users.map((listedUser) => (
                    <option key={listedUser.id} value={listedUser.id}>
                      {listedUser.full_name}
                    </option>
                  ))}
                </select>
              </label>

              {error ? <p className="error-text">{error}</p> : null}
              {success ? <p className="success-text">{success}</p> : null}

              <Button type="submit" className="w-full">
                {editingTeamId ? "Mettre a jour l'equipe" : "Ajouter l'equipe"}
              </Button>
            </form>
          ) : (
            <section className="panel notice-panel">
              <span className="panel-eyebrow">Droits</span>
              <h3>Consultation uniquement</h3>
              <p>Ce profil peut voir les equipes rattachees sans pouvoir les modifier.</p>
            </section>
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">Capacite</span>
                <h3>Equipes les plus sollicitees</h3>
                <p>Point rapide sur les structures avec la charge la plus forte.</p>
              </div>
            </div>

            <div className="table-list">
              {mostLoadedTeams.map((team) => (
                <article className="table-row stack-mobile" key={team.id}>
                  <div>
                    <strong>{team.name}</strong>
                    <p>{team.manager_name || "Responsable non defini"}</p>
                  </div>
                  <div className="row-badges">
                    <span className="pill-label">{team.total_tasks} tache(s)</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
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

function normalizeTeam(team) {
  const source = team && typeof team === "object" ? team : {};

  return {
    ...source,
    members: ensureArray(source.members),
    member_count: toNumber(source.member_count),
    total_tasks: toNumber(source.total_tasks),
    completed_tasks: toNumber(source.completed_tasks),
    open_tasks: toNumber(source.open_tasks)
  };
}
