import {
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem,
  Divider, Chip, Button,
} from "@mui/material";
interface FilterOptions { models: string[]; metrics: string[]; devices: string[]; }

interface Props {
  startDate: string;
  endDate: string;
  selectedModel: string;
  selectedMetric: string;
  selectedDevice: string;
  selectedBranch: string;
  filters: FilterOptions;
  branches: string[];
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  onModelChange: (m: string) => void;
  onMetricChange: (m: string) => void;
  onDeviceChange: (d: string) => void;
  onBranchChange: (b: string) => void;
}

export function Sidebar({
  startDate, endDate, selectedModel, selectedMetric, selectedDevice,
  selectedBranch, filters, branches, onStartDateChange, onEndDateChange,
  onModelChange, onMetricChange, onDeviceChange, onBranchChange,
}: Props) {
  return (
    <Box
      sx={{
        width: 280, minWidth: 280, bgcolor: "#0e0e0e", borderRight: "1px solid #1e1e1e",
        p: 2, display: "flex", flexDirection: "column", gap: 1.5, overflowY: "auto",
      }}
    >
      <Typography variant="subtitle2" sx={{ color: "#e0e0e0", fontWeight: 600 }}>
        Search
      </Typography>

      <Box>
        <Typography variant="caption" sx={{ color: "#666", mb: 0.5, display: "block" }}>
          Time Range
        </Typography>
        <Chip
          label={`${startDate} - ${endDate}`}
          size="small"
          sx={{ bgcolor: "#1a2a3a", color: "#5b9bd5", fontSize: "0.72rem", border: "1px solid #2a3a4a" }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)}
          size="small" fullWidth
          InputProps={{ sx: { color: "#ccc", fontSize: "0.78rem" } }}
        />
        <TextField
          type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)}
          size="small" fullWidth
          InputProps={{ sx: { color: "#ccc", fontSize: "0.78rem" } }}
        />
      </Box>

      <Divider sx={{ borderColor: "#1e1e1e" }} />

      <Typography variant="subtitle2" sx={{ color: "#e0e0e0", fontWeight: 600 }}>
        Filters
      </Typography>

      <SidebarSelect label="Branch" value={selectedBranch} onChange={onBranchChange}
        options={branches} />
      <SidebarSelect label="Model" value={selectedModel} onChange={onModelChange}
        options={filters.models} />
      <SidebarSelect label="Metric" value={selectedMetric} onChange={onMetricChange}
        options={filters.metrics} />
      <SidebarSelect label="Device" value={selectedDevice} onChange={onDeviceChange}
        options={filters.devices} />

      <Divider sx={{ borderColor: "#1e1e1e" }} />

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" sx={{ color: "#777", textTransform: "none" }}>
          Revert
        </Button>
        <Button size="small" variant="contained"
          sx={{ textTransform: "none", bgcolor: "#1a2a3a", color: "#5b9bd5", "&:hover": { bgcolor: "#2a3a4a" } }}>
          Apply
        </Button>
      </Box>
    </Box>
  );
}

function SidebarSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel sx={{ color: "#555" }}>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value)}
        sx={{ color: "#ccc", ".MuiOutlinedInput-notchedOutline": { borderColor: "#2a2a2a" } }}>
        <MenuItem value="">All</MenuItem>
        {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </Select>
    </FormControl>
  );
}
