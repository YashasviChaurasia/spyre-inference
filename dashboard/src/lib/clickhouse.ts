import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://clickhouse:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DB || "vllm_benchmarks",
  request_timeout: 30000,
});

const DEFAULT_REPO = "ibm/vllm-spyre";
const DEFAULT_BENCHMARK = "spyre_e2e_benchmark";

export { DEFAULT_REPO, DEFAULT_BENCHMARK };

export async function queryClickhouse(sql: string): Promise<any[]> {
  const result = await client.query({ query: sql, format: "JSONEachRow" });
  return result.json();
}
