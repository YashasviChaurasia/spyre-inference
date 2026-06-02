import { Box, FormControl, InputLabel, MenuItem, Paper, Select, Typography } from "@mui/material";
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
    label: `${c.head_sha.substring(0, 8)} (${c.head_branch} - ${c.date})`,
  }));

  // Build comparison table
  const metrics = [...new Set([...leftData, ...rightData].map((d) => d.metric))];
  const comparison = metrics.map((metric) => {
    const lVal = leftData.find((d) => d.metric === metric);
    const rVal = rightData.find((d) => d.metric === metric);
    const lNum = lVal ? parseFloat(lVal.value) : 0;
    const rNum = rVal ? parseFloat(rVal.value) : 0;
    const diff = lNum && rNum ? (((rNum - lNum) / lNum) * 100).toFixed(1) : "-";
    return { metric, left: lNum.toFixed(2), right: rNum.toFixed(2), diff };
  });

  return (
    <Paper sx={{ p: 2, bgcolor: "#16213e", mb: 2 }}>
      <Typography variant="h6" color="#fff" gutterBottom>
        Commit Comparison
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 250 }}>
          <InputLabel sx={{ color: "#aaa" }}>Left Commit</InputLabel>
          <Select value={leftSha} label="Left Commit" onChange={(e) => setLeftSha(e.target.value)} sx={{ color: "#fff" }}>
            {commitOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 250 }}>
          <InputLabel sx={{ color: "#aaa" }}>Right Commit</InputLabel>
          <Select value={rightSha} label="Right Commit" onChange={(e) => setRightSha(e.target.value)} sx={{ color: "#fff" }}>
            {commitOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {comparison.length > 0 && (
        <Box sx={{ overflow: "auto" }}>
          <table style={{ width: "100%", color: "#ccc", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Metric</th>
                <th style={{ textAlign: "right", padding: 8 }}>Left</th>
                <th style={{ textAlign: "right", padding: 8 }}>Right</th>
                <th style={{ textAlign: "right", padding: 8 }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.metric} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: 8 }}>{row.metric}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{row.left}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{row.right}</td>
                  <td style={{ padding: 8, textAlign: "right", color: row.diff.startsWith("-") ? "#2ecc71" : "#e94560" }}>
                    {row.diff}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Paper>
  );
}
