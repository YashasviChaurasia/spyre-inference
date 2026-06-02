export interface ClickhouseConfig {
  url: string;
  user: string;
  password: string;
  database: string;
}

function getMeta(name: string): string {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || "";
}

export function getClickhouseConfig(): ClickhouseConfig {
  return {
    url: getMeta("spyre-ch-url") || import.meta.env.VITE_CH_URL || "",
    user: getMeta("spyre-ch-user") || import.meta.env.VITE_CH_USER || "default",
    password: getMeta("spyre-ch-token") || import.meta.env.VITE_CH_PASSWORD || "",
    database: getMeta("spyre-ch-db") || import.meta.env.VITE_CH_DB || "vllm_benchmarks",
  };
}

export function getGithubClientId(): string {
  return getMeta("github-client-id") || import.meta.env.VITE_GITHUB_CLIENT_ID || "";
}
