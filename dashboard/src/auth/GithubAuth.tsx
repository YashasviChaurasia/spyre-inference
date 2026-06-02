import { Button, Avatar, Box, Typography } from "@mui/material";

interface Props {
  isAuthenticated: boolean;
  user: { login: string; avatar_url: string } | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function GithubAuth({ isAuthenticated, user, onLogin, onLogout }: Props) {
  if (isAuthenticated && user) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar src={user.avatar_url} sx={{ width: 28, height: 28 }} />
        <Typography variant="body2">{user.login}</Typography>
        <Button size="small" onClick={onLogout}>
          Logout
        </Button>
      </Box>
    );
  }

  return (
    <Button variant="contained" onClick={onLogin}>
      Sign in with GitHub
    </Button>
  );
}
