import { Database } from "./database";

export type User = Database["public"]["Tables"]["users"]["Row"];
export type Questionnaire = Database["public"]["Tables"]["questionnaires"]["Row"];
export type Consultation = Database["public"]["Tables"]["consultations"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];

export type UserRole = "admin" | "staff" | "customer_service";

export type OrderStatus = "open" | "ready_to_ship" | "closed" | "pending_approval" | "rejected" | "manually_refunded";

export type OrderSource = "shopify" | "service_request" | "upsell" | "upsell_add" | "upsell_change";

export type AdminApprovalStatus = "pending" | "approved" | "rejected";

export type ConsultationStatus = "scheduled" | "completed" | "cancelled";

export interface PendingItemLineItem {
  productId: number;
  variantId: number;
  productTitle: string;
  variantTitle: string;
  price: string;
  quantity: number;
  schedule?: string;
  notes?: string;
  shopifyLineItemId?: string;
}

export interface PendingItem {
  id: string;
  type: "service_request" | "upsell" | "upsell_add" | "upsell_change";
  items: PendingItemLineItem[];
  schedule?: string;
  notes?: string;
  parentOrderId?: string;
  removeLineItemIds?: string[];
  parentShopifyOrderId?: string;
  addedAt: string;
  addedBy: string;
}
