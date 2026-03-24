export interface Contact {
  id: string;
  email: string;
  name: string | null;
  tags: string[];
  status: "active" | "unsubscribed" | "bounced";
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  from_name: string;
  from_email: string;
  status: "draft" | "sending" | "sent" | "failed";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  resend_email_id: string | null;
  status: "queued" | "sent" | "delivered" | "bounced" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailEvent {
  id: string;
  recipient_id: string | null;
  campaign_id: string | null;
  resend_email_id: string | null;
  event_type: "opened" | "clicked" | "bounced" | "delivered" | "complained" | "replied";
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface DashboardStats {
  sentToday: number;
  sentTotal: number;
  openRate: number;
  bounceRate: number;
  replyRate: number;
  activeCampaigns: number;
}
