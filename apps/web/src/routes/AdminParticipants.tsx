import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";

type ParticipantRow = {
  id: string;
  owner_user_id: string;
  display_name: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
};

export default function AdminParticipants() {
  const { t } = useTranslation();
  const api = useApi();

  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ownerUserId, setOwnerUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultPayorUserId, setDefaultPayorUserId] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, uRes] = await Promise.all([
        api.fetch("/api/v1/admin/participants", { method: "GET" }),
        api.fetch("/api/v1/admin/users", { method: "GET" })
      ]);

      setParticipants((await pRes.json()) as ParticipantRow[]);
      setUsers((await uRes.json()) as UserRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  const userLabel = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.displayName} (${u.email})` : id;
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await api.fetch("/api/v1/admin/participants", {
        method: "POST",
        body: JSON.stringify({
          ownerUserId,
          displayName
        })
      });

      const data = (await res.json()) as { id: string };

      if (defaultPayorUserId) {
        await api.fetch(`/api/v1/admin/participants/${data.id}/default-payor`, {
          method: "PUT",
          body: JSON.stringify({
            payorUserId: defaultPayorUserId
          })
        });
      }

      setDisplayName("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Card sx={{ flex: 1, maxWidth: 480 }}>
          <CardHeader title={t("admin.participants.title")} subheader="Create a new participant" />
          <CardContent>
            <Box component="form" onSubmit={create}>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t("admin.participants.owner")}</InputLabel>
                  <Select
                    value={ownerUserId}
                    label={t("admin.participants.owner")}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                  >
                    <MenuItem value="">--</MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label={t("admin.participants.name")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  fullWidth
                  size="small"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>{t("admin.participants.defaultPayor")}</InputLabel>
                  <Select
                    value={defaultPayorUserId}
                    label={t("admin.participants.defaultPayor")}
                    onChange={(e) => setDefaultPayorUserId(e.target.value)}
                  >
                    <MenuItem value="">--</MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained">{t("admin.participants.create")}</Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 2 }}>
          <CardHeader title="Participants List" />
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
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.participants.name")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.participants.owner")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {participants.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell>{p.display_name}</TableCell>
                        <TableCell>{userLabel(p.owner_user_id)}</TableCell>
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
