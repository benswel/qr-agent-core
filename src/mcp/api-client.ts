import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
const API_KEY = process.env.API_KEY || "";

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number>;
}

export async function apiRequest(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, query } = options;

  let url = `${BASE_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      params.set(key, String(value));
    }
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    "X-API-Key": API_KEY,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}
