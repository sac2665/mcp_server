import { Env, ApexResponse, ApexError, Workout, Instructor } from "./types";
import { getAccessToken } from "./auth";

async function apexFetch<T>(
  env: Env,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken(env);
  const url = `${env.APEX_API_BASE_URL}${path}`;

  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = (await resp.json()) as ApexResponse<T> | ApexError;

  // Check for Apex error format
  if ("error" in data && "statusCode" in data) {
    const err = data as ApexError;
    throw new Error(`Apex API error ${err.statusCode}: ${err.message}`);
  }

  // Check for wrapped response
  if ("response" in data) {
    return (data as ApexResponse<T>).response;
  }

  // Fallback (shouldn't happen)
  return data as T;
}

export async function getPopularClasses(
  env: Env,
  from: string,
  to: string,
  type?: string
): Promise<{ data: string[]; labels: string[] }> {
  // Validate dates (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    throw new Error(
      "Invalid date format. Use YYYY-MM-DD."
    );
  }

  // Append time to include the whole final day
  const startDate = from;
  const endDate = `${to}T23:59:59Z`;

  let url = `/default/admin/report?id=POPULAR_WORKOUTS&startDate=${encodeURIComponent(
    startDate
  )}&endDate=${encodeURIComponent(endDate)}`;
  if (type) {
    url += `&type=${encodeURIComponent(type)}`;
  }

  return apexFetch(env, url);
}

export async function searchClasses(
  env: Env,
  params: Record<string, string | number | boolean | string[]>
): Promise<{ workouts: Workout[]; total: number }> {
  const url = new URL("/default/workouts/filtered", env.APEX_API_BASE_URL);

  // Always include pagination
  const perPage = (params.per_page as number) || 50;
  const page = (params.page as number) || 1;

  // Build query params
  const queryParams: Record<string, string> = {
    per_page: String(perPage),
    page: "1", // We'll handle paging manually if name filter is present
  };

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (key === "per_page" || key === "page") continue;
    if (key === "name") continue; // Handled separately

    if (Array.isArray(value)) {
      queryParams[key] = value.join(",");
    } else if (typeof value === "boolean") {
      queryParams[key] = String(value);
    } else {
      queryParams[key] = String(value);
    }
  }

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  // If no name filter, just fetch normally with requested page
  if (!params.name) {
    url.searchParams.set("page", String(page));
    const result = await apexFetch<{
      workouts: Workout[];
      total: number;
    }>(env, url.pathname + url.search);
    return result;
  }

  // Name filter: fetch large batch and filter manually
  const allUrl = new URL(url);
  allUrl.searchParams.set("page", "1");
  allUrl.searchParams.set("per_page", "500");

  const allData = await apexFetch<{
    workouts: Workout[];
    total: number;
  }>(env, allUrl.pathname + allUrl.search);

  const searchTerm = String(params.name).toLowerCase();
  const filtered = allData.workouts.filter((w) =>
    w.title.toLowerCase().includes(searchTerm)
  );

  // Manual pagination
  const start = (page - 1) * perPage;
  const paginated = filtered.slice(start, start + perPage);

  return {
    workouts: paginated,
    total: filtered.length,
  };
}

export async function getClass(env: Env, id: number): Promise<Workout> {
  try {
    return await apexFetch<Workout>(
      env,
      `/default/workouts/detail/${id}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("404")) {
      throw new Error(`Class not found: ${id}`);
    }
    throw err;
  }
}

export async function listInstructors(env: Env): Promise<Instructor[]> {
  return apexFetch<Instructor[]>(env, "/default/workouts/instructors");
}
