import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Student: Process Mock Payment
router.post('/mock-process', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    const { paymentId, paymentMethod, simulateFailure } = req.body;

    const parsedPaymentId = Number(paymentId);
    if (!Number.isSafeInteger(parsedPaymentId) || parsedPaymentId < 1) {
      return res.status(400).json({ error: 'A valid paymentId is required.' });
    }
    if (!['UPI', 'Card', 'Net Banking'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be UPI, Card, or Net Banking.' });
    }
    if (typeof simulateFailure !== 'undefined' && typeof simulateFailure !== 'boolean') {
      return res.status(400).json({ error: 'simulateFailure must be a boolean.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parsedPaymentId },
      include: {
        student: { include: { user: true } },
        feeHead: true,
      },
    });

    if (!payment || payment.studentId !== studentId) {
      return res.status(404).json({ error: 'Payment record not found or unauthorized.' });
    }

    if (payment.status === 'PAID') {
      return res.status(400).json({ error: 'This fee head has already been paid.' });
    }

    // Simulate failure if requested (for testing failure handling)
    if (simulateFailure) {
      const updateResult = await prisma.payment.updateMany({
        where: { id: payment.id, status: payment.status },
        data: {
          status: 'FAILED',
          failureReason: 'Payment declined by bank: Insufficient funds or invalid security PIN.',
        },
      });

      if (updateResult.count === 0) {
        return res.status(409).json({ error: 'Payment status changed while processing. Refresh your fees and try again.' });
      }

      return res.status(400).json({
        success: false,
        error: 'Payment transaction failed. The payment gateway reported bank rejection.',
        allowRetry: true,
      });
    }

    // Payment Success
    const now = new Date();
    const txnId = `TXN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const rcpNumber = `RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.payment.updateMany({
        where: { id: payment.id, status: payment.status },
        data: {
          status: 'PAID',
          transactionId: txnId,
          receiptNumber: rcpNumber,
          paymentMethod,
          paidAt: now,
          failureReason: null,
        },
      });

      if (updateResult.count === 0) return { conflict: true as const };

      const updatedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        include: { feeHead: true, student: true },
      });
      if (!updatedPayment) throw new Error('Payment record disappeared during processing.');

      await tx.notification.create({
        data: {
          userId: payment.student.userId,
          title: 'Fee Payment Successful 🧾',
          message: `Your payment of ₹${payment.amount.toLocaleString()} for ${payment.feeHead.name} was successful. Receipt #${rcpNumber}.`,
          type: 'PAYMENT',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'PAYMENT_COMPLETED',
          module: 'FEE',
          details: `Paid ₹${payment.amount} for ${payment.feeHead.name}. Txn: ${txnId}, Receipt: ${rcpNumber}.`,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return { conflict: false as const, updatedPayment };
    });

    if (result.conflict) {
      return res.status(409).json({ error: 'Payment status changed while processing. Refresh your fees and try again.' });
    }

    return res.json({
      success: true,
      message: 'Payment confirmed successfully.',
      payment: result.updatedPayment,
      receiptNumber: rcpNumber,
      transactionId: txnId,
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    return res.status(500).json({ error: 'Payment gateway communication failure.' });
  }
});

// View Receipt Details (Student & Staff)
router.get('/receipt/:receiptNumber', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!['STUDENT', 'ACCOUNTS', 'WARDEN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Your role is not authorized to view payment receipts.' });
    }

    const { receiptNumber } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { receiptNumber },
      include: {
        feeHead: true,
        student: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: {
                room: { include: { block: true } },
                bed: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    // Authorization: student can only view their own receipt
    if (req.user!.role === 'STUDENT' && req.studentId !== payment.studentId) {
      return res.status(403).json({ error: 'Unauthorized to view another student receipt.' });
    }

    const currentAlloc = payment.student.allocations[0];

    const receiptData = {
      receiptNumber: payment.receiptNumber,
      transactionId: payment.transactionId,
      date: payment.paidAt || payment.dueDate,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod || 'Online Gateway',
      status: payment.status,
      feeHeadName: payment.feeHead.name,
      academicTerm: payment.feeHead.term,
      institution: {
        name: 'CENTRAL UNIVERSITY HOSTELS',
        subText: 'Office of the Chief Warden & Hostel Accounts Administration',
        address: 'Campus Hostel Complex, University Enclave, Mumbai - 400058',
        contact: 'accounts@hostel.edu | +91 22 2670 1234',
      },
      student: {
        name: payment.student.name,
        rollNumber: payment.student.rollNumber,
        course: payment.student.course,
        year: payment.student.year,
        gender: payment.student.gender,
        hostelBlock: currentAlloc?.room.block.name || 'Not Allocated',
        roomNumber: currentAlloc?.room.roomNumber || '-',
        bedNumber: currentAlloc?.bed.bedNumber || '-',
      },
    };

    return res.json(receiptData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch receipt data.' });
  }
});

// Accounts / Admin: List all payments with filtering
router.get('/all', authenticate, requireRole(['ACCOUNTS', 'WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, feeHeadId, blockId, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status as string;
    if (feeHeadId && feeHeadId !== 'ALL') where.feeHeadId = parseInt(feeHeadId as string);

    if (blockId && blockId !== 'ALL') {
      where.student = {
        allocations: {
          some: {
            status: 'ACTIVE',
            room: { blockId: parseInt(blockId as string) },
          },
        },
      };
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { transactionId: { contains: q } },
        { receiptNumber: { contains: q } },
        { student: { name: { contains: q } } },
        { student: { rollNumber: { contains: q } } },
      ];
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { dueDate: 'desc' },
      include: {
        feeHead: true,
        student: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: { room: { include: { block: true } }, bed: true },
            },
          },
        },
      },
    });

    const totalCollected = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const totalPending = payments.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
    const totalOverdue = payments.filter((p) => p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      summary: { totalCollected, totalPending, totalOverdue, totalRecords: payments.length },
      payments,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// Accounts: Defaulters List
router.get('/defaulters', authenticate, requireRole(['ACCOUNTS', 'WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const overduePayments = await prisma.payment.findMany({
      where: {
        status: { in: ['OVERDUE', 'PENDING'] },
        dueDate: { lt: new Date() },
      },
      include: {
        feeHead: true,
        student: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: { room: { include: { block: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return res.json(overduePayments);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch defaulters.' });
  }
});

export default router;
