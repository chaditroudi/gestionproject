import { useEffect, useState } from "react";
import { api } from "../api/client";
import AccessDenied from "../components/AccessDenied";
import StatusBadge from "../components/StatusBadge";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../state/AuthContext";
import {
  formatBadgeLabel,
  formatDate,
  formatDateTime,
  getProgress
} from "../utils/formatters";

const taskStatusOptions = ["todo", "in_progress", "done", "blocked"];
const taskPriorityOptions = ["low", "medium", "high"];
const taskViewOptions = [
  { value: "list", label: "Liste" },
  { value: "kanban", label: "Kanban" },
  { value: "calendar", label: "Calendrier" },
  { value: "timeline", label: "Timeline" }
];
const kanbanColumns = [
  { status: "todo", label: "A lancer" },
  { status: "in_progress", label: "En cours" },
  { status: "done", label: "Terminees" },
  { status: "blocked", label: "Bloquees" }
];
const weekdayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const defaultTask = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  teamId: "",
  assigneeId: ""
};

const defaultSubtask = {
  title: "",
  description: "",
  priority: "medium",
  assigneeId: ""
};

const defaultAttachment = {
  label: "",
  url: ""
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(defaultTask);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [checklistDraft, setChecklistDraft] = useState("");
  const [attachmentForm, setAttachmentForm] = useState(defaultAttachment);
  const [subtaskForm, setSubtaskForm] = useState(defaultSubtask);
  const [activeView, setActiveView] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    teamId: "",
    assigneeId: ""
  });

  const canViewTasks = hasPermission(user?.role, "view_tasks");
  const canManageTasks = hasPermission(user?.role, "manage_tasks");
  const canViewUsers = hasPermission(user?.role, "view_users");

  async function loadData() {
    try {
      const [tasksResult, teamsResult, usersResult] = await Promise.all([
        api.getTasks(),
        api.getTeams(),
        canViewUsers ? api.getUsers() : Promise.resolve([])
      ]);

      const normalizedTasks = ensureArray(tasksResult).map(normalizeTaskSummary);
      const normalizedTeams = ensureArray(teamsResult).map((team) => ({
        ...team,
        members: ensureArray(team?.members)
      }));
      const normalizedUsers = ensureArray(usersResult);

      setTasks(normalizedTasks);
      setTeams(normalizedTeams);
      setUsers(normalizedUsers);

      if (!selectedTaskId && normalizedTasks[0]) {
        setSelectedTaskId(normalizedTasks[0].id);
      }

      if (selectedTaskId && !normalizedTasks.some((task) => task.id === selectedTaskId)) {
        setSelectedTaskId(normalizedTasks[0]?.id || null);
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadTaskDetail(taskId) {
    if (!taskId) {
      setSelectedTask(null);
      return;
    }

    try {
      setDetailLoading(true);
      const task = await api.getTaskById(taskId);
      setSelectedTask(normalizeTaskDetail(task));
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (canViewTasks) {
      loadData();
    }
  }, [user?.role]);

  useEffect(() => {
    if (canViewTasks && selectedTaskId) {
      loadTaskDetail(selectedTaskId);
    }
  }, [selectedTaskId, canViewTasks]);

  async function refreshTaskWorkspace(taskId = selectedTaskId) {
    await loadData();
    if (taskId) {
      await loadTaskDetail(taskId);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        teamId: form.teamId ? Number(form.teamId) : null,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null
      };

      const savedTask = editingTaskId
        ? await api.updateTask(editingTaskId, payload)
        : await api.createTask(payload);

      setSuccess(editingTaskId ? "Issue mise a jour." : "Issue creee.");
      setForm(defaultTask);
      setEditingTaskId(null);
      setSelectedTaskId(savedTask.id);
      await refreshTaskWorkspace(savedTask.id);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleStatusChange(taskId, status) {
    try {
      setError("");
      setSuccess("");
      await api.updateTaskStatus(taskId, status);
      setSuccess("Statut mis a jour.");
      await refreshTaskWorkspace(taskId);
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function handleDelete(taskId) {
    if (!window.confirm("Supprimer cette issue ?")) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await api.deleteTask(taskId);
      if (editingTaskId === taskId) {
        resetForm();
      }
      setSuccess("Issue supprimee.");
      const nextTaskId = tasks.find((task) => task.id !== taskId)?.id || null;
      setSelectedTaskId(nextTaskId);
      await loadData();
      if (nextTaskId) {
        await loadTaskDetail(nextTaskId);
      } else {
        setSelectedTask(null);
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function handleEdit(task) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date ? task.due_date.slice(0, 10) : "",
      teamId: task.team_id ? String(task.team_id) : "",
      assigneeId: task.assignee_id ? String(task.assignee_id) : ""
    });
    setSelectedTaskId(task.id);
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setEditingTaskId(null);
    setForm(defaultTask);
    setError("");
    setSuccess("");
  }

  async function handleAddComment(event) {
    event.preventDefault();
    if (!selectedTaskId) {
      return;
    }

    try {
      await api.addTaskComment(selectedTaskId, { content: commentDraft });
      setCommentDraft("");
      setSuccess("Commentaire ajoute.");
      await refreshTaskWorkspace(selectedTaskId);
    } catch (commentError) {
      setError(commentError.message);
    }
  }

  async function handleAddChecklistItem(event) {
    event.preventDefault();
    if (!selectedTaskId) {
      return;
    }

    try {
      await api.addTaskChecklistItem(selectedTaskId, { title: checklistDraft });
      setChecklistDraft("");
      setSuccess("Checklist mise a jour.");
      await refreshTaskWorkspace(selectedTaskId);
    } catch (checklistError) {
      setError(checklistError.message);
    }
  }

  async function handleToggleChecklistItem(item) {
    if (!selectedTaskId) {
      return;
    }

    try {
      await api.updateTaskChecklistItem(selectedTaskId, item.id, {
        title: item.title,
        isCompleted: !item.is_completed
      });
      await refreshTaskWorkspace(selectedTaskId);
    } catch (checklistError) {
      setError(checklistError.message);
    }
  }

  async function handleDeleteChecklistItem(itemId) {
    if (!selectedTaskId) {
      return;
    }

    try {
      await api.deleteTaskChecklistItem(selectedTaskId, itemId);
      await refreshTaskWorkspace(selectedTaskId);
    } catch (checklistError) {
      setError(checklistError.message);
    }
  }

  async function handleAddAttachment(event) {
    event.preventDefault();
    if (!selectedTaskId) {
      return;
    }

    try {
      await api.addTaskAttachment(selectedTaskId, attachmentForm);
      setAttachmentForm(defaultAttachment);
      setSuccess("Ressource ajoutee.");
      await refreshTaskWorkspace(selectedTaskId);
    } catch (attachmentError) {
      setError(attachmentError.message);
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    if (!selectedTaskId) {
      return;
    }

    try {
      await api.deleteTaskAttachment(selectedTaskId, attachmentId);
      await refreshTaskWorkspace(selectedTaskId);
    } catch (attachmentError) {
      setError(attachmentError.message);
    }
  }

  async function handleCreateSubtask(event) {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    try {
      await api.createTask({
        ...subtaskForm,
        parentTaskId: selectedTask.id,
        teamId: selectedTask.team_id,
        assigneeId: subtaskForm.assigneeId ? Number(subtaskForm.assigneeId) : null
      });
      setSubtaskForm(defaultSubtask);
      setSuccess("Sous-tache creee.");
      await refreshTaskWorkspace(selectedTask.id);
    } catch (subtaskError) {
      setError(subtaskError.message);
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = `${task?.title || ""} ${task?.description || ""} ${task?.team_name || ""} ${task?.assignee_name || ""}`
      .toLowerCase()
      .includes(filters.search.toLowerCase());

    const matchesStatus = !filters.status || task.status === filters.status;
    const matchesTeam = !filters.teamId || String(task.team_id || "") === filters.teamId;
    const matchesAssignee = !filters.assigneeId || String(task.assignee_id || "") === filters.assigneeId;

    return matchesSearch && matchesStatus && matchesTeam && matchesAssignee;
  });

  if (!canViewTasks) {
    return <AccessDenied message="Cet acteur ne dispose pas d'un espace taches." />;
  }

  function handleViewChange(view) {
    setActiveView(view);

    if (view === "calendar") {
      const focusDate =
        parseDateOnly(selectedTask?.due_date) ||
        parseDateOnly(filteredTasks.find((task) => task.due_date)?.due_date);

      if (focusDate) {
        setCalendarMonth(startOfMonth(focusDate));
      }
    }
  }

  const selectedTaskIndex = filteredTasks.findIndex((task) => task.id === selectedTaskId);
  const totalChecklistCompletion = selectedTask
    ? getProgress(toNumber(selectedTask.checklist_completed_count), toNumber(selectedTask.checklist_count))
    : 0;
  const selectedIssueKey = selectedTask ? getTaskIssueKey(selectedTask) : "";
  const activeViewLabel =
    taskViewOptions.find((view) => view.value === activeView)?.label.toLowerCase() || "liste";
  const taskStats = [
    { label: "Issues visibles", value: filteredTasks.length },
    { label: "Bloquees", value: filteredTasks.filter((task) => task.status === "blocked").length },
    { label: "En cours", value: filteredTasks.filter((task) => task.status === "in_progress").length },
    { label: "Terminees", value: filteredTasks.filter((task) => task.status === "done").length }
  ];

  const streamViewProps = {
    tasks: filteredTasks,
    selectedTaskId,
    canManageTasks,
    currentUserId: user?.id,
    onSelectTask: setSelectedTaskId,
    onEditTask: handleEdit,
    onDeleteTask: handleDelete,
    onStatusChange: handleStatusChange
  };

  let taskStreamView = null;

  if (activeView === "kanban") {
    taskStreamView = <TaskKanbanView {...streamViewProps} />;
  } else if (activeView === "calendar") {
    taskStreamView = (
      <TaskCalendarView
        {...streamViewProps}
        month={calendarMonth}
        onPreviousMonth={() => setCalendarMonth((current) => addMonths(current, -1))}
        onNextMonth={() => setCalendarMonth((current) => addMonths(current, 1))}
      />
    );
  } else if (activeView === "timeline") {
    taskStreamView = <TaskTimelineView {...streamViewProps} />;
  } else {
    taskStreamView = <TaskListView {...streamViewProps} />;
  }

  return (
    <section className="page-stack">
      <header className="hero-surface page-hero">
        <div className="hero-copy">
          <span className="section-kicker">Taches</span>
          <h2>Pilotage des taches</h2>
          <p className="page-copy">
            Creez, attribuez et suivez les taches depuis une interface plus directe,
            avec commentaires, checklistes et sous-taches quand c&apos;est utile.
          </p>
          <div className="hero-chip-row">
            <span className="feature-chip">Suivi</span>
            <span className="feature-chip">Checklist</span>
            <span className="feature-chip">Collaboration</span>
          </div>
        </div>

        <div className="hero-stat-stack">
          {taskStats.map((stat) => (
            <article className="mini-stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
      </header>

      {(error || success) ? (
        <section className="panel">
          {error ? <p className="error-text">{error}</p> : null}
          {success ? <p className="success-text">{success}</p> : null}
        </section>
      ) : null}

      <section className="panel toolbar-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-eyebrow">Filtres</span>
            <h3>File de travail</h3>
            <p>Affinez la vue par recherche, statut, equipe ou assigne.</p>
          </div>
          {selectedTask ? (
            <div className="toolbar-summary">
              <span className="issue-key">{selectedIssueKey}</span>
              <p>{selectedTask.title}</p>
            </div>
          ) : null}
        </div>

        <div className="form-row four">
          <label>
            Recherche
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Rechercher une issue"
            />
          </label>
          <label>
            Statut
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">Tous</option>
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatBadgeLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipe
            <select
              value={filters.teamId}
              onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))}
            >
              <option value="">Toutes</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigne
            <select
              value={filters.assigneeId}
              onChange={(event) => setFilters((current) => ({ ...current, assigneeId: event.target.value }))}
            >
              <option value="">Tous</option>
              {users.map((listedUser) => (
                <option key={listedUser.id} value={listedUser.id}>
                  {listedUser.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="task-hub">
        <div className="task-rail">
          {canManageTasks ? (
            <form className="panel form-panel task-composer" onSubmit={handleSubmit}>
              <div className="panel-heading">
                <div>
                  <span className="panel-eyebrow">Composer</span>
                  <h3>{editingTaskId ? "Modifier l'issue" : "Nouvelle issue"}</h3>
                  <p>Cadrez les informations essentielles avant diffusion a l&apos;equipe.</p>
                </div>
                {editingTaskId ? (
                  <button type="button" className="ghost-button" onClick={resetForm}>
                    Annuler
                  </button>
                ) : null}
              </div>

              <label>
                Titre
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label>
                Description
                <textarea
                  rows="5"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>

              <div className="form-row">
                <label>
                  Statut
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    {taskStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatBadgeLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priorite
                  <select
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  >
                    {taskPriorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatBadgeLabel(priority)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Echeance
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </label>
                <label>
                  Equipe
                  <select
                    value={form.teamId}
                    onChange={(event) => setForm((current) => ({ ...current, teamId: event.target.value }))}
                  >
                    <option value="">Selectionner</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Assigne
                <select
                  value={form.assigneeId}
                  onChange={(event) => setForm((current) => ({ ...current, assigneeId: event.target.value }))}
                >
                  <option value="">Selectionner</option>
                  {users.map((listedUser) => (
                    <option key={listedUser.id} value={listedUser.id}>
                      {listedUser.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="primary-button wide">
                {editingTaskId ? "Mettre a jour l'issue" : "Creer l'issue"}
              </button>
            </form>
          ) : (
            <section className="panel notice-panel task-composer">
              <span className="panel-eyebrow">Mon espace</span>
              <h3>Execution personnelle</h3>
              <p>Suivez vos issues et mettez a jour leur progression depuis ce cockpit.</p>
            </section>
          )}

          <section className="panel task-stream">
            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">Flux</span>
                <h3>Issues</h3>
                <p>{filteredTasks.length} issue(s) visibles dans la vue {activeViewLabel}.</p>
              </div>
              {selectedTask && selectedTaskIndex >= 0 ? (
                <span className="pill-label">
                  {selectedTaskIndex + 1}/{filteredTasks.length}
                </span>
              ) : null}
            </div>

            <div className="task-stream-toolbar">
              <div className="view-switcher" role="tablist" aria-label="Changer la vue des taches">
                {taskViewOptions.map((view) => (
                  <button
                    key={view.value}
                    type="button"
                    className={activeView === view.value ? "active" : ""}
                    aria-pressed={activeView === view.value}
                    onClick={() => handleViewChange(view.value)}
                  >
                    {view.label}
                  </button>
                ))}
              </div>

              {activeView === "calendar" ? (
                <div className="calendar-nav">
                  <button
                    type="button"
                    className="ghost-button compact"
                    onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                  >
                    Mois precedent
                  </button>
                  <span className="calendar-nav-label">{formatMonthLabel(calendarMonth)}</span>
                  <button
                    type="button"
                    className="ghost-button compact"
                    onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                  >
                    Mois suivant
                  </button>
                </div>
              ) : null}
            </div>

            {taskStreamView}
          </section>
        </div>

        <section className="panel task-focus">
          {detailLoading ? (
            <div className="screen-inline">Chargement de l&apos;issue...</div>
          ) : selectedTask ? (
            <TaskWorkspace
              task={selectedTask}
              users={users}
              canManageTasks={canManageTasks}
              commentDraft={commentDraft}
              checklistDraft={checklistDraft}
              attachmentForm={attachmentForm}
              subtaskForm={subtaskForm}
              selectedIssueKey={selectedIssueKey}
              totalChecklistCompletion={totalChecklistCompletion}
              setCommentDraft={setCommentDraft}
              setChecklistDraft={setChecklistDraft}
              setAttachmentForm={setAttachmentForm}
              setSubtaskForm={setSubtaskForm}
              onAddComment={handleAddComment}
              onAddChecklistItem={handleAddChecklistItem}
              onToggleChecklistItem={handleToggleChecklistItem}
              onDeleteChecklistItem={handleDeleteChecklistItem}
              onAddAttachment={handleAddAttachment}
              onDeleteAttachment={handleDeleteAttachment}
              onCreateSubtask={handleCreateSubtask}
            />
          ) : (
            <div className="screen-inline">Selectionnez une issue pour afficher son detail.</div>
          )}
        </section>
      </div>
    </section>
  );
}

function TaskListView(props) {
  const { tasks } = props;

  if (!tasks.length) {
    return <EmptyTaskView message="Aucune issue ne correspond aux filtres de cette liste." />;
  }

  return (
    <div className="task-stream-list">
      {tasks.map((task) => (
        <TaskListCard key={task.id} task={task} {...props} />
      ))}
    </div>
  );
}

function TaskKanbanView(props) {
  const { tasks } = props;

  if (!tasks.length) {
    return <EmptyTaskView message="Aucune issue a organiser dans ce board Kanban." />;
  }

  return (
    <div className="task-stream-body">
      <div className="kanban-board">
        {kanbanColumns.map((column) => {
          const columnTasks = [...tasks]
            .filter((task) => task.status === column.status)
            .sort(sortTasksForBoard);

          return (
            <section className="kanban-column" data-status={column.status} key={column.status}>
              <div className="kanban-column-head">
                <div>
                  <span className="panel-eyebrow">{column.label}</span>
                  <h4>{columnTasks.length} issue(s)</h4>
                </div>
                <StatusBadge value={column.status} />
              </div>

              <div className="kanban-column-list">
                {columnTasks.length ? (
                  columnTasks.map((task) => (
                    <TaskSurfaceCard key={task.id} task={task} variant="kanban" {...props} />
                  ))
                ) : (
                  <p className="meta-text">Aucune issue dans cette colonne.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCalendarView({
  tasks,
  month,
  selectedTaskId,
  canManageTasks,
  currentUserId,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onStatusChange
}) {
  if (!tasks.length) {
    return <EmptyTaskView message="Aucune issue a placer dans ce calendrier." />;
  }

  const monthStart = startOfMonth(month);
  const calendarDays = buildCalendarDays(monthStart);
  const tasksByDate = {};
  const unscheduledTasks = [];

  tasks.forEach((task) => {
    const dueDate = parseDateOnly(task.due_date);

    if (!dueDate) {
      unscheduledTasks.push(task);
      return;
    }

    const key = getDateKey(dueDate);
    tasksByDate[key] = [...(tasksByDate[key] || []), task].sort(sortTasksForBoard);
  });

  return (
    <div className="task-stream-body calendar-shell">
      <div className="calendar-grid-wrap">
        <div className="calendar-grid-shell">
          <div className="calendar-weekdays">
            {weekdayLabels.map((label) => (
              <span className="calendar-weekday" key={label}>
                {label}
              </span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayKey = getDateKey(day);
              const dayTasks = tasksByDate[dayKey] || [];

              return (
                <article
                  className={`calendar-day-cell ${!isSameMonth(day, monthStart) ? "is-outside" : ""} ${isSameDay(day, new Date()) ? "is-today" : ""}`}
                  key={dayKey}
                >
                  <div className="calendar-day-head">
                    <span className={`calendar-day-number ${!isSameMonth(day, monthStart) ? "is-muted" : ""}`}>
                      {day.getDate()}
                    </span>
                    <span className="calendar-day-count">
                      {dayTasks.length ? `${dayTasks.length} issue(s)` : ""}
                    </span>
                  </div>

                  <div className="calendar-day-list">
                    {dayTasks.length ? (
                      dayTasks.map((task) => (
                        <TaskSurfaceCard
                          key={task.id}
                          task={task}
                          variant="calendar"
                          selectedTaskId={selectedTaskId}
                          canManageTasks={canManageTasks}
                          currentUserId={currentUserId}
                          onSelectTask={onSelectTask}
                          onEditTask={onEditTask}
                          onDeleteTask={onDeleteTask}
                          onStatusChange={onStatusChange}
                        />
                      ))
                    ) : (
                      <p className="meta-text">Aucune issue.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {unscheduledTasks.length ? (
        <section className="calendar-unscheduled">
          <div className="section-head">
            <div>
              <h4>Sans echeance</h4>
              <p className="meta-text">Issues non positionnees dans le calendrier.</p>
            </div>
            <span className="pill-label subtle">{unscheduledTasks.length}</span>
          </div>

          <div className="calendar-unscheduled-list">
            {unscheduledTasks.sort(sortTasksForBoard).map((task) => (
              <TaskSurfaceCard
                key={task.id}
                task={task}
                variant="calendar"
                selectedTaskId={selectedTaskId}
                canManageTasks={canManageTasks}
                currentUserId={currentUserId}
                onSelectTask={onSelectTask}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TaskTimelineView({
  tasks,
  selectedTaskId,
  canManageTasks,
  currentUserId,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onStatusChange
}) {
  if (!tasks.length) {
    return <EmptyTaskView message="Aucune issue a projeter sur la timeline." />;
  }

  const timeline = buildTimelineModel(tasks);

  return (
    <div className="task-stream-body timeline-shell">
      <div className="timeline-scale">
        {timeline.markers.map((marker) => (
          <div
            className="timeline-scale-marker"
            key={getDateKey(marker)}
            style={{ left: `${getTimelinePosition(timeline.rangeStart, timeline.totalDays, marker)}%` }}
          >
            <span>{formatTimelineMarker(marker)}</span>
          </div>
        ))}
      </div>

      <div className="timeline-stack">
        {timeline.items.map((item) => {
          const rawLeft = getTimelinePosition(timeline.rangeStart, timeline.totalDays, item.startDate);
          const rawWidth = getTimelineWidth(timeline.totalDays, item.startDate, item.endDate);
          const width = Math.min(100, Math.max(rawWidth, 8));
          const left = Math.max(0, Math.min(100 - width, rawLeft));

          return (
            <article
              className={`timeline-task-row ${selectedTaskId === item.task.id ? "selected" : ""}`}
              key={item.task.id}
              onClick={() => onSelectTask(item.task.id)}
            >
              <div className="timeline-task-copy">
                <div className="card-heading">
                  <span className="issue-key">{getTaskIssueKey(item.task)}</span>
                  <StatusBadge value={item.task.status} />
                </div>

                <div className="task-surface-copy">
                  <strong>{item.task.title}</strong>
                  <p>{item.task.team_name || "Sans equipe"} - {item.task.assignee_name || "Non assigne"}</p>
                </div>

                <div className="row-badges">
                  <StatusBadge value={item.task.priority} />
                  <span className="pill-label subtle">
                    {item.dueDate ? `Echeance ${formatDate(item.dueDate)}` : "Sans echeance"}
                  </span>
                </div>

                <div className="timeline-task-range">
                  <span>Creee le {formatDate(item.startDate)}</span>
                  <span>
                    {item.dueDate ? `Fin cible ${formatDate(item.endDate)}` : "Date de fin non definie"}
                  </span>
                </div>

                <div className="task-card-footer">
                  <TaskStatusSelect
                    task={item.task}
                    canManageTasks={canManageTasks}
                    currentUserId={currentUserId}
                    onChange={onStatusChange}
                  />
                  <TaskCardActions task={item.task} canManageTasks={canManageTasks} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
                </div>
              </div>

              <div className="timeline-track-shell">
                <div className="timeline-track">
                  <div
                    className={`timeline-range-bar status-${item.task.status}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span>{item.dueDate ? formatDate(item.endDate) : "Sans echeance"}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EmptyTaskView({ message }) {
  return (
    <div className="task-stream-body">
      <div className="task-stream-empty">
        <p>{message}</p>
      </div>
    </div>
  );
}

function TaskListCard({
  task,
  selectedTaskId,
  canManageTasks,
  currentUserId,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onStatusChange
}) {
  return (
    <article
      className={`task-row ${selectedTaskId === task.id ? "selected" : ""}`}
      onClick={() => onSelectTask(task.id)}
    >
      <div className="task-row-top">
        <span className="issue-key">{getTaskIssueKey(task)}</span>
        <StatusBadge value={task.status} />
      </div>
      <strong>{task.title}</strong>
      <p>{task.team_name || "Sans equipe"} - {task.assignee_name || "Non assigne"}</p>
      <div className="task-row-meta">
        <StatusBadge value={task.priority} />
        <span>{task.comment_count} commentaires</span>
        <span>{task.subtask_count} sous-taches</span>
        <span>{task.due_date ? `Echeance ${formatDate(task.due_date)}` : "Sans echeance"}</span>
      </div>
      <div className="task-actions">
        <TaskStatusSelect
          task={task}
          canManageTasks={canManageTasks}
          currentUserId={currentUserId}
          onChange={onStatusChange}
        />
        <TaskCardActions task={task} canManageTasks={canManageTasks} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
      </div>
    </article>
  );
}

function TaskSurfaceCard({
  task,
  variant,
  selectedTaskId,
  canManageTasks,
  currentUserId,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onStatusChange
}) {
  return (
    <article
      className={`task-surface-card ${variant}-task-card ${selectedTaskId === task.id ? "selected" : ""}`}
      onClick={() => onSelectTask(task.id)}
    >
      <div className="card-heading">
        <span className="issue-key">{getTaskIssueKey(task)}</span>
        <StatusBadge value={task.status} />
      </div>

      <div className="task-surface-copy">
        <strong>{task.title}</strong>
        <p>{task.team_name || "Sans equipe"} - {task.assignee_name || "Non assigne"}</p>
      </div>

      <div className="task-surface-meta">
        <StatusBadge value={task.priority} />
        <span>{task.comment_count} commentaires</span>
        <span>{task.subtask_count} sous-taches</span>
      </div>

      <div className="task-card-footer">
        <TaskStatusSelect
          task={task}
          canManageTasks={canManageTasks}
          currentUserId={currentUserId}
          onChange={onStatusChange}
        />

        <div className="task-surface-meta">
          <span>{task.due_date ? formatDate(task.due_date) : "Sans echeance"}</span>
        </div>

        <TaskCardActions task={task} canManageTasks={canManageTasks} onEditTask={onEditTask} onDeleteTask={onDeleteTask} />
      </div>
    </article>
  );
}

function TaskStatusSelect({ task, canManageTasks, currentUserId, onChange }) {
  return (
    <select
      className="task-status-select"
      value={task.status}
      disabled={!canManageTasks && task.assignee_id !== currentUserId}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onChange(task.id, event.target.value);
      }}
    >
      {taskStatusOptions.map((status) => (
        <option key={status} value={status}>
          {formatBadgeLabel(status)}
        </option>
      ))}
    </select>
  );
}

function TaskCardActions({ task, canManageTasks, onEditTask, onDeleteTask }) {
  if (!canManageTasks) {
    return null;
  }

  return (
    <div className="task-inline-actions">
      <button
        type="button"
        className="ghost-button compact"
        onClick={(event) => {
          event.stopPropagation();
          onEditTask(task);
        }}
      >
        Modifier
      </button>
      <button
        type="button"
        className="ghost-button danger compact"
        onClick={(event) => {
          event.stopPropagation();
          onDeleteTask(task.id);
        }}
      >
        Supprimer
      </button>
    </div>
  );
}

function TaskWorkspace({
  task,
  users,
  canManageTasks,
  commentDraft,
  checklistDraft,
  attachmentForm,
  subtaskForm,
  selectedIssueKey,
  totalChecklistCompletion,
  setCommentDraft,
  setChecklistDraft,
  setAttachmentForm,
  setSubtaskForm,
  onAddComment,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onAddAttachment,
  onDeleteAttachment,
  onCreateSubtask
}) {
  const comments = ensureArray(task?.comments);
  const activity = ensureArray(task?.activity);
  const checklist = ensureArray(task?.checklist);
  const attachments = ensureArray(task?.attachments);
  const subtasks = ensureArray(task?.subtasks);

  return (
    <div className="task-detail-stack">
      <div className="breadcrumbs">
        <span>Portefeuille</span>
        <span>/</span>
        <span>{task.team_name || "General"}</span>
        <span>/</span>
        <span>{selectedIssueKey}</span>
      </div>

      <div className="issue-header-card">
        <div className="issue-header-copy">
          <span className="issue-key large">{selectedIssueKey}</span>
          <h3>{task.title}</h3>
          <p>{task.description || "Ajoutez une description detaillee pour cette issue."}</p>
        </div>

        <div className="issue-header-side">
          <div className="row-badges">
            <StatusBadge value={task.status} />
            <StatusBadge value={task.priority} />
          </div>
          <div className="person-card">
            <span className="avatar-badge">{getInitials(task.assignee_name)}</span>
            <div>
              <strong>{task.assignee_name || "Non assigne"}</strong>
              <span className="meta-text">Assigne principal</span>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid four">
        <article className="detail-card">
          <span>Equipe</span>
          <strong>{task.team_name || "Sans equipe"}</strong>
        </article>
        <article className="detail-card">
          <span>Reporter</span>
          <strong>{task.creator_name || "Non defini"}</strong>
        </article>
        <article className="detail-card">
          <span>Echeance</span>
          <strong>{formatDate(task.due_date)}</strong>
        </article>
        <article className="detail-card">
          <span>Checklist</span>
          <strong>{totalChecklistCompletion}%</strong>
        </article>
      </div>

      <div className="task-focus-grid">
        <div className="side-stack">
          <section className="task-detail-section">
            <div className="section-head">
              <h4>Contexte</h4>
              <span className="pill-label subtle">Description</span>
            </div>
            <div className="description-block">
              <p>{task.description || "Aucune description detaillee."}</p>
            </div>
          </section>

          <section className="task-detail-section">
            <div className="section-head">
              <div>
                <h4>Conversation</h4>
                <p className="meta-text">Utilisez `@emailhandle` pour mentionner un collegue.</p>
              </div>
            </div>

            <form className="inline-form" onSubmit={onAddComment}>
              <textarea
                rows="3"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Ajouter un commentaire..."
              />
              <div className="action-row align-end">
                <button type="submit" className="primary-button">
                  Commenter
                </button>
              </div>
            </form>

            <div className="activity-list">
              {comments.length ? (
                comments.map((comment) => {
                  const mentions = ensureArray(comment?.mentions);

                  return (
                  <article className="activity-card" key={comment.id}>
                    <div className="person-card">
                      <span className="avatar-badge soft">{getInitials(comment.author_name)}</span>
                      <div>
                        <strong>{comment.author_name || "Utilisateur inconnu"}</strong>
                        <span className="meta-text">{formatDateTime(comment.created_at)}</span>
                      </div>
                    </div>
                    <div className="comment-body">
                      <p>{renderComment(comment.content)}</p>
                    </div>
                    {mentions.length ? (
                      <div className="row-badges">
                        {mentions.map((mention) => (
                          <span className="pill-label subtle" key={mention.id}>
                            @{String(mention?.email || "user").split("@")[0]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                  );
                })
              ) : (
                <p className="meta-text">Aucun commentaire pour le moment.</p>
              )}
            </div>
          </section>

          <section className="task-detail-section">
            <div className="section-head">
              <div>
                <h4>Historique d'activite</h4>
                <p className="meta-text">Historique recent de l'issue.</p>
              </div>
            </div>

            <div className="activity-list">
              {activity.length ? (
                activity.map((entry) => (
                  <article className="activity-card timeline-card" key={entry.id}>
                    <div className="timeline-dot" />
                    <div>
                      <strong>{entry.actor_name || "Systeme"}</strong>
                      <p>{entry.message}</p>
                      <span className="meta-text">{formatDateTime(entry.created_at)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="meta-text">Aucune activite enregistree.</p>
              )}
            </div>
          </section>
        </div>

        <div className="side-stack">
          <section className="task-detail-section">
            <div className="section-head">
              <h4>Checklist</h4>
              <span className="pill-label subtle">
                {task.checklist_completed_count}/{task.checklist_count}
              </span>
            </div>

            <form className="inline-form inline-form-row" onSubmit={onAddChecklistItem}>
              <input
                value={checklistDraft}
                onChange={(event) => setChecklistDraft(event.target.value)}
                placeholder="Nouvel element"
              />
              <button type="submit" className="primary-button">
                Ajouter
              </button>
            </form>

            <div className="checklist-list">
              {checklist.length ? (
                checklist.map((item) => (
                  <article className="checklist-item" key={item.id}>
                    <label className="checklist-main">
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={() => onToggleChecklistItem(item)}
                      />
                      <span className={item.is_completed ? "checklist-done" : ""}>{item.title}</span>
                    </label>
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={() => onDeleteChecklistItem(item.id)}
                    >
                      Retirer
                    </button>
                  </article>
                ))
              ) : (
                <p className="meta-text">Checklist vide.</p>
              )}
            </div>
          </section>

          <section className="task-detail-section">
            <div className="section-head">
              <h4>Ressources</h4>
            </div>

            <form className="inline-form" onSubmit={onAddAttachment}>
              <input
                value={attachmentForm.label}
                onChange={(event) => setAttachmentForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Nom"
              />
              <input
                value={attachmentForm.url}
                onChange={(event) => setAttachmentForm((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://..."
              />
              <button type="submit" className="primary-button">
                Ajouter le lien
              </button>
            </form>

            <div className="resource-list">
              {attachments.length ? (
                attachments.map((attachment) => (
                  <article className="resource-card" key={attachment.id}>
                    <div>
                      <strong>{attachment.label}</strong>
                      <p>{attachment.url}</p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={() => onDeleteAttachment(attachment.id)}
                    >
                      Retirer
                    </button>
                  </article>
                ))
              ) : (
                <p className="meta-text">Aucune ressource liee.</p>
              )}
            </div>
          </section>

          <section className="task-detail-section">
            <div className="section-head">
              <h4>Sous-taches</h4>
            </div>

            {canManageTasks ? (
              <form className="inline-form" onSubmit={onCreateSubtask}>
                <input
                  value={subtaskForm.title}
                  onChange={(event) => setSubtaskForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Titre de la sous-tache"
                />
                <div className="form-row">
                  <select
                    value={subtaskForm.priority}
                    onChange={(event) => setSubtaskForm((current) => ({ ...current, priority: event.target.value }))}
                  >
                    {taskPriorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatBadgeLabel(priority)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={subtaskForm.assigneeId}
                    onChange={(event) => setSubtaskForm((current) => ({ ...current, assigneeId: event.target.value }))}
                  >
                    <option value="">Assigne</option>
                    {users.map((listedUser) => (
                      <option key={listedUser.id} value={listedUser.id}>
                        {listedUser.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="primary-button">
                  Creer la sous-tache
                </button>
              </form>
            ) : null}

            <div className="table-list">
              {subtasks.length ? (
                subtasks.map((subtask) => (
                  <article className="mini-task-card" key={subtask.id}>
                    <div className="card-heading">
                      <strong>{subtask.title}</strong>
                      <StatusBadge value={subtask.status} />
                    </div>
                    <p>{subtask.assignee_name || "Non assigne"}</p>
                    <div className="row-badges">
                      <StatusBadge value={subtask.priority} />
                      <span className="meta-text">{formatDate(subtask.due_date)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="meta-text">Aucune sous-tache rattachee.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function renderComment(content) {
  const normalizedContent = typeof content === "string" ? content : "";
  const parts = normalizedContent.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, index) =>
    part.startsWith("@") ? (
      <span className="mention-text" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
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
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");
}

function getTaskIssueKey(task) {
  const teamName = typeof task?.team_name === "string" ? task.team_name.trim() : "";
  return teamName ? `${teamName.slice(0, 3).toUpperCase()}-${task.id}` : `TSK-${task.id}`;
}

function sortTasksForBoard(left, right) {
  const leftDue = parseDateOnly(left.due_date);
  const rightDue = parseDateOnly(right.due_date);

  if (leftDue && rightDue && leftDue.getTime() !== rightDue.getTime()) {
    return leftDue - rightDue;
  }

  if (leftDue && !rightDue) {
    return -1;
  }

  if (!leftDue && rightDue) {
    return 1;
  }

  const leftCreated = parseDateTimeValue(left.created_at) || startOfDay(new Date());
  const rightCreated = parseDateTimeValue(right.created_at) || startOfDay(new Date());

  if (leftCreated.getTime() !== rightCreated.getTime()) {
    return rightCreated - leftCreated;
  }

  return right.id - left.id;
}

function buildCalendarDays(monthDate) {
  const firstDay = startOfWeek(startOfMonth(monthDate));
  const lastDay = endOfWeek(endOfMonth(monthDate));
  const days = [];

  let cursor = firstDay;

  while (cursor <= lastDay) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

function buildTimelineModel(tasks) {
  const items = [...tasks]
    .map((task) => {
      const startDate = parseDateTimeValue(task.created_at) || parseDateOnly(task.due_date) || startOfDay(new Date());
      const dueDate = parseDateOnly(task.due_date);
      const endDate = dueDate && diffInDays(startDate, dueDate) >= 0 ? dueDate : startDate;

      return {
        task,
        startDate,
        endDate,
        dueDate
      };
    })
    .sort((left, right) => {
      if (left.endDate.getTime() !== right.endDate.getTime()) {
        return left.endDate - right.endDate;
      }

      if (left.startDate.getTime() !== right.startDate.getTime()) {
        return left.startDate - right.startDate;
      }

      return left.task.id - right.task.id;
    });

  if (!items.length) {
    return {
      items: [],
      markers: [],
      totalDays: 1,
      rangeStart: startOfDay(new Date())
    };
  }

  let rangeStart = items[0].startDate;
  let rangeEnd = items[0].endDate;

  items.forEach((item) => {
    if (item.startDate < rangeStart) {
      rangeStart = item.startDate;
    }

    if (item.endDate > rangeEnd) {
      rangeEnd = item.endDate;
    }
  });

  if (diffInDays(rangeStart, rangeEnd) < 6) {
    rangeEnd = addDays(rangeStart, 6);
  }

  const totalDays = diffInDays(rangeStart, rangeEnd) + 1;
  const markerStep = totalDays > 120 ? 21 : totalDays > 70 ? 14 : 7;
  const markers = [];
  let marker = rangeStart;

  while (marker <= rangeEnd) {
    markers.push(marker);
    marker = addDays(marker, markerStep);
  }

  if (!isSameDay(markers[markers.length - 1], rangeEnd)) {
    markers.push(rangeEnd);
  }

  return {
    items,
    markers,
    totalDays,
    rangeStart
  };
}

function getTimelinePosition(rangeStart, totalDays, date) {
  if (totalDays <= 1) {
    return 0;
  }

  return (diffInDays(rangeStart, date) / totalDays) * 100;
}

function getTimelineWidth(totalDays, startDate, endDate) {
  return (Math.max(1, diffInDays(startDate, endDate) + 1) / totalDays) * 100;
}

function formatTimelineMarker(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function parseDateTimeValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry != null) : [];
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTaskSummary(task) {
  const source = task && typeof task === "object" ? task : {};

  return {
    ...source,
    comment_count: toNumber(source.comment_count),
    checklist_count: toNumber(source.checklist_count),
    checklist_completed_count: toNumber(source.checklist_completed_count),
    attachment_count: toNumber(source.attachment_count),
    subtask_count: toNumber(source.subtask_count)
  };
}

function normalizeTaskDetail(task) {
  const source = task && typeof task === "object" ? task : {};
  const normalizedTask = normalizeTaskSummary(source);

  return {
    ...normalizedTask,
    comments: ensureArray(source.comments),
    checklist: ensureArray(source.checklist),
    attachments: ensureArray(source.attachments),
    activity: ensureArray(source.activity),
    subtasks: ensureArray(source.subtasks)
  };
}

function diffInDays(startDate, endDate) {
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.round((endUtc - startUtc) / 86400000);
}

function isSameDay(left, right) {
  return getDateKey(left) === getDateKey(right);
}

function isSameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
