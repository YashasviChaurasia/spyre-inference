import { AppBar, Toolbar, Typography, Container, Box } from "@mui/material";
import { GithubAuth } from "../auth/GithubAuth";

interface Props {
  children: React.ReactNode;
  isAuthenticated: boolean;
  user: { login: string; avatar_url: string } | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function Layout({ children, isAuthenticated, user, onLogin, onLogout }: Props) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#1a1a2e" }}>
      <AppBar position="static" sx={{ bgcolor: "#16213e" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, color: "#e94560" }}>
            Spyre vLLM Benchmark Dashboard
          </Typography>
          <GithubAuth
            isAuthenticated={isAuthenticated}
            user={user}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {children}
      </Container>
    </Box>
  );
}
