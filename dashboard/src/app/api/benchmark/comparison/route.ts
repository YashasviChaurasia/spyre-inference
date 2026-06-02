export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { queryClickhouse, DEFAULT_REPO, DEFAULT_BENCHMARK } from "@/lib/clickhouse";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const left = searchParams.get("left") || "";
  const right = searchParams.get("right") || "";

  if (!left || !right) {
    return NextResponse.json({ error: "Both left and right commit SHAs required" }, { status: 400 });
  }

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

  const [leftData, rightData] = await Promise.all([
    queryClickhouse(query(left)),
    queryClickhouse(query(right)),
  ]);

  return NextResponse.json({ left: leftData, right: rightData });
}
