import { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, CircularProgress, Typography } from "@mui/material";
import { NavBar } from "./components/NavBar";
import { Sidebar } from "./components/Sidebar";
import { MainContent } from "./components/MainContent";
import {
  listCommits,
  getTimeSeriesData,
  getFilterOptions,
  CommitInfo,
  BenchmarkResult,
  FilterOptions,
} from "./clickhouse/queries";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#5b9bd5" },
    background: { default: "#0c0c0c", paper: "#141414" },
    text: { primary: "#e0e0e0", secondary: "#777" },
    warning: { main: "#e6a817" },
    error: { main: "#d44" },
    success: { main: "#4caf50" },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function App() {
  const defaultDates = getDefaultDateRange();

  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("main");

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [data, setData] = useState<BenchmarkResult[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ models: [], metrics: [], devices: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startMs = new Date(startDate + "T00:00:00Z").getTime();
  const endMs = new Date(endDate + "T23:59:59Z").getTime();

  useEffect(() => {
        getFilterOptions().then(setFilters).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([
      listCommits(startMs, endMs),
      getTimeSeriesData(startMs, endMs, undefined, undefined, selectedModel, selectedMetric),
    ])
      .then(([c, d]) => {
        setCommits(c);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedModel, selectedMetric]);

  const branches = [...new Set(commits.map((c) => c.head_branch))];

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <NavBar />

        <Box sx={{ display: "flex", flex: 1 }}>
          <Sidebar
              startDate={startDate}
              endDate={endDate}
              selectedModel={selectedModel}
              selectedMetric={selectedMetric}
              selectedDevice={selectedDevice}
              selectedBranch={selectedBranch}
              filters={filters}
              branches={branches}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onModelChange={setSelectedModel}
              onMetricChange={setSelectedMetric}
              onDeviceChange={setSelectedDevice}
              onBranchChange={setSelectedBranch}
            />

            <Box sx={{ flex: 1, p: 3, overflow: "auto" }}>
              {error && (
                <Typography color="error" sx={{ mb: 2 }}>
                  {error}
                </Typography>
              )}
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <MainContent
                  data={data}
                  commits={commits}
                  selectedBranch={selectedBranch}
                />
              )}
            </Box>
          </Box>
      </Box>
    </ThemeProvider>
  );
}
