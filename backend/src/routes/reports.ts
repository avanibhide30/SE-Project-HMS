import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Comprehensive Reports API
router.get('/all', authenticate, requireRole(['WARDEN', 'ACCOUNTS', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    // 1. Occupancy Breakdown
    const blocks = await prisma.hostelBlock.findMany({
      include: {
        rooms: {
          include: {
            beds: true,
          },
        },
      },
    });

    const occupancyByBlock = blocks.map((b) => {
      const beds = b.rooms.flatMap((r) => r.beds);
      const occupied = beds.filter((bd) => bd.isOccupied).length;
      const total = beds.length;
      return {
        name: b.name.split(' (')[0],
        code: b.code,
        totalBeds: total,
        occupiedBeds: occupied,
        availableBeds: total - occupied,
        occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      };
    });

    // 2. Fees Collection & Status Breakdown
    const payments = await prisma.payment.findMany({
      include: { feeHead: true },
    });

    const paidSum = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const pendingSum = payments.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
    const overdueSum = payments.filter((p) => p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0);

    const feeDistribution = [
      { name: 'Paid Collections', value: paidSum, count: payments.filter((p) => p.status === 'PAID').length },
      { name: 'Pending Payments', value: pendingSum, count: payments.filter((p) => p.status === 'PENDING').length },
      { name: 'Overdue Dues', value: overdueSum, count: payments.filter((p) => p.status === 'OVERDUE').length },
    ];

    // 3. Application Funnel Breakdown
    const applications = await prisma.application.findMany();
    const appStats = {
      SUBMITTED: applications.filter((a) => a.status === 'SUBMITTED').length,
      UNDER_REVIEW: applications.filter((a) => a.status === 'UNDER_REVIEW').length,
      APPROVED: applications.filter((a) => a.status === 'APPROVED').length,
      REJECTED: applications.filter((a) => a.status === 'REJECTED').length,
      WITHDRAWN: applications.filter((a) => a.status === 'WITHDRAWN').length,
      TOTAL: applications.length,
    };

    // 4. Curfew Violations Stats
    const curfewRecords = await prisma.curfewRecord.findMany();
    const totalEntries = curfewRecords.length;
    const violations = curfewRecords.filter((c) => c.flaggedLate && !c.isWaived);
    const waived = curfewRecords.filter((c) => c.isWaived);
    const onTime = curfewRecords.filter((c) => !c.flaggedLate && !c.isWaived);

    // 5. Outpass Activity Breakdown
    const outpasses = await prisma.outpass.findMany();
    const outpassStats = {
      PENDING: outpasses.filter((o) => o.status === 'PENDING').length,
      APPROVED: outpasses.filter((o) => o.status === 'APPROVED').length,
      ACTIVE: outpasses.filter((o) => o.status === 'ACTIVE').length,
      RETURNED: outpasses.filter((o) => o.status === 'RETURNED').length,
      REJECTED: outpasses.filter((o) => o.status === 'REJECTED').length,
      OVERDUE: outpasses.filter((o) => o.status === 'OVERDUE').length,
      TOTAL: outpasses.length,
    };

    // 6. Visitor Activity Breakdown
    const visitors = await prisma.visitorRequest.findMany();
    const visitorStats = {
      INSIDE: visitors.filter((v) => v.status === 'INSIDE').length,
      COMPLETED: visitors.filter((v) => v.status === 'COMPLETED').length,
      OTP_GENERATED: visitors.filter((v) => v.status === 'OTP_GENERATED').length,
      DENIED: visitors.filter((v) => v.status === 'DENIED').length,
      OVERSTAY: visitors.filter((v) => v.status === 'OVERSTAY').length,
      TOTAL: visitors.length,
    };

    return res.json({
      occupancyByBlock,
      feeDistribution,
      feeTotals: { paidSum, pendingSum, overdueSum },
      appStats,
      curfewStats: {
        totalEntries,
        violationsCount: violations.length,
        waivedCount: waived.length,
        onTimeCount: onTime.length,
      },
      outpassStats,
      visitorStats,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate reports.' });
  }
});

export default router;
