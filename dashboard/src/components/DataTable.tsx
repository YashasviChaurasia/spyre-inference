import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, TableSortLabel,
} from "@mui/material";
import { useState } from "react";
interface BenchmarkResult { timestamp: number; head_sha: string; head_branch: string; model_name: string; metric_name: string; value: string; test_name: string; device_name: string; }

interface Props {
  data: BenchmarkResult[];
}

type SortKey = keyof BenchmarkResult;

export function DataTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (!data.length) return null;

  const sorted = [...data].sort((a, b) => {
    const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "head_sha", label: "Commit" },
    { key: "head_branch", label: "Branch" },
    { key: "model_name", label: "Model" },
    { key: "metric_name", label: "Metric" },
    { key: "value", label: "Value" },
    { key: "test_name", label: "Test" },
    { key: "device_name", label: "Device" },
  ];

  return (
    <Paper sx={{ bgcolor: "#141414", border: "1px solid #1e1e1e" }}>
      <Typography variant="h6" color="#e0e0e0" sx={{ p: 2 }}>
        Raw Data
      </Typography>
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.key} sx={{ bgcolor: "#181818", color: "#777", fontWeight: 600, borderBottom: "1px solid #2a2a2a", fontSize: "0.8rem" }}>
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDir : "asc"}
                    onClick={() => handleSort(col.key)}
                    sx={{ color: "#777 !important", "& .MuiTableSortLabel-icon": { color: "#555 !important" } }}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={i} sx={{ "&:hover": { bgcolor: "#1a1a1a" } }}>
                <TableCell sx={{ color: "#5b9bd5", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>{row.head_sha?.substring(0, 8)}</TableCell>
                <TableCell sx={{ color: "#999", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>{row.head_branch}</TableCell>
                <TableCell sx={{ color: "#5b9bd5", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>{row.model_name}</TableCell>
                <TableCell sx={{ color: "#bbb", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>{row.metric_name}</TableCell>
                <TableCell sx={{ color: "#e0e0e0", fontWeight: 600, borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>
                  {parseFloat(row.value).toFixed(2)}
                </TableCell>
                <TableCell sx={{ color: "#999", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>{row.test_name}</TableCell>
                <TableCell sx={{ color: "#999", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>{row.device_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
