// server/src/index.ts
import express from "express";
import cors from "cors";

// server/src/config.ts
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var envLocalInServer = path.resolve(__dirname, "../.env.local");
var envLocalInCwd = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalInServer)) {
  dotenv.config({ path: envLocalInServer });
} else if (fs.existsSync(envLocalInCwd)) {
  dotenv.config({ path: envLocalInCwd });
}
var envInServer = path.resolve(__dirname, "../.env");
if (fs.existsSync(envInServer)) {
  dotenv.config({ path: envInServer });
} else {
  dotenv.config();
}
var config = {
  port: parseInt(process.env.PORT || "10000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_key_simsarpras_2026",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:5173,http://192.168.100.45:5173").split(",").map((s) => s.trim()),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "300", 10)
};

// server/src/routes/health.ts
import { Router } from "express";

// server/src/db.ts
import pg from "pg";
var { Pool } = pg;
var pool = config.databaseUrl ? new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("supabase.com") ? { rejectUnauthorized: false } : void 0,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3
}) : null;
async function checkDatabaseConnection() {
  if (!pool) {
    return {
      connected: false,
      message: "DATABASE_URL belum dikonfigurasi. Backend berjalan dalam mode persiapan."
    };
  }
  try {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT NOW() as current_time");
      return {
        connected: true,
        message: `Terhubung ke PostgreSQL pada ${res.rows[0].current_time}`
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      connected: false,
      message: `Gagal terhubung ke database: ${error?.message || error}`
    };
  }
}

// server/src/routes/health.ts
var healthRouter = Router();
healthRouter.get("/", async (_req, res) => {
  const dbStatus = await checkDatabaseConnection();
  res.status(dbStatus.connected ? 200 : 503).json({
    status: dbStatus.connected ? "OK" : "DEGRADED",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    service: "SIMSARPRAS Express API",
    version: "2.1.0",
    database: dbStatus
  });
});

// server/src/routes/assets.ts
import { Router as Router2 } from "express";

// server/src/validators.ts
import { z } from "zod";
var TOKEN_REGEX = /^[A-Za-z0-9_\-\.]+$/;
var tokenParamSchema = z.string({ required_error: "Parameter token atau kode barang wajib diisi." }).trim().min(2, "Token atau kode barang minimal 2 karakter.").max(100, "Token atau kode barang maksimal 100 karakter.").regex(
  TOKEN_REGEX,
  "Format token barcode tidak valid. Hanya karakter alfanumerik, tanda hubung (-), titik (.), dan garis bawah (_) yang diperbolehkan."
);
var loanRequestSchema = z.object({
  assetId: z.string({ required_error: "ID atau token barang wajib diisi." }).trim().min(1, "ID atau token barang tidak boleh kosong.").max(100, "ID atau token barang maksimal 100 karakter.").regex(TOKEN_REGEX, "Format ID barang tidak valid."),
  borrowerName: z.string({ required_error: "Nama peminjam wajib diisi." }).trim().min(2, "Nama peminjam minimal 2 karakter.").max(200, "Nama peminjam maksimal 200 karakter."),
  borrowerEmployeeNumber: z.string().trim().max(50, "NIP/Nomor pegawai maksimal 50 karakter.").default("-"),
  borrowerRole: z.enum(["ADMIN_SARPRAS", "GURU_PEGAWAI", "KEPALA_SEKOLAH"], {
    errorMap: () => ({
      message: "Role peminjam harus salah satu dari: ADMIN_SARPRAS, GURU_PEGAWAI, KEPALA_SEKOLAH."
    })
  }).default("GURU_PEGAWAI"),
  borrowerId: z.string().trim().max(100).optional(),
  purpose: z.string({ required_error: "Tujuan peminjaman wajib diisi." }).trim().min(3, "Tujuan peminjaman minimal 3 karakter.").max(500, "Tujuan peminjaman maksimal 500 karakter."),
  expectedReturnAt: z.string({ required_error: "Tanggal pengembalian yang direncanakan wajib diisi." }).trim().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal pengembalian tidak valid (wajib ISO-8601 string valid)."
  })
});
function normalizeLoanPayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  return {
    assetId: raw.assetId || raw.assetUnitId,
    borrowerName: raw.borrowerName || raw.borrower?.fullName || raw.borrower?.name,
    borrowerEmployeeNumber: raw.borrowerEmployeeNumber || raw.borrower?.employeeNumber || raw.borrower?.nip || "-",
    borrowerRole: raw.borrowerRole || raw.borrower?.role || "GURU_PEGAWAI",
    borrowerId: raw.borrowerId || raw.borrower?.id,
    purpose: raw.purpose,
    expectedReturnAt: raw.expectedReturnAt
  };
}
var loginSchema = z.object({
  identifier: z.string({ required_error: "NIP atau email wajib diisi." }).trim().min(3, "NIP atau email minimal 3 karakter.").max(255, "NIP atau email maksimal 255 karakter."),
  password: z.string({ required_error: "Kata sandi wajib diisi." }).min(1, "Kata sandi tidak boleh kosong.").max(255, "Kata sandi maksimal 255 karakter.")
});
var createUserSchema = z.object({
  fullName: z.string({ required_error: "Nama lengkap wajib diisi." }).trim().min(2, "Nama lengkap minimal 2 karakter.").max(255, "Nama lengkap maksimal 255 karakter."),
  employeeNumber: z.string().trim().max(50, "NIP/Nomor pegawai maksimal 50 karakter.").optional().default("-"),
  email: z.string({ required_error: "Email kedinasan wajib diisi." }).trim().email("Format email tidak valid.").max(255, "Email maksimal 255 karakter."),
  role: z.enum(["ADMIN_SARPRAS", "GURU_PEGAWAI", "KEPALA_SEKOLAH"], {
    errorMap: () => ({
      message: "Peran harus salah satu dari: ADMIN_SARPRAS, GURU_PEGAWAI, KEPALA_SEKOLAH."
    })
  }),
  password: z.string({ required_error: "Kata sandi awal wajib diisi." }).min(6, "Kata sandi minimal 6 karakter.").max(255, "Kata sandi maksimal 255 karakter."),
  department: z.string().trim().max(255, "Departemen maksimal 255 karakter.").optional().default("Guru / Pegawai"),
  isActive: z.boolean().optional().default(true)
});
var updateUserSchema = z.object({
  fullName: z.string().trim().min(2, "Nama lengkap minimal 2 karakter.").max(255, "Nama lengkap maksimal 255 karakter.").optional(),
  employeeNumber: z.string().trim().max(50, "NIP/Nomor pegawai maksimal 50 karakter.").optional(),
  email: z.string().trim().email("Format email tidak valid.").max(255, "Email maksimal 255 karakter.").optional(),
  role: z.enum(["ADMIN_SARPRAS", "GURU_PEGAWAI", "KEPALA_SEKOLAH"], {
    errorMap: () => ({
      message: "Peran harus salah satu dari: ADMIN_SARPRAS, GURU_PEGAWAI, KEPALA_SEKOLAH."
    })
  }).optional(),
  password: z.string().min(6, "Kata sandi baru minimal 6 karakter.").max(255, "Kata sandi maksimal 255 karakter.").optional().or(z.literal("")),
  department: z.string().trim().max(255, "Departemen maksimal 255 karakter.").optional(),
  isActive: z.boolean().optional()
});
var updateUserStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "Status aktif (isActive) wajib berupa nilai boolean true atau false.",
    invalid_type_error: "Status aktif (isActive) harus boolean."
  })
});
var httpsUrlSchema = z.string().trim().max(1e3, "URL tautan foto maksimal 1000 karakter.").refine(
  (val) => {
    if (!val) return true;
    try {
      const parsed = new URL(val);
      if (parsed.protocol !== "https:") return false;
      if (parsed.username || parsed.password) return false;
      return true;
    } catch {
      return false;
    }
  },
  { message: "Tautan foto harus berupa URL valid dengan protokol HTTPS (https://) dan tidak menggunakan skema berbahaya." }
);
var locationSchema = z.object({
  name: z.string({ required_error: "Nama ruangan/lokasi wajib diisi." }).trim().min(2, "Nama ruangan minimal 2 karakter.").max(100, "Nama ruangan maksimal 100 karakter."),
  code: z.string().trim().max(50, "Kode ruangan maksimal 50 karakter.").optional(),
  description: z.string().trim().max(500, "Keterangan ruangan maksimal 500 karakter.").optional(),
  isActive: z.boolean().optional().default(true)
});
var updateLocationSchema = locationSchema.partial();
var categorySchema = z.object({
  name: z.string({ required_error: "Nama kategori wajib diisi." }).trim().min(2, "Nama kategori minimal 2 karakter.").max(100, "Nama kategori maksimal 100 karakter."),
  defaultLoanMode: z.enum(["DIRECT", "ADMIN_APPROVAL"], {
    errorMap: () => ({
      message: "Mode peminjaman harus DIRECT atau ADMIN_APPROVAL."
    })
  }).default("DIRECT"),
  description: z.string().trim().max(500, "Keterangan kategori maksimal 500 karakter.").optional(),
  isActive: z.boolean().optional().default(true)
});
var updateCategorySchema = categorySchema.partial();
var fundingSourceSchema = z.object({
  name: z.string({ required_error: "Nama sumber pendanaan wajib diisi." }).trim().min(2, "Nama sumber pendanaan minimal 2 karakter.").max(100, "Nama sumber pendanaan maksimal 100 karakter."),
  description: z.string().trim().max(500, "Keterangan sumber dana maksimal 500 karakter.").optional(),
  isActive: z.boolean().optional().default(true)
});
var updateFundingSourceSchema = fundingSourceSchema.partial();
var schoolSettingsSchema = z.object({
  schoolName: z.string({ required_error: "Nama sekolah wajib diisi." }).trim().min(2, "Nama sekolah minimal 2 karakter.").max(255, "Nama sekolah maksimal 255 karakter."),
  address: z.string().trim().max(500, "Alamat sekolah maksimal 500 karakter.").optional().default(""),
  phone: z.string().trim().max(50, "Nomor telepon/kontak maksimal 50 karakter.").optional().default(""),
  email: z.string().trim().max(255, "Email sekolah maksimal 255 karakter.").refine(
    (val) => {
      if (!val) return true;
      return z.string().email().safeParse(val).success;
    },
    { message: "Format email sekolah tidak valid." }
  ).optional().default(""),
  logoUrl: httpsUrlSchema.optional().default("")
});
var assetCreateSchema = z.object({
  itemName: z.string({ required_error: "Nama barang wajib diisi." }).trim().min(2, "Nama barang minimal 2 karakter.").max(255, "Nama barang maksimal 255 karakter."),
  institution: z.string().trim().max(128).optional().default("MIS Cendikia Bunayya"),
  categoryId: z.string().trim().max(64).optional(),
  categoryName: z.string().trim().max(128).optional(),
  locationId: z.string({ required_error: "Ruangan/lokasi wajib dipilih." }).trim().min(1, "Ruangan/lokasi wajib dipilih."),
  locationName: z.string().trim().max(128).optional(),
  itemBrand: z.string().trim().max(128).optional().default("Standar"),
  fundingSource: z.string().trim().max(128).optional().default("BOS Reguler"),
  acquisitionYear: z.union([z.number(), z.string()]).transform((val) => Number(val) || (/* @__PURE__ */ new Date()).getFullYear()).optional(),
  technicalSpecs: z.string().trim().max(2e3).optional().default("-"),
  effectiveLoanMode: z.enum(["DIRECT", "ADMIN_APPROVAL"]).optional().default("DIRECT"),
  conditionStatus: z.enum(["GOOD", "MINOR_DAMAGE", "MAJOR_DAMAGE", "LOST"]).optional().default("GOOD"),
  operationalStatus: z.enum([
    "AVAILABLE",
    "UNAVAILABLE",
    "RESERVED",
    "ON_LOAN",
    "RETURN_PENDING",
    "RETURN_INSPECTION",
    "MAINTENANCE",
    "INACTIVE",
    "LOST"
  ]).optional().default("AVAILABLE"),
  photoUrl: httpsUrlSchema.optional().nullable(),
  photoPath: httpsUrlSchema.optional().nullable(),
  notes: z.string().trim().max(1e3).optional(),
  assetCode: z.string().trim().max(64).optional(),
  itemNumber: z.string().trim().max(64).optional().nullable(),
  qrToken: z.string().trim().max(64).optional(),
  serialNumber: z.string().trim().max(128).optional(),
  standardAccessories: z.array(z.string()).optional().default([])
});
var assetUpdateSchema = assetCreateSchema.partial();

// server/src/middleware/auth.ts
import jwt from "jsonwebtoken";
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Akses ditolak. Token otorisasi (Bearer Token) diperlukan untuk mengakses sumber daya ini."
    });
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Token otorisasi kosong."
    });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (_error) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Token otorisasi tidak valid atau telah kadaluarsa."
    });
  }
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Akses ditolak. Token otorisasi diperlukan."
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: `Akses ditolak. Peran "${req.user.role}" tidak memiliki hak akses untuk tindakan ini.`
      });
    }
    next();
  };
}

// server/src/middleware/rateLimiter.ts
function createRateLimiter(options) {
  const store = /* @__PURE__ */ new Map();
  const limiter = (req, res, next) => {
    const now = Date.now();
    const rawIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const key = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
    let record = store.get(key);
    if (!record || record.resetTime <= now) {
      record = {
        count: 1,
        resetTime: now + options.windowMs
      };
      store.set(key, record);
    } else {
      record.count += 1;
    }
    const remaining = Math.max(0, options.max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1e3);
    res.setHeader("X-RateLimit-Limit", options.max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1e3));
    if (record.count > options.max) {
      res.setHeader("Retry-After", resetSeconds);
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: options.message || "Terlalu banyak permintaan pengajuan peminjaman dari IP ini. Silakan coba lagi beberapa saat kemudian.",
        retryAfterSeconds: resetSeconds
      });
    }
    next();
  };
  limiter.reset = () => {
    store.clear();
  };
  return limiter;
}

