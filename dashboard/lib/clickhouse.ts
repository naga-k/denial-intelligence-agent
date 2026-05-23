// Minimal ClickHouse Cloud reader over the native HTTP interface — no npm
// dependency (keeps package.json untouched). Reads creds from dashboard/.env.local.
const URL = process.env.CLICKHOUSE_URL!;
const USER = process.env.CLICKHOUSE_USER ?? "default";
const PASSWORD = process.env.CLICKHOUSE_PASSWORD ?? "";

export async function chQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await fetch(`${URL}/?default_format=JSONEachRow`, {
    method: "POST",
    headers: {
      "X-ClickHouse-User": USER,
      "X-ClickHouse-Key": PASSWORD,
      "Content-Type": "text/plain",
    },
    body: sql,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${await res.text()}`);
  const text = (await res.text()).trim();
  return text ? text.split("\n").map((line) => JSON.parse(line) as T) : [];
}
