export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { queryClickhouse, DEFAULT_REPO, DEFAULT_BENCHMARK } from "@/lib/clickhouse";

export async function GET() {
  const rows = await queryClickhouse(`
    SELECT DISTINCT
      tupleElement(model, 'name') AS model_name,
      tupleElement(metric, 'name') AS metric_name,
      tupleElement(runners, 'name') AS device_name
    FROM results_v3
    WHERE repo = '${DEFAULT_REPO}'
      AND tupleElement(benchmark, 'name') = '${DEFAULT_BENCHMARK}'
  `);

  return NextResponse.json({
    models: [...new Set(rows.map((r: any) => r.model_name).filter(Boolean))],
    metrics: [...new Set(rows.map((r: any) => r.metric_name).filter(Boolean))],
    devices: [...new Set(rows.map((r: any) => r.device_name).filter(Boolean))],
  });
}