// server/src/realtime/sseManager.ts
var SSEManager = class _SSEManager {
  static instance;
  clients = /* @__PURE__ */ new Map();
  heartbeatInterval = null;
  constructor() {
    this.startHeartbeat();
  }
  static getInstance() {
    if (!_SSEManager.instance) {
      _SSEManager.instance = new _SSEManager();
    }
    return _SSEManager.instance;
  }
  /**
   * Mendaftarkan koneksi klien baru ke kanal stream SSE
   */
  addClient(client) {
    const { id, res, role } = client;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }
    this.clients.set(id, client);
    const welcomeData = JSON.stringify({
      status: "CONNECTED",
      clientId: id,
      serverTime: (/* @__PURE__ */ new Date()).toISOString(),
      role: role || "GUEST"
    });
    res.write(`event: connected
data: ${welcomeData}

`);
    res.on("close", () => {
      this.removeClient(id);
    });
  }
  /**
   * Menghapus klien yang telah terputus
   */
  removeClient(id) {
    if (this.clients.has(id)) {
      this.clients.delete(id);
    }
  }
  /**
   * Menyiarkan event perubahan data ke semua klien yang terhubung
   * Wajib dipanggil HANYA setelah transaksi database di-COMMIT secara sukses
   */
  broadcast(eventType, payload = {}, options) {
    const eventMessage = JSON.stringify({
      ...payload,
      type: eventType,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const sseFormatted = `event: ${eventType}
data: ${eventMessage}

`;
    for (const [id, client] of this.clients.entries()) {
      if (options?.targetRoles && options.targetRoles.length > 0) {
        if (!client.role || !options.targetRoles.includes(client.role)) {
          continue;
        }
      }
      if (options?.targetUserId) {
        if (client.userId !== options.targetUserId) {
          continue;
        }
      }
      try {
        client.res.write(sseFormatted);
      } catch (err) {
        console.error(`[SSE Broadcast Error] Gagal mengirim ke client ${id}:`, err);
        this.removeClient(id);
      }
    }
  }
  /**
   * Mengirim heartbeat / komentar keep-alive setiap 20 detik
   */
  startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(`: keep-alive ${Date.now()}

`);
        } catch {
          this.removeClient(id);
        }
      }
    }, 2e4);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }
  /**
   * Jumlah klien aktif yang terhubung saat ini
   */
  getClientCount() {
    return this.clients.size;
  }
  /**
   * Bersihkan semua koneksi (untuk testing/reset)
   */
  reset() {
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
      }
    }
    this.clients.clear();
  }
};
var sseManager = SSEManager.getInstance();

