import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import { useApi, useAuth } from "../auth";
import { utcIsoToJalaliDate } from "../utils/jalali";
import PublicLogin from "./PublicLogin";

import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";

type EventRow = {
  id: string;
  name: string;
  starts_at_utc: string;
  cutoff_at_utc: string;
  state: string;
};

export default function PublicEvents() {
  const { t } = useTranslation();
  const api = useApi();
  const { me, loading } = useAuth();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const load = async () => {
    setLoadingEvents(true);
    setError(null);
    try {
      const res = await api.fetch("/api/v1/events", { method: "GET" });
      setEvents((await res.json()) as EventRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!me) return;
    load();
  }, [me?.id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!me) return <PublicLogin />;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardHeader title={t("public.events.title")} />
        <CardContent>
          {loadingEvents ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t("public.events.name")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("public.events.starts")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("public.events.state")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/events/${ev.id}`} underline="hover">
                          {ev.name}
                        </Link>
                      </TableCell>
                      <TableCell>{utcIsoToJalaliDate(ev.starts_at_utc)}</TableCell>
                      <TableCell>
                        <Chip
                          label={ev.state}
                          size="small"
                          color={ev.state === "OPEN" ? "success" : ev.state === "COMPLETED" ? "primary" : "default"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
