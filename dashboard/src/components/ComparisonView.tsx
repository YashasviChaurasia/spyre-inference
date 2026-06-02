import { Box, FormControl, InputLabel, MenuItem, Paper, Select, Typography, Button } from "@mui/material";
import { CommitInfo, BenchmarkResult, getComparisonData } from "../clickhouse/queries";
import { useEffect, useState } from "react";

interface Props {
  commits: CommitInfo[];
}

export function ComparisonView({ commits }: Props) {
  const [leftSha, setLeftSha] = useState("");
  const [rightSha, setRightSha] = useState("");
  const [leftData, setLeftData] = useState<BenchmarkResult[]>([]);
  const [rightData, setRightData] = useState<BenchmarkResult[]>([]);

  useEffect(() => {
    if (leftSha && rightSha) {
      getComparisonData(leftSha, rightSha).then(({ left, right }) => {
        setLeftData(left);
        setRightData(right);
      });
    }
  }, [leftSha, rightSha]);

  const commitOptions = commits.map((c) => ({
    value: c.head_sha,
    label: `${c.head_sha.substring(0, 7)} \u2022 ${c.date}`,
  }));

  // Build pivot: rows = model+test_name, columns = metrics
  const allMetrics = [...new Set([...leftData, ...rightData].map((d) => d.metric_name))].sort();
  const allModels = [...new Set([...leftData, ...rightData].map((d) => d.model_name))];

  const rows = allModels.map((model) => {
    const leftByMetric: Record<string, number> = {};
    const rightByMetric: Record<string, number> = {};

    leftData.filter((d) => d.model_name === model).forEach((d) => {
      leftByMetric[d.metric_name] = parseFloat(d.value) || 0;
    });
    rightData.filter((d) => d.model_name === model).forEach((d) => {
      rightByMetric[d.metric_name] = parseFloat(d.value) || 0;
    });

    return { model_name: model, leftByMetric, rightByMetric };
  });

  const formatChange = (left: number, right: number) => {
    if (!left || !right) return { text: "-", color: "#555" };
    const pct = ((right - left) / left) * 100;
    // For latency/ttft/tpot: lower is better (green if negative)
    // For throughput/rps: higher is better (green if positive)
    const color = pct === 0 ? "#555" : pct < 0 ? "#4caf50" : "#f44336";
    return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, color };
  };

  return (
    <Paper sx={{ p: 2, bgcolor: "#141414", border: "1px solid #1e1e1e", mb: 2 }}>
      <Typography variant="h6" color="#e0e0e0" gutterBottom>
        Comparison Table
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel sx={{ color: "#555" }}>Base (left)</InputLabel>
          <Select value={leftSha} label="Base (left)" onChange={(e) => setLeftSha(e.target.value)}
            sx={{ color: "#ccc", fontSize: "0.8rem", ".MuiOutlinedInput-notchedOutline": { borderColor: "#2a2a2a" } }}>
            {commitOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography sx={{ color: "#555" }}>vs</Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel sx={{ color: "#555" }}>Compare (right)</InputLabel>
          <Select value={rightSha} label="Compare (right)" onChange={(e) => setRightSha(e.target.value)}
            sx={{ color: "#ccc", fontSize: "0.8rem", ".MuiOutlinedInput-notchedOutline": { borderColor: "#2a2a2a" } }}>
            {commitOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {leftSha && rightSha && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" sx={{ color: "#5b9bd5", textTransform: "none", fontSize: "0.75rem" }}>
              view json
            </Button>
            <Button size="small" sx={{ color: "#5b9bd5", textTransform: "none", fontSize: "0.75rem" }}>
              Download CSV
            </Button>
          </Box>
        )}
      </Box>

      {leftSha && rightSha && (
        <Typography variant="caption" sx={{ color: "#666", display: "block", mb: 1 }}>
          {leftSha.substring(0, 7)} &rarr; {rightSha.substring(0, 7)}
        </Typography>
      )}

      {rows.length > 0 && (
        <Box sx={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#777", fontWeight: 600 }}>Model</th>
                {allMetrics.map((m) => (
                  <th key={m} style={{ textAlign: "right", padding: "8px 8px", color: "#777", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.model_name} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "8px 12px", color: "#5b9bd5" }}>{row.model_name}</td>
                  {allMetrics.map((metric) => {
                    const left = row.leftByMetric[metric];
                    const right = row.rightByMetric[metric];
                    const { text, color } = formatChange(left, right);
                    const displayVal = right ? right.toFixed(2) : left ? left.toFixed(2) : "-";

                    return (
                      <td key={metric} style={{ textAlign: "right", padding: "8px 8px", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#ccc" }}>{displayVal}</span>
                        {left && right && left !== right && (
                          <span style={{ color, marginLeft: 4, fontSize: "0.72rem", fontWeight: 600 }}>
                            {text}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Paper>
  );
}