// server/src/routes/assets.ts
var assetsRouter = Router2();
var publicScanLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  max: 60,
  message: "Terlalu banyak permintaan pemindaian barcode dari perangkat Anda. Silakan coba lagi 1 menit kemudian."
});
function formatAssetResponse(row) {
  let standardAccessories = [];
  if (Array.isArray(row.standard_accessories)) {
    standardAccessories = row.standard_accessories;
  } else if (typeof row.standard_accessories === "string") {
    try {
      standardAccessories = JSON.parse(row.standard_accessories);
    } catch {
      standardAccessories = [];
    }
  }
  const base = {
    id: row.id,
    permanentId: row.permanent_id,
    qrToken: row.qr_token,
    assetCode: row.asset_code,
    itemNumber: row.item_number || null,
    itemName: row.item_name,
    institution: row.institution,
    categoryId: row.category_id,
    categoryName: row.category_name,
    locationId: row.location_id,
    locationName: row.location_name,
    itemBrand: row.item_brand,
    fundingSource: row.funding_source,
    acquisitionYear: row.acquisition_year,
    technicalSpecs: row.technical_specs,
    effectiveLoanMode: row.effective_loan_mode,
    conditionStatus: row.condition_status,
    operationalStatus: row.operational_status,
    photoPath: row.photo_url,
    photoUrl: row.photo_url,
    notes: row.notes,
    standardAccessories,
    isDecommissioned: Boolean(row.is_decommissioned),
    decommissionedAt: row.decommissioned_at,
    decommissionedReason: row.decommissioned_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  return {
    ...base,
    asset: base
    // Mempertahankan backward compatibility untuk konsumen yang membaca res.asset
  };
}
function formatPublicAssetResponse(row) {
  let standardAccessories = [];
  if (Array.isArray(row.standard_accessories)) {
    standardAccessories = row.standard_accessories;
  } else if (typeof row.standard_accessories === "string") {
    try {
      standardAccessories = JSON.parse(row.standard_accessories);
    } catch {
      standardAccessories = [];
    }
  }
  const base = {
    id: row.id,
    permanentId: row.permanent_id,
    qrToken: row.qr_token,
    assetCode: row.asset_code,
    itemNumber: row.item_number || null,
    itemName: row.item_name,
    institution: row.institution,
    categoryId: row.category_id,
    categoryName: row.category_name,
    locationId: row.location_id,
    locationName: row.location_name,
    itemBrand: row.item_brand,
    technicalSpecs: row.technical_specs,
    effectiveLoanMode: row.effective_loan_mode,
    conditionStatus: row.condition_status,
    operationalStatus: row.operational_status,
    photoPath: row.photo_url,
    photoUrl: row.photo_url,
    standardAccessories,
    isDecommissioned: Boolean(row.is_decommissioned),
    decommissionedAt: row.decommissioned_at,
    decommissionedReason: row.decommissioned_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  return {
    ...base,
    asset: base
    // Mempertahankan backward compatibility untuk konsumen yang membaca res.asset
  };
}
async function lookupAsset(rawIdentifier, res) {
  const parseResult = tokenParamSchema.safeParse(rawIdentifier);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "INVALID_TOKEN_FORMAT",
      message: parseResult.error.errors[0]?.message || "Format token atau kode inventaris tidak valid."
    });
  }
  const identifier = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung. Backend dalam mode persiapan."
    });
  }
  try {
    const query = `
      SELECT 
        id, permanent_id, qr_token, asset_code, item_name, institution,
        category_id, category_name, location_id, location_name, item_brand,
        technical_specs, effective_loan_mode,
        condition_status, operational_status, photo_url,
        standard_accessories, is_decommissioned, decommissioned_at, decommissioned_reason,
        created_at, updated_at
      FROM assets
      WHERE qr_token = $1 OR permanent_id = $1 OR asset_code = $1 OR id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [identifier]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "ASSET_NOT_FOUND",
        message: "Data barang tidak ditemukan atau kode inventaris salah."
      });
    }
    const row = result.rows[0];
    const formatted = formatPublicAssetResponse(row);
    if (formatted.isDecommissioned) {
      return res.status(200).json({
        ...formatted,
        notice: "BARANG_DINONAKTIFKAN",
        message: "Barang ini telah dinonaktifkan atau dihapus secara logis dari inventaris aktif."
      });
    }
    return res.status(200).json(formatted);
  } catch (error) {
    console.error("[Assets Lookup Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan sistem saat mencari data barang."
    });
  }
}
assetsRouter.get("/scan", publicScanLimiter, async (req, res) => {
  const queryParam = req.query.query || req.query.code || req.query.token;
  if (!queryParam || typeof queryParam !== "string") {
    return res.status(400).json({
      error: "MISSING_QUERY_PARAMETER",
      message: "Parameter pencarian barcode (?query=...) wajib diisi."
    });
  }
  return lookupAsset(queryParam, res);
});
assetsRouter.get("/scan/:token", publicScanLimiter, async (req, res) => {
  return lookupAsset(req.params.token, res);
});
assetsRouter.get("/token/:token", publicScanLimiter, async (req, res) => {
  return lookupAsset(req.params.token, res);
});
assetsRouter.get("/", requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const {
      categoryId,
      locationId,
      operationalStatus,
      fundingSourceId,
      fundingSource,
      acquisitionYear,
      institution,
      itemNumber,
      search,
      q,
      limit,
      offset,
      page
    } = req.query;
    let query = "SELECT * FROM assets WHERE is_decommissioned = false";
    const params = [];
    if (categoryId && typeof categoryId === "string" && categoryId.trim() !== "") {
      params.push(categoryId.trim());
      query += ` AND category_id = $${params.length}`;
    }
    if (locationId && typeof locationId === "string" && locationId.trim() !== "") {
      params.push(locationId.trim());
      query += ` AND location_id = $${params.length}`;
    }
    if (operationalStatus && typeof operationalStatus === "string" && operationalStatus.trim() !== "") {
      params.push(operationalStatus.trim());
      query += ` AND operational_status = $${params.length}`;
    }
    const fundingParam = (fundingSourceId || fundingSource)?.trim();
    if (fundingParam) {
      params.push(fundingParam);
      query += ` AND (funding_source = $${params.length} OR funding_source IN (SELECT name FROM funding_sources WHERE id = $${params.length}))`;
    }
    if (acquisitionYear !== void 0 && acquisitionYear !== "" && acquisitionYear !== null) {
      const parsedYear = parseInt(String(acquisitionYear), 10);
      if (!isNaN(parsedYear)) {
        params.push(parsedYear);
        query += ` AND acquisition_year = $${params.length}`;
      }
    }
    if (institution && typeof institution === "string" && institution.trim() !== "") {
      params.push(institution.trim());
      query += ` AND institution = $${params.length}`;
    }
    if (itemNumber && typeof itemNumber === "string" && itemNumber.trim() !== "") {
      const numTrim = itemNumber.trim();
      params.push(numTrim);
      query += ` AND (item_number = $${params.length} OR TRIM(LEADING '0' FROM COALESCE(item_number, '')) = TRIM(LEADING '0' FROM $${params.length}))`;
    }
    const searchParam = (search || q)?.trim();
    if (searchParam) {
      params.push(`%${searchParam}%`);
      query += ` AND (item_name ILIKE $${params.length} OR asset_code ILIKE $${params.length} OR item_brand ILIKE $${params.length} OR technical_specs ILIKE $${params.length} OR COALESCE(item_number, '') ILIKE $${params.length})`;
    }
    let totalCount;
    const countRes = await pool.query(`SELECT COUNT(*) FROM (${query}) AS filtered_assets`, params);
    totalCount = parseInt(countRes.rows[0].count, 10);
    query += " ORDER BY created_at DESC";
    const limitNum = limit ? parseInt(String(limit), 10) : void 0;
    let offsetNum = offset ? parseInt(String(offset), 10) : void 0;
    if (page && limitNum && offsetNum === void 0) {
      const pageNum = parseInt(String(page), 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        offsetNum = (pageNum - 1) * limitNum;
      }
    }
    if (limitNum && !isNaN(limitNum)) {
      params.push(limitNum);
      query += ` LIMIT $${params.length}`;
    }
    if (offsetNum && !isNaN(offsetNum)) {
      params.push(offsetNum);
      query += ` OFFSET $${params.length}`;
    }
    const result = await pool.query(query, params);
    const data = result.rows.map(formatAssetResponse);
    return res.status(200).json({ data, total: totalCount });
  } catch (error) {
    console.error("[Assets Listing Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat daftar aset inventaris."
    });
  }
});
assetsRouter.get("/years", requireAuth, async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const result = await pool.query(`
      SELECT DISTINCT acquisition_year
      FROM assets
      WHERE acquisition_year IS NOT NULL AND is_decommissioned = false
      ORDER BY acquisition_year DESC
    `);
    const years = result.rows.map((r) => r.acquisition_year).filter((y) => typeof y === "number" && !isNaN(y));
    return res.status(200).json(years);
  } catch (error) {
    console.error("[Assets Years Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat daftar tahun perolehan."
    });
  }
});
assetsRouter.get("/:id", publicScanLimiter, async (req, res) => {
  return lookupAsset(req.params.id, res);
});
assetsRouter.post("/", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const parseResult = assetCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format data barang tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const data = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const locRes = await pool.query("SELECT id, name FROM locations WHERE id = $1", [data.locationId]);
    if (locRes.rows.length === 0) {
      return res.status(400).json({
        error: "INVALID_LOCATION",
        message: "Ruangan / lokasi yang dipilih tidak terdaftar dalam database."
      });
    }
    const locationName = locRes.rows[0].name;
    let categoryId = data.categoryId || null;
    let categoryName = data.categoryName || "Umum";
    if (categoryId) {
      const catRes = await pool.query("SELECT id, name FROM categories WHERE id = $1", [categoryId]);
      if (catRes.rows.length > 0) {
        categoryName = catRes.rows[0].name;
      }
    } else if (data.categoryName) {
      const catRes = await pool.query(
        "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1)",
        [data.categoryName]
      );
      if (catRes.rows.length > 0) {
        categoryId = catRes.rows[0].id;
        categoryName = catRes.rows[0].name;
      }
    }
    const assetCode = (data.assetCode || `INV-${Date.now().toString().slice(-6)}`).toUpperCase();
    const qrToken = (data.qrToken || `QR-${assetCode}`).toUpperCase();
    const permanentId = `ast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const id = permanentId;
    const codeCheck = await pool.query(
      "SELECT id FROM assets WHERE asset_code = $1 OR qr_token = $2 LIMIT 1",
      [assetCode, qrToken]
    );
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({
        error: "DUPLICATE_ASSET_CODE",
        message: `Kode barang "${assetCode}" atau token QR sudah digunakan oleh barang lain.`
      });
    }
    const photoUrl = data.photoUrl || data.photoPath || null;
    const insertQuery = `
      INSERT INTO assets (
        id, permanent_id, qr_token, asset_code, item_number, item_name, institution,
        category_id, category_name, location_id, location_name, item_brand,
        funding_source, acquisition_year, technical_specs, effective_loan_mode,
        condition_status, operational_status, photo_url, notes, standard_accessories
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *
    `;
    const insertRes = await pool.query(insertQuery, [
      id,
      permanentId,
      qrToken,
      assetCode,
      data.itemNumber || null,
      data.itemName,
      data.institution,
      categoryId,
      categoryName,
      data.locationId,
      locationName,
      data.itemBrand,
      data.fundingSource,
      data.acquisitionYear,
      data.technicalSpecs,
      data.effectiveLoanMode,
      data.conditionStatus,
      data.operationalStatus,
      photoUrl,
      data.notes || null,
      JSON.stringify(data.standardAccessories || [])
    ]);
    const createdRow = insertRes.rows[0];
    sseManager.broadcast("asset.updated", {
      assetId: id,
      assetCode,
      action: "created"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: id,
      status: data.operationalStatus || "AVAILABLE"
    });
    return res.status(201).json(formatAssetResponse(createdRow));
  } catch (error) {
    console.error("[Asset Creation Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menambahkan data barang ke database."
    });
  }
});
assetsRouter.patch("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  const parseResult = assetUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format data perbaruan barang tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const data = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existingRes = await pool.query("SELECT * FROM assets WHERE id = $1", [targetId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: "ASSET_NOT_FOUND",
        message: "Data barang tidak ditemukan."
      });
    }
    const current = existingRes.rows[0];
    let locationName = current.location_name;
    if (data.locationId && data.locationId !== current.location_id) {
      const locRes = await pool.query("SELECT id, name FROM locations WHERE id = $1", [data.locationId]);
      if (locRes.rows.length === 0) {
        return res.status(400).json({
          error: "INVALID_LOCATION",
          message: "Ruangan/lokasi tidak valid."
        });
      }
      locationName = locRes.rows[0].name;
    }
    let categoryName = current.category_name;
    if (data.categoryId && data.categoryId !== current.category_id) {
      const catRes = await pool.query("SELECT id, name FROM categories WHERE id = $1", [data.categoryId]);
      if (catRes.rows.length > 0) {
        categoryName = catRes.rows[0].name;
      }
    }
    const updates = [];
    const params = [];
    if (data.itemName !== void 0) {
      params.push(data.itemName);
      updates.push(`item_name = $${params.length}`);
    }
    if (data.itemNumber !== void 0) {
      params.push(data.itemNumber || null);
      updates.push(`item_number = $${params.length}`);
    }
    if (data.institution !== void 0) {
      params.push(data.institution);
      updates.push(`institution = $${params.length}`);
    }
    if (data.categoryId !== void 0) {
      params.push(data.categoryId);
      updates.push(`category_id = $${params.length}`);
      params.push(categoryName);
      updates.push(`category_name = $${params.length}`);
    } else if (data.categoryName !== void 0) {
      params.push(data.categoryName);
      updates.push(`category_name = $${params.length}`);
    }
    if (data.locationId !== void 0) {
      params.push(data.locationId);
      updates.push(`location_id = $${params.length}`);
      params.push(locationName);
      updates.push(`location_name = $${params.length}`);
    }
    if (data.itemBrand !== void 0) {
      params.push(data.itemBrand);
      updates.push(`item_brand = $${params.length}`);
    }
    if (data.fundingSource !== void 0) {
      params.push(data.fundingSource);
      updates.push(`funding_source = $${params.length}`);
    }
    if (data.acquisitionYear !== void 0) {
      params.push(data.acquisitionYear);
      updates.push(`acquisition_year = $${params.length}`);
    }
    if (data.technicalSpecs !== void 0) {
      params.push(data.technicalSpecs);
      updates.push(`technical_specs = $${params.length}`);
    }
    if (data.effectiveLoanMode !== void 0) {
      params.push(data.effectiveLoanMode);
      updates.push(`effective_loan_mode = $${params.length}`);
    }
    if (data.conditionStatus !== void 0) {
      params.push(data.conditionStatus);
      updates.push(`condition_status = $${params.length}`);
    }
    if (data.operationalStatus !== void 0) {
      params.push(data.operationalStatus);
      updates.push(`operational_status = $${params.length}`);
    }
    const newPhoto = data.photoUrl !== void 0 ? data.photoUrl : data.photoPath;
    if (newPhoto !== void 0) {
      params.push(newPhoto || null);
      updates.push(`photo_url = $${params.length}`);
    }
    if (data.notes !== void 0) {
      params.push(data.notes || null);
      updates.push(`notes = $${params.length}`);
    }
    if (data.standardAccessories !== void 0) {
      params.push(JSON.stringify(data.standardAccessories));
      updates.push(`standard_accessories = $${params.length}`);
    }
    updates.push(`updated_at = NOW()`);
    params.push(targetId);
    const updateQuery = `
      UPDATE assets
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING *
    `;
    const updateRes = await pool.query(updateQuery, params);
    const updatedRow = updateRes.rows[0];
    const formatted = formatAssetResponse(updatedRow);
    sseManager.broadcast("asset.updated", {
      assetId: formatted.id,
      assetCode: formatted.assetCode,
      action: "updated"
    });
    if (data.operationalStatus !== void 0 || data.conditionStatus !== void 0) {
      sseManager.broadcast("asset.availability_changed", {
        assetId: formatted.id,
        status: formatted.operationalStatus
      });
    }
    return res.status(200).json(formatted);
  } catch (error) {
    console.error("[Asset Update Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memperbarui data barang di database."
    });
  }
});
assetsRouter.post("/:id/decommission", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  const reason = (req.body?.reason || "Dinonaktifkan oleh administrator").trim();
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existingRes = await pool.query("SELECT * FROM assets WHERE id = $1", [targetId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: "ASSET_NOT_FOUND",
        message: "Data barang tidak ditemukan."
      });
    }
    const current = existingRes.rows[0];
    const activeLoansRes = await pool.query(
      `SELECT COUNT(*) AS total FROM loans 
       WHERE asset_id = $1 
         AND status IN ('PENDING_APPROVAL', 'APPROVED', 'READY_FOR_HANDOVER', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED', 'RETURN_ISSUE')`,
      [targetId]
    );
    const activeLoansCount = parseInt(activeLoansRes.rows[0].total, 10);
    if (activeLoansCount > 0) {
      return res.status(409).json({
        error: "ACTIVE_LOANS_EXIST",
        message: `Barang "${current.item_name}" (${current.asset_code}) tidak dapat dinonaktifkan karena masih terikat dalam transaksi peminjaman aktif atau proses pengembalian.`
      });
    }
    const updateQuery = `
      UPDATE assets
      SET is_decommissioned = true,
          decommissioned_at = NOW(),
          decommissioned_reason = $1,
          operational_status = 'INACTIVE',
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const updateRes = await pool.query(updateQuery, [reason, targetId]);
    const updatedRow = updateRes.rows[0];
    const formatted = formatAssetResponse(updatedRow);
    try {
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          req.user?.id || "system",
          req.user?.fullName || "Admin Sarpras",
          req.user?.role || "ADMIN_SARPRAS",
          "NONAKTIF_BARANG",
          "ASSET",
          targetId,
          current.item_name,
          `Menonaktifkan barang inventaris: ${current.item_name} (${current.asset_code}) \u2014 Alasan: ${reason}`
        ]
      );
    } catch (auditErr) {
      console.warn("[Audit Log Write Warning]:", auditErr);
    }
    sseManager.broadcast("asset.updated", {
      assetId: formatted.id,
      assetCode: formatted.assetCode,
      action: "decommissioned"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: formatted.id,
      status: "INACTIVE"
    });
    return res.status(200).json(formatted);
  } catch (error) {
    console.error("[Asset Decommission Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menonaktifkan data barang di database."
    });
  }
});
assetsRouter.delete("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  const reason = (req.body?.reason || "Dihapus oleh administrator inventaris").trim();
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const assetRes = await client.query("SELECT * FROM assets WHERE id = $1 FOR UPDATE", [targetId]);
    if (assetRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "ASSET_NOT_FOUND",
        message: "Data barang tidak ditemukan dalam database."
      });
    }
    const asset = assetRes.rows[0];
    const isInactive = asset.operational_status === "INACTIVE" || Boolean(asset.is_decommissioned);
    if (!isInactive) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "CANNOT_DELETE_ACTIVE_ASSET",
        message: `Barang "${asset.item_name}" (${asset.asset_code}) masih berstatus aktif (${asset.operational_status}). Barang aktif tidak boleh dihapus. Silakan nonaktifkan barang terlebih dahulu sebelum diajukan untuk dihapus.`
      });
    }
    const activeLoansRes = await client.query(
      `SELECT COUNT(*) AS total FROM loans 
       WHERE asset_id = $1 
         AND status IN ('PENDING_APPROVAL', 'APPROVED', 'READY_FOR_HANDOVER', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED', 'RETURN_ISSUE')`,
      [targetId]
    );
    const activeLoansCount = parseInt(activeLoansRes.rows[0].total, 10);
    if (activeLoansCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "ACTIVE_LOANS_EXIST",
        message: `Barang "${asset.item_name}" (${asset.asset_code}) tidak dapat dihapus karena masih terkait dengan ${activeLoansCount} transaksi peminjaman aktif atau pengembalian yang sedang berjalan.`
      });
    }
    const totalLoansRes = await client.query(
      "SELECT COUNT(*) AS total FROM loans WHERE asset_id = $1",
      [targetId]
    );
    const totalLoansCount = parseInt(totalLoansRes.rows[0].total, 10);
    let deleteMode = "DELETED";
    let resultData = null;
    if (totalLoansCount > 0) {
      deleteMode = "ARCHIVED";
      const updateRes = await client.query(
        `UPDATE assets 
         SET is_decommissioned = true, 
             decommissioned_at = COALESCE(decommissioned_at, NOW()), 
             decommissioned_reason = $1, 
             operational_status = 'INACTIVE', 
             updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [reason, targetId]
      );
      resultData = formatAssetResponse(updateRes.rows[0]);
    } else {
      deleteMode = "DELETED";
      await client.query("DELETE FROM assets WHERE id = $1", [targetId]);
      resultData = {
        id: asset.id,
        assetCode: asset.asset_code,
        itemName: asset.item_name,
        permanentId: asset.permanent_id,
        qrToken: asset.qr_token
      };
    }
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        auditId,
        req.user?.id || "system",
        req.user?.fullName || "Admin Sarpras",
        req.user?.role || "ADMIN_SARPRAS",
        deleteMode === "DELETED" ? "HAPUS_BARANG" : "ARSIP_BARANG",
        "ASSET",
        targetId,
        asset.item_name,
        deleteMode === "DELETED" ? `Menghapus data barang secara permanen: ${asset.item_name} (${asset.asset_code}) \u2014 Alasan: ${reason}` : `Mengarsipkan data barang dengan riwayat transaksi: ${asset.item_name} (${asset.asset_code}) \u2014 Alasan: ${reason}`
      ]
    );
    await client.query("COMMIT");
    sseManager.broadcast("asset.updated", {
      assetId: targetId,
      assetCode: asset.asset_code,
      action: deleteMode === "DELETED" ? "deleted" : "archived"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: targetId,
      status: "INACTIVE"
    });
    return res.status(200).json({
      success: true,
      mode: deleteMode,
      message: deleteMode === "DELETED" ? `Data barang "${asset.item_name}" (${asset.asset_code}) berhasil dihapus secara permanen.` : `Barang "${asset.item_name}" (${asset.asset_code}) memiliki riwayat transaksi peminjaman, sehingga diarsipkan secara aman untuk menjaga keutuhan riwayat audit.`,
      data: resultData
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Asset Deletion Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memproses penghapusan barang."
    });
  } finally {
    client.release();
  }
});

// server/src/routes/loans.ts
import { Router as Router3 } from "express";
var loansRouter = Router3();
var loanSubmissionLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  max: 10,
  message: "Terlalu banyak permintaan pengajuan pinjaman dari perangkat Anda. Silakan tunggu 1 menit."
});
function formatLoanResponse(row, assetRow) {
  return {
    id: row.id,
    loanNumber: row.loan_number,
    assetId: row.asset_id,
    borrowerId: row.borrower_id || null,
    borrowerName: row.borrower_name,
    borrowerEmployeeNumber: row.borrower_employee_number || "-",
    borrowerRole: row.borrower_role || "GURU_PEGAWAI",
    status: row.status,
    loanModeSnapshot: row.loan_mode_snapshot,
    purpose: row.purpose,
    requestedAt: row.requested_at,
    expectedReturnAt: row.expected_return_at,
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    rejectionReason: row.rejection_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unit: assetRow ? formatAssetResponse(assetRow) : void 0
  };
}
async function handleLoanSubmission(req, res) {
  const normalized = normalizeLoanPayload(req.body);
  const parseResult = loanRequestSchema.safeParse(normalized);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Data pengajuan peminjaman tidak memenuhi syarat validasi.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const {
    assetId,
    borrowerName,
    borrowerEmployeeNumber,
    borrowerRole,
    borrowerId,
    purpose,
    expectedReturnAt
  } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung. Backend dalam mode persiapan."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const assetRes = await client.query(
      `SELECT id, operational_status, effective_loan_mode, item_name, is_decommissioned 
       FROM assets 
       WHERE id = $1 OR qr_token = $1 OR permanent_id = $1 OR asset_code = $1
       FOR UPDATE`,
      [assetId]
    );
    if (assetRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "ASSET_NOT_FOUND",
        message: "Barang tidak ditemukan di inventaris."
      });
    }
    const asset = assetRes.rows[0];
    const canonicalAssetId = asset.id;
    if (asset.is_decommissioned) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "ASSET_DECOMMISSIONED",
        message: "Barang ini telah dinonaktifkan dari inventaris dan tidak dapat dipinjam."
      });
    }
    if (asset.operational_status !== "AVAILABLE") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "ASSET_NOT_AVAILABLE",
        message: `Barang saat ini berstatus ${asset.operational_status} dan tidak sedang tersedia untuk dipinjam.`
      });
    }
    const isDirect = asset.effective_loan_mode === "DIRECT";
    const initialLoanStatus = isDirect ? "ACTIVE" : "PENDING_APPROVAL";
    const nextUnitStatus = isDirect ? "ON_LOAN" : "RESERVED";
    await client.query(
      `UPDATE assets 
       SET operational_status = $1, updated_at = NOW() 
       WHERE id = $2`,
      [nextUnitStatus, canonicalAssetId]
    );
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1e3 + Math.random() * 9e3);
    const loanNumber = `PINJAM-${dateStr}-${randomSuffix}`;
    const loanId = `loan-${Date.now()}-${randomSuffix}`;
    const loanInsertRes = await client.query(
      `INSERT INTO loans (
        id, loan_number, asset_id, borrower_id, borrower_name, borrower_employee_number,
        borrower_role, status, loan_mode_snapshot, purpose, expected_return_at, requested_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        loanId,
        loanNumber,
        canonicalAssetId,
        borrowerId || null,
        borrowerName,
        borrowerEmployeeNumber || "-",
        borrowerRole || "GURU_PEGAWAI",
        initialLoanStatus,
        asset.effective_loan_mode,
        purpose,
        expectedReturnAt
      ]
    );
    await client.query("COMMIT");
    sseManager.broadcast("loan.created", {
      loanId,
      loanNumber,
      assetId: canonicalAssetId,
      borrowerName,
      status: initialLoanStatus
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: canonicalAssetId,
      status: nextUnitStatus
    });
    const formattedLoan = formatLoanResponse(loanInsertRes.rows[0], asset);
    return res.status(201).json({
      ...formattedLoan,
      loan: formattedLoan,
      message: isDirect ? "Peminjaman mandiri berhasil aktif (Mode Direct)." : "Pengajuan peminjaman berhasil dicatat dan menunggu persetujuan admin.",
      nextUnitStatus
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Loan Request Error]:", error?.message || error);
    return res.status(500).json({
      error: "TRANSACTION_FAILED",
      message: "Gagal memproses transaksi peminjaman."
    });
  } finally {
    client.release();
  }
}
loansRouter.post("/request", loanSubmissionLimiter, handleLoanSubmission);
loansRouter.post("/", loanSubmissionLimiter, handleLoanSubmission);
loansRouter.get("/", requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const { status } = req.query;
    let query = `
      SELECT l.*, 
             a.id as a_id, a.item_name, a.asset_code, a.qr_token, a.permanent_id,
             a.photo_url, a.category_name, a.location_name, a.effective_loan_mode,
             a.condition_status, a.operational_status
      FROM loans l
      JOIN assets a ON l.asset_id = a.id
    `;
    const params = [];
    if (status && typeof status === "string") {
      params.push(status);
      query += ` WHERE l.status = $1`;
    }
    query += " ORDER BY l.requested_at DESC";
    const result = await pool.query(query, params);
    const data = result.rows.map(
      (row) => formatLoanResponse(row, {
        id: row.a_id,
        item_name: row.item_name,
        asset_code: row.asset_code,
        qr_token: row.qr_token,
        permanent_id: row.permanent_id,
        photo_url: row.photo_url,
        category_name: row.category_name,
        location_name: row.location_name,
        effective_loan_mode: row.effective_loan_mode,
        condition_status: row.condition_status,
        operational_status: row.operational_status
      })
    );
    return res.status(200).json({ data, total: result.rowCount });
  } catch (error) {
    console.error("[Loans Listing Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat riwayat peminjaman."
    });
  }
});
loansRouter.get("/:id", requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const { id } = req.params;
    const query = `
      SELECT l.*, 
             a.id as a_id, a.item_name, a.asset_code, a.qr_token, a.permanent_id,
             a.photo_url, a.category_name, a.location_name, a.effective_loan_mode,
             a.condition_status, a.operational_status
      FROM loans l
      JOIN assets a ON l.asset_id = a.id
      WHERE l.id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data transaksi peminjaman tidak ditemukan."
      });
    }
    const row = result.rows[0];
    const data = formatLoanResponse(row, {
      id: row.a_id,
      item_name: row.item_name,
      asset_code: row.asset_code,
      qr_token: row.qr_token,
      permanent_id: row.permanent_id,
      photo_url: row.photo_url,
      category_name: row.category_name,
      location_name: row.location_name,
      effective_loan_mode: row.effective_loan_mode,
      condition_status: row.condition_status,
      operational_status: row.operational_status
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error("[Loan Detail Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat detail peminjaman."
    });
  }
});
loansRouter.post("/:id/approve", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const loanId = req.params.id;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      "SELECT * FROM loans WHERE id = $1 FOR UPDATE",
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data permohonan peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    if (currentLoan.status !== "PENDING_APPROVAL") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_LOAN_STATUS",
        message: `Hanya pengajuan berstatus PENDING_APPROVAL yang dapat disetujui. Status saat ini: ${currentLoan.status}.`
      });
    }
    const adminUser = req.user || {};
    const adminId = adminUser.id || "usr-admin-1";
    const adminName = adminUser.fullName || "Admin Sarpras";
    const updatedLoanRes = await client.query(
      `UPDATE loans 
       SET status = 'ACTIVE', approved_by = $1, approved_by_name = $2, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [adminId, adminName, loanId]
    );
    await client.query(
      `UPDATE assets 
       SET operational_status = 'ON_LOAN', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );
    await client.query("COMMIT");
    const formatted = formatLoanResponse(updatedLoanRes.rows[0]);
    sseManager.broadcast("loan.approved", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: "ACTIVE"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: currentLoan.asset_id,
      status: "ON_LOAN"
    });
    return res.status(200).json(formatted);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Loan Approve Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menyetujui peminjaman."
    });
  } finally {
    client.release();
  }
});
loansRouter.post("/:id/reject", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const loanId = req.params.id;
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Alasan penolakan permohonan peminjaman wajib diisi."
    });
  }
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      "SELECT * FROM loans WHERE id = $1 FOR UPDATE",
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data permohonan peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    if (currentLoan.status !== "PENDING_APPROVAL") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_LOAN_STATUS",
        message: `Hanya pengajuan berstatus PENDING_APPROVAL yang dapat ditolak. Status saat ini: ${currentLoan.status}.`
      });
    }
    const adminUser = req.user || {};
    const adminId = adminUser.id || "usr-admin-1";
    const adminName = adminUser.fullName || "Admin Sarpras";
    const updatedLoanRes = await client.query(
      `UPDATE loans 
       SET status = 'REJECTED', rejection_reason = $1, approved_by = $2, approved_by_name = $3, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $4 
       RETURNING *`,
      [reason.trim(), adminId, adminName, loanId]
    );
    await client.query(
      `UPDATE assets 
       SET operational_status = 'AVAILABLE', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );
    await client.query("COMMIT");
    const formatted = formatLoanResponse(updatedLoanRes.rows[0]);
    sseManager.broadcast("loan.rejected", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: "REJECTED",
      reason: reason.trim()
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: currentLoan.asset_id,
      status: "AVAILABLE"
    });
    return res.status(200).json(formatted);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Loan Reject Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menolak peminjaman."
    });
  } finally {
    client.release();
  }
});
loansRouter.post("/:id/handover", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const loanId = req.params.id;
  const { conditionAtHandover, accessoriesVerified, notes } = req.body;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      "SELECT * FROM loans WHERE id = $1 FOR UPDATE",
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    const handoverData = JSON.stringify({
      conditionAtHandover: conditionAtHandover || "GOOD",
      accessoriesVerified: accessoriesVerified ?? true,
      notes: notes || null,
      handedOverAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const updatedLoanRes = await client.query(
      `UPDATE loans 
       SET status = 'ACTIVE', handover_data = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [handoverData, loanId]
    );
    await client.query(
      `UPDATE assets 
       SET operational_status = 'ON_LOAN', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );
    await client.query("COMMIT");
    const formatted = formatLoanResponse(updatedLoanRes.rows[0]);
    sseManager.broadcast("loan.approved", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: "ACTIVE"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: currentLoan.asset_id,
      status: "ON_LOAN"
    });
    return res.status(200).json(formatted);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Loan Handover Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memproses serah terima barang."
    });
  } finally {
    client.release();
  }
});

