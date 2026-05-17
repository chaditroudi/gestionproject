const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getAuthHeaders(customHeaders = {}) {
  const token = readStorageItem("wm_token");
  const headers = {
    ...customHeaders
  };

  if (!("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function readStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const headers = getAuthHeaders(options.headers || {});

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && payload.message) ||
      (typeof payload === "string" && payload.trim()) ||
      "Une erreur est survenue.";
    throw new Error(message);
  }

  return payload;
}

function extractFilename(response, fallback) {
  const header = response.headers.get("content-disposition") || "";
  const match = header.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

async function download(path, fallbackFilename) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: getAuthHeaders({ Accept: "text/csv, application/json" })
  });

  if (!response.ok) {
    const payload = await parseResponsePayload(response);
    const message =
      (payload && typeof payload === "object" && payload.message) ||
      (typeof payload === "string" && payload.trim()) ||
      "Une erreur est survenue.";
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = extractFilename(response, fallbackFilename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  login: (credentials) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    }),
  me: () => request("/auth/me"),
  getUsers: () => request("/users"),
  createUser: (data) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateUser: (id, data) =>
    request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteUser: (id) =>
    request(`/users/${id}`, {
      method: "DELETE"
    }),
  getTeams: () => request("/teams"),
  createTeam: (data) =>
    request("/teams", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateTeam: (id, data) =>
    request(`/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteTeam: (id) =>
    request(`/teams/${id}`, {
      method: "DELETE"
    }),
  getTasks: () => request("/tasks"),
  getTaskById: (id) => request(`/tasks/${id}`),
  createTask: (data) =>
    request("/tasks", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateTask: (id, data) =>
    request(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  updateTaskStatus: (id, status) =>
    request(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  addTaskComment: (id, data) =>
    request(`/tasks/${id}/comments`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  addTaskChecklistItem: (id, data) =>
    request(`/tasks/${id}/checklist`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateTaskChecklistItem: (id, itemId, data) =>
    request(`/tasks/${id}/checklist/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteTaskChecklistItem: (id, itemId) =>
    request(`/tasks/${id}/checklist/${itemId}`, {
      method: "DELETE"
    }),
  addTaskAttachment: (id, data) =>
    request(`/tasks/${id}/attachments`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  deleteTaskAttachment: (id, attachmentId) =>
    request(`/tasks/${id}/attachments/${attachmentId}`, {
      method: "DELETE"
    }),
  deleteTask: (id) =>
    request(`/tasks/${id}`, {
      method: "DELETE"
    }),
  getDashboardSummary: () => request("/dashboard/summary"),
  downloadDashboardReport: (format = "csv") =>
    download(`/dashboard/report?format=${format}`, `rapport-dashboard.${format}`)
};
