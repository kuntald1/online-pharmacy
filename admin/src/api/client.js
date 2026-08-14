const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("pillpoints_admin_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("pillpoints_admin_token", token);
  else localStorage.removeItem("pillpoints_admin_token");
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path, body) => request(path, { method: "DELETE", body }),
};