// server/src/routes/auth.ts
import { Router as Router4 } from "express";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";
var authRouter = Router4();
var loginLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  max: 10,
  message: "Terlalu banyak percobaan masuk dari perangkat Anda. Silakan coba lagi setelah 1 menit."
});
authRouter.post("/login", loginLimiter, async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format permintaan login tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const { identifier, password } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung. Backend dalam mode persiapan."
    });
  }
  try {
    const query = `
      SELECT id, email, password_hash, full_name, employee_number, role, department, avatar_url, is_active
      FROM users
      WHERE LOWER(email) = LOWER($1) OR employee_number = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [identifier]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "NIP/Email atau kata sandi tidak valid."
      });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({
        error: "ACCOUNT_INACTIVE",
        message: "Akun pengguna dinonaktifkan. Silakan hubungi Administrator Sarpras."
      });
    }
    const passwordHash = user.password_hash || "";
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "NIP/Email atau kata sandi tidak valid."
      });
    }
    const tokenPayload = {
      id: user.id,
      fullName: user.full_name,
      employeeNumber: user.employee_number || "-",
      email: user.email,
      role: user.role
    };
    const token = jwt2.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });
    return res.status(200).json({
      message: "Login berhasil.",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        employeeNumber: user.employee_number || "-",
        email: user.email,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatar_url
      }
    });
  } catch (error) {
    console.error("[Auth Login Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan sistem saat memproses autentikasi."
    });
  }
});
authRouter.get("/me", requireAuth, async (req, res) => {
  const authUser = req.user;
  if (!authUser) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Sesi otorisasi tidak valid."
    });
  }
  if (!pool) {
    return res.status(200).json({
      user: {
        id: authUser.id,
        fullName: authUser.fullName,
        employeeNumber: authUser.employeeNumber,
        email: authUser.email,
        role: authUser.role
      }
    });
  }
  try {
    const query = `
      SELECT id, email, full_name, employee_number, role, department, avatar_url, is_active
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [authUser.id]);
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        error: "USER_NOT_FOUND_OR_INACTIVE",
        message: "Pengguna tidak ditemukan atau akun telah dinonaktifkan."
      });
    }
    const row = result.rows[0];
    return res.status(200).json({
      user: {
        id: row.id,
        fullName: row.full_name,
        employeeNumber: row.employee_number || "-",
        email: row.email,
        role: row.role,
        department: row.department,
        avatarUrl: row.avatar_url
      }
    });
  } catch (error) {
    console.error("[Auth Profile Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat profil pengguna."
    });
  }
});
authRouter.post("/logout", (_req, res) => {
  return res.status(200).json({
    message: "Logout berhasil. Sesi lokal dibersihkan."
  });
});

