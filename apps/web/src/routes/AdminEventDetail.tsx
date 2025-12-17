import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useParams } from "react-router-dom";

import { useApi } from "../auth";
import { utcIsoToJalaliDate } from "../utils/jalali";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
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
  TextField,
  Typography
} from "@mui/material";

type UserRow = {
  id: string;
  mobilePhone?: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
};

type EventRow = {
  id: string;
  name: string;
  location_text: string;
  location_user_id: string | null;
  host_user_id: string;
  starts_at_utc: string;
  cutoff_at_utc: string;
  state: string;
  payor_exemption_enabled?: number;
};

type HostRow = {
  event_id: string;
  user_id: string;
  created_at: string;
};

type SharedCostRow = {
  id: string;
  event_id: string;
  name: string;
  amount_irr: number;
  split_method: string;
  created_at: string;
};

type GuestRow = {
  event_id: string;
  user_id: string;
  created_at: string;
};

type MenuRow = {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  created_at: string;
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

type PayorOverrideRow = {
  event_id: string;
  participant_id: string;
  payor_user_id: string;
  created_at: string;
};

type ChargeRow = {
  event_id: string;
  payor_user_id: string;
  payor_email: string;
  payor_name: string;
  total_irr: number;
  finalized_at_utc: string;
};

type PayorSummary = {
  payorUserId: string;
  payorEmail: string;
  totalIrr: number;
  participants: { participantId: string; participantName: string; amountIrr: number }[];
};

type PayorPaymentStatusRow = {
  event_id: string;
  payor_user_id: string;
  status: "PAID" | "UNPAID";
  updated_at: string;
};

type ParticipantCharge = {
  participantId: string;
  participantName: string;
  payorUserId: string;
  payorEmail: string;
  totalIrr: number;
  breakdown: {
    selectionId: string;
    itemName: string;
    quantity: number;
    unitPriceIrr: number;
    shareCount: number;
    shareAmountIrr: number;
  }[];
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

export default function AdminEventDetail() {
  const { t } = useTranslation();
  const api = useApi();
  const { eventId } = useParams();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [eventParticipants, setEventParticipants] = useState<EventParticipantRow[]>([]);
  const [overrides, setOverrides] = useState<PayorOverrideRow[]>([]);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [sharedCosts, setSharedCosts] = useState<SharedCostRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [selections, setSelections] = useState<SelectionRow[]>([]);
  const [chargesPreview, setChargesPreview] = useState<{
    participantCharges: ParticipantCharge[];
    payorSummaries: PayorSummary[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guestUserId, setGuestUserId] = useState("");
  const [menuName, setMenuName] = useState("");
  const [participantIdToAdd, setParticipantIdToAdd] = useState("");
  const [managingUserId, setManagingUserId] = useState("");
  const [targetState, setTargetState] = useState<string>("");
  const [locationUserId, setLocationUserId] = useState<string>("");
  const [newHostUserId, setNewHostUserId] = useState<string>("");
  const [newSharedCostName, setNewSharedCostName] = useState<string>("");
  const [newSharedCostAmountIrr, setNewSharedCostAmountIrr] = useState<string>("");

  const [orderSummaryMenuName, setOrderSummaryMenuName] = useState("");

  const [eventParticipantSearch, setEventParticipantSearch] = useState("");
  const [eventParticipantOwnerUserId, setEventParticipantOwnerUserId] = useState("");
  const [eventParticipantAttendanceStatus, setEventParticipantAttendanceStatus] = useState("");
  const [chargesPreviewPayorUserId, setChargesPreviewPayorUserId] = useState("");
  const [chargesPreviewPaymentStatus, setChargesPreviewPaymentStatus] = useState<"" | "PAID" | "UNPAID">("");
  const [payorPaymentStatuses, setPayorPaymentStatuses] = useState<Record<string, "PAID" | "UNPAID">>({});

  const overrideByParticipant = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of overrides) m.set(o.participant_id, o.payor_user_id);
    return m;
  }, [overrides]);

  const guestIds = useMemo(() => new Set(guests.map((g) => g.user_id)), [guests]);

  const hostIds = useMemo(() => new Set(hosts.map((h) => h.user_id)), [hosts]);

  const userById = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const userLabel = (id: string) => {
    const u = userById.get(id);
    if (!u) return id;
    const contact = u.mobilePhone || u.email;
    return contact ? `${u.displayName} (${contact})` : u.displayName;
  };

  const setPayorPaymentStatus = async (payorUserId: string, status: "PAID" | "UNPAID") => {
    if (!eventId) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/admin/events/${eventId}/payor-payment-statuses/${payorUserId}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      setPayorPaymentStatuses((prev) => ({ ...prev, [payorUserId]: status }));
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const payorBreakdowns = useMemo(() => {
    const pcs = chargesPreview?.participantCharges ?? [];

    const byPayor = new Map<string, { foodIrr: number; sharedCostsIrr: number; hostFeeIrr: number }>();

    for (const pc of pcs) {
      if (!byPayor.has(pc.payorUserId)) {
        byPayor.set(pc.payorUserId, { foodIrr: 0, sharedCostsIrr: 0, hostFeeIrr: 0 });
      }
      const agg = byPayor.get(pc.payorUserId)!;

      for (const b of pc.breakdown ?? []) {
        const lineAmount = (b.shareAmountIrr ?? 0);
        if (typeof lineAmount !== "number") continue;

        const isSharedCost = String(b.selectionId).startsWith("shared:");
        const isHostRedistribution = !!(b as any).isHostRedistribution;

        if (isHostRedistribution) {
          agg.hostFeeIrr += lineAmount;
        } else if (isSharedCost) {
          agg.sharedCostsIrr += lineAmount;
        } else {
          agg.foodIrr += lineAmount;
        }
      }
    }

    return byPayor;
  }, [chargesPreview]);

  const chargesPreviewCombined = useMemo(() => {
    let foodIrr = 0;
    let sharedCostsIrr = 0;
    let hostFeeIrr = 0;

    for (const v of payorBreakdowns.values()) {
      foodIrr += Number(v.foodIrr ?? 0) || 0;
      sharedCostsIrr += Number(v.sharedCostsIrr ?? 0) || 0;
      hostFeeIrr += Number(v.hostFeeIrr ?? 0) || 0;
    }

    return {
      foodIrr,
      sharedCostsIrr,
      hostFeeIrr,
      totalIrr: foodIrr + sharedCostsIrr + hostFeeIrr
    };
  }, [payorBreakdowns]);

  const payorChargeStatus = (payorUserId: string): "PAID" | "UNPAID" => {
    return payorPaymentStatuses[payorUserId] ?? "UNPAID";
  };

  const filteredPayorSummaries = useMemo(() => {
    const summaries = chargesPreview?.payorSummaries ?? [];

    return summaries.filter((ps) => {
      if (chargesPreviewPayorUserId && ps.payorUserId !== chargesPreviewPayorUserId) return false;
      if (chargesPreviewPaymentStatus && payorChargeStatus(ps.payorUserId) !== chargesPreviewPaymentStatus) return false;
      return true;
    });
  }, [chargesPreview, chargesPreviewPayorUserId, chargesPreviewPaymentStatus, payorPaymentStatuses]);

  const filteredPayorUserIds = useMemo(() => {
    return new Set<string>((filteredPayorSummaries ?? []).map((x) => x.payorUserId));
  }, [filteredPayorSummaries]);

  const chargesPreviewCombinedFiltered = useMemo(() => {
    let foodIrr = 0;
    let sharedCostsIrr = 0;
    let hostFeeIrr = 0;

    for (const [payorUserId, v] of payorBreakdowns.entries()) {
      if (!filteredPayorUserIds.has(payorUserId)) continue;
      foodIrr += Number(v.foodIrr ?? 0) || 0;
      sharedCostsIrr += Number(v.sharedCostsIrr ?? 0) || 0;
      hostFeeIrr += Number(v.hostFeeIrr ?? 0) || 0;
    }

    return {
      foodIrr,
      sharedCostsIrr,
      hostFeeIrr,
      totalIrr: foodIrr + sharedCostsIrr + hostFeeIrr
    };
  }, [payorBreakdowns, filteredPayorUserIds]);

  const chargesPreviewCollectedTotalIrr = useMemo(() => {
    let total = 0;
    for (const ps of filteredPayorSummaries ?? []) {
      total += Number(ps.totalIrr ?? 0) || 0;
    }
    return total;
  }, [filteredPayorSummaries]);

  const eventFoodSubtotalIrr = useMemo(() => {
    let total = 0;
    for (const s of selections) {
      total += (Number(s.quantity ?? 0) || 0) * (Number(s.item_price_irr ?? 0) || 0);
    }
    return total;
  }, [selections]);

  const eventSharedCostsSubtotalIrr = useMemo(() => {
    let total = 0;
    for (const sc of sharedCosts) {
      total += Number(sc.amount_irr ?? 0) || 0;
    }
    return total;
  }, [sharedCosts]);

  const filteredEventParticipants = useMemo(() => {
    const q = eventParticipantSearch.trim().toLowerCase();
    return eventParticipants.filter((ep) => {
      if (eventParticipantAttendanceStatus && ep.attendance_status !== eventParticipantAttendanceStatus) return false;
      const p = participants.find((x) => x.id === ep.participant_id);
      if (eventParticipantOwnerUserId && p?.owner_user_id !== eventParticipantOwnerUserId) return false;
      if (!q) return true;
      const name = (p?.display_name ?? "").toLowerCase();
      return name.includes(q);
    });
  }, [eventParticipants, participants, eventParticipantSearch, eventParticipantOwnerUserId, eventParticipantAttendanceStatus]);

  const eventParticipantAttendanceStatuses = useMemo(() => {
    const s = new Set<string>();
    for (const ep of eventParticipants) {
      if (ep?.attendance_status) s.add(ep.attendance_status);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [eventParticipants]);

  const eventParticipantOwnerUserIds = useMemo(() => {
    const s = new Set<string>();
    for (const ep of eventParticipants) {
      const p = participants.find((x) => x.id === ep.participant_id);
      if (p?.owner_user_id) s.add(p.owner_user_id);
    }
    return [...s].sort((a, b) => userLabel(a).localeCompare(userLabel(b)));
  }, [eventParticipants, participants, users]);

  const orderSummaryItems = useMemo(() => {
    const byItem = new Map<string, { itemName: string; quantity: number; unitPriceIrr: number }>();

    const scopedSelections = orderSummaryMenuName
      ? selections.filter((s) => s.menu_name === orderSummaryMenuName)
      : selections;

    for (const s of scopedSelections) {
      const key = s.menu_item_id || String(s.item_name || "");
      if (!byItem.has(key)) {
        byItem.set(key, { itemName: s.item_name, quantity: 0, unitPriceIrr: Number(s.item_price_irr ?? 0) || 0 });
      }
      const agg = byItem.get(key)!;
      agg.quantity += Number(s.quantity ?? 0) || 0;
    }

    return [...byItem.values()].sort((a, b) => {
      return (a.itemName || "").localeCompare(b.itemName || "");
    });
  }, [selections, orderSummaryMenuName]);

  const orderSummaryTotalQuantity = useMemo(() => {
    let total = 0;
    for (const x of orderSummaryItems) total += Number(x.quantity ?? 0) || 0;
    return total;
  }, [orderSummaryItems]);

  const orderSummarySubtotalIrr = useMemo(() => {
    let total = 0;
    for (const x of orderSummaryItems) {
      const lineTotal = (Number(x.quantity ?? 0) || 0) * (Number(x.unitPriceIrr ?? 0) || 0);
      total += lineTotal;
    }
    return total;
  }, [orderSummaryItems]);

  const orderSummaryMenuNames = useMemo(() => {
    const s = new Set<string>();
    for (const m of menus) {
      if (m?.name) s.add(m.name);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [menus]);

  const load = async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const [
        evRes,
        usersRes,
        guestsRes,
        hostsRes,
        sharedCostsRes,
        menusRes,
        participantsRes,
        eventParticipantsRes,
        overridesRes,
        selectionsRes,
        payorStatusesRes
      ] = await Promise.all([
        api.fetch(`/api/v1/admin/events/${eventId}`, { method: "GET" }),
        api.fetch("/api/v1/admin/users", { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/guests`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/hosts`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/shared-costs`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/menus`, { method: "GET" }),
        api.fetch("/api/v1/admin/participants", { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/participants`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/payor-overrides`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/selections`, { method: "GET" }),
        api.fetch(`/api/v1/admin/events/${eventId}/payor-payment-statuses`, { method: "GET" })
      ]);

      const ev = (await evRes.json()) as EventRow;
      setEvent(ev);
      setTargetState(ev.state);
      setUsers((await usersRes.json()) as UserRow[]);
      setGuests((await guestsRes.json()) as GuestRow[]);
      setHosts((await hostsRes.json()) as HostRow[]);
      setSharedCosts((await sharedCostsRes.json()) as SharedCostRow[]);
      setMenus((await menusRes.json()) as MenuRow[]);
      setParticipants((await participantsRes.json()) as ParticipantRow[]);
      setEventParticipants((await eventParticipantsRes.json()) as EventParticipantRow[]);
      setOverrides((await overridesRes.json()) as PayorOverrideRow[]);
      setSelections((await selectionsRes.json()) as SelectionRow[]);

      const statusRows = (await payorStatusesRes.json()) as PayorPaymentStatusRow[];
      const statusMap: Record<string, "PAID" | "UNPAID"> = {};
      for (const r of statusRows) {
        statusMap[r.payor_user_id] = r.status;
      }
      setPayorPaymentStatuses(statusMap);

      const chargesRes = await api.fetch(`/api/v1/admin/events/${eventId}/charges`, { method: "GET" });
      setCharges((await chargesRes.json()) as ChargeRow[]);

      const previewRes = await api.fetch(`/api/v1/admin/events/${eventId}/charges-preview`, { method: "GET" });
      const previewData = (await previewRes.json()) as {
        participantCharges: ParticipantCharge[];
        payorSummaries: PayorSummary[];
      };
      setChargesPreview(previewData);

      if (!locationUserId) {
        setLocationUserId(ev.location_user_id ?? "");
      }

      if (!managingUserId) {
        if (ev.host_user_id) setManagingUserId(ev.host_user_id);
      }
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const addGuest = async () => {
    if (!eventId || !guestUserId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/guests`, {
      method: "POST",
      body: JSON.stringify({ userId: guestUserId })
    });
    setGuestUserId("");
    await load();
  };

  const removeGuest = async (userId: string) => {
    if (!eventId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/guests/${userId}`, { method: "DELETE" });
    await load();
  };

  const addHost = async () => {
    if (!eventId || !newHostUserId) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/admin/events/${eventId}/hosts`, {
        method: "POST",
        body: JSON.stringify({ userId: newHostUserId })
      });
      setNewHostUserId("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const removeHost = async (userId: string) => {
    if (!eventId) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/admin/events/${eventId}/hosts/${userId}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const updateLocation = async (nextUserId: string) => {
    if (!eventId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ locationUserId: nextUserId ? nextUserId : null })
    });
    setLocationUserId(nextUserId);
    await load();
  };

  const addSharedCost = async () => {
    if (!eventId) return;
    const amountIrr = Number(newSharedCostAmountIrr);
    if (!newSharedCostName.trim() || !Number.isInteger(amountIrr) || amountIrr < 0) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/shared-costs`, {
      method: "POST",
      body: JSON.stringify({ name: newSharedCostName.trim(), amountIrr, splitMethod: "EQUAL_ALL_ATTENDING" })
    });
    setNewSharedCostName("");
    setNewSharedCostAmountIrr("");
    await load();
  };

  const removeSharedCost = async (sharedCostId: string) => {
    if (!eventId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/shared-costs/${sharedCostId}`, { method: "DELETE" });
    await load();
  };

  const createMenu = async () => {
    if (!eventId || !menuName.trim()) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/menus`, {
      method: "POST",
      body: JSON.stringify({ name: menuName })
    });
    setMenuName("");
    await load();
  };

  const addParticipantToEvent = async () => {
    if (!eventId || !participantIdToAdd) return;

    const participant = participants.find((p) => p.id === participantIdToAdd);
    const effectiveManagingUserId = managingUserId || participant?.owner_user_id;
    if (!effectiveManagingUserId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/participants`, {
      method: "POST",
      body: JSON.stringify({
        participantId: participantIdToAdd,
        managingUserId: effectiveManagingUserId,
        attendanceStatus: "ATTENDING"
      })
    });
    setParticipantIdToAdd("");
    await load();
  };

  const setOverride = async (participantId: string, payorUserId: string) => {
    if (!eventId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/payor-overrides/${participantId}`, {
      method: "PUT",
      body: JSON.stringify({ payorUserId })
    });
    await load();
  };

  const clearOverride = async (participantId: string) => {
    if (!eventId) return;
    await api.fetch(`/api/v1/admin/events/${eventId}/payor-overrides/${participantId}`, { method: "DELETE" });
    await load();
  };

  const removeParticipantFromEvent = async (participantId: string) => {
    if (!eventId) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/admin/events/${eventId}/participants/${participantId}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const transitionState = async (targetState: string) => {
    if (!eventId) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/admin/events/${eventId}/transition`, {
        method: "POST",
        body: JSON.stringify({ targetState })
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const applyTargetState = async () => {
    if (!eventId || !event) return;
    if (!targetState || targetState === event.state) return;

    const states = ["DRAFT", "OPEN", "LOCKED", "COMPLETED"];
    const currentIdx = states.indexOf(event.state);
    const targetIdx = states.indexOf(targetState);

    setError(null);
    try {
      if (currentIdx === -1 || targetIdx === -1) {
        throw new Error("invalid state");
      }

      if (targetIdx <= currentIdx) {
        await api.fetch(`/api/v1/admin/events/${eventId}/state`, {
          method: "POST",
          body: JSON.stringify({ targetState })
        });
        await load();
        return;
      }

      for (let i = currentIdx + 1; i <= targetIdx; i++) {
        await api.fetch(`/api/v1/admin/events/${eventId}/transition`, {
          method: "POST",
          body: JSON.stringify({ targetState: states[i] })
        });
      }
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
  if (error) {
    return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  }
  if (!event) {
    return <Alert severity="warning" sx={{ mt: 2 }}>{t("admin.events.detail.notFound")}</Alert>;
  }

  const allowedTargetStates = () => {
    return ["DRAFT", "OPEN", "LOCKED", "COMPLETED"];
  };

  const startsMs = Date.parse(event.starts_at_utc);
  const cutoffMs = Date.parse(event.cutoff_at_utc);
  const invalidSchedule = Number.isFinite(startsMs) && Number.isFinite(cutoffMs) ? cutoffMs > startsMs : false;

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={`${t("admin.events.detail.title")}: ${event.name}`}
          action={
            <Chip
              label={event.state}
              color={event.state === "OPEN" ? "success" : event.state === "COMPLETED" ? "primary" : "default"}
            />
          }
        />
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>{t("admin.events.detail.starts")}:</strong> {utcIsoToJalaliDate(event.starts_at_utc)}
            </Typography>
            <Typography variant="body2">
              <strong>{t("admin.events.detail.cutoff")}:</strong> {utcIsoToJalaliDate(event.cutoff_at_utc)}
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>{t("admin.events.location")}</InputLabel>
                <Select
                  value={locationUserId}
                  label={t("admin.events.location")}
                  onChange={(e) => {
                    const next = e.target.value;
                    void updateLocation(next);
                  }}
                >
                  <MenuItem value="">--</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                {event.location_text}
              </Typography>
            </Stack>
            {invalidSchedule && <Alert severity="warning" sx={{ mt: 1 }}>{t("admin.events.detail.invalidSchedule")}</Alert>}

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">{t("admin.events.detail.changeState")}:</Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={targetState}
                  onChange={(e) => setTargetState(e.target.value)}
                >
                  {allowedTargetStates().map((s) => (
                    <MenuItem key={s} value={s}>
                      {s === "DRAFT"
                        ? t("admin.events.detail.stateDraft")
                        : s === "OPEN"
                          ? t("admin.events.detail.stateOpen")
                          : s === "LOCKED"
                            ? t("admin.events.detail.stateLocked")
                            : t("admin.events.detail.stateCompleted")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" onClick={applyTargetState} disabled={!targetState || targetState === event.state}>
                {t("admin.events.detail.applyState")}
              </Button>
            </Stack>

          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardHeader title={t("admin.events.detail.sharedCosts", { defaultValue: "Shared Costs" })} />
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label={t("admin.events.detail.menuNamePlaceholder")}
              value={newSharedCostName}
              onChange={(e) => setNewSharedCostName(e.target.value)}
            />
            <TextField
              size="small"
              label={t("admin.events.detail.amount")}
              value={newSharedCostAmountIrr}
              onChange={(e) => setNewSharedCostAmountIrr(e.target.value)}
            />
            <Button variant="contained" size="small" onClick={addSharedCost}>
              {t("admin.events.detail.createMenu")}
            </Button>
          </Stack>
          {sharedCosts.length === 0 ? (
            <Typography color="text.secondary">{t("admin.events.detail.noCharges")}</Typography>
          ) : (
            <Stack spacing={1}>
              {sharedCosts.map((sc) => (
                <Stack key={sc.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{sc.name} — {sc.amount_irr.toLocaleString()} IRR</Typography>
                  <Button size="small" color="error" onClick={() => removeSharedCost(sc.id)}>
                    {t("admin.events.detail.remove")}
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.events.host")} />
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>{t("admin.events.detail.selectUser")}</InputLabel>
                <Select
                  value={newHostUserId}
                  label={t("admin.events.detail.selectUser")}
                  onChange={(e) => setNewHostUserId(e.target.value)}
                >
                  <MenuItem value="">--</MenuItem>
                  {users.filter((u) => !hostIds.has(u.id)).map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" onClick={addHost} disabled={!newHostUserId}>
                {t("admin.events.detail.addGuest")}
              </Button>
            </Stack>
            <Stack spacing={1}>
              {hosts.map((h) => (
                <Stack key={h.user_id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{userLabel(h.user_id)}</Typography>
                  <Button size="small" color="error" onClick={() => removeHost(h.user_id)} disabled={hosts.length <= 1}>
                    {t("admin.events.detail.remove")}
                  </Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.events.detail.guests")} />
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t("admin.events.detail.selectUser")}</InputLabel>
                <Select
                  value={guestUserId}
                  label={t("admin.events.detail.selectUser")}
                  onChange={(e) => setGuestUserId(e.target.value)}
                >
                  <MenuItem value="">--</MenuItem>
                  {users.filter((u) => !guestIds.has(u.id)).map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" onClick={addGuest}>{t("admin.events.detail.addGuest")}</Button>
            </Stack>
            <Stack spacing={1}>
              {guests.map((g) => (
                <Stack key={g.user_id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{userLabel(g.user_id)}</Typography>
                  <Button size="small" color="error" onClick={() => removeGuest(g.user_id)}>{t("admin.events.detail.remove")}</Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardHeader title={t("admin.events.detail.menus")} />
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                size="small"
                value={menuName}
                onChange={(e) => setMenuName(e.target.value)}
                placeholder={t("admin.events.detail.menuNamePlaceholder")}
              />
              <Button variant="contained" size="small" onClick={createMenu}>{t("admin.events.detail.createMenu")}</Button>
            </Stack>
            <Stack spacing={1}>
              {menus.map((m) => (
                <Stack key={m.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{m.name}</Typography>
                  <Link component={RouterLink} to={`/admin/menus/${m.id}`} underline="hover">{t("admin.events.detail.manageItems")}</Link>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Card sx={{ mt: 3 }}>
        <CardHeader
          title={t("admin.events.detail.orderSummary", { defaultValue: "Order Summary" })}
          subheader={t("admin.events.detail.orderSummaryCount", {
            defaultValue: "{{items}} item(s), {{qty}} total",
            items: orderSummaryItems.length,
            qty: orderSummaryTotalQuantity
          })}
        />
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>{t("admin.events.detail.filterMenu", { defaultValue: "Menu" })}</InputLabel>
              <Select
                value={orderSummaryMenuName}
                label={t("admin.events.detail.filterMenu", { defaultValue: "Menu" })}
                onChange={(e) => setOrderSummaryMenuName(e.target.value)}
              >
                <MenuItem value="">--</MenuItem>
                {orderSummaryMenuNames.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {orderSummaryItems.length === 0 ? (
            <Typography color="text.secondary">
              {t("admin.events.detail.orderSummaryEmpty", { defaultValue: "No selections yet." })}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {orderSummaryItems.map((x) => (
                <Typography key={x.itemName} variant="body2">
                  {x.itemName} × {x.quantity} × {x.unitPriceIrr.toLocaleString()} = {(x.quantity * x.unitPriceIrr).toLocaleString()}
                </Typography>
              ))}
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2">
                {t("admin.events.detail.orderSummarySubtotal", { defaultValue: "Subtotal" })}: {orderSummarySubtotalIrr.toLocaleString()}
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardHeader
          title={t("admin.events.detail.eventParticipants")}
          subheader={t("admin.events.detail.eventParticipantsCount", {
            defaultValue: "Showing {{shown}} of {{total}}",
            shown: filteredEventParticipants.length,
            total: eventParticipants.length
          })}
          action={
            <Link component={RouterLink} to={`/admin/events/${event.id}/selections`} underline="hover">
              {t("admin.events.detail.manageSelections")}
            </Link>
          }
        />
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t("admin.events.detail.participant")}</InputLabel>
              <Select
                value={participantIdToAdd}
                label={t("admin.events.detail.participant")}
                onChange={(e) => setParticipantIdToAdd(e.target.value)}
              >
                <MenuItem value="">--</MenuItem>
                {participants.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.display_name} ({userLabel(p.owner_user_id)})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t("admin.events.detail.managingUser")}</InputLabel>
              <Select
                value={managingUserId}
                label={t("admin.events.detail.managingUser")}
                onChange={(e) => setManagingUserId(e.target.value)}
              >
                <MenuItem value="">--</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.displayName} ({u.email})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" size="small" onClick={addParticipantToEvent}>{t("admin.events.detail.addParticipant")}</Button>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label={t("admin.events.detail.searchParticipant", { defaultValue: "Search participant" })}
              value={eventParticipantSearch}
              onChange={(e) => setEventParticipantSearch(e.target.value)}
              fullWidth
            />
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>{t("admin.events.detail.filterOwner", { defaultValue: "Filter owner" })}</InputLabel>
              <Select
                value={eventParticipantOwnerUserId}
                label={t("admin.events.detail.filterOwner", { defaultValue: "Filter owner" })}
                onChange={(e) => setEventParticipantOwnerUserId(e.target.value)}
              >
                <MenuItem value="">--</MenuItem>
                {eventParticipantOwnerUserIds.map((uid) => (
                  <MenuItem key={uid} value={uid}>{userLabel(uid)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t("admin.events.detail.filterAttendance", { defaultValue: "Attendance" })}</InputLabel>
              <Select
                value={eventParticipantAttendanceStatus}
                label={t("admin.events.detail.filterAttendance", { defaultValue: "Attendance" })}
                onChange={(e) => setEventParticipantAttendanceStatus(e.target.value)}
              >
                <MenuItem value="">--</MenuItem>
                {eventParticipantAttendanceStatuses.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack spacing={2}>
            {filteredEventParticipants.map((ep) => {
              const participant = participants.find((p) => p.id === ep.participant_id);
              const overridePayor = overrideByParticipant.get(ep.participant_id) ?? "";

              return (
                <Card key={ep.participant_id} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2">{participant?.display_name ?? ep.participant_id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("admin.events.detail.attendance")}: {ep.attendance_status}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                          <InputLabel>{t("admin.events.detail.payorOverride")}</InputLabel>
                          <Select
                            value={overridePayor}
                            label={t("admin.events.detail.payorOverride")}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) setOverride(ep.participant_id, v);
                            }}
                          >
                            <MenuItem value="">--</MenuItem>
                            {users.map((u) => (
                              <MenuItem key={u.id} value={u.id}>{u.displayName}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button size="small" variant="outlined" onClick={() => clearOverride(ep.participant_id)}>
                          {t("admin.events.detail.clearOverride")}
                        </Button>
                        <Button size="small" color="error" onClick={() => removeParticipantFromEvent(ep.participant_id)}>
                          {t("admin.events.detail.remove")}
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardHeader title={t("admin.events.detail.chargesPreview")} />
        <CardContent>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="subtitle2">
                {t("admin.events.detail.chargesPreviewCombined", { defaultValue: "Combined totals" })}
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.breakdownFood", { defaultValue: "Food" })}: {chargesPreviewCombinedFiltered.foodIrr.toLocaleString()} IRR
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.breakdownSharedCosts", { defaultValue: "Shared costs" })}: {chargesPreviewCombinedFiltered.sharedCostsIrr.toLocaleString()} IRR
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.breakdownHostFee", { defaultValue: "Host fee" })}: {chargesPreviewCombinedFiltered.hostFeeIrr.toLocaleString()} IRR
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.chargesPreviewCollected", { defaultValue: "Collected from payors" })}: {chargesPreviewCollectedTotalIrr.toLocaleString()} IRR
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.chargesPreviewCombinedTotal", { defaultValue: "Charged total" })}: {chargesPreviewCombinedFiltered.totalIrr.toLocaleString()} IRR
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.chargesPreviewDiscrepancy", { defaultValue: "Discrepancy" })}: {(chargesPreviewCollectedTotalIrr - chargesPreviewCombinedFiltered.totalIrr).toLocaleString()} IRR
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.orderSummarySubtotal", { defaultValue: "Subtotal" })}: {(eventFoodSubtotalIrr + eventSharedCostsSubtotalIrr).toLocaleString()} IRR
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("admin.events.detail.chargesPreviewExpectedVsCollected", { defaultValue: "Expected - collected" })}: {((eventFoodSubtotalIrr + eventSharedCostsSubtotalIrr) - chargesPreviewCollectedTotalIrr).toLocaleString()} IRR
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>{t("admin.events.detail.filterPayor", { defaultValue: "Filter payor" })}</InputLabel>
              <Select
                value={chargesPreviewPayorUserId}
                label={t("admin.events.detail.filterPayor", { defaultValue: "Filter payor" })}
                onChange={(e) => setChargesPreviewPayorUserId(e.target.value)}
              >
                <MenuItem value="">--</MenuItem>
                {(chargesPreview?.payorSummaries ?? []).map((ps) => (
                  <MenuItem key={ps.payorUserId} value={ps.payorUserId}>
                    {userLabel(ps.payorUserId)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>{t("admin.events.detail.filterPaymentStatus", { defaultValue: "Payment" })}</InputLabel>
              <Select
                value={chargesPreviewPaymentStatus}
                label={t("admin.events.detail.filterPaymentStatus", { defaultValue: "Payment" })}
                onChange={(e) => setChargesPreviewPaymentStatus(e.target.value as any)}
              >
                <MenuItem value="">--</MenuItem>
                <MenuItem value="UNPAID">{t("admin.events.detail.unpaid", { defaultValue: "Unpaid" })}</MenuItem>
                <MenuItem value="PAID">{t("admin.events.detail.paid", { defaultValue: "Paid" })}</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {(chargesPreview?.payorSummaries?.length ?? 0) === 0 ? (
            <Typography color="text.secondary">{t("admin.events.detail.noCharges")}</Typography>
          ) : (
            <Stack spacing={2}>
              {filteredPayorSummaries.map((ps) => {
                const bd = payorBreakdowns.get(ps.payorUserId) ?? { foodIrr: 0, sharedCostsIrr: 0, hostFeeIrr: 0 };
                return (
                <Card key={ps.payorUserId} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ md: "center" }}>
                      <Typography variant="subtitle2">{userLabel(ps.payorUserId)} — {ps.totalIrr.toLocaleString()} IRR</Typography>
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>{t("admin.events.detail.paymentStatus", { defaultValue: "Payment" })}</InputLabel>
                        <Select
                          value={payorChargeStatus(ps.payorUserId)}
                          label={t("admin.events.detail.paymentStatus", { defaultValue: "Payment" })}
                          onChange={(e) => void setPayorPaymentStatus(ps.payorUserId, e.target.value as any)}
                        >
                          <MenuItem value="UNPAID">{t("admin.events.detail.unpaid", { defaultValue: "Unpaid" })}</MenuItem>
                          <MenuItem value="PAID">{t("admin.events.detail.paid", { defaultValue: "Paid" })}</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("admin.events.detail.breakdownFood", { defaultValue: "Food" })}: {bd.foodIrr.toLocaleString()} IRR
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("admin.events.detail.breakdownSharedCosts", { defaultValue: "Shared costs" })}: {bd.sharedCostsIrr.toLocaleString()} IRR
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("admin.events.detail.breakdownHostFee", { defaultValue: "Host fee" })}: {bd.hostFeeIrr.toLocaleString()} IRR
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {ps.participants.map((p) => `${p.participantName}: ${p.amountIrr.toLocaleString()}`).join(", ")}
                    </Typography>
                  </CardContent>
                </Card>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {(event.state === "LOCKED" || event.state === "COMPLETED") && (
        <Card sx={{ mt: 3 }}>
          <CardHeader title={t("admin.events.detail.finalizedCharges")} />
          <CardContent>
            {charges.length === 0 ? (
              <Typography color="text.secondary">{t("admin.events.detail.noCharges")}</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.events.detail.payor")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.events.detail.amount")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.events.detail.finalizedAt")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {charges.map((c) => (
                      <TableRow key={c.payor_user_id} hover>
                        <TableCell>{c.payor_name} ({c.payor_email})</TableCell>
                        <TableCell>{c.total_irr.toLocaleString()} IRR</TableCell>
                        <TableCell>{c.finalized_at_utc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
