import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Student: View fee dues and status
router.get('/my', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student record not found.' });

    const payments = await prisma.payment.findMany({
      where: { studentId },
      include: { feeHead: true },
      orderBy: { dueDate: 'asc' },
    });

    const totalPayable = payments.reduce((sum, p) => sum + p.amount, 0);
    const amountPaid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const amountPending = payments.filter((p) => ['PENDING', 'OVERDUE', 'FAILED'].includes(p.status)).reduce((sum, p) => sum + p.amount, 0);
    const overdueCount = payments.filter((p) => p.status === 'OVERDUE').length;

    // Upcoming pending due date
    const pendingItems = payments.filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE');
    const nextDueDate = pendingItems.length > 0 ? pendingItems[0].dueDate : null;

    return res.json({
      summary: {
        totalPayable,
        amountPaid,
        amountPending,
        overdueCount,
        nextDueDate,
      },
      payments,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch student fees.' });
  }
});

// Accounts / Warden: Get all defined fee heads
router.get('/heads', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const heads = await prisma.feeHead.findMany({
      include: {
        _count: { select: { payments: true } },
      },
      orderBy: { id: 'asc' },
    });
    return res.json(heads);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch fee heads.' });
  }
});

// Accounts: Create or update fee head
router.post('/heads', authenticate, requireRole(['ACCOUNTS', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, amount, term, roomCategory } = req.body;
    if (!name || !amount || !term) {
      return res.status(400).json({ error: 'Name, amount, and term are required.' });
    }

    const feeHead = await prisma.feeHead.create({
      data: {
        name,
        amount: parseFloat(amount),
        term,
        roomCategory: roomCategory || 'All',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'FEE_HEAD_CREATED',
      module: 'FEE',
      details: `Created fee head ${feeHead.name} of ₹${feeHead.amount} for ${feeHead.term}`,
      ipAddress: req.ip,
    });

    return res.status(201).json(feeHead);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create fee head.' });
  }
});

// Accounts: Assign fee head to all allocated students
router.post('/assign', authenticate, requireRole(['ACCOUNTS', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { feeHeadId, dueDate } = req.body;
    if (!feeHeadId || !dueDate) {
      return res.status(400).json({ error: 'feeHeadId and dueDate are required.' });
    }

    const feeHead = await prisma.feeHead.findUnique({ where: { id: parseInt(feeHeadId) } });
    if (!feeHead) return res.status(404).json({ error: 'Fee head not found.' });

    // Find all active resident students
    const activeAllocations = await prisma.allocation.findMany({
      where: { status: 'ACTIVE' },
      select: { studentId: true },
    });

    let assignedCount = 0;
    for (const alloc of activeAllocations) {
      // Check if already assigned
      const existing = await prisma.payment.findFirst({
        where: { studentId: alloc.studentId, feeHeadId: feeHead.id },
      });
      if (!existing) {
        await prisma.payment.create({
          data: {
            studentId: alloc.studentId,
            feeHeadId: feeHead.id,
            amount: feeHead.amount,
            dueDate: new Date(dueDate),
            status: 'PENDING',
          },
        });
        assignedCount++;
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'FEE_ASSIGNED',
      module: 'FEE',
      details: `Assigned fee head ${feeHead.name} to ${assignedCount} students.`,
      ipAddress: req.ip,
    });

    return res.json({ message: `Successfully assigned fee head to ${assignedCount} students.`, assignedCount });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to assign fee.' });
  }
});

export default router;