// server/src/routes/users.ts
import { Router as Router5 } from "express";
import bcrypt2 from "bcryptjs";
var usersRouter = Router5();
usersRouter.use(requireAuth);
usersRouter.use(requireRole("ADMIN_SARPRAS"));
function formatUserResponse(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number || "-",
    email: row.email,
    role: row.role,
    department: row.department || "Guru / Pegawai",
    avatarUrl: row.avatar_url || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
usersRouter.get("/", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const { search, role, isActive } = req.query;
    let query = `
      SELECT id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params = [];
    if (search && typeof search === "string" && search.trim().length > 0) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(full_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR employee_number LIKE $${params.length})`;
    }
    if (role && typeof role === "string" && role.trim().length > 0) {
      params.push(role.trim());
      query += ` AND role = $${params.length}`;
    }
    if (isActive !== void 0 && isActive !== "") {
      params.push(String(isActive) === "true");
      query += ` AND is_active = $${params.length}`;
    }
    query += " ORDER BY created_at ASC";
    const result = await pool.query(query, params);
    const data = result.rows.map(formatUserResponse);
    return res.status(200).json({
      success: true,
      data,
      total: result.rowCount
    });
  } catch (error) {
    console.error("[Users Listing Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat daftar pengguna."
    });
  }
});
usersRouter.post("/", async (req, res) => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format input pengguna tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const { fullName, employeeNumber, email, role, password, department, isActive } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        error: "DUPLICATE_EMAIL",
        message: `Email "${email}" sudah digunakan oleh akun lain.`
      });
    }
    if (employeeNumber && employeeNumber !== "-") {
      const empCheck = await pool.query(
        "SELECT id FROM users WHERE employee_number = $1 LIMIT 1",
        [employeeNumber]
      );
      if (empCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_EMPLOYEE_NUMBER",
          message: `NIP/Nomor pegawai "${employeeNumber}" sudah digunakan oleh akun lain.`
        });
      }
    }
    const passwordHash = await bcrypt2.hash(password, 10);
    const newId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const insertQuery = `
      INSERT INTO users (
        id, email, password_hash, full_name, employee_number, role, department, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      email,
      passwordHash,
      fullName,
      employeeNumber || "-",
      role,
      department || "Guru / Pegawai",
      isActive ?? true
    ]);
    const createdUser = formatUserResponse(result.rows[0]);
    return res.status(201).json({
      success: true,
      message: "Akun pengguna berhasil ditambahkan.",
      data: createdUser
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        error: "DUPLICATE_RESOURCE",
        message: "Email atau NIP sudah terdaftar dalam sistem."
      });
    }
    console.error("[User Creation Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan sistem saat menyimpan pengguna baru."
    });
  }
});
usersRouter.patch("/:id", async (req, res) => {
  const targetId = req.params.id;
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format input pembaruan pengguna tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query(
      "SELECT id, email, full_name, employee_number, role, department, is_active FROM users WHERE id = $1",
      [targetId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan."
      });
    }
    const currentTarget = existing.rows[0];
    const data = parseResult.data;
    if (currentTarget.role === "ADMIN_SARPRAS" && data.role && data.role !== "ADMIN_SARPRAS") {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN_SARPRAS' AND is_active = true AND id != $1",
        [targetId]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0].total, 10);
      if (remainingAdmins === 0) {
        return res.status(400).json({
          error: "LAST_ADMIN_PROTECTED",
          message: "Tidak dapat mengubah peran admin aktif terakhir sistem demi menjaga kelangsungan operasional."
        });
      }
    }
    if (data.email && data.email.toLowerCase() !== currentTarget.email.toLowerCase()) {
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1",
        [data.email, targetId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_EMAIL",
          message: `Email "${data.email}" sudah digunakan oleh akun lain.`
        });
      }
    }
    if (data.employeeNumber && data.employeeNumber !== "-" && data.employeeNumber !== currentTarget.employee_number) {
      const empCheck = await pool.query(
        "SELECT id FROM users WHERE employee_number = $1 AND id != $2 LIMIT 1",
        [data.employeeNumber, targetId]
      );
      if (empCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_EMPLOYEE_NUMBER",
          message: `NIP/Nomor pegawai "${data.employeeNumber}" sudah digunakan oleh akun lain.`
        });
      }
    }
    const updates = [];
    const params = [];
    if (data.fullName !== void 0) {
      params.push(data.fullName);
      updates.push(`full_name = $${params.length}`);
    }
    if (data.employeeNumber !== void 0) {
      params.push(data.employeeNumber);
      updates.push(`employee_number = $${params.length}`);
    }
    if (data.email !== void 0) {
      params.push(data.email);
      updates.push(`email = $${params.length}`);
    }
    if (data.role !== void 0) {
      params.push(data.role);
      updates.push(`role = $${params.length}`);
    }
    if (data.department !== void 0) {
      params.push(data.department);
      updates.push(`department = $${params.length}`);
    }
    if (data.isActive !== void 0) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }
    if (data.password && data.password.trim().length >= 6) {
      const newHash = await bcrypt2.hash(data.password, 10);
      params.push(newHash);
      updates.push(`password_hash = $${params.length}`);
    }
    updates.push("updated_at = NOW()");
    params.push(targetId);
    const updateQuery = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
    `;
    const result = await pool.query(updateQuery, params);
    const updatedUser = formatUserResponse(result.rows[0]);
    return res.status(200).json({
      success: true,
      message: "Data pengguna berhasil diperbarui.",
      data: updatedUser
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        error: "DUPLICATE_RESOURCE",
        message: "Email atau NIP sudah terdaftar dalam sistem."
      });
    }
    console.error("[User Update Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memperbarui data pengguna."
    });
  }
});
usersRouter.patch("/:id/status", async (req, res) => {
  const targetId = req.params.id;
  const parseResult = updateUserStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Status aktif (isActive) harus berupa boolean.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const { isActive } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query(
      "SELECT id, role, is_active FROM users WHERE id = $1",
      [targetId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan."
      });
    }
    const currentTarget = existing.rows[0];
    if (!isActive) {
      if (req.user?.id === targetId) {
        return res.status(400).json({
          error: "CANNOT_DEACTIVATE_SELF",
          message: "Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk."
        });
      }
      if (currentTarget.role === "ADMIN_SARPRAS") {
        const adminCountRes = await pool.query(
          "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN_SARPRAS' AND is_active = true AND id != $1",
          [targetId]
        );
        const remainingAdmins = parseInt(adminCountRes.rows[0].total, 10);
        if (remainingAdmins === 0) {
          return res.status(400).json({
            error: "LAST_ADMIN_PROTECTED",
            message: "Akun admin aktif terakhir tidak dapat dinonaktifkan demi keamanan sistem."
          });
        }
      }
    }
    const updateQuery = `
      UPDATE users
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
    `;
    const result = await pool.query(updateQuery, [isActive, targetId]);
    const updatedUser = formatUserResponse(result.rows[0]);
    return res.status(200).json({
      success: true,
      message: isActive ? "Akun pengguna berhasil diaktifkan kembali." : "Akun pengguna berhasil dinonaktifkan.",
      data: updatedUser
    });
  } catch (error) {
    console.error("[User Status Update Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memperbarui status akun pengguna."
    });
  }
});
usersRouter.delete("/:id", async (req, res) => {
  const targetId = req.params.id;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query(
      "SELECT id, role, full_name, email FROM users WHERE id = $1",
      [targetId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan."
      });
    }
    const currentTarget = existing.rows[0];
    if (req.user?.id === targetId) {
      return res.status(400).json({
        error: "CANNOT_DELETE_SELF",
        message: "Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk."
      });
    }
    if (currentTarget.role === "ADMIN_SARPRAS") {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN_SARPRAS' AND id != $1",
        [targetId]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0].total, 10);
      if (remainingAdmins === 0) {
        return res.status(400).json({
          error: "LAST_ADMIN_PROTECTED",
          message: "Akun admin aktif terakhir tidak dapat dihapus demi keamanan sistem."
        });
      }
    }
    const activeLoansRes = await pool.query(
      `SELECT COUNT(*) AS total FROM loans 
       WHERE borrower_id = $1 AND status IN ('PENDING_APPROVAL', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED')`,
      [targetId]
    );
    const activeLoansCount = parseInt(activeLoansRes.rows[0].total, 10);
    if (activeLoansCount > 0) {
      return res.status(400).json({
        error: "ACTIVE_LOANS_EXIST",
        message: "Pengguna tidak dapat dihapus karena masih memiliki peminjaman barang aktif atau pengembalian yang sedang berjalan."
      });
    }
    const inspectionRes = await pool.query(
      `SELECT COUNT(*) AS total FROM return_inspections 
       WHERE received_by = $1 OR inspected_by = $1`,
      [targetId]
    );
    const inspectionCount = parseInt(inspectionRes.rows[0].total, 10);
    if (inspectionCount > 0) {
      return res.status(400).json({
        error: "AUDIT_TRAIL_LOCKED",
        message: "Pengguna tidak dapat dihapus permanen karena tercatat dalam berkas verifikasi pengembalian fisik barang. Gunakan opsi Nonaktifkan Akun untuk menjaga keabsahan audit."
      });
    }
    await pool.query("DELETE FROM users WHERE id = $1", [targetId]);
    try {
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit-${Date.now()}`,
          req.user?.id || "system",
          req.user?.fullName || "Admin Sarpras",
          req.user?.role || "ADMIN_SARPRAS",
          "HAPUS_PENGGUNA",
          "USER",
          targetId,
          currentTarget.full_name,
          `Menghapus akun pengguna: ${currentTarget.full_name} (${currentTarget.email})`
        ]
      );
    } catch (auditErr) {
      console.warn("[Audit Log Write Warning]:", auditErr);
    }
    return res.status(200).json({
      success: true,
      message: `Akun pengguna ${currentTarget.full_name} berhasil dihapus secara permanen.`
    });
  } catch (error) {
    console.error("[User Delete Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menghapus akun pengguna."
    });
  }
});

// server/src/routes/locations.ts
import { Router as Router6 } from "express";
var locationsRouter = Router6();
function formatLocation(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}
locationsRouter.get("/", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const { isActive } = req.query;
    let query = "SELECT id, name, code, description, is_active, created_at FROM locations WHERE 1=1";
    const params = [];
    if (isActive !== void 0 && isActive !== "") {
      params.push(String(isActive) === "true");
      query += ` AND is_active = $${params.length}`;
    }
    query += " ORDER BY name ASC";
    const result = await pool.query(query, params);
    const data = result.rows.map(formatLocation);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[Locations Listing Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat daftar ruangan/lokasi."
    });
  }
});
locationsRouter.post("/", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const parseResult = locationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format input ruangan tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const { name, code, description, isActive } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const nameCheck = await pool.query(
      "SELECT id FROM locations WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: "DUPLICATE_LOCATION_NAME",
        message: `Ruangan dengan nama "${name}" sudah terdaftar.`
      });
    }
    const finalCode = (code || `RNG-${Date.now().toString().slice(-4)}`).toUpperCase();
    const codeCheck = await pool.query(
      "SELECT id FROM locations WHERE UPPER(code) = UPPER($1) LIMIT 1",
      [finalCode]
    );
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({
        error: "DUPLICATE_LOCATION_CODE",
        message: `Kode ruangan "${finalCode}" sudah digunakan oleh ruangan lain.`
      });
    }
    const newId = `loc-${Date.now().toString(36)}`;
    const insertQuery = `
      INSERT INTO locations (id, name, code, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, code, description, is_active, created_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      name,
      finalCode,
      description || null,
      isActive ?? true
    ]);
    return res.status(201).json(formatLocation(result.rows[0]));
  } catch (error) {
    console.error("[Location Creation Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menambahkan ruangan baru."
    });
  }
});
locationsRouter.patch("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  const parseResult = updateLocationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format pembaruan ruangan tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query("SELECT * FROM locations WHERE id = $1", [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "LOCATION_NOT_FOUND",
        message: "Ruangan/lokasi tidak ditemukan."
      });
    }
    const current = existing.rows[0];
    const data = parseResult.data;
    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const nameCheck = await pool.query(
        "SELECT id FROM locations WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
        [data.name, targetId]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_LOCATION_NAME",
          message: `Ruangan dengan nama "${data.name}" sudah terdaftar.`
        });
      }
    }
    if (data.code && data.code.toUpperCase() !== (current.code || "").toUpperCase()) {
      const codeCheck = await pool.query(
        "SELECT id FROM locations WHERE UPPER(code) = UPPER($1) AND id != $2 LIMIT 1",
        [data.code.toUpperCase(), targetId]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_LOCATION_CODE",
          message: `Kode ruangan "${data.code}" sudah digunakan oleh ruangan lain.`
        });
      }
    }
    const updates = [];
    const params = [];
    if (data.name !== void 0) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }
    if (data.code !== void 0) {
      params.push(data.code.toUpperCase());
      updates.push(`code = $${params.length}`);
    }
    if (data.description !== void 0) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }
    if (data.isActive !== void 0) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length === 0) {
      return res.status(200).json(formatLocation(current));
    }
    params.push(targetId);
    const updateQuery = `
      UPDATE locations
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, name, code, description, is_active, created_at
    `;
    const result = await pool.query(updateQuery, params);
    if (data.name !== void 0 && data.name !== current.name) {
      await pool.query("UPDATE assets SET location_name = $1 WHERE location_id = $2", [
        data.name,
        targetId
      ]);
    }
    return res.status(200).json(formatLocation(result.rows[0]));
  } catch (error) {
    console.error("[Location Update Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memperbarui data ruangan."
    });
  }
});
locationsRouter.delete("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query("SELECT * FROM locations WHERE id = $1", [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "LOCATION_NOT_FOUND",
        message: "Ruangan/lokasi tidak ditemukan."
      });
    }
    const assetCountRes = await pool.query(
      "SELECT COUNT(*) AS total FROM assets WHERE location_id = $1",
      [targetId]
    );
    const assetCount = parseInt(assetCountRes.rows[0].total, 10);
    if (assetCount > 0) {
      return res.status(409).json({
        error: "RESOURCE_IN_USE",
        message: `Ruangan "${existing.rows[0].name}" tidak dapat dihapus karena masih digunakan oleh ${assetCount} unit barang/sarana. Pindahkan barang terlebih dahulu atau nonaktifkan ruangan.`
      });
    }
    await pool.query("DELETE FROM locations WHERE id = $1", [targetId]);
    return res.status(200).json({
      success: true,
      message: `Ruangan "${existing.rows[0].name}" berhasil dihapus.`
    });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "RESOURCE_IN_USE",
        message: "Ruangan tidak dapat dihapus karena masih memiliki relasi data aktif."
      });
    }
    console.error("[Location Deletion Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menghapus ruangan/lokasi."
    });
  }
});

// server/src/routes/categories.ts
import { Router as Router7 } from "express";
var categoriesRouter = Router7();
function formatCategory(row) {
  return {
    id: row.id,
    name: row.name,
    defaultLoanMode: row.default_loan_mode,
    description: row.description || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}
categoriesRouter.get("/", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const { isActive } = req.query;
    let query = "SELECT id, name, default_loan_mode, description, is_active, created_at FROM categories WHERE 1=1";
    const params = [];
    if (isActive !== void 0 && isActive !== "") {
      params.push(String(isActive) === "true");
      query += ` AND is_active = $${params.length}`;
    }
    query += " ORDER BY name ASC";
    const result = await pool.query(query, params);
    const data = result.rows.map(formatCategory);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[Categories Listing Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat daftar kategori."
    });
  }
});
categoriesRouter.post("/", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const parseResult = categorySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format input kategori tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const { name, defaultLoanMode, description, isActive } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const nameCheck = await pool.query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: "DUPLICATE_CATEGORY_NAME",
        message: `Kategori dengan nama "${name}" sudah terdaftar.`
      });
    }
    const newId = `cat-${Date.now().toString(36)}`;
    const insertQuery = `
      INSERT INTO categories (id, name, default_loan_mode, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, default_loan_mode, description, is_active, created_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      name,
      defaultLoanMode || "DIRECT",
      description || null,
      isActive ?? true
    ]);
    return res.status(201).json(formatCategory(result.rows[0]));
  } catch (error) {
    console.error("[Category Creation Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menambahkan kategori baru."
    });
  }
});
categoriesRouter.patch("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  const parseResult = updateCategorySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format pembaruan kategori tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query("SELECT * FROM categories WHERE id = $1", [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "CATEGORY_NOT_FOUND",
        message: "Kategori tidak ditemukan."
      });
    }
    const current = existing.rows[0];
    const data = parseResult.data;
    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const nameCheck = await pool.query(
        "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
        [data.name, targetId]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_CATEGORY_NAME",
          message: `Kategori dengan nama "${data.name}" sudah terdaftar.`
        });
      }
    }
    const updates = [];
    const params = [];
    if (data.name !== void 0) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }
    if (data.defaultLoanMode !== void 0) {
      params.push(data.defaultLoanMode);
      updates.push(`default_loan_mode = $${params.length}`);
    }
    if (data.description !== void 0) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }
    if (data.isActive !== void 0) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length === 0) {
      return res.status(200).json(formatCategory(current));
    }
    params.push(targetId);
    const updateQuery = `
      UPDATE categories
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, name, default_loan_mode, description, is_active, created_at
    `;
    const result = await pool.query(updateQuery, params);
    if (data.name !== void 0 && data.name !== current.name) {
      await pool.query("UPDATE assets SET category_name = $1 WHERE category_id = $2", [
        data.name,
        targetId
      ]);
    }
    return res.status(200).json(formatCategory(result.rows[0]));
  } catch (error) {
    console.error("[Category Update Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memperbarui data kategori."
    });
  }
});
categoriesRouter.delete("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query("SELECT * FROM categories WHERE id = $1", [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "CATEGORY_NOT_FOUND",
        message: "Kategori tidak ditemukan."
      });
    }
    const assetCountRes = await pool.query(
      "SELECT COUNT(*) AS total FROM assets WHERE category_id = $1",
      [targetId]
    );
    const assetCount = parseInt(assetCountRes.rows[0].total, 10);
    if (assetCount > 0) {
      return res.status(409).json({
        error: "RESOURCE_IN_USE",
        message: `Kategori "${existing.rows[0].name}" tidak dapat dihapus karena masih digunakan oleh ${assetCount} unit barang/sarana. Pindahkan kategori barang terlebih dahulu atau nonaktifkan kategori.`
      });
    }
    await pool.query("DELETE FROM categories WHERE id = $1", [targetId]);
    return res.status(200).json({
      success: true,
      message: `Kategori "${existing.rows[0].name}" berhasil dihapus.`
    });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "RESOURCE_IN_USE",
        message: "Kategori tidak dapat dihapus karena masih memiliki relasi data aktif."
      });
    }
    console.error("[Category Deletion Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menghapus kategori."
    });
  }
});

// server/src/routes/fundingSources.ts
import { Router as Router8 } from "express";
var fundingSourcesRouter = Router8();
function formatFundingSource(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}
fundingSourcesRouter.get("/", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const { isActive } = req.query;
    let query = "SELECT id, name, description, is_active, created_at FROM funding_sources WHERE 1=1";
    const params = [];
    if (isActive !== void 0 && isActive !== "") {
      params.push(String(isActive) === "true");
      query += ` AND is_active = $${params.length}`;
    }
    query += " ORDER BY name ASC";
    const result = await pool.query(query, params);
    const data = result.rows.map(formatFundingSource);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[Funding Sources Listing Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat daftar sumber pendanaan."
    });
  }
});
fundingSourcesRouter.post("/", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const parseResult = fundingSourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format input sumber pendanaan tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const { name, description, isActive } = parseResult.data;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const nameCheck = await pool.query(
      "SELECT id FROM funding_sources WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: "DUPLICATE_FUNDING_SOURCE",
        message: `Sumber pendanaan "${name}" sudah terdaftar.`
      });
    }
    const newId = `fs-${Date.now().toString(36)}`;
    const insertQuery = `
      INSERT INTO funding_sources (id, name, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, description, is_active, created_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      name,
      description || null,
      isActive ?? true
    ]);
    return res.status(201).json(formatFundingSource(result.rows[0]));
  } catch (error) {
    console.error("[Funding Source Creation Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menambahkan sumber pendanaan baru."
    });
  }
});
fundingSourcesRouter.patch("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  const parseResult = updateFundingSourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format pembaruan sumber dana tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query("SELECT * FROM funding_sources WHERE id = $1", [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "FUNDING_SOURCE_NOT_FOUND",
        message: "Sumber pendanaan tidak ditemukan."
      });
    }
    const current = existing.rows[0];
    const data = parseResult.data;
    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const nameCheck = await pool.query(
        "SELECT id FROM funding_sources WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
        [data.name, targetId]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          error: "DUPLICATE_FUNDING_SOURCE",
          message: `Sumber pendanaan "${data.name}" sudah terdaftar.`
        });
      }
    }
    const updates = [];
    const params = [];
    if (data.name !== void 0) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }
    if (data.description !== void 0) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }
    if (data.isActive !== void 0) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length === 0) {
      return res.status(200).json(formatFundingSource(current));
    }
    params.push(targetId);
    const updateQuery = `
      UPDATE funding_sources
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, name, description, is_active, created_at
    `;
    const result = await pool.query(updateQuery, params);
    if (data.name !== void 0 && data.name !== current.name) {
      await pool.query("UPDATE assets SET funding_source = $1 WHERE funding_source = $2", [
        data.name,
        current.name
      ]);
    }
    return res.status(200).json(formatFundingSource(result.rows[0]));
  } catch (error) {
    console.error("[Funding Source Update Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memperbarui data sumber pendanaan."
    });
  }
});
fundingSourcesRouter.delete("/:id", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const targetId = req.params.id;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const existing = await pool.query("SELECT * FROM funding_sources WHERE id = $1", [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "FUNDING_SOURCE_NOT_FOUND",
        message: "Sumber pendanaan tidak ditemukan."
      });
    }
    const currentName = existing.rows[0].name;
    const assetCountRes = await pool.query(
      "SELECT COUNT(*) AS total FROM assets WHERE funding_source = $1",
      [currentName]
    );
    const assetCount = parseInt(assetCountRes.rows[0].total, 10);
    if (assetCount > 0) {
      return res.status(409).json({
        error: "RESOURCE_IN_USE",
        message: `Sumber pendanaan "${currentName}" tidak dapat dihapus karena masih digunakan oleh ${assetCount} unit barang/sarana. Alihkan sumber dana barang terlebih dahulu atau nonaktifkan sumber pendanaan.`
      });
    }
    await pool.query("DELETE FROM funding_sources WHERE id = $1", [targetId]);
    return res.status(200).json({
      success: true,
      message: `Sumber pendanaan "${currentName}" berhasil dihapus.`
    });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(409).json({
        error: "RESOURCE_IN_USE",
        message: "Sumber pendanaan tidak dapat dihapus karena masih memiliki relasi data aktif."
      });
    }
    console.error("[Funding Source Deletion Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menghapus sumber pendanaan."
    });
  }
});

