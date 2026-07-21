export interface Segment {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Tier {
  id: number;
  segmentId: number;
  letter: string;
  label: string;
  weight: number;
  sortOrder: number;
}

export interface Stage {
  id: number;
  segmentId: number;
  name: string;
  sortOrder: number;
  intervalDays: number;
  weight: number;
  isTerminal: boolean;
}

export interface Contact {
  id: number;
  segmentId: number;
  tierId: number | null;
  stageId: number | null;
  brand: string | null;
  subBrand: string | null;
  name: string;
  role: string | null;
  followers: number | null;
  linkedin: string | null;
  email: string | null;
  lastContactedAt: string | null;
  dueAt: string | null;
  inTouch: boolean;
  metInPerson: boolean;
  converted: boolean;
  priorityScore: number;
  effectivePriorityScore: number;
  promptContext: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  tier?: Tier | null;
  stage?: Stage | null;
  status: "overdue" | "today" | "upcoming" | "none";
  brandBonus?: BrandBonusInfo | null;
}

export interface BrandBonusInfo {
  eventType: string;
  date: string;
  daysAgo: number;
}

export interface BrandHistoryEntry {
  id: number;
  brand: string;
  eventType: "New CMO" | "Brand Refresh / Rebrand" | "Major ATL Campaign" | "New Head of Brand" | "Other";
  date: string;
  note: string | null;
  source: "manual" | "news_api" | "sales_nav_feed";
  articleUrl: string | null;
  status: "confirmed" | "pending";
  createdAt: string;
}

export interface GridContact extends Contact {
  segmentName: string;
  segmentSlug: string;
}

export interface OutreachEvent {
  id: number;
  contactId: number;
  fromStageId: number | null;
  toStageId: number | null;
  prevDueAt: string | null;
  prevLastContactedAt: string | null;
  prevPriorityScore: number | null;
  type: "contacted" | "snoozed";
  contactedAt: string;
}
