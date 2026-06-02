import { Box, Typography, FormControl, Select, MenuItem, Chip } from "@mui/material";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { ComparisonView } from "./ComparisonView";
import { DataTable } from "./DataTable";
import { CommitInfo, BenchmarkResult } from "../clickhouse/queries";
import { useState } from "react";

interface Props {
  data: BenchmarkResult[];
  commits: CommitInfo[];
  selectedBranch: string;
}

export function MainContent({ data, commits, selectedBranch }: Props) {
  const [leftCommit, setLeftCommit] = useState("");
  const [rightCommit, setRightCommit] = useState("");

  const filteredCommits = selectedBranch
    ? commits.filter((c) => c.head_branch === selectedBranch)
    : commits;

  const filteredData = selectedBranch
    ? data.filter((d) => d.head_branch === selectedBranch)
    : data;

  return (
    <Box>
      {/* Commit Range Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "#777" }}>
          Commit Range:
        </Typography>
        <Typography variant="body2" sx={{ color: "#999" }}>
          {selectedBranch || "main"}({selectedBranch || "main"}):
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select value={leftCommit} displayEmpty onChange={(e) => setLeftCommit(e.target.value)}
            sx={{ color: "#ccc", fontSize: "0.78rem", bgcolor: "#181818", ".MuiOutlinedInput-notchedOutline": { borderColor: "#2a2a2a" } }}>
            <MenuItem value="">lbl-left</MenuItem>
            {filteredCommits.map((c) => (
              <MenuItem key={c.head_sha} value={c.head_sha}>
                {c.head_sha.substring(0, 7)} &bull; {c.date}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" sx={{ color: "#999" }}>
          {selectedBranch || "main"}({selectedBranch || "main"}):
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select value={rightCommit} displayEmpty onChange={(e) => setRightCommit(e.target.value)}
            sx={{ color: "#ccc", fontSize: "0.78rem", bgcolor: "#181818", ".MuiOutlinedInput-notchedOutline": { borderColor: "#2a2a2a" } }}>
            <MenuItem value="">lbl-right</MenuItem>
            {filteredCommits.map((c) => (
              <MenuItem key={c.head_sha} value={c.head_sha}>
                {c.head_sha.substring(0, 7)} &bull; {c.date}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Title */}
      <Typography variant="h3" sx={{ color: "#e0e0e0", fontWeight: 300, mb: 0.5 }}>
        VLLM V1 Benchmark
      </Typography>
      <Typography variant="body2" sx={{ color: "#777", mb: 1 }}>
        The dashboard is generated based on pinned pytorch with latest vllm, powered by{" "}
        <span style={{ color: "#5b9bd5", cursor: "pointer" }}>spyre-inference workflow</span>
      </Typography>

      {filteredCommits.length > 0 && (
        <Chip
          label={`${filteredCommits.length} commit(s) found`}
          size="small"
          sx={{ bgcolor: "#1a2a3a", color: "#5b9bd5", mb: 2, border: "1px solid #2a3a4a" }}
        />
      )}

      {/* Content */}
      {filteredData.length > 0 ? (
        <>
          <TimeSeriesChart data={filteredData} title="Metrics Over Time" />
          <ComparisonView commits={filteredCommits} />
          <DataTable data={filteredData} />
        </>
      ) : (
        <Box sx={{ textAlign: "center", mt: 5, p: 4, bgcolor: "#141414", borderRadius: 1, border: "1px solid #1e1e1e" }}>
          <Typography color="#555">
            No benchmark data found for the selected filters and time range.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