// server/src/routes/schoolSettings.ts
import { Router as Router9 } from "express";
import fs2 from "fs/promises";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var schoolSettingsRouter = Router9();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var SETTINGS_DIR = path2.resolve(__dirname2, "../../data");
var SETTINGS_FILE = path2.resolve(SETTINGS_DIR, "school_settings.json");
var DEFAULT_SETTINGS = {
  schoolName: "MIS Cendikia Bunayya",
  address: "Jl. Pendidikan No. 123, Medan, Sumatera Utara",
  phone: "081234567890",
  email: "sarpras@cendikiabunayya.sch.id",
  logoUrl: ""
};
async function loadSettings() {
  try {
    const raw = await fs2.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
async function saveSettings(data) {
  await fs2.mkdir(SETTINGS_DIR, { recursive: true });
  await fs2.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
}
schoolSettingsRouter.get("/", async (_req, res) => {
  try {
    const settings = await loadSettings();
    return res.status(200).json(settings);
  } catch (error) {
    console.error("[School Settings Read Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat pengaturan identitas sekolah."
    });
  }
});
async function handleUpdateSettings(req, res) {
  const parseResult = schoolSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Format pengaturan sekolah tidak valid.",
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
  }
  const currentUser = req.user;
  try {
    const current = await loadSettings();
    const updated = {
      ...current,
      ...parseResult.data,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.email || "ADMIN_SARPRAS"
    };
    await saveSettings(updated);
    return res.status(200).json(updated);
  } catch (error) {
    console.error("[School Settings Write Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menyimpan pengaturan sekolah."
    });
  }
}
schoolSettingsRouter.patch("/", requireAuth, requireRole("ADMIN_SARPRAS"), handleUpdateSettings);
schoolSettingsRouter.put("/", requireAuth, requireRole("ADMIN_SARPRAS"), handleUpdateSettings);

