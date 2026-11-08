import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

/**
 * GET /api/v1/dashboard & GET /dashboard
 * Menghitung agregasi metrik dashboard langsung dari basis data PostgreSQL lokal
 */
dashboardRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
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
      `),
    ]);

    const assets = assetsRes.rows;
    const loans = loansRes.rows;
    const categories = categoriesRes.rows;
    const locations = locationsRes.rows;
    const fundingSources = fundingSourcesRes.rows;

    const totalAssets = assets.length;
    const availableAssets = assets.filter((a) => a.operational_status === 'AVAILABLE').length;
    const onLoanAssets = assets.filter((a) => a.operational_status === 'ON_LOAN').length;
    const maintenanceAssets = assets.filter((a) => a.operational_status === 'MAINTENANCE').length;

    const pendingApprovalsCount = loans.filter((l) => l.status === 'PENDING_APPROVAL').length;
    const pendingReturnsCount = loans.filter(
      (l) => l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED'
    ).length;

    const now = Date.now();
    const overdueLoansCount = loans.filter((l) => {
      if (l.status !== 'ACTIVE') return false;
      return new Date(l.expected_return_at).getTime() < now;
    }).length;

    const byCategory = categories.map((c) => {
      const catAssets = assets.filter((a) => a.category_name === c.name);
      return {
        name: c.name,
        count: catAssets.length,
        available: catAssets.filter((a) => a.operational_status === 'AVAILABLE').length,
      };
    });

    const conditions = [
      { status: 'GOOD', label: 'Baik' },
      { status: 'MINOR_DAMAGE', label: 'Rusak Ringan' },
      { status: 'MAJOR_DAMAGE', label: 'Rusak Berat' },
      { status: 'LOST', label: 'Hilang' },
    ];

    const byCondition = conditions.map((cond) => ({
      status: cond.status,
      label: cond.label,
      count: assets.filter((a) => a.condition_status === cond.status).length,
    }));

    const byLocation = locations.map((loc) => ({
      name: loc.name,
      count: assets.filter((a) => a.location_id === loc.id).length,
    }));

    const byFundingSource = fundingSources.map((fs) => ({
      name: fs.name,
      count: assets.filter((a) => a.funding_source === fs.name).length,
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
      byFundingSource,
    });
  } catch (error: any) {
    console.error('[Dashboard Metrics Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat metrik dashboard.',
    });
  }
});
