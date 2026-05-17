import { Activity, Search, Shield, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import AccessDenied from "../components/AccessDenied";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { canAssignRole, hasPermission } from "../constants/permissions";
import { roles } from "../constants/roles";
import { useAuth } from "../state/AuthContext";
import { formatBadgeLabel, formatDate } from "../utils/formatters";

const defaultForm = {
  fullName: "",
  email: "",
  password: "",
  role: "employee"
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [search, setSearch] = useState("");

  const canManageUsers = hasPermission(user?.role, "manage_users");
  const availableRoles = roles.filter((role) => canAssignRole(user?.role, role));

  async function loadUsers() {
    try {
      const result = await api.getUsers();
      setUsers(ensureArray(result).map(normalizeUser));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (editingUserId) {
        await api.updateUser(editingUserId, form);
        setSuccess("Utilisateur mis a jour avec succes.");
      } else {
        await api.createUser(form);
        setSuccess("Utilisateur cree avec succes.");
      }

      setForm(defaultForm);
      setEditingUserId(null);
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDelete(userId) {
    const confirmed = window.confirm("Supprimer ce compte utilisateur ?");

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.deleteUser(userId);
      if (editingUserId === userId) {
        setEditingUserId(null);
        setForm(defaultForm);
      }
      setSuccess("Utilisateur supprime avec succes.");
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function handleEdit(listedUser) {
    setEditingUserId(listedUser.id);
    setForm({
      fullName: listedUser.full_name,
      email: listedUser.email,
      password: "",
      role: listedUser.role
    });
    setSuccess("");
    setError("");
  }

  function resetForm() {
    setEditingUserId(null);
    setForm(defaultForm);
    setError("");
    setSuccess("");
  }

  const filteredUsers = users.filter((listedUser) => {
    const haystack = `${listedUser?.full_name || ""} ${listedUser?.email || ""} ${listedUser?.role || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const roleTotals = roles.map((role) => ({
    role,
    total: users.filter((listedUser) => listedUser.role === role).length
  }));
  const activeUsers = [...users]
    .sort((left, right) => toNumber(right?.assigned_task_count) - toNumber(left?.assigned_task_count))
    .slice(0, 4);

  function canManageListedUser(listedUser) {
    return canManageUsers && canAssignRole(user?.role, listedUser.role);
  }

  if (!hasPermission(user?.role, "view_users")) {
    return <AccessDenied message="Cet acteur ne dispose pas d'un espace utilisateurs." />;
  }

  return (
    <section className="page-stack">
      <header className="hero-surface page-hero">
        <div className="hero-copy">
          <span className="section-kicker">Identity</span>
          <h2>Gestion des utilisateurs</h2>
          <p className="page-copy">Gere les comptes, les roles et la charge de travail depuis un seul cockpit.</p>
          <div className="hero-chip-row">
            <span className="feature-chip">
              <Users size={14} />
              Annuaire
            </span>
            <span className="feature-chip">
              <Shield size={14} />
              Permissions
            </span>
            <span className="feature-chip">
              <Activity size={14} />
              Capacite
            </span>
          </div>
        </div>

        <div className="hero-action-card">
          <span className="panel-eyebrow">Recherche transverse</span>
          <div className="search-with-icon">
            <Search size={14} />
            <Input
              className="search-input"
              placeholder="Rechercher un utilisateur..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p>{filteredUsers.length} profil(s) visibles.</p>
        </div>
      </header>

      <div className="stats-grid">
        {roleTotals.map((item) => (
          <article className="stat-card compact tone-default" key={item.role}>
            <span className="stat-label">{formatBadgeLabel(item.role)}</span>
            <strong className="stat-value">{item.total}</strong>
            <small className="stat-helper">acteur(s)</small>
          </article>
        ))}
      </div>

      <div className="split-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">Annuaire</span>
              <h3>Utilisateurs enregistres</h3>
              <p>Comptes, role actif et charge d&apos;execution.</p>
            </div>
          </div>

          <div className="table-list">
            {filteredUsers.map((listedUser) => (
              <article className="entity-card" key={listedUser.id}>
                <div className="card-heading">
                  <div className="entity-identity">
                    <span className="avatar-badge soft">{getInitials(listedUser.full_name)}</span>
                    <div>
                      <strong>{listedUser.full_name}</strong>
                      <p>{listedUser.email}</p>
                    </div>
                  </div>
                  <div className="row-badges">
                    <StatusBadge value={listedUser.role} />
                  </div>
                </div>

                <div className="detail-grid">
                  <article className="detail-card">
                    <span>Equipes</span>
                    <strong>{listedUser.team_count}</strong>
                  </article>
                  <article className="detail-card">
                    <span>Equipes gerees</span>
                    <strong>{listedUser.managed_team_count}</strong>
                  </article>
                  <article className="detail-card">
                    <span>Taches assignees</span>
                    <strong>{listedUser.assigned_task_count}</strong>
                  </article>
                </div>

                <p className="meta-text">Cree le {formatDate(listedUser.created_at)}</p>

                {canManageListedUser(listedUser) ? (
                  <div className="action-row">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(listedUser)}>
                      Modifier
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(listedUser.id)}>
                      Supprimer
                    </Button>
                  </div>
                ) : (
                  <div className="subtle-inline-note">
                    <span>Consultation</span>
                    <p>Ce compte n&apos;est pas modifiable par votre role.</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <div className="side-stack">
          {canManageUsers ? (
            <form className="panel form-panel" onSubmit={handleSubmit}>
              <div className="panel-heading">
                <div>
                  <span className="panel-eyebrow">Provisioning</span>
                  <h3>{editingUserId ? "Modifier un utilisateur" : "Nouvel utilisateur"}</h3>
                  <p>{editingUserId ? "Ajustez le role et l&apos;acces." : "Ajoutez un profil a la plateforme."}</p>
                </div>
                {editingUserId ? (
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                    Annuler
                  </Button>
                ) : (
                  <UserPlus size={18} />
                )}
              </div>

              <label>
                Nom complet
                <Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
              </label>

              <label>
                Email
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </label>

              <label>
                Mot de passe
                <Input
                  type="password"
                  placeholder={editingUserId ? "Laisser vide pour conserver l'actuel" : ""}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>

              <label>
                Role
                <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {formatBadgeLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              {error ? <p className="error-text">{error}</p> : null}
              {success ? <p className="success-text">{success}</p> : null}

              <Button type="submit" className="w-full">
                {editingUserId ? "Mettre a jour l'utilisateur" : "Creer l'utilisateur"}
              </Button>
            </form>
          ) : (
            <section className="panel notice-panel">
              <span className="panel-eyebrow">Droits</span>
              <h3>Consultation uniquement</h3>
              <p>Ce profil peut consulter l&apos;annuaire sans modifier les comptes.</p>
            </section>
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">Charge visible</span>
                <h3>Profils les plus sollicites</h3>
                <p>Reperez les acteurs les plus exposes a l&apos;execution.</p>
              </div>
            </div>

            <div className="table-list">
              {activeUsers.map((listedUser) => (
                <article className="table-row stack-mobile" key={listedUser.id}>
                  <div>
                    <strong>{listedUser.full_name}</strong>
                    <p>{formatBadgeLabel(listedUser.role)} - {listedUser.email}</p>
                  </div>
                  <div className="row-badges">
                    <span className="pill-label">{listedUser.assigned_task_count} tache(s)</span>
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

function getInitials(name) {
  if (!name) {
    return "NA";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry != null) : [];
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUser(user) {
  const source = user && typeof user === "object" ? user : {};

  return {
    ...source,
    team_count: toNumber(source.team_count),
    managed_team_count: toNumber(source.managed_team_count),
    assigned_task_count: toNumber(source.assigned_task_count)
  };
}
