import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  TextField
} from "@mui/material";

export default function PublicLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 400, mx: "auto", mt: 2 }}>
      <CardHeader title={t("public.login.title")} sx={{ textAlign: "center" }} />
      <CardContent>
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label={t("public.login.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              fullWidth
              size="small"
            />
            <TextField
              label={t("public.login.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              size="small"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth disabled={submitting}>
              {submitting ? t("public.login.submitting") : t("public.login.submit")}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
