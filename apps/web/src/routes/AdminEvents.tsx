import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import { useApi } from "../auth";
import { utcIsoToJalaliDate } from "../utils/jalali";
import { DatePicker, TimePicker } from "@mui/x-date-pickers";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";

type EventRow = {
  id: string;
  name: string;
  location_text: string;
  location_user_id: string | null;
  host_user_id: string;
  starts_at_utc: string;
  cutoff_at_utc: string;
  state: string;
  visibility_mode: string;
};

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  default_location_text: string | null;
  created_at: string;
};

export default function AdminEvents() {
  const { t } = useTranslation();
  const api = useApi();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [locationUserId, setLocationUserId] = useState<string>("");
  const [hostUserIds, setHostUserIds] = useState<string[]>([]);
  const [startsDate, setStartsDate] = useState<Date | null>(new Date());
  const [startsTime, setStartsTime] = useState<Date | null>(new Date(new Date().setHours(20, 0, 0, 0)));
  const [cutoffDate, setCutoffDate] = useState<Date | null>(new Date());
  const [cutoffTime, setCutoffTime] = useState<Date | null>(new Date(new Date().setHours(18, 0, 0, 0)));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, usersRes] = await Promise.all([
        api.fetch("/api/v1/admin/events", { method: "GET" }),
        api.fetch("/api/v1/admin/users", { method: "GET" })
      ]);

      setEvents((await eventsRes.json()) as EventRow[]);
      const u = (await usersRes.json()) as UserRow[];
      setUsers(u);

      const templatesRes = await api.fetch("/api/v1/admin/event-templates", { method: "GET" });
      setTemplates((await templatesRes.json()) as TemplateRow[]);

      if (hostUserIds.length === 0 && u?.[0]?.id) {
        setHostUserIds([u[0].id]);
      }
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
      if (!startsDate || !startsTime || !cutoffDate || !cutoffTime) {
        throw new Error("invalid date/time");
      }

      const startsAtLocal = new Date(startsDate);
      startsAtLocal.setHours(startsTime.getHours(), startsTime.getMinutes(), 0, 0);
      const startsAtUtc = startsAtLocal.toISOString();

      const cutoffAtLocal = new Date(cutoffDate);
      cutoffAtLocal.setHours(cutoffTime.getHours(), cutoffTime.getMinutes(), 0, 0);
      const cutoffAtUtc = cutoffAtLocal.toISOString();

      await api.fetch("/api/v1/admin/events", {
        method: "POST",
        body: JSON.stringify({
          templateId: templateId || null,
          name,
          locationUserId: locationUserId || null,
          hostUserIds,
          startsAtUtc,
          cutoffAtUtc,
          visibilityMode: "OPEN",
          payorExemptionEnabled: true
        })
      });

      setName("");
      setLocationUserId("");
      setHostUserIds([]);
      await load();
      setCreateOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardHeader
          title="Events List"
          action={
            <Button variant="contained" onClick={() => setCreateOpen(true)}>
              {t("admin.events.create")}
            </Button>
          }
        />
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
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.events.name")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.events.startsDate")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.events.state")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/admin/events/${ev.id}`} underline="hover">
                          {ev.name}
                        </Link>
                      </TableCell>
                      <TableCell>{utcIsoToJalaliDate(ev.starts_at_utc)}</TableCell>
                      <TableCell>{ev.state}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={create} id="create-event-form">
          <DialogTitle>{t("admin.events.title")}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t("admin.events.template")}</InputLabel>
                    <Select
                      value={templateId}
                      label={t("admin.events.template")}
                      onChange={(e) => {
                        const next = e.target.value;
                        setTemplateId(next);
                      }}
                    >
                      <MenuItem value="">--</MenuItem>
                      {templates.map((tpl) => (
                        <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label={t("admin.events.name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t("admin.events.location")}</InputLabel>
                    <Select
                      value={locationUserId}
                      label={t("admin.events.location")}
                      onChange={(e) => setLocationUserId(e.target.value)}
                    >
                      <MenuItem value="">--</MenuItem>
                      {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t("admin.events.host")}</InputLabel>
                    <Select
                      multiple
                      value={hostUserIds}
                      label={t("admin.events.host")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHostUserIds(typeof v === "string" ? v.split(",") : (v as string[]));
                      }}
                      renderValue={(selected) =>
                        (selected as string[])
                          .map((id) => users.find((u) => u.id === id)?.displayName ?? id)
                          .join(", ")
                      }
                    >
                      {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <DatePicker
                    label={t("admin.events.startsDate")}
                    value={startsDate}
                    onChange={(v: Date | null) => setStartsDate(v)}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TimePicker
                    label={t("admin.events.startsTime")}
                    value={startsTime}
                    onChange={(v: Date | null) => setStartsTime(v)}
                    ampm={false}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <DatePicker
                    label={t("admin.events.cutoffDate")}
                    value={cutoffDate}
                    onChange={(v: Date | null) => setCutoffDate(v)}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TimePicker
                    label={t("admin.events.cutoffTime")}
                    value={cutoffTime}
                    onChange={(v: Date | null) => setCutoffTime(v)}
                    ampm={false}
                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="outlined" onClick={() => setCreateOpen(false)}>
              {t("public.event.cancel")}
            </Button>
            <Button type="submit" variant="contained">
              {t("admin.events.create")}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
