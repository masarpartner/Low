import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";
import { env, isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";

export interface AppUser {
  id: string;
  username: string;
  email?: string | null;
  role: "admin" | "staff";
  display_name?: string | null;
  status?: "active" | "suspended";
  subscription_end_date?: string | null;
  subscription_notes?: string | null;
  google_service_account_json?: string | null;
  google_spreadsheet_id?: string | null;
  google_sheet_name?: string | null;
  has_google_service?: boolean;
  created_at?: string;
}

export interface AppUserWithHash extends AppUser {
  password_hash: string;
}

export interface UserGoogleCredentials {
  serviceAccountJson?: Record<string, unknown>;
  spreadsheetId?: string;
  sheetName?: string;
}

let _supabaseClient: SupabaseClient | null = null;
let _lastUrl: string | undefined = undefined;
let _lastKey: string | undefined = undefined;

// In-memory cache for user google credentials to avoid querying Supabase on every Sheets call
const userGoogleCredsCache = new Map<string, { data: UserGoogleCredentials; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export function invalidateUserGoogleCache(userId?: string): void {
  if (userId) {
    userGoogleCredsCache.delete(userId);
  } else {
    userGoogleCredsCache.clear();
  }
}

const LOCAL_USERS_FILE = resolve(process.cwd(), "artifacts", "api-server", "local_users.json");
const ALT_LOCAL_USERS_FILE = resolve(process.cwd(), "local_users.json");
const TMP_LOCAL_USERS_FILE = "/tmp/local_users.json";

let _localUsersCache: AppUserWithHash[] | null = null;

export function loadLocalUsers(): AppUserWithHash[] {
  if (_localUsersCache) {
    return _localUsersCache;
  }
  const paths = [LOCAL_USERS_FILE, ALT_LOCAL_USERS_FILE, TMP_LOCAL_USERS_FILE];
  for (const p of paths) {
    try {
      if (existsSync(p)) {
        const raw = readFileSync(p, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          _localUsersCache = list;
          return list;
        }
      }
    } catch {}
  }

  // Seed default admin and lawyer with 1-year subscription
  const adminHash = bcrypt.hashSync(env.adminPassword || "123456", 10);
  const lawyerHash = bcrypt.hashSync(env.appPassword || "12345", 10);
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const initial: AppUserWithHash[] = [
    {
      id: "local-admin",
      username: env.adminUsername || "123456",
      email: "admin@law.internal",
      role: "admin",
      display_name: "المشرف العام (مدير المنظومة)",
      status: "active",
      subscription_end_date: null,
      subscription_notes: "حساب المشرف العام الدائم",
      has_google_service: false,
      google_spreadsheet_id: null,
      google_sheet_name: null,
      password_hash: adminHash,
      created_at: new Date().toISOString(),
    },
    {
      id: "local-lawyer-default",
      username: env.appUsername || "12345",
      email: "lawyer@law.internal",
      role: "staff",
      display_name: "المحامي الافتراضي",
      status: "active",
      subscription_end_date: oneYearFromNow.toISOString(),
      subscription_notes: "اشتراك سنوي معتمد (باقة المكاتب)",
      has_google_service: false,
      google_spreadsheet_id: null,
      google_sheet_name: null,
      password_hash: lawyerHash,
      created_at: new Date().toISOString(),
    },
  ];

  saveLocalUsers(initial);
  return initial;
}

export function saveLocalUsers(users: AppUserWithHash[]): void {
  _localUsersCache = users;
  const content = JSON.stringify(users, null, 2);
  const paths = [LOCAL_USERS_FILE, ALT_LOCAL_USERS_FILE, TMP_LOCAL_USERS_FILE];
  for (const p of paths) {
    try {
      writeFileSync(p, content, "utf-8");
    } catch {}
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = env.supabaseUrl!;
  const key = env.supabaseKey!;

  if (_supabaseClient && _lastUrl === url && _lastKey === key) {
    return _supabaseClient;
  }

  try {
    _supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    _lastUrl = url;
    _lastKey = key;
    return _supabaseClient;
  } catch (err) {
    logger.error({ err }, "Failed to initialize Supabase client");
    return null;
  }
}

/**
 * Ensures that if app_users table is empty, a default admin user is seeded.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const tableName = env.supabaseTableName;
    const { count, error } = await client
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (error) {
      logger.warn({ error }, `Error checking ${tableName} in Supabase (table might not exist yet)`);
      return;
    }

    if (count === 0) {
      const defaultUsername = env.adminUsername || "123456";
      const defaultPassword = env.adminPassword || "123456";
      const password_hash = await bcrypt.hash(defaultPassword, 10);

      const { error: insertErr } = await client.from(tableName).insert([
        {
          username: defaultUsername,
          email: `${defaultUsername}@law.local`,
          password_hash,
          role: "admin",
          display_name: "المشرف العام (مدير المنظومة)",
          status: "active",
        },
      ]);

      if (insertErr) {
        logger.error({ insertErr }, "Failed to create default admin in Supabase");
      } else {
        logger.info({ username: defaultUsername }, "Seeded default admin user in Supabase");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error during ensureDefaultAdmin");
  }
}

/**
 * Verify user credentials against Supabase app_users table or local users fallback.
 */
export async function verifySupabaseUser(
  usernameOrEmail: string,
  plainPassword: string,
): Promise<AppUser | null> {
  const cleanIdentifier = usernameOrEmail.trim().toLowerCase();
  const client = getSupabaseClient();

  if (!client) {
    const localUsers = loadLocalUsers();
    const user = localUsers.find(
      (u) =>
        u.username.toLowerCase() === cleanIdentifier ||
        (u.email && u.email.toLowerCase() === cleanIdentifier),
    );
    if (!user || !user.password_hash) return null;

    let isValid = false;
    if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
      isValid = await bcrypt.compare(plainPassword, user.password_hash);
    } else {
      isValid = user.password_hash === plainPassword;
    }

    if (!isValid) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "staff",
      display_name: user.display_name,
      status: user.status || "active",
      subscription_end_date: user.subscription_end_date || null,
      subscription_notes: user.subscription_notes || null,
      google_spreadsheet_id: user.google_spreadsheet_id,
      google_sheet_name: user.google_sheet_name,
      created_at: user.created_at,
    };
  }

  try {
    const tableName = env.supabaseTableName;

    const { data, error } = await client
      .from(tableName)
      .select("id, username, email, role, display_name, status, subscription_end_date, subscription_notes, password_hash, google_spreadsheet_id, google_sheet_name, created_at")
      .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier}`)
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    const record = data[0] as AppUserWithHash;
    if (!record.password_hash) {
      return null;
    }

    let isValid = false;
    if (record.password_hash.startsWith("$2a$") || record.password_hash.startsWith("$2b$")) {
      isValid = await bcrypt.compare(plainPassword, record.password_hash);
    } else {
      if (record.password_hash === plainPassword) {
        isValid = true;
        const newHash = await bcrypt.hash(plainPassword, 10);
        await client.from(tableName).update({ password_hash: newHash }).eq("id", record.id);
      }
    }

    if (!isValid) {
      return null;
    }

    return {
      id: record.id,
      username: record.username,
      email: record.email,
      role: record.role || "staff",
      display_name: record.display_name,
      status: record.status || "active",
      subscription_end_date: record.subscription_end_date || null,
      subscription_notes: record.subscription_notes || null,
      google_spreadsheet_id: record.google_spreadsheet_id,
      google_sheet_name: record.google_sheet_name,
      created_at: record.created_at,
    };
  } catch (err) {
    logger.error({ err }, "Error verifying user against Supabase");
    return null;
  }
}

/**
 * Get Google Sheets credentials for a specific user.
 */
export async function getUserGoogleCredentials(userId?: string): Promise<UserGoogleCredentials | null> {
  if (!userId || userId === "local-admin" || userId === "local-default") {
    return null;
  }

  const cached = userGoogleCredsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const tableName = env.supabaseTableName;
    const { data, error } = await client
      .from(tableName)
      .select("google_service_account_json, google_spreadsheet_id, google_sheet_name")
      .eq("id", userId)
      .single();

    if (error || !data) return null;

    let parsedJson: Record<string, unknown> | undefined = undefined;
    if (data.google_service_account_json) {
      try {
        parsedJson = typeof data.google_service_account_json === "string"
          ? JSON.parse(data.google_service_account_json)
          : data.google_service_account_json;
      } catch (err) {
        logger.warn({ err, userId }, "Failed to parse user google_service_account_json");
      }
    }

    const creds: UserGoogleCredentials = {
      serviceAccountJson: parsedJson,
      spreadsheetId: data.google_spreadsheet_id?.trim() || undefined,
      sheetName: data.google_sheet_name?.trim() || undefined,
    };

    userGoogleCredsCache.set(userId, { data: creds, timestamp: Date.now() });
    return creds;
  } catch (err) {
    logger.error({ err, userId }, "Error getting user Google credentials from Supabase");
    return null;
  }
}

/**
 * List all users.
 */
export async function listSupabaseUsers(): Promise<AppUser[]> {
  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    return local.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role || "staff",
      display_name: u.display_name,
      status: u.status || "active",
      subscription_end_date: u.subscription_end_date || null,
      subscription_notes: u.subscription_notes || null,
      has_google_service: Boolean(u.google_service_account_json && u.google_service_account_json.trim().length > 10),
      google_spreadsheet_id: u.google_spreadsheet_id || null,
      google_sheet_name: u.google_sheet_name || null,
      created_at: u.created_at,
    }));
  }

  const tableName = env.supabaseTableName;
  const { data, error } = await client
    .from(tableName)
    .select("id, username, email, role, display_name, status, subscription_end_date, subscription_notes, google_service_account_json, google_spreadsheet_id, google_sheet_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error({ error }, "Failed to list users from Supabase");
    throw new Error(
      `فشل جلب المستخدمين من Supabase: ${error.message}. تأكد من إنشاء جدول ${tableName}.`,
    );
  }

  return (data || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role || "staff",
    display_name: u.display_name,
    status: u.status || "active",
    subscription_end_date: u.subscription_end_date || null,
    subscription_notes: u.subscription_notes || null,
    has_google_service: Boolean(u.google_service_account_json && u.google_service_account_json.trim().length > 10),
    google_spreadsheet_id: u.google_spreadsheet_id || null,
    google_sheet_name: u.google_sheet_name || null,
    created_at: u.created_at,
  }));
}

/**
 * Validates Google Service Account JSON string or object.
 */
function sanitizeGoogleServiceJson(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw.trim()) : raw;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON object");
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("ملف Service Account JSON يجب أن يحتوي على client_email و private_key.");
    }
    return JSON.stringify(parsed);
  } catch (err: any) {
    throw new Error(err.message || "صيغة Google Service Account JSON غير صحيحة.");
  }
}

/**
 * Create a new user in Supabase or local store.
 */
export async function createSupabaseUser(input: {
  username: string;
  email?: string;
  password: string;
  role?: "admin" | "staff";
  display_name?: string;
  status?: "active" | "suspended";
  subscription_end_date?: string;
  subscription_notes?: string;
  google_service_account_json?: string;
  google_spreadsheet_id?: string;
  google_sheet_name?: string;
}): Promise<AppUser> {
  const username = input.username.trim().toLowerCase();
  const password = input.password.trim();

  if (!username) {
    throw new Error("اسم المستخدم مطلوب.");
  }
  if (!password || password.length < 4) {
    throw new Error("كلمة المرور يجب ألا تقل عن 4 خانات.");
  }

  const sanitizedGoogleJson = sanitizeGoogleServiceJson(input.google_service_account_json);
  const password_hash = await bcrypt.hash(password, 10);
  const status = input.status || "active";
  const subscription_end_date = input.subscription_end_date || null;
  const subscription_notes = input.subscription_notes?.trim() || null;

  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    if (local.some((u) => u.username.toLowerCase() === username)) {
      throw new Error(`اسم المستخدم "${username}" مسجل مسبقاً.`);
    }

    const newUser: AppUserWithHash = {
      id: `local-${crypto.randomUUID()}`,
      username,
      email: input.email?.trim() || null,
      role: input.role || "staff",
      display_name: input.display_name?.trim() || username,
      status,
      subscription_end_date,
      subscription_notes,
      google_service_account_json: sanitizedGoogleJson,
      google_spreadsheet_id: input.google_spreadsheet_id?.trim() || null,
      google_sheet_name: input.google_sheet_name?.trim() || null,
      has_google_service: Boolean(sanitizedGoogleJson),
      password_hash,
      created_at: new Date().toISOString(),
    };

    local.unshift(newUser);
    saveLocalUsers(local);

    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      display_name: newUser.display_name,
      status: newUser.status,
      subscription_end_date: newUser.subscription_end_date,
      subscription_notes: newUser.subscription_notes,
      has_google_service: newUser.has_google_service,
      google_spreadsheet_id: newUser.google_spreadsheet_id,
      google_sheet_name: newUser.google_sheet_name,
      created_at: newUser.created_at,
    };
  }

  const tableName = env.supabaseTableName;

  // Check if username already exists
  const { data: existing } = await client
    .from(tableName)
    .select("id")
    .ilike("username", username)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`اسم المستخدم "${username}" مسجل مسبقاً.`);
  }

  const newUserData = {
    username,
    email: input.email?.trim() || null,
    password_hash,
    role: input.role || "staff",
    display_name: input.display_name?.trim() || username,
    status,
    subscription_end_date,
    subscription_notes,
    google_service_account_json: sanitizedGoogleJson,
    google_spreadsheet_id: input.google_spreadsheet_id?.trim() || null,
    google_sheet_name: input.google_sheet_name?.trim() || null,
  };

  const { data, error } = await client
    .from(tableName)
    .insert([newUserData])
    .select("id, username, email, role, display_name, status, subscription_end_date, subscription_notes, google_spreadsheet_id, google_sheet_name, created_at")
    .single();

  if (error) {
    logger.error({ error }, "Failed to insert user into Supabase");
    throw new Error(`فشل إنشاء المستخدم: ${error.message}`);
  }

  return {
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role,
    display_name: data.display_name,
    status: data.status || "active",
    subscription_end_date: data.subscription_end_date || null,
    subscription_notes: data.subscription_notes || null,
    has_google_service: Boolean(sanitizedGoogleJson),
    google_spreadsheet_id: data.google_spreadsheet_id,
    google_sheet_name: data.google_sheet_name,
    created_at: data.created_at,
  };
}

/**
 * Delete a user from Supabase or local store.
 */
export async function deleteSupabaseUser(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    const filtered = local.filter((u) => u.id !== id);
    if (filtered.length === local.length) {
      throw new Error("المستخدم غير موجود.");
    }
    saveLocalUsers(filtered);
    return;
  }

  invalidateUserGoogleCache(id);
  const tableName = env.supabaseTableName;
  const { error } = await client.from(tableName).delete().eq("id", id);

  if (error) {
    logger.error({ error, id }, "Failed to delete user from Supabase");
    throw new Error(`فشل حذف المستخدم: ${error.message}`);
  }
}

/**
 * Update a user in Supabase or local store.
 */
export async function updateSupabaseUser(
  id: string,
  input: {
    password?: string;
    role?: "admin" | "staff";
    display_name?: string;
    email?: string;
    status?: "active" | "suspended";
    subscription_end_date?: string | null;
    subscription_notes?: string | null;
    google_service_account_json?: string;
    google_spreadsheet_id?: string;
    google_sheet_name?: string;
  },
): Promise<AppUser> {
  const client = getSupabaseClient();
  if (!client) {
    const local = loadLocalUsers();
    const index = local.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error("المستخدم غير موجود.");
    }
    const user = local[index];
    if (input.password && input.password.trim()) {
      if (input.password.trim().length < 4) {
        throw new Error("كلمة المرور يجب ألا تقل عن 4 خانات.");
      }
      user.password_hash = await bcrypt.hash(input.password.trim(), 10);
    }
    if (input.role) user.role = input.role;
    if (input.display_name !== undefined) user.display_name = input.display_name.trim() || null;
    if (input.email !== undefined) user.email = input.email.trim() || null;
    if (input.status !== undefined) user.status = input.status;
    if (input.subscription_end_date !== undefined) user.subscription_end_date = input.subscription_end_date;
    if (input.subscription_notes !== undefined) user.subscription_notes = input.subscription_notes;
    if (input.google_service_account_json !== undefined) {
      user.google_service_account_json = sanitizeGoogleServiceJson(input.google_service_account_json);
      user.has_google_service = Boolean(user.google_service_account_json);
    }
    if (input.google_spreadsheet_id !== undefined) user.google_spreadsheet_id = input.google_spreadsheet_id.trim() || null;
    if (input.google_sheet_name !== undefined) user.google_sheet_name = input.google_sheet_name.trim() || null;

    saveLocalUsers(local);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      status: user.status,
      subscription_end_date: user.subscription_end_date,
      subscription_notes: user.subscription_notes,
      has_google_service: user.has_google_service,
      google_spreadsheet_id: user.google_spreadsheet_id,
      google_sheet_name: user.google_sheet_name,
      created_at: user.created_at,
    };
  }

  const tableName = env.supabaseTableName;
  const updates: Record<string, unknown> = {};

  if (input.password && input.password.trim()) {
    if (input.password.trim().length < 4) {
      throw new Error("كلمة المرور يجب ألا تقل عن 4 خانات.");
    }
    updates.password_hash = await bcrypt.hash(input.password.trim(), 10);
  }

  if (input.role) updates.role = input.role;
  if (input.display_name !== undefined) updates.display_name = input.display_name.trim() || null;
  if (input.email !== undefined) updates.email = input.email.trim() || null;
  if (input.status !== undefined) updates.status = input.status;
  if (input.subscription_end_date !== undefined) updates.subscription_end_date = input.subscription_end_date;
  if (input.subscription_notes !== undefined) updates.subscription_notes = input.subscription_notes?.trim() || null;

  if (input.google_service_account_json !== undefined) {
    updates.google_service_account_json = sanitizeGoogleServiceJson(input.google_service_account_json);
  }
  if (input.google_spreadsheet_id !== undefined) {
    updates.google_spreadsheet_id = input.google_spreadsheet_id.trim() || null;
  }
  if (input.google_sheet_name !== undefined) {
    updates.google_sheet_name = input.google_sheet_name.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("لا توجد بيانات للتعديل.");
  }

  invalidateUserGoogleCache(id);

  const { data, error } = await client
    .from(tableName)
    .update(updates)
    .eq("id", id)
    .select("id, username, email, role, display_name, status, subscription_end_date, subscription_notes, google_service_account_json, google_spreadsheet_id, google_sheet_name, created_at")
    .single();

  if (error) {
    logger.error({ error, id }, "Failed to update user in Supabase");
    throw new Error(`فشل تعديل المستخدم: ${error.message}`);
  }

  return {
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role,
    display_name: data.display_name,
    status: data.status || "active",
    subscription_end_date: data.subscription_end_date || null,
    subscription_notes: data.subscription_notes || null,
    has_google_service: Boolean(data.google_service_account_json && data.google_service_account_json.trim().length > 10),
    google_spreadsheet_id: data.google_spreadsheet_id,
    google_sheet_name: data.google_sheet_name,
    created_at: data.created_at,
  };
}

/**
 * Toggles a user's subscription status between active and suspended.
 */
export async function toggleUserStatus(
  id: string,
  explicitStatus?: "active" | "suspended",
): Promise<AppUser> {
  const users = await listSupabaseUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    throw new Error("المستخدم غير موجود.");
  }
  const newStatus = explicitStatus || (target.status === "suspended" ? "active" : "suspended");
  return updateSupabaseUser(id, { status: newStatus });
}
