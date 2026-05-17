# App Scenarios (End-to-End)

Updated: 2026-05-17
Scope: frontend + backend + API + role access + error recovery

## 1) Product Scope

This app is a role-based work management platform with:

- Authentication (JWT session)
- Dashboard analytics + report export (CSV/JSON)
- Users management
- Teams management
- Tasks management with 4 views:
  - List
  - Kanban
  - Calendar
  - Timeline
- Task collaboration:
  - Comments + @mentions
  - Checklist
  - Attachments
  - Subtasks
- Responsive layout with desktop sidebar + mobile hamburger drawer

Main modules:

- Frontend: `frontend/src`
- Backend API: `backend/src`
- Database schema/seed: `database/schema.sql`, `database/seed.sql`

## 2) Roles and Permissions

Roles:

- `admin`
- `director`
- `manager`
- `team_lead`
- `hr`
- `employee`

Permission matrix:

| Role | Dashboard | Users | Manage Users | Teams | Manage Teams | Tasks | Manage Tasks | Update Own Task Status |
|---|---|---|---|---|---|---|---|---|
| admin | yes | yes | yes | yes | yes | yes | yes | no |
| director | yes | yes | no | yes | yes | yes | yes | no |
| manager | yes | yes | no | yes | yes | yes | yes | no |
| team_lead | yes | yes | no | yes | no | yes | yes | no |
| hr | yes | yes | yes | yes | no | no | no | no |
| employee | yes | no | no | yes | no | yes | no | yes |

Important scoping rules:

- `admin` and `director` have broad cross-team visibility.
- `hr` can see dashboard + users + teams, but not tasks page.
- `manager` can manage only teams they own (manager_id = self).
- `team_lead` can manage tasks in teams they manage/are member of, or tasks they created.
- `employee` can only change status of tasks assigned to them.

## 3) Global App Flow Scenarios

### S1 - Login Success

1. User opens app without token.
2. `LoginPage` is shown.
3. User submits email/password.
4. `POST /api/auth/login` returns `{ token, user }`.
5. Frontend stores:
   - `wm_token`
   - `wm_user`
6. App renders protected area (`Layout` + routed pages).

### S2 - Login Failure

1. Wrong credentials or missing fields.
2. Backend returns `400` or `401`.
3. UI shows inline error message.

### S3 - Session Rehydration

1. App reloads with stored token.
2. `AuthContext` calls `GET /api/auth/me`.
3. If valid token:
   - user profile refreshed
   - role permissions rebuilt
4. If invalid/expired token:
   - storage cleared
   - user redirected to login state.

### S4 - Corrupted Local Storage

1. `wm_user` parse fails.
2. App auto-clears `wm_user` + `wm_token`.
3. Falls back to unauthenticated flow.

### S5 - Runtime UI Crash Recovery

1. React runtime error occurs.
2. `AppErrorBoundary` catches the error.
3. One-time auto recovery:
   - clear local keys `wm_token`, `wm_user`, `shell.sidebar.compact`
   - set session flag `wm_ui_recovery_attempted`
   - reload page
4. If still failing, fallback UI shows "Reparer et recharger" button.

### S6 - Navigation and Responsive Sidebar

Desktop (`>=1080px`):

- Sidebar is sticky.
- Toggle switches expanded/compact mode.
- Compact preference stored in `shell.sidebar.compact`.

Mobile (`<=1079px`):

- Sidebar is off-canvas drawer.
- Hamburger in top bar opens drawer.
- Backdrop click or `Escape` closes drawer.
- Body scroll locks while drawer is open.

## 4) Route Access Scenarios

Protected routes:

- `/` dashboard
- `/teams`
- `/tasks`
- `/users`

Behavior:

- User without required permission is redirected to role default route.
- Dashboard route itself can show `AccessDenied` if role cannot view dashboard.
- Unknown route redirects to role default route.

Default route order:

1. dashboard (`/`) if allowed
2. tasks (`/tasks`) if no dashboard access but tasks allowed
3. teams (`/teams`)
4. users (`/users`)

## 5) Dashboard Scenarios

Page: `DashboardPage.jsx`
API:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/report?format=csv|json`

### S7 - Summary Load

1. Page mounts.
2. Summary API returns:
   - stats
   - recent tasks
   - status breakdown
   - priority breakdown
   - team performance
   - role distribution
   - overdue/upcoming tasks
3. UI renders KPI cards, analytics panels, and activity list.

### S8 - Export Report

1. User clicks CSV or JSON export.
2. Frontend downloads blob file with backend filename.
3. Success message shown in UI.
4. On failure, action error shown.

### S9 - Scoped Analytics by Role

- Admin/director: broad/global.
- HR: dashboard still visible (not blocked by tasks-page restriction).
- Manager/team_lead/employee: dashboard data scoped by their task/team visibility rules.

## 6) Users Scenarios

Page: `UsersPage.jsx`
API:

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### S10 - View Users

1. Authorized role opens Users page.
2. User list loads with computed counters:
   - team count
   - managed team count
   - assigned task count
3. Search filters by name/email/role.

### S11 - Create User

1. Manage-capable actor submits form.
2. Backend validates required fields and role.
3. Role assignment policy:
   - admin: can assign all roles
   - hr: can assign `employee`, `hr`, `team_lead`, `manager`
4. User created and list refreshes.

### S12 - Update User

1. Actor edits existing user.
2. Password is optional in update flow.
3. If password blank, old hash is kept.
4. Role assignment restrictions still enforced.

### S13 - Delete User

1. Actor confirms deletion.
2. Backend blocks deleting own account.
3. On success returns `204`, UI refreshes list.

### S14 - Users Permission Failures

- Missing `view_users` -> access denied route/page behavior.
- Missing `manage_users` -> form actions hidden or forbidden by API.
- Duplicate email -> `409`.

## 7) Teams Scenarios

Page: `TeamsPage.jsx`
API:

- `GET /api/teams`
- `POST /api/teams`
- `PUT /api/teams/:id`
- `DELETE /api/teams/:id`

### S15 - View Teams

1. Teams load with:
   - manager
   - members
   - member count
   - total/completed/open tasks
2. Search filters by team name/description/manager.

### S16 - Create Team

1. Manage-capable actor submits team form.
2. Manager rule:
   - manager cannot create team assigned to another manager.
3. Members are deduplicated and manager is auto-included in members.

### S17 - Update Team

1. Team update allowed for:
   - admin/director
   - manager only for teams they manage
2. Team members are replaced by submitted set (+ manager).

### S18 - Delete Team

1. Actor confirms delete.
2. Same manage permissions as update.
3. On success `204`.

### S19 - Team Permission Failures

- Missing `view_teams` -> denied.
- Missing `manage_teams` -> read-only mode in UI.
- Manager updating non-owned team -> `403`.

## 8) Tasks Scenarios

Page: `TasksPage.jsx`
APIs:

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/comments`
- `POST /api/tasks/:id/checklist`
- `PATCH /api/tasks/:id/checklist/:itemId`
- `DELETE /api/tasks/:id/checklist/:itemId`
- `POST /api/tasks/:id/attachments`
- `DELETE /api/tasks/:id/attachments/:attachmentId`

### S20 - Tasks Page Load

1. Load task summaries + teams + users (users only when role can view users).
2. First task auto-selected.
3. Detail panel fetches selected task full detail:
   - comments
   - checklist
   - attachments
   - activity logs
   - subtasks

### S21 - Task Views (List/Kanban/Calendar/Timeline)

User can switch between 4 views:

- List: classic stream cards
- Kanban: grouped by `todo`, `in_progress`, `done`, `blocked`
- Calendar: by `due_date`, plus "unscheduled" section
- Timeline: date range bars from creation to due date

Filters apply to all views:

