import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

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

export default function AdminLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      navigate("/admin/users");
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Card sx={{ maxWidth: 400, width: "100%" }}>
        <CardHeader title={t("admin.login.title")} sx={{ textAlign: "center" }} />
        <CardContent>
          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label={t("admin.login.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                fullWidth
                size="small"
              />
              <TextField
                label={t("admin.login.password")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                fullWidth
                size="small"
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" fullWidth disabled={submitting}>
                {submitting ? t("admin.login.submitting") : t("admin.login.submit")}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