// server/src/routes/realtime.ts
import { Router as Router10 } from "express";
import jwt3 from "jsonwebtoken";
var realtimeRouter = Router10();
realtimeRouter.get("/events", (req, res) => {
  let token;
  if (typeof req.query.token === "string" && req.query.token.trim()) {
    token = req.query.token.trim();
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Autentikasi diperlukan untuk terhubung ke kanal real-time SIMSARPRAS."
    });
  }
  try {
    const decoded = jwt3.verify(token, config.jwtSecret);
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userId = decoded.id || decoded.sub;
    const role = decoded.role || "GURU_PEGAWAI";
    sseManager.addClient({
      id: clientId,
      res,
      userId,
      role,
      connectedAt: Date.now()
    });
  } catch (err) {
    return res.status(401).json({
      error: "INVALID_TOKEN",
      message: "Token autentikasi tidak valid atau telah kedaluwarsa."
    });
  }
});
realtimeRouter.get("/status", (_req, res) => {
  res.status(200).json({
    status: "ACTIVE",
    activeClients: sseManager.getClientCount(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});

// server/src/routes/returns.ts
import { Router as Router11 } from "express";
var returnsRouter = Router11();
returnsRouter.post("/", requireAuth, async (req, res) => {
  const loanId = req.body?.loanId || req.body?.loan_id;
  const notes = req.body?.notes;
  if (!loanId) {
    return res.status(400).json({
      error: "MISSING_LOAN_ID",
      message: "ID transaksi peminjaman wajib disertakan."
    });
  }
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data transaksi peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    const userRole = req.user?.role;
    const userId = req.user?.id;
    if (userRole !== "ADMIN_SARPRAS" && currentLoan.borrower_id && currentLoan.borrower_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Anda hanya dapat mengajukan pengembalian untuk barang yang Anda pinjam sendiri."
      });
    }
    if (currentLoan.status === "RETURN_REQUESTED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "ALREADY_RETURN_REQUESTED",
        message: "Pengembalian barang sudah diajukan sebelumnya dan sedang menunggu verifikasi admin."
      });
    }
    if (currentLoan.status === "COMPLETED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "ALREADY_COMPLETED",
        message: "Transaksi peminjaman ini telah selesai."
      });
    }
    if (currentLoan.status !== "ACTIVE" && currentLoan.status !== "APPROVED" && currentLoan.status !== "READY_FOR_HANDOVER") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_LOAN_STATUS",
        message: `Pengembalian tidak dapat diajukan untuk pinjaman dengan status ${currentLoan.status}.`
      });
    }
    const updateRes = await client.query(
      `UPDATE loans 
       SET status = 'RETURN_REQUESTED', return_notes = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [notes || null, loanId]
    );
    await client.query(
      `UPDATE assets 
       SET operational_status = 'RETURN_PENDING', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );
    const auditId = `aud-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const userName = req.user?.fullName || currentLoan.borrower_name || "Guru / Pegawai";
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, 'PENGAJUAN_PENGEMBALIAN', 'RETURN', $5, $6, $7, $8, NOW())`,
      [
        auditId,
        userId || currentLoan.borrower_id,
        userName,
        userRole || "GURU_PEGAWAI",
        currentLoan.id,
        currentLoan.loan_number,
        `Pengajuan pengembalian unit pinjaman ${currentLoan.loan_number} oleh ${userName}.`,
        req.ip || null
      ]
    );
    await client.query("COMMIT");
    const updatedLoan = formatLoanResponse(updateRes.rows[0]);
    sseManager.broadcast("loan.returned", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: "RETURN_REQUESTED"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId: currentLoan.asset_id,
      status: "RETURN_PENDING"
    });
    return res.status(200).json(updatedLoan);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Return Request Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memproses pengajuan pengembalian barang."
    });
  } finally {
    client.release();
  }
});
returnsRouter.post("/:id/verify", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const loanId = req.params.id;
  const { notes, conditionAtReturn = "GOOD", accessoriesComplete = true } = req.body;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data transaksi peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    if (currentLoan.status === "COMPLETED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "ALREADY_COMPLETED",
        message: "Transaksi pengembalian ini sudah selesai diverifikasi sebelumnya."
      });
    }
    if (currentLoan.status !== "RETURN_REQUESTED" && currentLoan.status !== "RETURN_RECEIVED" && currentLoan.status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_LOAN_STATUS",
        message: `Pengembalian tidak dapat diverifikasi untuk status ${currentLoan.status}.`
      });
    }
    const assetId = currentLoan.asset_id;
    const assetRes = await client.query(
      `SELECT id, asset_code, is_decommissioned, condition_status FROM assets WHERE id = $1 FOR UPDATE`,
      [assetId]
    );
    if (assetRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "ASSET_NOT_FOUND",
        message: "Data barang inventaris tidak ditemukan."
      });
    }
    const currentAsset = assetRes.rows[0];
    let resultingStatus = "AVAILABLE";
    if (currentAsset.is_decommissioned) {
      resultingStatus = "INACTIVE";
    } else if (conditionAtReturn && conditionAtReturn !== "GOOD") {
      resultingStatus = "MAINTENANCE";
    }
    const resultingCondition = conditionAtReturn || currentAsset.condition_status || "GOOD";
    await client.query(
      `UPDATE assets 
       SET operational_status = $1, condition_status = $2, updated_at = NOW() 
       WHERE id = $3`,
      [resultingStatus, resultingCondition, assetId]
    );
    const adminUser = req.user || {};
    const adminId = adminUser.id || "usr-admin-1";
    const adminName = adminUser.fullName || "Admin Sarpras";
    const loanUpdateRes = await client.query(
      `UPDATE loans 
       SET status = 'COMPLETED', approved_by = $1, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [adminId, loanId]
    );
    const inspectionId = `insp-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const inspectionNotes = notes || "Verifikasi penerimaan pengembalian langsung disetujui oleh Admin Sarpras.";
    await client.query(
      `INSERT INTO return_inspections (
        id, loan_id, received_by, received_by_name, inspected_by, inspected_by_name,
        approved_by, approved_by_name, approved_at, condition_at_return, accessories_complete,
        notes, resulting_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12)
      ON CONFLICT (loan_id) DO UPDATE SET
        approved_by = EXCLUDED.approved_by,
        approved_by_name = EXCLUDED.approved_by_name,
        approved_at = EXCLUDED.approved_at,
        condition_at_return = EXCLUDED.condition_at_return,
        accessories_complete = EXCLUDED.accessories_complete,
        resulting_status = EXCLUDED.resulting_status,
        notes = EXCLUDED.notes`,
      [
        inspectionId,
        loanId,
        adminId,
        adminName,
        adminId,
        adminName,
        adminId,
        adminName,
        resultingCondition,
        Boolean(accessoriesComplete),
        inspectionNotes,
        resultingStatus
      ]
    );
    const auditId = `aud-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    await client.query(
      `INSERT INTO audit_logs (
        id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, 'VERIFIKASI_PENGEMBALIAN', 'RETURN', $5, $6, $7, $8, NOW())`,
      [
        auditId,
        adminId,
        adminName,
        adminUser.role || "ADMIN_SARPRAS",
        currentLoan.id,
        currentLoan.loan_number,
        `Verifikasi penerimaan pengembalian unit ${currentAsset.asset_code} (${currentLoan.loan_number}) disetujui oleh ${adminName}. Status peminjaman COMPLETED, status unit ${resultingStatus}.`,
        req.ip || null
      ]
    );
    await client.query("COMMIT");
    const formatted = formatLoanResponse(loanUpdateRes.rows[0]);
    sseManager.broadcast("loan.returned", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId,
      status: "COMPLETED"
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId,
      status: resultingStatus,
      conditionStatus: resultingCondition
    });
    return res.status(200).json({
      ...formatted,
      message: "Verifikasi penerimaan barang berhasil. Pengembalian selesai.",
      resultingStatus
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Return Verification Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memverifikasi pengembalian barang."
    });
  } finally {
    client.release();
  }
});
returnsRouter.post("/:id/receive", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const loanId = req.params.id;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data transaksi peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    if (currentLoan.status !== "RETURN_REQUESTED" && currentLoan.status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_LOAN_STATUS",
        message: `Penerimaan fisik tidak dapat diproses untuk status ${currentLoan.status}.`
      });
    }
    const updateRes = await client.query(
      `UPDATE loans 
       SET status = 'RETURN_RECEIVED', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [loanId]
    );
    await client.query(
      `UPDATE assets 
       SET operational_status = 'RETURN_INSPECTION', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );
    await client.query("COMMIT");
    const updatedLoan = formatLoanResponse(updateRes.rows[0]);
    sseManager.broadcast("loan.returned", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: "RETURN_RECEIVED"
    });
    return res.status(200).json(updatedLoan);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Return Receive Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal mencatat penerimaan fisik barang."
    });
  } finally {
    client.release();
  }
});
returnsRouter.post("/:id/approve", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  const loanId = req.params.id;
  const {
    conditionAtReturn = "GOOD",
    accessoriesComplete = true,
    issueDescription,
    notes,
    photoPath,
    photoUrl
  } = req.body;
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "LOAN_NOT_FOUND",
        message: "Data transaksi peminjaman tidak ditemukan."
      });
    }
    const currentLoan = loanRes.rows[0];
    const assetId = currentLoan.asset_id;
    const assetRes = await client.query(`SELECT is_decommissioned FROM assets WHERE id = $1 FOR UPDATE`, [assetId]);
    const isDecommissioned = assetRes.rows[0]?.is_decommissioned;
    let resultingStatus = conditionAtReturn === "GOOD" ? "AVAILABLE" : "MAINTENANCE";
    if (isDecommissioned) resultingStatus = "INACTIVE";
    await client.query(
      `UPDATE assets 
       SET operational_status = $1, condition_status = $2, updated_at = NOW() 
       WHERE id = $3`,
      [resultingStatus, conditionAtReturn, assetId]
    );
    const loanUpdateRes = await client.query(
      `UPDATE loans 
       SET status = 'COMPLETED', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [loanId]
    );
    const inspectionId = `insp-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const adminUser = req.user || {};
    const adminId = adminUser.id || "usr-admin-1";
    const adminName = adminUser.fullName || "Admin Sarpras";
    await client.query(
      `INSERT INTO return_inspections (
        id, loan_id, received_by, received_by_name, inspected_by, inspected_by_name,
        approved_by, approved_by_name, approved_at, condition_at_return, accessories_complete,
        issue_description, notes, photo_url, resulting_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13, $14)
      ON CONFLICT (loan_id) DO UPDATE SET
        condition_at_return = EXCLUDED.condition_at_return,
        accessories_complete = EXCLUDED.accessories_complete,
        resulting_status = EXCLUDED.resulting_status,
        notes = EXCLUDED.notes`,
      [
        inspectionId,
        loanId,
        adminId,
        adminName,
        adminId,
        adminName,
        adminId,
        adminName,
        conditionAtReturn,
        Boolean(accessoriesComplete),
        issueDescription || null,
        notes || null,
        photoUrl || photoPath || null,
        resultingStatus
      ]
    );
    const auditId = `aud-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, 'VERIFIKASI_PENGEMBALIAN', 'RETURN', $5, $6, $7, $8, NOW())`,
      [
        auditId,
        adminId,
        adminName,
        adminUser.role || "ADMIN_SARPRAS",
        currentLoan.id,
        currentLoan.loan_number,
        `Pemeriksaan fisik pengembalian disetujui oleh ${adminName}. Status COMPLETED, unit ${resultingStatus}.`,
        req.ip || null
      ]
    );
    await client.query("COMMIT");
    const formatted = formatLoanResponse(loanUpdateRes.rows[0]);
    sseManager.broadcast("loan.returned", {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId,
      status: "COMPLETED",
      conditionAtReturn
    });
    sseManager.broadcast("asset.availability_changed", {
      assetId,
      status: resultingStatus,
      conditionStatus: conditionAtReturn
    });
    return res.status(200).json({
      ...formatted,
      message: "Pemeriksaan pengembalian fisik berhasil disetujui.",
      resultingStatus
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Return Approval Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal menyelesaikan inspeksi pengembalian barang."
    });
  } finally {
    client.release();
  }
});

// server/src/routes/dashboard.ts
import { Router as Router12 } from "express";
var dashboardRouter = Router12();
dashboardRouter.get("/", requireAuth, async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const [assetsRes, loansRes, categoriesRes, locationsRes, fundingSourcesRes] = await Promise.all([
      pool.query(`
        SELECT id, operational_status, condition_status, category_name, location_id, funding_source 
        FROM assets
      `),
      pool.query(`
        SELECT id, status, expected_return_at 
        FROM loans
      `),
      pool.query(`
        SELECT id, name 
        FROM categories 
        ORDER BY name ASC
      `),
      pool.query(`
        SELECT id, name 
        FROM locations 
        ORDER BY name ASC
      `),
      pool.query(`
        SELECT id, name 
        FROM funding_sources 
        ORDER BY name ASC
      `)
    ]);
    const assets = assetsRes.rows;
    const loans = loansRes.rows;
    const categories = categoriesRes.rows;
    const locations = locationsRes.rows;
    const fundingSources = fundingSourcesRes.rows;
    const totalAssets = assets.length;
    const availableAssets = assets.filter((a) => a.operational_status === "AVAILABLE").length;
    const onLoanAssets = assets.filter((a) => a.operational_status === "ON_LOAN").length;
    const maintenanceAssets = assets.filter((a) => a.operational_status === "MAINTENANCE").length;
    const pendingApprovalsCount = loans.filter((l) => l.status === "PENDING_APPROVAL").length;
    const pendingReturnsCount = loans.filter(
      (l) => l.status === "RETURN_REQUESTED" || l.status === "RETURN_RECEIVED"
    ).length;
    const now = Date.now();
    const overdueLoansCount = loans.filter((l) => {
      if (l.status !== "ACTIVE") return false;
      return new Date(l.expected_return_at).getTime() < now;
    }).length;
    const byCategory = categories.map((c) => {
      const catAssets = assets.filter((a) => a.category_name === c.name);
      return {
        name: c.name,
        count: catAssets.length,
        available: catAssets.filter((a) => a.operational_status === "AVAILABLE").length
      };
    });
    const conditions = [
      { status: "GOOD", label: "Baik" },
      { status: "MINOR_DAMAGE", label: "Rusak Ringan" },
      { status: "MAJOR_DAMAGE", label: "Rusak Berat" },
      { status: "LOST", label: "Hilang" }
    ];
    const byCondition = conditions.map((cond) => ({
      status: cond.status,
      label: cond.label,
      count: assets.filter((a) => a.condition_status === cond.status).length
    }));
    const byLocation = locations.map((loc) => ({
      name: loc.name,
      count: assets.filter((a) => a.location_id === loc.id).length
    }));
    const byFundingSource = fundingSources.map((fs4) => ({
      name: fs4.name,
      count: assets.filter((a) => a.funding_source === fs4.name).length
    }));
    return res.status(200).json({
      totalAssets,
      availableAssets,
      onLoanAssets,
      maintenanceAssets,
      pendingApprovalsCount,
      pendingReturnsCount,
      overdueLoansCount,
      byCategory,
      byCondition,
      byLocation,
      byFundingSource
    });
  } catch (error) {
    console.error("[Dashboard Metrics Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat metrik dashboard."
    });
  }
});

// server/src/routes/auditLogs.ts
import { Router as Router13 } from "express";
var auditLogsRouter = Router13();
auditLogsRouter.get("/", requireAuth, async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const result = await pool.query(`
      SELECT id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 200
    `);
    const data = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name || void 0,
      details: row.details,
      timestamp: row.created_at
    }));
    return res.status(200).json(data);
  } catch (error) {
    console.error("[Audit Logs Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat log audit."
    });
  }
});

// server/src/routes/backup.ts
import { Router as Router14 } from "express";
import fs3 from "fs/promises";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var backupRouter = Router14();
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path3.dirname(__filename3);
var SETTINGS_DIR2 = path3.resolve(__dirname3, "../../data");
var SETTINGS_FILE2 = path3.resolve(SETTINGS_DIR2, "school_settings.json");
backupRouter.get("/summary", requireAuth, requireRole("ADMIN_SARPRAS"), async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    const [
      usersCount,
      assetsCount,
      categoriesCount,
      locationsCount,
      fundingSourcesCount,
      loansCount,
      auditLogsCount
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM assets WHERE is_decommissioned = false"),
      pool.query("SELECT COUNT(*) FROM categories"),
      pool.query("SELECT COUNT(*) FROM locations"),
      pool.query("SELECT COUNT(*) FROM funding_sources"),
      pool.query("SELECT COUNT(*) FROM loans"),
      pool.query("SELECT COUNT(*) FROM audit_logs")
    ]);
    return res.status(200).json({
      counts: {
        users: parseInt(usersCount.rows[0].count, 10),
        assets: parseInt(assetsCount.rows[0].count, 10),
        categories: parseInt(categoriesCount.rows[0].count, 10),
        locations: parseInt(locationsCount.rows[0].count, 10),
        fundingSources: parseInt(fundingSourcesCount.rows[0].count, 10),
        loans: parseInt(loansCount.rows[0].count, 10),
        auditLogs: parseInt(auditLogsCount.rows[0].count, 10)
      },
      databaseTime: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("[Backup Summary Error]:", error?.message || error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Gagal memuat ringkasan basis data."
    });
  }
});
backupRouter.get("/export", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  try {
    let schoolSettings = {
      schoolName: "MIS Cendikia Bunayya",
      address: "Jl. Pendidikan No. 123, Medan, Sumatera Utara",
      phone: "081234567890",
      email: "sarpras@cendikiabunayya.sch.id",
      logoUrl: ""
    };
    try {
      const raw = await fs3.readFile(SETTINGS_FILE2, "utf-8");
      schoolSettings = { ...schoolSettings, ...JSON.parse(raw) };
    } catch {
    }
    const [
      usersRes,
      categoriesRes,
      locationsRes,
      fundingSourcesRes,
      assetsRes,
      loansRes,
      returnInspectionsRes,
      auditLogsRes
    ] = await Promise.all([
      pool.query("SELECT * FROM users ORDER BY created_at ASC"),
      pool.query("SELECT * FROM categories ORDER BY created_at ASC"),
      pool.query("SELECT * FROM locations ORDER BY created_at ASC"),
      pool.query("SELECT * FROM funding_sources ORDER BY created_at ASC"),
      pool.query("SELECT * FROM assets ORDER BY created_at ASC"),
      pool.query("SELECT * FROM loans ORDER BY created_at ASC"),
      pool.query("SELECT * FROM return_inspections ORDER BY created_at ASC"),
      pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500")
    ]);
    const backupPayload = {
      system: "SIMSARPRAS_SMART_CAMPUS",
      signature: "SIMSARPRAS_BACKUP_V2",
      version: "2.1.0",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exportedBy: {
        id: req.user?.id || "admin",
        name: req.user?.fullName || "Admin Sarpras",
        email: req.user?.email || "admin@simsarpras.sch.id"
      },
      counts: {
        users: usersRes.rows.length,
        categories: categoriesRes.rows.length,
        locations: locationsRes.rows.length,
        fundingSources: fundingSourcesRes.rows.length,
        assets: assetsRes.rows.length,
        loans: loansRes.rows.length,
        returnInspections: returnInspectionsRes.rows.length,
        auditLogs: auditLogsRes.rows.length
      },
      data: {
        schoolSettings,
        users: usersRes.rows,
        categories: categoriesRes.rows,
        locations: locationsRes.rows,
        fundingSources: fundingSourcesRes.rows,
        assets: assetsRes.rows,
        loans: loansRes.rows,
        returnInspections: returnInspectionsRes.rows,
        auditLogs: auditLogsRes.rows
      }
    };
    try {
      const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
         VALUES ($1, $2, $3, $4, 'BACKUP_EXPORTED', 'SYSTEM', 'backup-file', 'Unduh Cadangan Basis Data', $5, NOW())`,
        [
          auditId,
          req.user?.id || "system",
          req.user?.fullName || "Admin Sarpras",
          req.user?.role || "ADMIN_SARPRAS",
          `Mengekspor cadangan basis data lengkap: ${assetsRes.rows.length} aset, ${usersRes.rows.length} pengguna, ${loansRes.rows.length} peminjaman.`
        ]
      );
    } catch (auditErr) {
      console.warn("[Backup Audit Log Warning]:", auditErr);
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="backup-simsarpras-${timestamp}.json"`);
    return res.status(200).json(backupPayload);
  } catch (error) {
    console.error("[Backup Export Error]:", error?.message || error);
    return res.status(500).json({
      error: "BACKUP_FAILED",
      message: `Gagal membuat cadangan basis data: ${error?.message || error}`
    });
  }
});
backupRouter.post("/restore", requireAuth, requireRole("ADMIN_SARPRAS"), async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "DATABASE_UNAVAILABLE",
      message: "Database belum terhubung."
    });
  }
  const { backupData, mode = "clean" } = req.body;
  if (!backupData || typeof backupData !== "object") {
    return res.status(400).json({
      error: "INVALID_BACKUP_PAYLOAD",
      message: "Format berkas cadangan tidak valid. Objek data cadangan diperlukan."
    });
  }
  if (backupData.signature !== "SIMSARPRAS_BACKUP_V2" && backupData.system !== "SIMSARPRAS_SMART_CAMPUS" && !backupData.data?.assets) {
    return res.status(400).json({
      error: "INVALID_SIGNATURE",
      message: "Berkas tidak dikenali sebagai berkas cadangan resmi SIMSARPRAS."
    });
  }
  const data = backupData.data || {};
  const usersList = Array.isArray(data.users) ? data.users : [];
  const categoriesList = Array.isArray(data.categories) ? data.categories : [];
  const locationsList = Array.isArray(data.locations) ? data.locations : [];
  const fundingSourcesList = Array.isArray(data.fundingSources) ? data.fundingSources : [];
  const assetsList = Array.isArray(data.assets) ? data.assets : [];
  const loansList = Array.isArray(data.loans) ? data.loans : [];
  const returnInspectionsList = Array.isArray(data.returnInspections) ? data.returnInspections : [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (mode === "clean") {
      await client.query("DELETE FROM return_inspections");
      await client.query("DELETE FROM loans");
      await client.query("DELETE FROM assets");
      await client.query("DELETE FROM categories");
      await client.query("DELETE FROM locations");
      await client.query("DELETE FROM funding_sources");
      const currentUserId = req.user?.id;
      if (currentUserId) {
        await client.query("DELETE FROM users WHERE id != $1", [currentUserId]);
      } else {
        await client.query("DELETE FROM users");
      }
    }
    for (const cat of categoriesList) {
      if (!cat.id || !cat.name) continue;
      await client.query(
        `INSERT INTO categories (id, name, default_loan_mode, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           default_loan_mode = EXCLUDED.default_loan_mode,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active`,
        [
          cat.id,
          cat.name,
          cat.default_loan_mode || cat.defaultLoanMode || "ADMIN_APPROVAL",
          cat.description || "",
          cat.is_active ?? cat.isActive ?? true,
          cat.created_at || cat.createdAt || null
        ]
      );
    }
    for (const loc of locationsList) {
      if (!loc.id || !loc.name) continue;
      await client.query(
        `INSERT INTO locations (id, name, code, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           code = EXCLUDED.code,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active`,
        [
          loc.id,
          loc.name,
          loc.code || loc.name.slice(0, 4).toUpperCase(),
          loc.description || "",
          loc.is_active ?? loc.isActive ?? true,
          loc.created_at || loc.createdAt || null
        ]
      );
    }
    for (const fsItem of fundingSourcesList) {
      if (!fsItem.id || !fsItem.name) continue;
      await client.query(
        `INSERT INTO funding_sources (id, name, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active`,
        [
          fsItem.id,
          fsItem.name,
          fsItem.description || "",
          fsItem.is_active ?? fsItem.isActive ?? true,
          fsItem.created_at || fsItem.createdAt || null
        ]
      );
    }
    for (const u of usersList) {
      if (!u.id || !u.email) continue;
      await client.query(
        `INSERT INTO users (id, full_name, employee_number, email, role, is_active, department, avatar_url, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), COALESCE($11, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           employee_number = EXCLUDED.employee_number,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           department = EXCLUDED.department,
           avatar_url = EXCLUDED.avatar_url,
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
           updated_at = NOW()`,
        [
          u.id,
          u.full_name || u.fullName || "Pengguna",
          u.employee_number || u.employeeNumber || "-",
          u.email,
          u.role || "GURU_PEGAWAI",
          u.is_active ?? u.isActive ?? true,
          u.department || "Umum",
          u.avatar_url || u.avatarUrl || null,
          u.password_hash || u.passwordHash || null,
          u.created_at || u.createdAt || null,
          u.updated_at || u.updatedAt || null
        ]
      );
    }
    for (const a of assetsList) {
      if (!a.id || !a.item_name && !a.itemName) continue;
      const itemName = a.item_name || a.itemName;
      const assetCode = a.asset_code || a.assetCode || `INV-${Math.floor(1e5 + Math.random() * 9e5)}`;
      const permanentId = a.permanent_id || a.permanentId || a.id;
      const qrToken = a.qr_token || a.qrToken || `QR-${assetCode}`;
      const itemNumber = a.item_number ?? a.itemNumber ?? null;
      const institution = a.institution || "MIS Cendikia Bunayya";
      const categoryId = a.category_id || a.categoryId || null;
      const categoryName = a.category_name || a.categoryName || "Umum";
      const locationId = a.location_id || a.locationId || locationsList[0]?.id || "loc-mv8z9zes";
      const locationName = a.location_name || a.locationName || "Kantor MIS";
      const itemBrand = a.item_brand || a.itemBrand || "Standar";
      const fundingSource = a.funding_source || a.fundingSource || "BOS Reguler";
      const acquisitionYear = a.acquisition_year || a.acquisitionYear || 2026;
      const technicalSpecs = a.technical_specs || a.technicalSpecs || "-";
      const effectiveLoanMode = a.effective_loan_mode || a.effectiveLoanMode || "DIRECT";
      const conditionStatus = a.condition_status || a.conditionStatus || "GOOD";
      const operationalStatus = a.operational_status || a.operationalStatus || "AVAILABLE";
      const photoUrl = a.photo_url || a.photoUrl || a.photo_path || a.photoPath || null;
      const notes = a.notes || null;
      const standardAccessories = JSON.stringify(a.standard_accessories || a.standardAccessories || []);
      const isDecommissioned = a.is_decommissioned ?? a.isDecommissioned ?? false;
      const decommissionedAt = a.decommissioned_at || a.decommissionedAt || null;
      const decommissionedReason = a.decommissioned_reason || a.decommissionedReason || null;
      const createdAt = a.created_at || a.createdAt || null;
      const updatedAt = a.updated_at || a.updatedAt || null;
      await client.query(
        `INSERT INTO assets (
           id, permanent_id, qr_token, asset_code, item_number, item_name, institution,
           category_id, category_name, location_id, location_name, item_brand,
           funding_source, acquisition_year, technical_specs, effective_loan_mode,
           condition_status, operational_status, photo_url, notes, standard_accessories,
           is_decommissioned, decommissioned_at, decommissioned_reason, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15, $16,
           $17, $18, $19, $20, $21::jsonb,
           $22, $23, $24, COALESCE($25, NOW()), COALESCE($26, NOW())
         ) ON CONFLICT (id) DO UPDATE SET
           permanent_id = EXCLUDED.permanent_id,
           qr_token = EXCLUDED.qr_token,
           asset_code = EXCLUDED.asset_code,
           item_number = EXCLUDED.item_number,
           item_name = EXCLUDED.item_name,
           institution = EXCLUDED.institution,
           category_id = EXCLUDED.category_id,
           category_name = EXCLUDED.category_name,
           location_id = EXCLUDED.location_id,
           location_name = EXCLUDED.location_name,
           item_brand = EXCLUDED.item_brand,
           funding_source = EXCLUDED.funding_source,
           acquisition_year = EXCLUDED.acquisition_year,
           technical_specs = EXCLUDED.technical_specs,
           effective_loan_mode = EXCLUDED.effective_loan_mode,
           condition_status = EXCLUDED.condition_status,
           operational_status = EXCLUDED.operational_status,
           photo_url = EXCLUDED.photo_url,
           notes = EXCLUDED.notes,
           standard_accessories = EXCLUDED.standard_accessories,
           is_decommissioned = EXCLUDED.is_decommissioned,
           decommissioned_at = EXCLUDED.decommissioned_at,
           decommissioned_reason = EXCLUDED.decommissioned_reason,
           updated_at = NOW()`,
        [
          a.id,
          permanentId,
          qrToken,
          assetCode,
          itemNumber,
          itemName,
          institution,
          categoryId,
          categoryName,
          locationId,
          locationName,
          itemBrand,
          fundingSource,
          acquisitionYear,
          technicalSpecs,
          effectiveLoanMode,
          conditionStatus,
          operationalStatus,
          photoUrl,
          notes,
          standardAccessories,
          isDecommissioned,
          decommissionedAt,
          decommissionedReason,
          createdAt,
          updatedAt
        ]
      );
    }
    for (const l of loansList) {
      const assetId = l.asset_id || l.assetId || l.unit_id || l.unitId;
      if (!l.id || !assetId) continue;
      const loanNumber = l.loan_number || l.loanNumber || `PINJAM-${Date.now()}`;
      const borrowerId = l.borrower_id || l.borrowerId || null;
      const borrowerName = l.borrower_name || l.borrowerName || "Peminjam";
      const borrowerEmployeeNumber = l.borrower_employee_number || l.borrowerEmployeeNumber || l.borrower_identifier || l.borrowerIdentifier || "-";
      const borrowerRole = l.borrower_role || l.borrowerRole || "GURU_PEGAWAI";
      const loanModeSnapshot = l.loan_mode_snapshot || l.loanModeSnapshot || l.loan_mode || l.loanMode || "DIRECT";
      const purpose = l.purpose || "Keperluan mengajar";
      const status = l.status || "ACTIVE";
      const requestedAt = l.requested_at || l.requestedAt || null;
      const approvedAt = l.approved_at || l.approvedAt || null;
      const approvedBy = l.approved_by || l.approvedBy || null;
      const approvedByName = l.approved_by_name || l.approvedByName || null;
      const handoverData = JSON.stringify(l.handover_data || l.handoverData || {});
      const expectedReturnAt = l.expected_return_at || l.expectedReturnAt || null;
      const returnNotes = l.return_notes || l.returnNotes || l.return_inspection_notes || l.returnInspectionNotes || null;
      const rejectionReason = l.rejection_reason || l.rejectionReason || null;
      const createdAt = l.created_at || l.createdAt || null;
      const updatedAt = l.updated_at || l.updatedAt || null;
      await client.query(
        `INSERT INTO loans (
           id, loan_number, asset_id, borrower_id, borrower_name, borrower_employee_number, borrower_role,
           loan_mode_snapshot, purpose, status, requested_at, approved_at, approved_by, approved_by_name,
           handover_data, expected_return_at, return_notes, rejection_reason, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, COALESCE($11, NOW()), $12, $13, $14,
           $15::jsonb, COALESCE($16, NOW() + INTERVAL '1 day'), $17, $18,
           COALESCE($19, NOW()), COALESCE($20, NOW())
         ) ON CONFLICT (id) DO UPDATE SET
           loan_number = EXCLUDED.loan_number,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          l.id,
          loanNumber,
          assetId,
          borrowerId,
          borrowerName,
          borrowerEmployeeNumber,
          borrowerRole,
          loanModeSnapshot,
          purpose,
          status,
          requestedAt,
          approvedAt,
          approvedBy,
          approvedByName,
          handoverData,
          expectedReturnAt,
          returnNotes,
          rejectionReason,
          createdAt,
          updatedAt
        ]
      );
    }
    for (const insp of returnInspectionsList) {
      const loanId = insp.loan_id || insp.loanId;
      if (!insp.id || !loanId) continue;
      const receivedBy = insp.received_by || insp.receivedBy || insp.inspected_by || insp.inspectedBy || req.user?.id || "admin";
      const receivedByName = insp.received_by_name || insp.receivedByName || insp.inspected_by_name || insp.inspectedByName || req.user?.fullName || "Petugas Sarpras";
      const inspectedBy = insp.inspected_by || insp.inspectedBy || receivedBy;
      const inspectedByName = insp.inspected_by_name || insp.inspectedByName || receivedByName;
      const conditionAtReturn = insp.condition_at_return || insp.conditionAtReturn || "GOOD";
      const resultingStatus = insp.resulting_status || insp.resultingStatus || "AVAILABLE";
      const notes = insp.notes || null;
      const photoUrl = insp.photo_url || insp.photoUrl || null;
      const createdAt = insp.created_at || insp.createdAt || null;
      await client.query(
        `INSERT INTO return_inspections (
           id, loan_id, received_by, received_by_name, inspected_by, inspected_by_name,
           condition_at_return, resulting_status, notes, photo_url, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           condition_at_return = EXCLUDED.condition_at_return,
           resulting_status = EXCLUDED.resulting_status,
           notes = EXCLUDED.notes`,
        [
          insp.id,
          loanId,
          receivedBy,
          receivedByName,
          inspectedBy,
          inspectedByName,
          conditionAtReturn,
          resultingStatus,
          notes,
          photoUrl,
          createdAt
        ]
      );
    }
    if (data.schoolSettings) {
      try {
        await fs3.mkdir(SETTINGS_DIR2, { recursive: true });
        await fs3.writeFile(SETTINGS_FILE2, JSON.stringify(data.schoolSettings, null, 2), "utf-8");
      } catch (fileErr) {
        console.warn("[School Settings File Save Warning]:", fileErr);
      }
    }
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
       VALUES ($1, $2, $3, $4, 'DATABASE_RESTORED', 'SYSTEM', 'backup-restore', 'Pemulihan Basis Data', $5, NOW())`,
      [
        auditId,
        req.user?.id || "system",
        req.user?.fullName || "Admin Sarpras",
        req.user?.role || "ADMIN_SARPRAS",
        `Memulihkan basis data secara ${mode === "clean" ? "TIMPA BERSIH (Clean)" : "GABUNG (Merge)"}: ${assetsList.length} aset, ${usersList.length} pengguna, ${categoriesList.length} kategori, ${loansList.length} peminjaman.`
      ]
    );
    await client.query("COMMIT");
    try {
      sseManager.broadcast("asset.updated", {
        action: "database.restored",
        message: "Basis data sistem sarpras berhasil dipulihkan dari cadangan."
      });
    } catch (sseErr) {
      console.warn("[SSE Broadcast Warning]:", sseErr);
    }
    return res.status(200).json({
      success: true,
      message: "Seluruh data berhasil dipulihkan ke basis data.",
      restoredCounts: {
        users: usersList.length,
        categories: categoriesList.length,
        locations: locationsList.length,
        fundingSources: fundingSourcesList.length,
        assets: assetsList.length,
        loans: loansList.length,
        returnInspections: returnInspectionsList.length
      },
      restoredAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Backup Restore Transaction Error]:", error?.message || error);
    return res.status(500).json({
      error: "RESTORE_FAILED",
      message: `Gagal memulihkan basis data (transaksi dibatalkan): ${error?.message || error}`
    });
  } finally {
    client.release();
  }
});

// server/src/index.ts
var app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsAllowedOrigins.includes("*") || config.corsAllowedOrigins.includes(origin) || origin.startsWith("http://localhost") || origin.startsWith("http://192.168.")) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true
  })
);
app.use(express.json());
app.use((req, _res, next) => {
  if (config.nodeEnv !== "test") {
    console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/assets", assetsRouter);
app.use("/api/v1/loans", loansRouter);
app.use("/api/v1/locations", locationsRouter);
app.use("/api/v1/categories", categoriesRouter);
app.use("/api/v1/funding-sources", fundingSourcesRouter);
app.use("/api/v1/school-settings", schoolSettingsRouter);
app.use("/api/v1/realtime", realtimeRouter);
app.use("/api/v1/returns", returnsRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/audit-logs", auditLogsRouter);
app.use("/api/v1/backup", backupRouter);
app.use("/v1/health", healthRouter);
app.use("/v1/auth", authRouter);
app.use("/v1/users", usersRouter);
app.use("/v1/assets", assetsRouter);
app.use("/v1/loans", loansRouter);
app.use("/v1/locations", locationsRouter);
app.use("/v1/categories", categoriesRouter);
app.use("/v1/funding-sources", fundingSourcesRouter);
app.use("/v1/school-settings", schoolSettingsRouter);
app.use("/v1/realtime", realtimeRouter);
app.use("/v1/returns", returnsRouter);
app.use("/v1/dashboard", dashboardRouter);
app.use("/v1/audit-logs", auditLogsRouter);
app.use("/v1/backup", backupRouter);
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/assets", assetsRouter);
app.use("/loans", loansRouter);
app.use("/loan-requests", loansRouter);
app.use("/locations", locationsRouter);
app.use("/categories", categoriesRouter);
app.use("/funding-sources", fundingSourcesRouter);
app.use("/school-settings", schoolSettingsRouter);
app.use("/realtime", realtimeRouter);
app.use("/returns", returnsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/audit-logs", auditLogsRouter);
app.use("/backup", backupRouter);
app.use((_req, res) => {
  res.status(404).json({
    error: "ENDPOINT_NOT_FOUND",
    message: "Endpoint API tidak ditemukan."
  });
});
app.use((err, _req, res, _next) => {
  console.error("[API Unhandled Error]:", err?.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.code || "INTERNAL_SERVER_ERROR",
    message: status === 500 ? "Terjadi kesalahan sistem internal. Detail kesalahan disembunyikan demi keamanan." : err.message || "Permintaan gagal diproses."
  });
});
if (process.argv[1]?.includes("index") && process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`=====================================================`);
    console.log(` SIMSARPRAS Express API v2.1.0 Aktif`);
    console.log(` Port: ${config.port} | Mode: ${config.nodeEnv}`);
    console.log(` Health: http://localhost:${config.port}/api/v1/health`);
    console.log(`=====================================================`);
  });
}
var index_default = app;
export {
  app,
  index_default as default
};
