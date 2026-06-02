import { AppBar, Toolbar, Box, Typography } from "@mui/material";

export function NavBar() {
  return (
    <AppBar position="static" sx={{ bgcolor: "#0c0c0c", boxShadow: "none", borderBottom: "1px solid #1e1e1e" }}>
      <Toolbar sx={{ minHeight: "44px !important", px: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#5b9bd5", mr: 3 }}>
          Spyre CI HUD
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flex: 1 }}>
          <NavLink label="Dashboard" active />
          <NavLink label="Benchmarks" />
          <NavLink label="Metrics" />
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <NavLink label="Help" />
          <NavLink label="KPIs" />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function NavLink({ label, active }: { label: string; active?: boolean }) {
  return (
    <Typography
      variant="body2"
      sx={{
        color: active ? "#e0e0e0" : "#555",
        cursor: "pointer",
        fontWeight: active ? 500 : 400,
        "&:hover": { color: "#5b9bd5" },
      }}
    >
      {label}
    </Typography>
  );
}
