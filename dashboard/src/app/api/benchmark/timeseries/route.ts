export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { queryClickhouse, DEFAULT_REPO, DEFAULT_BENCHMARK } from "@/lib/clickhouse";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startTime = searchParams.get("startTime") || "0";
  const stopTime = searchParams.get("stopTime") || "9999999999999";
  const model = searchParams.get("model") || "";
  const metric = searchParams.get("metric") || "";

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

  const data = await queryClickhouse(sql);
  return NextResponse.json(data);
}
