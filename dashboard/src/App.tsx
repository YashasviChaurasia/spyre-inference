import { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Typography, Box, CircularProgress } from "@mui/material";
import { Layout } from "./components/Layout";
import { Filters } from "./components/Filters";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { ComparisonView } from "./components/ComparisonView";
import { DataTable } from "./components/DataTable";
import { useAuth } from "./auth/useAuth";
import {
  listCommits,
  getTimeSeriesData,
  getFilterOptions,
  CommitInfo,
  BenchmarkResult,
  FilterOptions,
} from "./clickhouse/queries";

const darkTheme = createTheme({
  palette: { mode: "dark", primary: { main: "#e94560" } },
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
  const { isAuthenticated, user, login, logout } = useAuth();
  const defaultDates = getDefaultDateRange();

  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [data, setData] = useState<BenchmarkResult[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ models: [], metrics: [], devices: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startMs = new Date(startDate + "T00:00:00Z").getTime();
  const endMs = new Date(endDate + "T23:59:59Z").getTime();

  // Load filter options
  useEffect(() => {
    if (!isAuthenticated) return;
    getFilterOptions().then(setFilters).catch((e) => setError(e.message));
  }, [isAuthenticated]);

  // Load commits + data when filters change
  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated, startDate, endDate, selectedModel, selectedMetric]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Layout
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={login}
        onLogout={logout}
      >
        {!isAuthenticated ? (
          <Box sx={{ textAlign: "center", mt: 10 }}>
            <Typography variant="h4" color="#fff" gutterBottom>
              Spyre vLLM Benchmark Dashboard
            </Typography>
            <Typography color="#aaa" sx={{ mb: 3 }}>
              Sign in with GitHub to view benchmark results
            </Typography>
          </Box>
        ) : (
          <>
            <Filters
              filters={filters}
              selectedModel={selectedModel}
              selectedMetric={selectedMetric}
              selectedDevice={selectedDevice}
              startDate={startDate}
              endDate={endDate}
              onModelChange={setSelectedModel}
              onMetricChange={setSelectedMetric}
              onDeviceChange={setSelectedDevice}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />

            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}

            {loading ? (
              <Box sx={{ textAlign: "center", mt: 5 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TimeSeriesChart data={data} title="Benchmark Metrics Over Time" />
                <ComparisonView commits={commits} />
                <DataTable data={data} />
              </>
            )}
          </>
        )}
      </Layout>
    </ThemeProvider>
  );
}
