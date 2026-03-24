import { dbQuery, dbUpdate, dbInsert } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const rows = await dbQuery("settings", { select: "key,value" }) as { key: string; value: string }[];
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return Response.json(settings);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body as { key: string; value: string };

    if (!key || value === undefined) {
      return Response.json({ error: "key and value are required" }, { status: 400 });
    }

    // Try update first, insert if not found
    const updated = await dbUpdate("settings", { key }, { value, updated_at: new Date().toISOString() });

    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      await dbInsert("settings", { key, value });
    }

    return Response.json({ key, value });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to update setting" },
      { status: 500 }
    );
  }
}
