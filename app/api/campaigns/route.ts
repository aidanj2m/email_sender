import { NextRequest } from "next/server";
import { dbQuery } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  try {
    const campaigns = await dbQuery("campaigns", {
      select: "*",
      order: "created_at.desc",
      limit: "50",
    });
    return Response.json(campaigns);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
