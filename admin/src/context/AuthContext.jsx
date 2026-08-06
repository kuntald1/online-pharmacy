import { createContext, useContext, useEffect, useState } from "react";
import { api, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pillpoints_admin_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/api/auth/me")
      .then((me) => {
        if (me.role !== "admin") throw new Error("Not an admin account");
        setUser(me);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(phone, password) {
    const data = await api.post("/api/auth/login", { phone, password });
    if (data.role !== "admin") {
      throw new Error("This login isn't an admin account");
    }
    setToken(data.access_token);
    setUser({ id: data.user_id, name: data.name, role: data.role });
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
