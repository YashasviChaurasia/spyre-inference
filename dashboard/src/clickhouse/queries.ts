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
  model: string;
  metric: string;
  value: string;
  test_name: string;
  device: string;
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
  stopTime: number,
  repo: string = DEFAULT_REPO,
  benchmarkName: string = DEFAULT_BENCHMARK
): Promise<CommitInfo[]> {
  return queryClickhouse(
    `SELECT DISTINCT
      head_branch, head_sha, workflow_id,
      toStartOfHour(fromUnixTimestamp(intDiv(timestamp, 1000))) AS date
    FROM run_metadata
    WHERE repo = {repo:String}
      AND timestamp >= {startTime:Int64}
      AND timestamp < {stopTime:Int64}
      AND (benchmark_name = {benchmarkName:String} OR {benchmarkName:String} = '')
      AND notEmpty(metric_name)
      AND notEmpty(device)
    GROUP BY head_branch, head_sha, workflow_id, date
    ORDER BY date DESC`,
    { repo, startTime, stopTime, benchmarkName }
  );
}

export async function getTimeSeriesData(
  startTime: number,
  stopTime: number,
  repo: string = DEFAULT_REPO,
  benchmarkName: string = DEFAULT_BENCHMARK,
  model: string = "",
  metric: string = ""
): Promise<BenchmarkResult[]> {
  return queryClickhouse(
    `SELECT
      timestamp,
      head_sha,
      head_branch,
      tupleElement(model, 'name') AS model,
      tupleElement(metric, 'name') AS metric,
      extra['value'] AS value,
      tupleElement(benchmark, 'extra_info')['test_name'] AS test_name,
      tupleElement(runners, 'name') AS device
    FROM results_v3
    WHERE repo = {repo:String}
      AND timestamp >= {startTime:Int64}
      AND timestamp < {stopTime:Int64}
      AND tupleElement(benchmark, 'name') = {benchmarkName:String}
      AND (tupleElement(model, 'name') = {model:String} OR {model:String} = '')
      AND (tupleElement(metric, 'name') = {metric:String} OR {metric:String} = '')
    ORDER BY timestamp`,
    { repo, startTime, stopTime, benchmarkName, model, metric }
  );
}

export async function getFilterOptions(
  repo: string = DEFAULT_REPO,
  benchmarkName: string = DEFAULT_BENCHMARK
): Promise<FilterOptions> {
  const rows = await queryClickhouse(
    `SELECT DISTINCT
      tupleElement(model, 'name') AS model,
      tupleElement(metric, 'name') AS metric,
      tupleElement(runners, 'name') AS device
    FROM results_v3
    WHERE repo = {repo:String}
      AND tupleElement(benchmark, 'name') = {benchmarkName:String}`,
    { repo, benchmarkName }
  );

  return {
    models: [...new Set(rows.map((r) => r.model).filter(Boolean))],
    metrics: [...new Set(rows.map((r) => r.metric).filter(Boolean))],
    devices: [...new Set(rows.map((r) => r.device).filter(Boolean))],
  };
}

export async function getComparisonData(
  sha1: string,
  sha2: string,
  repo: string = DEFAULT_REPO,
  benchmarkName: string = DEFAULT_BENCHMARK
): Promise<{ left: BenchmarkResult[]; right: BenchmarkResult[] }> {
  const query = `SELECT
      timestamp,
      head_sha,
      head_branch,
      tupleElement(model, 'name') AS model,
      tupleElement(metric, 'name') AS metric,
      extra['value'] AS value,
      tupleElement(benchmark, 'extra_info')['test_name'] AS test_name,
      tupleElement(runners, 'name') AS device
    FROM results_v3
    WHERE repo = {repo:String}
      AND tupleElement(benchmark, 'name') = {benchmarkName:String}
      AND head_sha = {sha:String}`;

  const [left, right] = await Promise.all([
    queryClickhouse(query, { repo, benchmarkName, sha: sha1 }),
    queryClickhouse(query, { repo, benchmarkName, sha: sha2 }),
  ]);

  return { left, right };
}
