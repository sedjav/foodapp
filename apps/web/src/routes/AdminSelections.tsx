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
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";

type MenuItemRow = {
  id: string;
  menu_id: string;
  menu_name: string;
  name: string;
  price_irr: number;
  category_id: string | null;
  category_name_en: string | null;
  category_name_fa: string | null;
  tags: string[];
};

type ParticipantRow = {
  id: string;
  owner_user_id: string;
  display_name: string;
  created_at: string;
};

type EventParticipantRow = {
  event_id: string;
  participant_id: string;
  managing_user_id: string;
  attendance_status: string;
  created_at: string;
};

type SelectionRow = {
  id: string;
  event_id: string;
  menu_item_id: string;
  quantity: number;
  created_by_user_id: string;
  note: string | null;
  created_at: string;
  item_name: string;
  item_price_irr: number;
  menu_name: string;
  category_name_en: string | null;
  category_name_fa: string | null;
  allocations: { participant_id: string }[];
};

export default function AdminSelections() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const { eventId } = useParams();

  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [eventParticipants, setEventParticipants] = useState<EventParticipantRow[]>([]);
  const [selections, setSelections] = useState<SelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Record<string, boolean>>({});

  const participantLabel = (pid: string) => {
    const p = participants.find((x) => x.id === pid);
    return p ? p.display_name : pid;
  };

  const attendingParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ep of eventParticipants) {
      if (ep.attendance_status === "ATTENDING") ids.add(ep.participant_id);
    }
    return ids;
  }, [eventParticipants]);

  const unselectedAttendingParticipantIds = useMemo(() => {
    const selected = new Set<string>();
    for (const s of selections) {
      for (const a of s.allocations ?? []) {
        selected.add(a.participant_id);
      }
    }

    return [...attendingParticipantIds]
      .filter((pid) => !selected.has(pid))
      .sort((a, b) => participantLabel(a).localeCompare(participantLabel(b)));
  }, [attendingParticipantIds, selections, participants]);

  const load = async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const [itemsRes, participantsRes, eventParticipantsRes, selectionsRes] = await Promise.all([
        api.fetch(`/api/v1/admin/events/${eventId}/menu-items`, { method: "GET" }),
        api.fetch(`/api/v1/admin/participants`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/participants`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/selections`, { method: "GET" })
      ]);

      setMenuItems((await itemsRes.json()) as MenuItemRow[]);
      setParticipants((await participantsRes.json()) as ParticipantRow[]);
      setEventParticipants((await eventParticipantsRes.json()) as EventParticipantRow[]);
      setSelections((await selectionsRes.json()) as SelectionRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const toggleParticipant = (pid: string) => {
    setSelectedParticipantIds((prev) => ({
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
      await api.fetch(`/api/v1/admin/events/${eventId}/selections`, {
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
      await api.fetch(`/api/v1/admin/selections/${selectionId}`, { method: "DELETE" });
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

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={t("admin.selections.missingSelectionsTitle", { defaultValue: "Participants without food selection" })}
          subheader={t("admin.selections.missingSelectionsCount", {
            defaultValue: "{{count}} attending participant(s) have no selection",
            count: unselectedAttendingParticipantIds.length
          })}
        />
        <CardContent>
          {unselectedAttendingParticipantIds.length === 0 ? (
            <Typography color="text.secondary">
              {t("admin.selections.missingSelectionsNone", { defaultValue: "All attending participants have at least one selection." })}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {unselectedAttendingParticipantIds.map((pid) => (
                <Typography key={pid} variant="body2">
                  {participantLabel(pid)}
                </Typography>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card sx={{ flex: 1, maxWidth: 500 }}>
          <CardHeader title={t("admin.selections.title")} subheader="Create a new selection" />
          <CardContent>
            <Box component="form" onSubmit={createSelection}>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t("admin.selections.menuItem")}</InputLabel>
                  <Select
                    value={menuItemId}
                    label={t("admin.selections.menuItem")}
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
                  label={t("admin.selections.quantity")}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  inputProps={{ min: 1, step: 1 }}
                  fullWidth
                  size="small"
                />

                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>{t("admin.selections.allocateTo")}</Typography>
                  <Stack spacing={0.5}>
                    {eventParticipants
                      .filter((ep) => attendingParticipantIds.has(ep.participant_id))
                      .map((ep) => (
                        <FormControlLabel
                          key={ep.participant_id}
                          control={
                            <Checkbox
                              size="small"
                              checked={!!selectedParticipantIds[ep.participant_id]}
                              onChange={() => toggleParticipant(ep.participant_id)}
                            />
                          }
                          label={participantLabel(ep.participant_id)}
                        />
                      ))}
                  </Stack>
                </Box>

                <Button type="submit" variant="contained">{t("admin.selections.create")}</Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 2 }}>
          <CardHeader title={t("admin.selections.listTitle")} />
          <CardContent>
            <Stack spacing={2}>
              {selections.map((s) => (
                <Card key={s.id} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2">
                          {s.menu_name} — {s.item_name} × {s.quantity}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("admin.selections.allocations")}: {s.allocations.map((a) => participantLabel(a.participant_id)).join(", ")}
                        </Typography>
                      </Box>
                      <Button size="small" color="error" onClick={() => removeSelection(s.id)}>
                        {t("admin.selections.remove")}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
