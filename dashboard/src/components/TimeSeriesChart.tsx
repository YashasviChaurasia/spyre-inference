import { Paper, Typography } from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
interface BenchmarkResult { timestamp: number; head_sha: string; head_branch: string; model_name: string; metric_name: string; value: string; test_name: string; device_name: string; }

interface Props {
  data: BenchmarkResult[];
  title: string;
}

const COLORS = ["#5b9bd5", "#e0e0e0", "#7fb3e0", "#999", "#a0c4e8", "#666"];

export function TimeSeriesChart({ data, title }: Props) {
  if (!data.length) {
    return (
      <Paper sx={{ p: 2, bgcolor: "#141414", border: "1px solid #1e1e1e", mb: 2 }}>
        <Typography color="#555">No data for {title}</Typography>
      </Paper>
    );
  }

  const metrics = [...new Set(data.map((d) => d.metric_name))];
  const chartData = data.reduce((acc, d) => {
    const date = new Date(d.timestamp).toISOString().split("T")[0];
    const existing = acc.find((x) => x.date === date && x.sha === d.head_sha);
    if (existing) {
      existing[d.metric_name] = parseFloat(d.value) || 0;
    } else {
      acc.push({ date, sha: d.head_sha, [d.metric_name]: parseFloat(d.value) || 0 });
    }
    return acc;
  }, [] as any[]);

  return (
    <Paper sx={{ p: 2, bgcolor: "#141414", border: "1px solid #1e1e1e", mb: 2 }}>
      <Typography variant="h6" color="#e0e0e0" gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
          <XAxis dataKey="date" stroke="#555" fontSize={11} />
          <YAxis stroke="#555" fontSize={11} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e0e0e0" }}
            labelStyle={{ color: "#999" }}
          />
          <Legend wrapperStyle={{ color: "#999" }} />
          {metrics.map((metric, i) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={COLORS[i % COLORS.length]}
              dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
              name={metric}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
}
