import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { useApi } from "../auth";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from "@mui/material";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
};

type ParticipantRow = {
  id: string;
  owner_user_id: string;
  display_name: string;
  created_at: string;
};

type TemplateGuestRow = {
  template_id: string;
  user_id: string;
  created_at: string;
};

type TemplateParticipantRow = {
  template_id: string;
  participant_id: string;
  managing_user_id: string;
  default_attendance_status: string;
  created_at: string;
};

export default function AdminTemplateDetail() {
  const { t } = useTranslation();
  const api = useApi();
  const { templateId } = useParams();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [guests, setGuests] = useState<TemplateGuestRow[]>([]);
  const [templateParticipants, setTemplateParticipants] = useState<TemplateParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guestUserId, setGuestUserId] = useState("");

  const [participantId, setParticipantId] = useState("");
  const [managingUserId, setManagingUserId] = useState("");
  const [defaultAttendanceStatus, setDefaultAttendanceStatus] = useState("TENTATIVE");

  const guestIds = useMemo(() => new Set(guests.map((g) => g.user_id)), [guests]);

  const load = async () => {
    if (!templateId) return;

    setLoading(true);
    setError(null);

    try {
      const [uRes, pRes, gRes, tpRes] = await Promise.all([
        api.fetch("/api/v1/admin/users", { method: "GET" }),
        api.fetch("/api/v1/admin/participants", { method: "GET" }),
        api.fetch(`/api/v1/admin/event-templates/${templateId}/guests`, { method: "GET" }),
        api.fetch(`/api/v1/admin/event-templates/${templateId}/participants`, { method: "GET" })
      ]);

      const u = (await uRes.json()) as UserRow[];
      setUsers(u);
      setParticipants((await pRes.json()) as ParticipantRow[]);
      setGuests((await gRes.json()) as TemplateGuestRow[]);
      setTemplateParticipants((await tpRes.json()) as TemplateParticipantRow[]);

      if (!managingUserId) {
        const firstUserId = u?.[0]?.id;
        if (firstUserId) setManagingUserId(firstUserId);
      }
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [templateId]);

  const addGuest = async () => {
    if (!templateId || !guestUserId) return;
    await api.fetch(`/api/v1/admin/event-templates/${templateId}/guests`, {
      method: "POST",
      body: JSON.stringify({ userId: guestUserId })
    });
    setGuestUserId("");
    await load();
  };

  const removeGuest = async (userId: string) => {
    if (!templateId) return;
    await api.fetch(`/api/v1/admin/event-templates/${templateId}/guests/${userId}`, { method: "DELETE" });
    await load();
  };

  const addTemplateParticipant = async () => {
    if (!templateId || !participantId || !defaultAttendanceStatus) return;

    const participant = participants.find((p) => p.id === participantId);
    const effectiveManagingUserId = managingUserId || participant?.owner_user_id;
    if (!effectiveManagingUserId) return;

    await api.fetch(`/api/v1/admin/event-templates/${templateId}/participants`, {
      method: "POST",
      body: JSON.stringify({
        participantId,
        managingUserId: effectiveManagingUserId,
        defaultAttendanceStatus
      })
    });

    setParticipantId("");
    await load();
  };

  const removeTemplateParticipant = async (pid: string) => {
    if (!templateId) return;
    await api.fetch(`/api/v1/admin/event-templates/${templateId}/participants/${pid}`, { method: "DELETE" });
    await load();
  };

  const userLabel = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.displayName} (${u.email})` : id;
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t("admin.templates.detail.title")}</Typography>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.templates.detail.guests")} />
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Select User</InputLabel>
                <Select
                  value={guestUserId}
                  label="Select User"
                  onChange={(e) => setGuestUserId(e.target.value)}
                >
                  <MenuItem value="">--</MenuItem>
                  {users.filter((u) => !guestIds.has(u.id)).map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" onClick={addGuest}>{t("admin.templates.detail.addGuest")}</Button>
            </Stack>
            <Stack spacing={1}>
              {guests.map((g) => (
                <Stack key={g.user_id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{userLabel(g.user_id)}</Typography>
                  <Button size="small" color="error" onClick={() => removeGuest(g.user_id)}>{t("admin.templates.detail.remove")}</Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.templates.detail.participants")} />
          <CardContent>
            <Stack spacing={2} sx={{ mb: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t("admin.templates.detail.participant")}</InputLabel>
                <Select
                  value={participantId}
                  label={t("admin.templates.detail.participant")}
                  onChange={(e) => setParticipantId(e.target.value)}
                >
                  <MenuItem value="">--</MenuItem>
                  {participants.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.display_name} ({userLabel(p.owner_user_id)})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t("admin.templates.detail.managingUser")}</InputLabel>
                <Select
                  value={managingUserId}
                  label={t("admin.templates.detail.managingUser")}
                  onChange={(e) => setManagingUserId(e.target.value)}
                >
                  <MenuItem value="">--</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t("admin.templates.detail.defaultAttendance")}</InputLabel>
                <Select
                  value={defaultAttendanceStatus}
                  label={t("admin.templates.detail.defaultAttendance")}
                  onChange={(e) => setDefaultAttendanceStatus(e.target.value)}
                >
                  <MenuItem value="ATTENDING">ATTENDING</MenuItem>
                  <MenuItem value="TENTATIVE">TENTATIVE</MenuItem>
                  <MenuItem value="DECLINED">DECLINED</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" onClick={addTemplateParticipant}>{t("admin.templates.detail.addParticipant")}</Button>
            </Stack>

            <Stack spacing={2}>
              {templateParticipants.map((tp) => {
                const p = participants.find((x) => x.id === tp.participant_id);
                return (
                  <Card key={tp.participant_id} variant="outlined">
                    <CardContent sx={{ py: 1.5 }}>
                      <Typography variant="subtitle2">{p?.display_name ?? tp.participant_id}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t("admin.templates.detail.managingUser")}: {userLabel(tp.managing_user_id)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t("admin.templates.detail.defaultAttendance")}: {tp.default_attendance_status}
                      </Typography>
                      <Button size="small" color="error" sx={{ mt: 1 }} onClick={() => removeTemplateParticipant(tp.participant_id)}>
                        {t("admin.templates.detail.remove")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
