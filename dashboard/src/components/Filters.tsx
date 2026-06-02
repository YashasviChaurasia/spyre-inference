import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { FilterOptions } from "../clickhouse/queries";

interface Props {
  filters: FilterOptions;
  selectedModel: string;
  selectedMetric: string;
  selectedDevice: string;
  startDate: string;
  endDate: string;
  onModelChange: (model: string) => void;
  onMetricChange: (metric: string) => void;
  onDeviceChange: (device: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function Filters({
  filters,
  selectedModel,
  selectedMetric,
  selectedDevice,
  startDate,
  endDate,
  onModelChange,
  onMetricChange,
  onDeviceChange,
  onStartDateChange,
  onEndDateChange,
}: Props) {
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
      <TextField
        label="Start Date"
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        InputLabelProps={{ shrink: true, sx: { color: "#aaa" } }}
        inputProps={{ style: { color: "#fff" } }}
        sx={{ minWidth: 150 }}
      />
      <TextField
        label="End Date"
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        InputLabelProps={{ shrink: true, sx: { color: "#aaa" } }}
        inputProps={{ style: { color: "#fff" } }}
        sx={{ minWidth: 150 }}
      />
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel sx={{ color: "#aaa" }}>Model</InputLabel>
        <Select
          value={selectedModel}
          label="Model"
          onChange={(e) => onModelChange(e.target.value)}
          sx={{ color: "#fff" }}
        >
          <MenuItem value="">All</MenuItem>
          {filters.models.map((m) => (
            <MenuItem key={m} value={m}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel sx={{ color: "#aaa" }}>Metric</InputLabel>
        <Select
          value={selectedMetric}
          label="Metric"
          onChange={(e) => onMetricChange(e.target.value)}
          sx={{ color: "#fff" }}
        >
          <MenuItem value="">All</MenuItem>
          {filters.metrics.map((m) => (
            <MenuItem key={m} value={m}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 150 }}>
        <InputLabel sx={{ color: "#aaa" }}>Device</InputLabel>
        <Select
          value={selectedDevice}
          label="Device"
          onChange={(e) => onDeviceChange(e.target.value)}
          sx={{ color: "#fff" }}
        >
          <MenuItem value="">All</MenuItem>
          {filters.devices.map((d) => (
            <MenuItem key={d} value={d}>{d}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
