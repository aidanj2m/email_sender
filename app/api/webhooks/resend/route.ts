import { NextRequest } from "next/server";
import { dbQuery, dbUpdate, dbInsert } from "@/lib/supabase";

// Resend webhook event types we care about
const EVENT_TYPES = new Set([
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.delivered",
  "email.complained",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType: string = body.type;
    const data = body.data;

    if (!eventType || !data) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const resendEmailId: string = data.email_id;
    if (!resendEmailId) {
      return new Response(null, { status: 200 });
    }

    // Map Resend event type to our event_type
    const internalType = eventType.replace("email.", "");

    // Find the recipient by resend_email_id
    const recipients = await dbQuery("campaign_recipients", {
      select: "id,campaign_id",
      resend_email_id: `eq.${resendEmailId}`,
      limit: "1",
    });

    const recipient = recipients[0] as { id: string; campaign_id: string } | undefined;

    // Record the event
    if (EVENT_TYPES.has(eventType)) {
      await dbInsert("email_events", {
        recipient_id: recipient?.id ?? null,
        campaign_id: recipient?.campaign_id ?? null,
        resend_email_id: resendEmailId,
        event_type: internalType,
        metadata: data,
        occurred_at: new Date().toISOString(),
      });
    }

    // Update recipient status for delivery/bounce events
    if (recipient) {
      if (eventType === "email.delivered") {
        await dbUpdate(
          "campaign_recipients",
          { id: recipient.id },
          { status: "delivered" }
        );
      } else if (eventType === "email.bounced") {
        await dbUpdate(
          "campaign_recipients",
          { id: recipient.id },
          { status: "bounced", error_message: data.bounce?.message ?? "Bounced" }
        );
        // Also mark contact as bounced
        const contacts = await dbQuery("contacts", {
          select: "id",
          email: `eq.${data.to}`,
          limit: "1",
        });
        if (contacts[0]) {
          await dbUpdate(
            "contacts",
            { id: (contacts[0] as { id: string }).id },
            { status: "bounced" }
          );
        }
      }
    }

    return new Response(null, { status: 200 });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
