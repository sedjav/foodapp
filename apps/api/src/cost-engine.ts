import type { Db } from "./db/client.js";

export type ParticipantCharge = {
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

export type PayorSummary = {
  payorUserId: string;
  payorEmail: string;
  totalIrr: number;
  participants: { participantId: string; participantName: string; amountIrr: number }[];
};

export async function computeEventCharges(db: Db, eventId: string): Promise<{
  participantCharges: ParticipantCharge[];
  payorSummaries: PayorSummary[];
}> {
  const event = await db
    .selectFrom("events")
    .select(["id", "host_user_id", "payor_exemption_enabled"])
    .where("id", "=", eventId)
    .executeTakeFirst();

  const hostRows = await db.selectFrom("event_hosts").select(["user_id"]).where("event_id", "=", eventId).execute();
  const hostUserIds = new Set<string>(hostRows.map((h: any) => h.user_id));
  if (hostUserIds.size === 0 && event && (event as any).host_user_id) {
    hostUserIds.add((event as any).host_user_id);
  }

  const hostFoodExemptionEnabled = !!(event && (event as any).payor_exemption_enabled);

  const eventParticipants = await db
    .selectFrom("event_participants")
    .innerJoin("participants", "participants.id", "event_participants.participant_id")
    .select([
      "event_participants.participant_id as participant_id",
      "participants.display_name as display_name",
      "participants.owner_user_id as owner_user_id",
      "event_participants.attendance_status as attendance_status"
    ])
    .where("event_participants.event_id", "=", eventId)
    .execute();

  const attendingParticipantIds = new Set(
    (eventParticipants as any[])
      .filter((ep) => ep.attendance_status === "ATTENDING")
      .map((ep) => ep.participant_id)
  );

  const participantMap = new Map<string, { displayName: string; ownerUserId: string }>();
  for (const ep of eventParticipants as any[]) {
    participantMap.set(ep.participant_id, {
      displayName: ep.display_name,
      ownerUserId: ep.owner_user_id
    });
  }

  const isHostParticipant = (participantId: string) => {
    const ownerUserId = participantMap.get(participantId)?.ownerUserId;
    return ownerUserId ? hostUserIds.has(ownerUserId) : false;
  };

  const payorOverrides = await db
    .selectFrom("event_payor_overrides")
    .select(["participant_id", "payor_user_id"])
    .where("event_id", "=", eventId)
    .execute();

  const overrideMap = new Map<string, string>();
  for (const o of payorOverrides as any[]) {
    overrideMap.set(o.participant_id, o.payor_user_id);
  }

  const defaultPayors = await db
    .selectFrom("participant_default_payors")
    .select(["participant_id", "payor_user_id"])
    .execute();

  const defaultPayorMap = new Map<string, string>();
  for (const dp of defaultPayors as any[]) {
    defaultPayorMap.set(dp.participant_id, dp.payor_user_id);
  }

  const resolvePayor = (participantId: string): string => {
    if (overrideMap.has(participantId)) return overrideMap.get(participantId)!;
    if (defaultPayorMap.has(participantId)) return defaultPayorMap.get(participantId)!;
    return participantMap.get(participantId)?.ownerUserId ?? participantId;
  };

  const selections = await db
    .selectFrom("selections")
    .innerJoin("menu_items", "menu_items.id", "selections.menu_item_id")
    .select([
      "selections.id as id",
      "selections.quantity as quantity",
      "menu_items.name as item_name",
      "menu_items.price_irr as price_irr"
    ])
    .where("selections.event_id", "=", eventId)
    .execute();

  const selectionIds = (selections as any[]).map((s) => s.id);

  const allocations = selectionIds.length
    ? await db
        .selectFrom("selection_allocations")
        .select(["selection_id", "participant_id"])
        .where("selection_id", "in", selectionIds as any)
        .execute()
    : [];

  const allocBySelection = new Map<string, string[]>();
  for (const a of allocations as any[]) {
    const arr = allocBySelection.get(a.selection_id) ?? [];
    arr.push(a.participant_id);
    allocBySelection.set(a.selection_id, arr);
  }

  const chargesByParticipant = new Map<string, ParticipantCharge>();

  const sharedCosts = await db.selectFrom("shared_costs").select(["id", "name", "amount_irr", "split_method"]).where("event_id", "=", eventId).execute();

  for (const sc of sharedCosts as any[]) {
    const amountIrr = sc.amount_irr;
    if (typeof amountIrr !== "number" || !Number.isInteger(amountIrr) || amountIrr <= 0) continue;

    const attending = hostFoodExemptionEnabled ? [...attendingParticipantIds].filter((pid) => !isHostParticipant(pid)) : [...attendingParticipantIds];
    if (attending.length === 0) continue;

    const shareCount = attending.length;
    const perShare = Math.floor(amountIrr / shareCount);
    if (perShare <= 0) continue;

    for (const pid of attending) {
      const payorUserId = resolvePayor(pid);
      const pInfo = participantMap.get(pid);

      if (!chargesByParticipant.has(pid)) {
        chargesByParticipant.set(pid, {
          participantId: pid,
          participantName: pInfo?.displayName ?? pid,
          payorUserId,
          payorEmail: "",
          totalIrr: 0,
          breakdown: []
        });
      }

      const charge = chargesByParticipant.get(pid)!;
      charge.totalIrr += perShare;
      charge.breakdown.push({
        selectionId: `shared:${sc.id}`,
        itemName: sc.name,
        quantity: 1,
        unitPriceIrr: amountIrr,
        shareCount,
        shareAmountIrr: perShare
      });
    }
  }

  for (const s of selections as any[]) {
    const participantIds = allocBySelection.get(s.id) ?? [];
    const attendingAllocated = participantIds.filter((pid) => attendingParticipantIds.has(pid));

    if (attendingAllocated.length === 0) continue;

    const chargeableAllocated = hostFoodExemptionEnabled ? attendingAllocated.filter((pid) => !isHostParticipant(pid)) : attendingAllocated;

    const nonHostAttendingAll = hostFoodExemptionEnabled ? [...attendingParticipantIds].filter((pid) => !isHostParticipant(pid)) : [...attendingParticipantIds];

    const finalAllocated = chargeableAllocated.length > 0 ? chargeableAllocated : nonHostAttendingAll;
    if (finalAllocated.length === 0) continue;

    const totalCost = s.quantity * s.price_irr;
    const shareCount = finalAllocated.length;
    const perShare = Math.floor(totalCost / shareCount);

    for (const pid of finalAllocated) {
      const payorUserId = resolvePayor(pid);
      const pInfo = participantMap.get(pid);

      if (!chargesByParticipant.has(pid)) {
        chargesByParticipant.set(pid, {
          participantId: pid,
          participantName: pInfo?.displayName ?? pid,
          payorUserId,
          payorEmail: "",
          totalIrr: 0,
          breakdown: []
        });
      }

      const charge = chargesByParticipant.get(pid)!;
      charge.totalIrr += perShare;
      charge.breakdown.push({
        selectionId: s.id,
        itemName: s.item_name,
        quantity: s.quantity,
        unitPriceIrr: s.price_irr,
        shareCount,
        shareAmountIrr: perShare
      });
    }
  }

  const payorUserIds = new Set<string>();
  for (const c of chargesByParticipant.values()) {
    payorUserIds.add(c.payorUserId);
  }

  const users = payorUserIds.size
    ? await db
        .selectFrom("users")
        .select(["id", "email"])
        .where("id", "in", [...payorUserIds] as any)
        .execute()
    : [];

  const userEmailMap = new Map<string, string>();
  for (const u of users as any[]) {
    userEmailMap.set(u.id, u.email);
  }

  for (const c of chargesByParticipant.values()) {
    c.payorEmail = userEmailMap.get(c.payorUserId) ?? "";
  }

  const participantCharges = [...chargesByParticipant.values()];

  const payorAgg = new Map<string, PayorSummary>();
  for (const pc of participantCharges) {
    if (!payorAgg.has(pc.payorUserId)) {
      payorAgg.set(pc.payorUserId, {
        payorUserId: pc.payorUserId,
        payorEmail: pc.payorEmail,
        totalIrr: 0,
        participants: []
      });
    }
    const ps = payorAgg.get(pc.payorUserId)!;
    ps.totalIrr += pc.totalIrr;
    ps.participants.push({
      participantId: pc.participantId,
      participantName: pc.participantName,
      amountIrr: pc.totalIrr
    });
  }

  const payorSummaries = [...payorAgg.values()];

  return { participantCharges, payorSummaries };
}
