import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, TableSortLabel,
} from "@mui/material";
import { useState } from "react";
import { BenchmarkResult } from "../clickhouse/queries";

interface Props {
  data: BenchmarkResult[];
}

type SortKey = keyof BenchmarkResult;

export function DataTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (!data.length) {
    return (
      <Paper sx={{ p: 2, bgcolor: "#16213e" }}>
        <Typography color="#aaa">No results</Typography>
      </Paper>
    );
  }

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "head_sha", label: "Commit" },
    { key: "head_branch", label: "Branch" },
    { key: "model", label: "Model" },
    { key: "metric", label: "Metric" },
    { key: "value", label: "Value" },
    { key: "test_name", label: "Test" },
    { key: "device", label: "Device" },
  ];

  return (
    <Paper sx={{ bgcolor: "#16213e" }}>
      <Typography variant="h6" color="#fff" sx={{ p: 2 }}>
        Raw Data
      </Typography>
      <TableContainer sx={{ maxHeight: 500 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  sx={{ bgcolor: "#0f3460", color: "#fff", fontWeight: "bold" }}
                >
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDir : "asc"}
                    onClick={() => handleSort(col.key)}
                    sx={{ color: "#fff !important", "& .MuiTableSortLabel-icon": { color: "#aaa !important" } }}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ color: "#ccc" }}>{row.head_sha?.substring(0, 8)}</TableCell>
                <TableCell sx={{ color: "#ccc" }}>{row.head_branch}</TableCell>
                <TableCell sx={{ color: "#ccc" }}>{row.model}</TableCell>
                <TableCell sx={{ color: "#ccc" }}>{row.metric}</TableCell>
                <TableCell sx={{ color: "#e94560", fontWeight: "bold" }}>
                  {parseFloat(row.value).toFixed(2)}
                </TableCell>
                <TableCell sx={{ color: "#ccc" }}>{row.test_name}</TableCell>
                <TableCell sx={{ color: "#ccc" }}>{row.device}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
