import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import { useApi } from "../auth";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";

type Row = {
  id: string;
  name: string;
  description: string | null;
  default_location_text: string | null;
  created_at: string;
};

export default function AdminTemplates() {
  const { t } = useTranslation();
  const api = useApi();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [defaultLocationText, setDefaultLocationText] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetch("/api/v1/admin/event-templates", { method: "GET" });
      setRows((await res.json()) as Row[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.fetch("/api/v1/admin/event-templates", {
        method: "POST",
        body: JSON.stringify({
          name,
          defaultLocationText: defaultLocationText || null
        })
      });
      setName("");
      setDefaultLocationText("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Card sx={{ flex: 1, maxWidth: 400 }}>
          <CardHeader title={t("admin.templates.title")} subheader="Create a new template" />
          <CardContent>
            <Box component="form" onSubmit={create}>
              <Stack spacing={2}>
                <TextField
                  label={t("admin.templates.name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label={t("admin.templates.defaultLocation")}
                  value={defaultLocationText}
                  onChange={(e) => setDefaultLocationText(e.target.value)}
                  fullWidth
                  size="small"
                />
                <Button type="submit" variant="contained">{t("admin.templates.create")}</Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 2 }}>
          <CardHeader title="Templates List" />
          <CardContent>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.templates.name")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.templates.defaultLocation")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.default_location_text ?? ""}</TableCell>
                        <TableCell>
                          <Link component={RouterLink} to={`/admin/templates/${r.id}`} underline="hover">
                            {t("admin.templates.manageRoster")}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
