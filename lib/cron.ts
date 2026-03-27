import { Resend } from "resend";
import { dbQuery, dbInsert, dbUpdate } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);
const BATCH_SIZE = 10;

export interface Attachment {
  filename: string;
  path: string; // public URL
}

export interface SenderConfig {
  fromName: string;
  fromEmail: string;
  subject: string;
  attachments?: Attachment[];
  buildHtml: (props: { recipientName?: string; recipientEmail: string; companyName?: string }) => string;
}

/**
 * Verifies the request is from Vercel's cron system.
 */
export function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Checks if cron sending is active via the settings table.
 */
export async function isCronActive(): Promise<boolean> {
  const rows = await dbQuery("settings", {
    select: "value",
    key: "eq.cron_active",
  }) as { value: string }[];
  return rows.length > 0 && rows[0].value === "true";
}

/**
 * Picks the next N contacts that haven't been emailed by this sender yet,
 * sends them an email, and records everything to the DB.
 */
export async function runCronBatch(config: SenderConfig): Promise<{
  sent: number;
  remaining: number;
  errors: { email: string; error: string }[];
}> {
  // Get all emails that have already been sent by ANY sender
  const allCampaigns = await dbQuery("campaigns", {
    select: "id",
  }) as { id: string }[];

  const sentEmails = new Set<string>();

  if (allCampaigns.length > 0) {
    const campaignIds = allCampaigns.map((c) => c.id).join(",");
    const sentRecipients = await dbQuery("campaign_recipients", {
      select: "email",
      campaign_id: `in.(${campaignIds})`,
    }) as { email: string }[];
    sentRecipients.forEach((r) => sentEmails.add(r.email));
  }

  // Get active contacts not yet emailed by this sender
  // Prioritize contacts with phone numbers (higher conversion), then by created_at
  const contactsWithPhone = await dbQuery("contacts", {
    select: "id,email,name,company_name,phone",
    status: "eq.active",
    phone: "not.is.null",
    order: "created_at.asc",
  }) as { id: string; email: string; name: string | null; company_name: string | null; phone: string | null }[];

  const contactsWithoutPhone = await dbQuery("contacts", {
    select: "id,email,name,company_name,phone",
    status: "eq.active",
    phone: "is.null",
    order: "created_at.asc",
  }) as { id: string; email: string; name: string | null; company_name: string | null; phone: string | null }[];

  const allContacts = [...contactsWithPhone, ...contactsWithoutPhone];

  const queue = allContacts.filter((c) => !sentEmails.has(c.email));

  if (queue.length === 0) {
    return { sent: 0, remaining: 0, errors: [] };
  }

  const batch = queue.slice(0, BATCH_SIZE);

  // Create campaign record for this cron run
  const [campaign] = await dbInsert("campaigns", {
    subject: config.subject,
    body: "[cron batch]",
    from_name: config.fromName,
    from_email: config.fromEmail,
    status: "sending",
    total_recipients: batch.length,
  }) as { id: string }[];

  const campaignId = campaign.id;

  // Create queued recipient rows
  const createdRecipients = await dbInsert(
    "campaign_recipients",
    batch.map((contact) => ({
      campaign_id: campaignId,
      contact_id: contact.id,
      email: contact.email,
      status: "queued",
    }))
  ) as { id: string; email: string }[];

  const recipientMap = new Map(createdRecipients.map((r) => [r.email, r.id]));

  const from = `${config.fromName} <${config.fromEmail}>`;
  const errors: { email: string; error: string }[] = [];
  let sent = 0;

  for (const contact of batch) {
    {
      const recipientId = recipientMap.get(contact.email)!;
      const html = config.buildHtml({
        recipientName: contact.name ?? undefined,
        recipientEmail: contact.email,
        companyName: contact.company_name ?? undefined,
      });

      try {
        const { data, error } = await resend.emails.send({
          from,
          to: contact.email,
          subject: config.subject,
          html,
          attachments: config.attachments?.map((a) => ({
            filename: a.filename,
            path: a.path,
          })),
        });

        if (error) throw new Error(error.message);

        await dbUpdate("campaign_recipients", { id: recipientId }, {
          resend_email_id: data?.id ?? null,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await dbUpdate("campaign_recipients", { id: recipientId }, {
          status: "failed",
          error_message: msg,
        });
        errors.push({ email: contact.email, error: msg });
      }
    }
    // Respect Resend's 5 req/sec rate limit
    await new Promise((r) => setTimeout(r, 250));
  }

  await dbUpdate("campaigns", { id: campaignId }, {
    status: errors.length === batch.length ? "failed" : "sent",
    sent_count: sent,
    failed_count: errors.length,
    sent_at: new Date().toISOString(),
  });

  return { sent, remaining: queue.length - batch.length, errors };
}
