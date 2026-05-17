import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { getPermissionsForRole } from "../constants/permissions";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const rawUser = readStorageItem("wm_user");

    if (!rawUser) {
      return null;
    }

    const parsedUser = JSON.parse(rawUser);

    if (!parsedUser || typeof parsedUser !== "object") {
      removeStorageItem("wm_user");
      return null;
    }

    return parsedUser;
  } catch {
    removeStorageItem("wm_user");
    removeStorageItem("wm_token");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStorageItem("wm_token"));
  const [user, setUser] = useState(() => readStoredUser());
  const [authLoading, setAuthLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    api
      .me()
      .then((profile) => {
        if (!cancelled) {
          const normalizedUser = {
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email,
            role: profile.role,
            permissions: getPermissionsForRole(profile.role)
          };
          setUser(normalizedUser);
          writeStorageItem("wm_user", JSON.stringify(normalizedUser));
        }
      })
      .catch(() => {
        removeStorageItem("wm_token");
        removeStorageItem("wm_user");
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      authLoading,
      async login(credentials) {
        const result = await api.login(credentials);
        writeStorageItem("wm_token", result.token);
        writeStorageItem("wm_user", JSON.stringify(result.user));
        setToken(result.token);
        setUser({
          ...result.user,
          permissions: result.user.permissions || getPermissionsForRole(result.user.role)
        });
      },
      logout() {
        removeStorageItem("wm_token");
        removeStorageItem("wm_user");
        setToken(null);
        setUser(null);
      }
    }),
    [authLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

function readStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so UI remains usable.
  }
}

function removeStorageItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures so logout/cleanup can continue.
  }
}
