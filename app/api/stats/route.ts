import { NextRequest } from "next/server";
import { dbQuery } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [recipients, events] = await Promise.all([
      dbQuery("campaign_recipients", { select: "id,status,sent_at,resend_email_id" }),
      dbQuery("email_events", { select: "event_type,resend_email_id" }),
    ]);

    const sentToday = recipients.filter(
      (r) => r.sent_at && (r.sent_at as string) >= todayISO
    ).length;

    const sentTotal = recipients.filter((r) => r.status !== "queued").length;

    const uniqueEmailIds = new Set(
      recipients
        .filter((r) => r.resend_email_id)
        .map((r) => r.resend_email_id as string)
    );

    const opens = new Set(
      (events as { event_type: string; resend_email_id: string }[])
        .filter((e) => e.event_type === "opened" && e.resend_email_id)
        .map((e) => e.resend_email_id)
    );

    const bounced = recipients.filter((r) => r.status === "bounced").length;

    const replies = new Set(
      (events as { event_type: string; resend_email_id: string }[])
        .filter((e) => e.event_type === "replied" && e.resend_email_id)
        .map((e) => e.resend_email_id)
    );

    const base = uniqueEmailIds.size || 1;
    const openRate = Math.round((opens.size / base) * 100);
    const bounceRate = Math.round((bounced / (sentTotal || 1)) * 100);
    const replyRate = Math.round((replies.size / base) * 100);

    return Response.json({
      sentToday,
      sentTotal,
      openRate,
      bounceRate,
      replyRate,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
