import { getClickhouseConfig } from "../config";

function formatParamValue(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((v) =>
      typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`
    );
    return `[${items.join(",")}]`;
  }
  if (typeof value === "number") return String(value);
  return String(value);
}

export async function queryClickhouse(
  sql: string,
  params: Record<string, unknown> = {}
): Promise<any[]> {
  const config = getClickhouseConfig();

  if (!config.url) {
    throw new Error("ClickHouse URL not configured");
  }

  // Auto-default any params referenced in SQL but not in params object
  const templateMatches = sql.matchAll(/\{(\w+):\s*([^}]+)\}/g);
  for (const match of templateMatches) {
    const name = match[1];
    if (!(name in params)) {
      const type = match[2].trim();
      params[name] = type.startsWith("Array") ? [] : "";
    }
  }

  // Build URL via string concatenation (avoids URLSearchParams encoding issues)
  let url =
    config.url +
    "/?user=" + config.user +
    "&password=" + config.password +
    "&database=" + config.database +
    "&default_format=JSONEachRow";

  for (const [key, value] of Object.entries(params)) {
    url += "&param_" + key + "=" + encodeURIComponent(formatParamValue(value ?? ""));
  }

  const response = await fetch(url, {
    method: "POST",
    body: sql,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ClickHouse error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const text = await response.text();
  if (!text.trim()) return [];

  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
