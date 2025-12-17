import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useParams } from "react-router-dom";

import { useApi, useAuth } from "../auth";
import { utcIsoToJalaliDate } from "../utils/jalali";
import PublicLogin from "./PublicLogin";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";

type EventRow = {
  id: string;
  name: string;
  starts_at_utc: string;
  cutoff_at_utc: string;
  state: string;
};

type MenuItemRow = {
  id: string;
  menu_id: string;
  menu_name: string;
  name: string;
  price_irr: number;
  category_name_en: string | null;
  category_name_fa: string | null;
  tags: string[];
};

type ManagedParticipantRow = {
  participant_id: string;
  display_name: string;
  attendance_status: string;
};

type SelectionRow = {
  id: string;
  event_id: string;
  menu_item_id: string;
  quantity: number;
  created_at: string;
  item_name: string;
  item_price_irr: number;
  menu_name: string;
  allocations: { participant_id: string; display_name?: string }[];
};

export default function PublicEventDetail() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const { me, loading } = useAuth();
  const { eventId } = useParams();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [managedParticipants, setManagedParticipants] = useState<ManagedParticipantRow[]>([]);
  const [selections, setSelections] = useState<SelectionRow[]>([]);

  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Record<string, boolean>>({});

  const [editingSelectionId, setEditingSelectionId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editParticipantIds, setEditParticipantIds] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const attendingParticipants = useMemo(
    () => managedParticipants.filter((p) => p.attendance_status === "ATTENDING"),
    [managedParticipants]
  );

  const load = async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError(null);

    try {
      const [evRes, itemsRes, managedRes, selectionsRes] = await Promise.all([
        api.fetch(`/api/v1/events/${eventId}`, { method: "GET" }),
        api.fetch(`/api/v1/events/${eventId}/menu-items`, { method: "GET" }),
        api.fetch(`/api/v1/events/${eventId}/managed-participants`, { method: "GET" }),
        api.fetch(`/api/v1/events/${eventId}/selections`, { method: "GET" })
      ]);

      setEvent((await evRes.json()) as EventRow);
      setMenuItems((await itemsRes.json()) as MenuItemRow[]);
      setManagedParticipants((await managedRes.json()) as ManagedParticipantRow[]);
      setSelections((await selectionsRes.json()) as SelectionRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoadingData(false);
    }
  };

  const startEdit = (s: SelectionRow) => {
    setEditingSelectionId(s.id);
    setEditQuantity(s.quantity);
    const map: Record<string, boolean> = {};
    for (const a of s.allocations) {
      if (manageableParticipantIdSet.has(a.participant_id)) map[a.participant_id] = true;
    }
    setEditParticipantIds(map);
  };

  const cancelEdit = () => {
    setEditingSelectionId(null);
    setEditQuantity(1);
    setEditParticipantIds({});
  };

  const saveEdit = async () => {
    if (!eventId) return;
    if (!editingSelectionId) return;

    const participantIds = Object.entries(editParticipantIds)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setError(null);
    try {
      await api.fetch(`/api/v1/selections/${editingSelectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: editQuantity, participantIds })
      });
      cancelEdit();
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  useEffect(() => {
    if (!me) return;
    load();
  }, [me?.id, eventId]);

  const toggleParticipant = (pid: string) => {
    setSelectedParticipantIds((prev) => ({
      ...prev,
      [pid]: !prev[pid]
    }));
  };

  const participantLabel = (pid: string) => {
    const p = managedParticipants.find((x) => x.participant_id === pid);
    return p ? p.display_name : pid;
  };

  const manageableParticipantIdSet = useMemo(() => {
    return new Set(managedParticipants.map((p) => p.participant_id));
  }, [managedParticipants]);

  const toggleEditParticipant = (pid: string) => {
    setEditParticipantIds((prev) => ({
      ...prev,
      [pid]: !prev[pid]
    }));
  };

  const createSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    const participantIds = Object.entries(selectedParticipantIds)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setError(null);
    try {
      await api.fetch(`/api/v1/events/${eventId}/selections`, {
        method: "POST",
        body: JSON.stringify({
          menuItemId,
          quantity,
          participantIds
        })
      });

      setMenuItemId("");
      setQuantity(1);
      setSelectedParticipantIds({});

      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const removeSelection = async (selectionId: string) => {
    setError(null);
    try {
      await api.fetch(`/api/v1/selections/${selectionId}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const updateAttendance = async (participantId: string, attendance: string) => {
    setError(null);
    try {
      await api.fetch(`/api/v1/events/${eventId}/participants/${participantId}/attendance`, {
        method: "PATCH",
        body: JSON.stringify({ attendance })
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!me) return <PublicLogin />;

  if (loadingData) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!event) {
    return <Alert severity="warning" sx={{ mt: 2 }}>{t("public.event.notFound")}</Alert>;
  }

  const cutoffMs = Date.parse(event.cutoff_at_utc);
  const cutoffPassed = Number.isFinite(cutoffMs) ? Date.now() >= cutoffMs : false;
  const isOpen = event.state === "OPEN";
  const canEditSelections = isOpen && !cutoffPassed;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{event.name}</Typography>
        <Link component={RouterLink} to="/events" underline="hover">{t("public.event.back")}</Link>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Box>
              <Typography variant="caption" color="text.secondary">{t("public.event.starts")}</Typography>
              <Typography variant="body1">{utcIsoToJalaliDate(event.starts_at_utc)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t("public.event.cutoff")}</Typography>
              <Typography variant="body1">{utcIsoToJalaliDate(event.cutoff_at_utc)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t("public.event.state")}</Typography>
              <Chip
                label={event.state}
                size="small"
                color={event.state === "OPEN" ? "success" : event.state === "COMPLETED" ? "primary" : "default"}
              />
            </Box>
          </Stack>
          {!canEditSelections && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {!isOpen ? t("public.event.notOpen") : cutoffPassed ? t("public.event.cutoffPassed") : null}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardHeader title={t("public.event.myParticipants")} />
        <CardContent>
          {managedParticipants.length === 0 ? (
            <Typography color="text.secondary">{t("public.event.noParticipants")}</Typography>
          ) : (
            <Stack spacing={1}>
              {managedParticipants.map((p) => (
                <Stack key={p.participant_id} direction="row" spacing={2} alignItems="center">
                  <Typography sx={{ minWidth: 120, fontWeight: 500 }}>{p.display_name}</Typography>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={p.attendance_status}
                      onChange={(e) => updateAttendance(p.participant_id, e.target.value)}
                    >
                      <MenuItem value="ATTENDING">{t("public.event.attending")}</MenuItem>
                      <MenuItem value="TENTATIVE">{t("public.event.tentative")}</MenuItem>
                      <MenuItem value="DECLINED">{t("public.event.declined")}</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {canEditSelections && (
        <Card sx={{ mb: 3 }}>
          <CardHeader title={t("public.event.createSelection")} />
          <CardContent>
            <Box component="form" onSubmit={createSelection}>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t("public.event.menuItem")}</InputLabel>
                  <Select
                    value={menuItemId}
                    label={t("public.event.menuItem")}
                    onChange={(e) => setMenuItemId(e.target.value)}
                  >
                    <MenuItem value="">--</MenuItem>
                    {menuItems.map((mi) => {
                      const cat = i18n.language === "fa" ? mi.category_name_fa : mi.category_name_en;
                      const catLabel = cat ? ` • ${cat}` : "";
                      const tagsLabel = mi.tags?.length ? ` • ${mi.tags.join(", ")}` : "";
                      return (
                        <MenuItem key={mi.id} value={mi.id}>
                          {mi.menu_name} — {mi.name} ({mi.price_irr.toLocaleString()}){catLabel}{tagsLabel}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>

                <TextField
                  label={t("public.event.quantity")}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  inputProps={{ min: 1, step: 1 }}
                  size="small"
                  sx={{ maxWidth: 150 }}
                />

                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>{t("public.event.allocateTo")}</Typography>
                  <Stack spacing={0.5}>
                    {attendingParticipants.map((p) => (
                      <FormControlLabel
                        key={p.participant_id}
                        control={
                          <Checkbox
                            size="small"
                            checked={!!selectedParticipantIds[p.participant_id]}
                            onChange={() => toggleParticipant(p.participant_id)}
                          />
                        }
                        label={p.display_name}
                      />
                    ))}
                  </Stack>
                </Box>

                <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
                  {t("public.event.create")}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title={t("public.event.mySelections")} />
        <CardContent>
          {selections.length === 0 ? (
            <Typography color="text.secondary">{t("public.event.noSelections")}</Typography>
          ) : (
            <Stack spacing={2}>
              {selections.map((s) => (
                <Card key={s.id} variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {s.menu_name} — {s.item_name} × {s.quantity}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t("public.event.allocations")}: {s.allocations.map((a) => a.display_name ?? participantLabel(a.participant_id)).join(", ")}
                    </Typography>

                    {(() => {
                      const unmanaged = s.allocations.filter((a) => !manageableParticipantIdSet.has(a.participant_id));
                      if (unmanaged.length < 1) return null;
                      return (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          {t("public.event.unmanagedAllocations")}: {unmanaged.map((a) => a.display_name ?? a.participant_id).join(", ")}
                        </Typography>
                      );
                    })()}

                    {editingSelectionId === s.id && canEditSelections ? (
                      <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                        <Stack spacing={2}>
                          <TextField
                            label={t("public.event.editQuantity")}
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number(e.target.value))}
                            inputProps={{ min: 1, step: 1 }}
                            size="small"
                            sx={{ maxWidth: 150 }}
                          />

                          <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>{t("public.event.editAllocations")}</Typography>
                            <Stack spacing={0.5}>
                              {managedParticipants.map((p) => (
                                <FormControlLabel
                                  key={p.participant_id}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={!!editParticipantIds[p.participant_id]}
                                      onChange={() => toggleEditParticipant(p.participant_id)}
                                    />
                                  }
                                  label={`${p.display_name} (${p.attendance_status})`}
                                />
                              ))}
                            </Stack>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            <Button variant="contained" size="small" onClick={saveEdit}>
                              {t("public.event.save")}
                            </Button>
                            <Button variant="outlined" size="small" onClick={cancelEdit}>
                              {t("public.event.cancel")}
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    ) : canEditSelections ? (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button variant="outlined" size="small" onClick={() => startEdit(s)}>
                          {t("public.event.edit")}
                        </Button>
                        <Button variant="outlined" size="small" color="error" onClick={() => removeSelection(s.id)}>
                          {t("public.event.remove")}
                        </Button>
                      </Stack>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
