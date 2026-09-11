export type Role = "admin" | "manager" | "staff" | "viewer";

export type Profile = {
  id: string;
  org_id: string | null;
  branch_id: string | null;
  role: Role;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Invite = {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  branch_id: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Branch = {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
};

export type OrgSettings = {
  id: string;
  org_id: string;
  store_name: string;
  store_phone: string | null;
  store_address: string | null;
  timezone: string;
  branding: Record<string, unknown>;
};

export type MessageTemplate = {
  id: string;
  org_id: string;
  name: string;
  channel: "whatsapp" | "email";
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PriceListItem = {
  id: string;
  org_id: string;
  vaccine_name: string;
  price_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QuoteTemplate = {
  id: string;
  org_id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QuoteTemplateItem = {
  id: string;
  org_id: string;
  quote_template_id: string;
  price_list_item_id: string;
  quantity: number;
  unit_price_cents: number;
  created_at: string;
  updated_at: string;
};

export type Tutor = {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
  phone1: string | null;
  phone2: string | null;
  notes: string | null;
  tags: string[];
  contact_consent: boolean;
  is_active: boolean;
  created_at: string;
};

export type Pet = {
  id: string;
  org_id: string;
  tutor_id: string;
  name: string;
  species: "dog" | "cat" | "other";
  age_text: string | null;
  birth_date: string | null;
  breed: string | null;
  color: string | null;
  notes: string | null;
  is_active: boolean;
};

export type CatalogItem = {
  id: string;
  org_id: string;
  name: string;
  category: "vaccine" | "medication" | "other";
  requires_description: boolean;
  allows_origin: boolean;
  default_origin: string | null;
  is_active: boolean;
};

export type VaccinationRecordItem = {
  quantity: number;
  item: string;
  category: "vaccine" | "medication" | "other";
  pet_id: string | null;
  brand: string | null;
  lot: string | null;
  expires_on: string | null;
};

export type VaccinationRecordRow = {
  id: string;
  org_id: string;
  branch_id: string | null;
  tutor_id: string;
  applied_date: string;
  next_due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  tutor_name: string;
  tutor_phone1: string | null;
  tutor_phone2: string | null;
  items: VaccinationRecordItem[] | null;
};

export type DueReminderRow = {
  id: string;
  org_id: string;
  branch_id: string | null;
  tutor_id: string;
  pet_id: string | null;
  due_date: string;
  reference_appointment_id: string | null;
  reference_record_id: string | null;
  last_applied_at: string | null;
  reminder_type: string;
  item_name: string | null;
  message_template_id: string | null;
  status: "ATIVO" | "FEITO" | "ARQUIVADO";
  last_sent_at: string | null;
  send_count: number;
  notes: string | null;
  tutor_name: string;
  tutor_phone1: string | null;
  tutor_phone2: string | null;
  pet_name: string | null;
};

export type DashboardKpis = {
  org_id: string;
  applied_today: number;
  applied_7d: number;
  applied_month: number;
  active_reminders: number;
  overdue_reminders: number;
};