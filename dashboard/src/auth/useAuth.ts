import { useState, useEffect } from "react";
import { getGithubClientId } from "../config";

interface AuthState {
  isAuthenticated: boolean;
  user: { login: string; avatar_url: string } | null;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(
    sessionStorage.getItem("gh_token")
  );
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);

  useEffect(() => {
    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !token) {
      // Exchange code for token via our proxy endpoint
      exchangeCode(code).then((t) => {
        if (t) {
          sessionStorage.setItem("gh_token", t);
          setToken(t);
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setUser({ login: data.login, avatar_url: data.avatar_url });
          else {
            sessionStorage.removeItem("gh_token");
            setToken(null);
          }
        })
        .catch(() => {
          sessionStorage.removeItem("gh_token");
          setToken(null);
        });
    }
  }, [token]);

  const login = () => {
    const clientId = getGithubClientId();
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
  };

  const logout = () => {
    sessionStorage.removeItem("gh_token");
    setToken(null);
    setUser(null);
  };

  return {
    isAuthenticated: !!token && !!user,
    user,
    login,
    logout,
  };
}

async function exchangeCode(code: string): Promise<string | null> {
  // In production, this would go through a server-side proxy
  // For now, use the /api/github-oauth endpoint on the same origin
  try {
    const res = await fetch(`/api/github-oauth?code=${code}`);
    if (res.ok) {
      const data = await res.json();
      return data.access_token;
    }
  } catch {
    // Fallback: if no server proxy, skip auth for development
    console.warn("OAuth exchange failed — running in dev mode without auth");
  }
  return null;
}
