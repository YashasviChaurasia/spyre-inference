export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { queryClickhouse, DEFAULT_REPO, DEFAULT_BENCHMARK } from "@/lib/clickhouse";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startTime = searchParams.get("startTime") || "0";
  const stopTime = searchParams.get("stopTime") || "9999999999999";

  const data = await queryClickhouse(`
    SELECT DISTINCT
      head_branch, head_sha, workflow_id,
      formatDateTime(fromUnixTimestamp(intDiv(timestamp, 1000)), '%Y-%m-%d %H:%i') AS date
    FROM run_metadata
    WHERE repo = '${DEFAULT_REPO}'
      AND timestamp >= ${startTime}
      AND timestamp < ${stopTime}
      AND benchmark_name = '${DEFAULT_BENCHMARK}'
      AND notEmpty(metric_name)
      AND notEmpty(device)
    ORDER BY date DESC
  `);

  return NextResponse.json(data);
}
