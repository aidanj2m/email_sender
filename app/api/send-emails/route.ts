import { Resend } from "resend";
import { NextRequest } from "next/server";
import { dbInsert, dbUpdate, dbQuery } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailsRequest {
  emails: string[];
  subject: string;
  message: string;
  fromName?: string;
  fromEmail?: string;
}

interface EmailResult {
  email: string;
  success: boolean;
  resendId?: string;
  error?: string;
}

const BATCH_SIZE = 10;

export async function POST(req: NextRequest) {
  try {
    const body: SendEmailsRequest = await req.json();
    const {
      emails,
      subject,
      message,
      fromName = "Email Sender",
      fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev",
    } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return Response.json({ error: "No emails provided" }, { status: 400 });
    }
    if (!subject || !message) {
      return Response.json({ error: "Subject and message are required" }, { status: 400 });
    }

    // Create campaign record
    const [campaign] = await dbInsert("campaigns", {
      subject,
      body: message,
      from_name: fromName,
      from_email: fromEmail,
      status: "sending",
      total_recipients: emails.length,
    }) as { id: string }[];

    const campaignId = campaign.id;

    // Look up existing contacts to link them
    const contacts = await dbQuery("contacts", {
      select: "id,email",
      email: `in.(${emails.map((e) => e.trim().toLowerCase()).join(",")})`,
    }) as { id: string; email: string }[];

    const contactMap = new Map(contacts.map((c) => [c.email, c.id]));

    // Create queued recipient records
    const recipientRows = emails.map((email) => ({
      campaign_id: campaignId,
      contact_id: contactMap.get(email.trim().toLowerCase()) ?? null,
      email: email.trim().toLowerCase(),
      status: "queued",
    }));

    const createdRecipients = await dbInsert("campaign_recipients", recipientRows) as {
      id: string;
      email: string;
    }[];

    const recipientMap = new Map(createdRecipients.map((r) => [r.email, r.id]));

    const from = `${fromName} <${fromEmail}>`;
    const results: EmailResult[] = [];

    // Send in batches
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (email): Promise<EmailResult> => {
          const normalizedEmail = email.trim().toLowerCase();
          const recipientId = recipientMap.get(normalizedEmail);

          try {
            const { data, error } = await resend.emails.send({
              from,
              to: normalizedEmail,
              subject,
              html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                <p style="white-space: pre-wrap;">${message.replace(/\n/g, "<br/>")}</p>
              </div>`,
            });

            if (error) throw new Error(error.message);

            // Update recipient with resend ID and sent status
            if (recipientId) {
              await dbUpdate(
                "campaign_recipients",
                { id: recipientId },
                {
                  resend_email_id: data?.id ?? null,
                  status: "sent",
                  sent_at: new Date().toISOString(),
                }
              );
            }

            return { email: normalizedEmail, success: true, resendId: data?.id };
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";

            if (recipientId) {
              await dbUpdate(
                "campaign_recipients",
                { id: recipientId },
                { status: "failed", error_message: errorMsg }
              );
            }

            return { email: normalizedEmail, success: false, error: errorMsg };
          }
        })
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Update campaign with final counts
    await dbUpdate(
      "campaigns",
      { id: campaignId },
      {
        status: failed === emails.length ? "failed" : "sent",
        sent_count: succeeded,
        failed_count: failed,
        sent_at: new Date().toISOString(),
      }
    );

    return Response.json({
      campaignId,
      results,
      succeeded,
      failed,
      total: emails.length,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
