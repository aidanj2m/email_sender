const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const SCHEMA = "public";

function headers(method: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (method === "GET" || method === "HEAD") {
    h["Accept-Profile"] = SCHEMA;
  } else {
    h["Content-Profile"] = SCHEMA;
  }
  return h;
}

export async function dbQuery(
  table: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: "GET", headers: headers("GET") });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dbInsert(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: headers("POST"),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dbUpdate(
  table: string,
  filter: Record<string, string>,
  data: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filter).forEach(([k, v]) => url.searchParams.set(k, `eq.${v}`));
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: headers("PATCH"),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dbDelete(
  table: string,
  filter: Record<string, string>
): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filter).forEach(([k, v]) => url.searchParams.set(k, `eq.${v}`));
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: headers("DELETE"),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function dbRpc(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers("POST"),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
