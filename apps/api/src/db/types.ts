export type UserRole = "ADMIN" | "USER";

export type EventState = "DRAFT" | "OPEN" | "LOCKED" | "COMPLETED";
export type EventVisibilityMode = "OPEN" | "PRIVATE_PAYOR";
export type AttendanceStatus = "ATTENDING" | "TENTATIVE" | "DECLINED";
export type ShareType = "EQUAL" | "WEIGHTED";
export type SharedCostSplitMethod = "EQUAL_ALL_ATTENDING";
export type WalletTransactionType = "TOPUP" | "EVENT_CHARGE" | "ADJUSTMENT" | "REFUND";
export type PaymentLinkStatus = "OPEN" | "PAID" | "VOID";

export interface UsersTable {
  id: string;
  email: string;
  mobile_phone: string | null;
  display_name: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

export interface WalletsTable {
  user_id: string;
  balance_irr: number;
  created_at: string;
}

export interface WalletTransactionsTable {
  id: string;
  user_id: string;
  type: WalletTransactionType;
  amount_irr: number;
  event_id: string | null;
  created_at: string;
}

export interface ParticipantsTable {
  id: string;
  owner_user_id: string;
  display_name: string;
  created_at: string;
}

export interface ParticipantDefaultPayorsTable {
  participant_id: string;
  payor_user_id: string;
  created_at: string;
}

export interface EventTemplatesTable {
  id: string;
  name: string;
  description: string | null;
  default_location_text: string | null;
  created_at: string;
}

export interface EventTemplateGuestsTable {
  template_id: string;
  user_id: string;
  created_at: string;
}

export interface EventTemplateParticipantsTable {
  template_id: string;
  participant_id: string;
  managing_user_id: string;
  default_attendance_status: AttendanceStatus;
  created_at: string;
}

export interface EventsTable {
  id: string;
  template_id: string | null;
  name: string;
  description: string | null;
  location_text: string;
  location_user_id: string | null;
  host_user_id: string;
  starts_at_utc: string;
  cutoff_at_utc: string;
  state: EventState;
  visibility_mode: EventVisibilityMode;
  payor_exemption_enabled: number;
  created_at: string;
}

export interface EventHostsTable {
  event_id: string;
  user_id: string;
  created_at: string;
}

export interface EventGuestsTable {
  event_id: string;
  user_id: string;
  created_at: string;
}

export interface EventParticipantsTable {
  event_id: string;
  participant_id: string;
  managing_user_id: string;
  attendance_status: AttendanceStatus;
  created_at: string;
}

export interface EventPayorOverridesTable {
  event_id: string;
  participant_id: string;
  payor_user_id: string;
  created_at: string;
}

export interface MenusTable {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItemCategoriesTable {
  id: string;
  code: string;
  name_en: string;
  name_fa: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface MenuItemsTable {
  id: string;
  menu_id: string;
  name: string;
  price_irr: number;
  category_id: string | null;
  category: string | null;
  tags_json: string | null;
  is_active: number;
  created_at: string;
}

export interface SharedCostsTable {
  id: string;
  event_id: string;
  name: string;
  amount_irr: number;
  split_method: SharedCostSplitMethod;
  created_at: string;
}

export interface SelectionsTable {
  id: string;
  event_id: string;
  menu_item_id: string;
  quantity: number;
  created_by_user_id: string;
  note: string | null;
  created_at: string;
}

export interface SelectionAllocationsTable {
  id: string;
  selection_id: string;
  participant_id: string;
  share_type: ShareType;
  share_weight: number | null;
  created_at: string;
}

export interface EventChargesTable {
  event_id: string;
  payor_user_id: string;
  total_irr: number;
  finalized_at_utc: string;
}

export interface PaymentLinksTable {
  id: string;
  event_id: string;
  payor_user_id: string;
  token: string;
  locked_amount_irr: number | null;
  status: PaymentLinkStatus;
  created_at: string;
}

export interface SchemaMigrationsTable {
  id: string;
  created_at: string;
}

export interface DatabaseSchema {
  users: UsersTable;
  wallets: WalletsTable;
  wallet_transactions: WalletTransactionsTable;
  participants: ParticipantsTable;
  participant_default_payors: ParticipantDefaultPayorsTable;
  event_templates: EventTemplatesTable;
  event_template_guests: EventTemplateGuestsTable;
  event_template_participants: EventTemplateParticipantsTable;
  events: EventsTable;
  event_hosts: EventHostsTable;
  event_guests: EventGuestsTable;
  event_participants: EventParticipantsTable;
  event_payor_overrides: EventPayorOverridesTable;
  menus: MenusTable;
  menu_item_categories: MenuItemCategoriesTable;
  menu_items: MenuItemsTable;
  shared_costs: SharedCostsTable;
  selections: SelectionsTable;
  selection_allocations: SelectionAllocationsTable;
  event_charges: EventChargesTable;
  payment_links: PaymentLinksTable;
  schema_migrations: SchemaMigrationsTable;
}
