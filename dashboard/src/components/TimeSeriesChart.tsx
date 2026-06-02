import { Paper, Typography } from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BenchmarkResult } from "../clickhouse/queries";

interface Props {
  data: BenchmarkResult[];
  title: string;
}

const COLORS = ["#e94560", "#0f3460", "#53a8b6", "#f5a623", "#7b68ee", "#2ecc71"];

export function TimeSeriesChart({ data, title }: Props) {
  if (!data.length) {
    return (
      <Paper sx={{ p: 2, bgcolor: "#16213e", mb: 2 }}>
        <Typography color="#aaa">No data for {title}</Typography>
      </Paper>
    );
  }

  // Group by metric for multi-line chart
  const metrics = [...new Set(data.map((d) => d.metric))];
  const chartData = data.reduce((acc, d) => {
    const date = new Date(d.timestamp).toISOString().split("T")[0];
    const existing = acc.find((x) => x.date === date && x.sha === d.head_sha);
    if (existing) {
      existing[d.metric] = parseFloat(d.value) || 0;
    } else {
      acc.push({ date, sha: d.head_sha, [d.metric]: parseFloat(d.value) || 0 });
    }
    return acc;
  }, [] as any[]);

  return (
    <Paper sx={{ p: 2, bgcolor: "#16213e", mb: 2 }}>
      <Typography variant="h6" color="#fff" gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" stroke="#aaa" fontSize={12} />
          <YAxis stroke="#aaa" fontSize={12} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333" }}
            labelStyle={{ color: "#fff" }}
          />
          <Legend />
          {metrics.map((metric, i) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={COLORS[i % COLORS.length]}
              dot={{ r: 4 }}
              name={metric}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
}