- search text
- status
- team
- assignee

### S22 - Create/Update/Delete Task

Create/Update allowed to `manage_tasks` actors.

Validation:

- title required
- valid status and priority enums
- task cannot be its own subtask

Role constraints:

- manager can create tasks only in teams they manage
- team_lead can create tasks only in accessible teams

Delete:

- allowed only when `canManageTask` rule passes

### S23 - Status Update

Endpoint: `PATCH /tasks/:id/status` (requires `view_tasks`)

Policy:

- employee: only assigned tasks
- other non-admin/director:
  - can update if they can manage task
  - or if they are assignee

Frontend also disables status select when actor cannot update that card.

### S24 - Comments and Mentions

1. User with task access posts comment.
2. Mentions parsed from `@token`.
3. Mention token can match:
   - email handle (before `@`)
   - full name without spaces
4. Mention links stored in `task_comment_mentions`.
5. Activity log entry is created.

### S25 - Checklist

1. Add checklist item (title required).
2. Toggle completion updates `is_completed`, `completed_by`, `completed_at`.
3. Delete checklist item.
4. All actions create activity log records.

### S26 - Attachments

1. Add attachment with label + URL.
2. URL must be valid `http` or `https`.
3. Delete attachment.
4. Both actions recorded in activity log.

### S27 - Subtasks

1. Create task with `parentTaskId`.
2. Parent access is validated.
3. Subtasks appear in detail panel and count in summary cards.

### S28 - Task Access Scope

- Admin/director: broad task access.
- HR: tasks list is empty and tasks page is not allowed by permission.
- Others: task visibility from combination of:
  - assignee = self
  - creator = self
  - task team in accessible teams

## 9) Data and Cascade Scenarios (DB)

Key cascade behavior from schema:

- Deleting team removes `team_members` links.
- Deleting task cascades:
  - comments
  - mentions
  - checklist items
  - activity logs
  - attachments
  - subtasks (via `parent_task_id ON DELETE CASCADE`)
- Deleting user:
  - manager/assignee/creator/completed_by/uploaded_by becomes `NULL` where configured
  - team membership rows are removed (`team_members` cascade)

## 10) API Error Scenarios

Common patterns:

- `401`:
  - missing token
  - invalid/expired token
- `403`:
  - missing permission
  - role cannot perform scoped action
- `404`:
  - route not found
  - entity not found
- `409`:
  - duplicate unique values (email/team name)
- `500`:
  - unhandled backend error

Frontend behavior:

- API client converts error payload to thrown `Error(message)`.
- Pages display error inline (`error-text`) and preserve current context.

## 11) End-to-End Persona Journeys

### P1 - Admin Journey

Login -> Dashboard analytics -> create users -> create/update teams -> create tasks -> track through Kanban/Calendar/Timeline -> export report.

### P2 - HR Journey

Login -> Dashboard overview -> manage users -> view teams.

No tasks page access.

### P3 - Manager Journey

Login -> Dashboard scoped metrics -> view users -> manage owned teams -> manage tasks for owned teams -> monitor execution views.

### P4 - Team Lead Journey

Login -> Dashboard -> view users/teams -> manage team tasks -> update status -> collaborate via comments/checklist/attachments/subtasks.

### P5 - Employee Journey

Login -> Dashboard -> teams -> tasks page (read/collab) -> update only own assigned task status.

## 12) Practical Acceptance Checklist

- Login works and persists across refresh.
- Invalid token auto-logout path works.
- Route access obeys permission matrix.
- Sidebar behaves correctly desktop/mobile.
- Dashboard export downloads CSV/JSON.
- Users CRUD obeys role assignment rules.
- Teams CRUD obeys ownership rules.
- Tasks:
  - all 4 views render correctly
  - filtering works
  - detail panel syncs with selection
  - status restrictions are enforced
  - comments/checklist/attachments/subtasks function correctly
- Error boundary recovery clears local session and reloads.

