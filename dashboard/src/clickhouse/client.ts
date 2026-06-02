import { getClickhouseConfig } from "../config";

export async function queryClickhouse(sql: string): Promise<any[]> {
  const config = getClickhouseConfig();

  if (!config.url) {
    throw new Error("ClickHouse URL not configured");
  }

  const url = config.url + "/?user=" + config.user +
    "&password=" + config.password +
    "&database=" + config.database +
    "&default_format=JSONEachRow";

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

  return text.trim().split("\n").map((line) => JSON.parse(line));
}
