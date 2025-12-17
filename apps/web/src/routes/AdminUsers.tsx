import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useApi, useAuth } from "../auth";
import { utcIsoToJalaliDate } from "../utils/jalali";

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
  TextField,
  Typography
} from "@mui/material";

type UserRole = "ADMIN" | "USER";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
};

const utcIsoToTimeHHmm = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminUsers() {
  const { t } = useTranslation();
  const api = useApi();
  const { me } = useAuth();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [creating, setCreating] = useState(false);

  const [topupUserId, setTopupUserId] = useState("");
  const [topupAmountIrr, setTopupAmountIrr] = useState(0);
  const [toppingUp, setToppingUp] = useState(false);

  const canManage = useMemo(() => me?.role === "ADMIN", [me?.role]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetch("/api/v1/admin/users", { method: "GET" });
      const data = (await res.json()) as UserRow[];
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  const onTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!topupUserId) return;

    setToppingUp(true);
    setError(null);
    try {
      await api.fetch(`/api/v1/admin/users/${topupUserId}/wallet-topup`, {
        method: "POST",
        body: JSON.stringify({ amountIrr: topupAmountIrr })
      });
      setTopupUserId("");
      setTopupAmountIrr(0);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setToppingUp(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setCreating(true);
    setError(null);

    try {
      await api.fetch("/api/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          displayName,
          password,
          role
        })
      });

      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("USER");

      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardHeader title={t("admin.users.title")} />
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
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.users.email")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.users.name")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.users.role")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.users.createdAt")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.displayName}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>
                        {utcIsoToJalaliDate(u.createdAt)} {utcIsoToTimeHHmm(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.users.createTitle")} />
          <CardContent>
            {!canManage ? (
              <Typography color="text.secondary">{t("admin.users.forbidden")}</Typography>
            ) : (
              <Box component="form" onSubmit={onCreate}>
                <Stack spacing={2}>
                  <TextField
                    label={t("admin.users.email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label={t("admin.users.name")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label={t("admin.users.password")}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>{t("admin.users.role")}</InputLabel>
                    <Select
                      value={role}
                      label={t("admin.users.role")}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      <MenuItem value="USER">USER</MenuItem>
                      <MenuItem value="ADMIN">ADMIN</MenuItem>
                    </Select>
                  </FormControl>
                  <Button type="submit" variant="contained" disabled={creating}>
                    {creating ? t("admin.users.creating") : t("admin.users.create")}
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.users.walletTopupTitle")} />
          <CardContent>
            {!canManage ? (
              <Typography color="text.secondary">{t("admin.users.forbidden")}</Typography>
            ) : (
              <Box component="form" onSubmit={onTopup}>
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t("admin.users.walletTopupUser")}</InputLabel>
                    <Select
                      value={topupUserId}
                      label={t("admin.users.walletTopupUser")}
                      onChange={(e) => setTopupUserId(e.target.value)}
                    >
                      <MenuItem value="">--</MenuItem>
                      {rows.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.displayName} ({u.email})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label={t("admin.users.walletTopupAmount")}
                    type="number"
                    value={topupAmountIrr}
                    onChange={(e) => setTopupAmountIrr(Number(e.target.value))}
                    fullWidth
                    size="small"
                  />
                  <Button type="submit" variant="contained" disabled={toppingUp}>
                    {toppingUp ? t("admin.users.walletTopupSubmitting") : t("admin.users.walletTopupSubmit")}
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
