import { queryClickhouse } from "./client";

export interface CommitInfo {
  head_branch: string;
  head_sha: string;
  workflow_id: number;
  date: string;
}

export interface BenchmarkResult {
  timestamp: number;
  head_sha: string;
  head_branch: string;
  model_name: string;
  metric_name: string;
  value: string;
  test_name: string;
  device_name: string;
}

export interface FilterOptions {
  models: string[];
  metrics: string[];
  devices: string[];
}

const DEFAULT_REPO = "ibm/vllm-spyre";
const DEFAULT_BENCHMARK = "spyre_e2e_benchmark";

export async function listCommits(
  startTime: number,
  stopTime: number
): Promise<CommitInfo[]> {
  return queryClickhouse(
    `SELECT DISTINCT
      head_branch, head_sha, workflow_id,
      formatDateTime(fromUnixTimestamp(intDiv(timestamp, 1000)), '%Y-%m-%d %H:%i') AS date
    FROM run_metadata
    WHERE repo = '${DEFAULT_REPO}'
      AND timestamp >= ${startTime}
      AND timestamp < ${stopTime}
      AND benchmark_name = '${DEFAULT_BENCHMARK}'
      AND notEmpty(metric_name)
      AND notEmpty(device)
    ORDER BY date DESC`
  );
}

export async function getTimeSeriesData(
  startTime: number,
  stopTime: number,
  _repo?: string,
  _benchmarkName?: string,
  model: string = "",
  metric: string = ""
): Promise<BenchmarkResult[]> {
  let sql = `SELECT
      timestamp,
      head_sha,
      head_branch,
      tupleElement(model, 'name') AS model_name,
      tupleElement(metric, 'name') AS metric_name,
      extra['value'] AS value,
      tupleElement(benchmark, 'extra_info')['test_name'] AS test_name,
      tupleElement(runners, 'name') AS device_name
    FROM results_v3
    WHERE repo = '${DEFAULT_REPO}'
      AND timestamp >= ${startTime}
      AND timestamp < ${stopTime}
      AND tupleElement(benchmark, 'name') = '${DEFAULT_BENCHMARK}'`;

  if (model) sql += ` AND tupleElement(model, 'name') = '${model}'`;
  if (metric) sql += ` AND tupleElement(metric, 'name') = '${metric}'`;
  sql += ` ORDER BY timestamp`;

  return queryClickhouse(sql);
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const rows = await queryClickhouse(
    `SELECT DISTINCT
      tupleElement(model, 'name') AS model_name,
      tupleElement(metric, 'name') AS metric_name,
      tupleElement(runners, 'name') AS device_name
    FROM results_v3
    WHERE repo = '${DEFAULT_REPO}'
      AND tupleElement(benchmark, 'name') = '${DEFAULT_BENCHMARK}'`
  );

  return {
    models: [...new Set(rows.map((r: any) => r.model_name).filter(Boolean))],
    metrics: [...new Set(rows.map((r: any) => r.metric_name).filter(Boolean))],
    devices: [...new Set(rows.map((r: any) => r.device_name).filter(Boolean))],
  };
}

export async function getComparisonData(
  sha1: string,
  sha2: string
): Promise<{ left: BenchmarkResult[]; right: BenchmarkResult[] }> {
  const query = (sha: string) => `SELECT
      timestamp,
      head_sha,
      head_branch,
      tupleElement(model, 'name') AS model_name,
      tupleElement(metric, 'name') AS metric_name,
      extra['value'] AS value,
      tupleElement(benchmark, 'extra_info')['test_name'] AS test_name,
      tupleElement(runners, 'name') AS device_name
    FROM results_v3
    WHERE repo = '${DEFAULT_REPO}'
      AND tupleElement(benchmark, 'name') = '${DEFAULT_BENCHMARK}'
      AND head_sha = '${sha}'`;

  const [left, right] = await Promise.all([
    queryClickhouse(query(sha1)),
    queryClickhouse(query(sha2)),
  ]);

  return { left, right };
}
