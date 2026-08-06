import { createContext, useContext, useState } from "react";
import { setToken } from "../api/client";

const AuthContext = createContext(null);
const USER_KEY = "pillpoints_user";

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  function login(tokenResponse) {
    setToken(tokenResponse.access_token);
    const userData = { id: tokenResponse.user_id, name: tokenResponse.name, role: tokenResponse.role };
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }

  // Merges profile changes (name, etc.) into the cached user object so the
  // header and anywhere else displaying it update immediately, without
  // needing a fresh login.
  function updateUser(partial) {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
