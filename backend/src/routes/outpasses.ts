import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Student: View own outpass history
router.get('/my', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student record not found.' });

    const outpasses = await prisma.outpass.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    const activePass = outpasses.find((o) => ['APPROVED', 'ACTIVE'].includes(o.status));

    return res.json({
      activePass,
      history: outpasses,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch outpass records.' });
  }
});

// Student: Request Outpass or Leave
router.post('/', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student record not found.' });

    // Verify student is an active resident
    const activeAlloc = await prisma.allocation.findFirst({
      where: { studentId, status: 'ACTIVE' },
    });
    if (!activeAlloc) {
      return res.status(403).json({
        error: 'Only resident students with an active room allocation can request an outpass or leave.',
      });
    }

    const { type, reason, destination, modeOfTravel, departureTime, expectedReturnTime } = req.body;
    if (!type || !reason || !destination || !departureTime || !expectedReturnTime) {
      return res.status(400).json({ error: 'All outpass fields are required.' });
    }

    const depDate = new Date(departureTime);
    const retDate = new Date(expectedReturnTime);

    if (Number.isNaN(depDate.getTime()) || Number.isNaN(retDate.getTime())) {
      return res.status(400).json({ error: 'Departure and expected return must be valid date/time values.' });
    }

    if (depDate <= new Date()) {
      return res.status(400).json({ error: 'Departure date/time must be in the future.' });
    }

    // Validation: return time must be strictly after departure time
    if (retDate <= depDate) {
      return res.status(400).json({
        error: 'Expected return date/time must be strictly later than departure date/time.',
      });
    }

    // Validation: Prevent overlapping pending or active/approved outpasses
    const overlapping = await prisma.outpass.findFirst({
      where: {
        studentId,
        status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
        OR: [
          {
            departureTime: { lte: retDate },
            expectedReturnTime: { gte: depDate },
          },
        ],
      },
    });

    if (overlapping) {
      return res.status(400).json({
        error: `You already have an existing ${overlapping.type} (${overlapping.outpassNumber}) scheduled between ${new Date(overlapping.departureTime).toLocaleDateString()} and ${new Date(overlapping.expectedReturnTime).toLocaleDateString()} with status '${overlapping.status}'. Overlapping requests are not permitted.`,
      });
    }

    const count = await prisma.outpass.count();
    const outpassNumber = `OP-2026-${String(count + 1).padStart(4, '0')}`;

    const newOutpass = await prisma.outpass.create({
      data: {
        outpassNumber,
        studentId,
        type: type === 'LEAVE' ? 'LEAVE' : 'OUTPASS',
        reason: reason.trim(),
        destination: destination.trim(),
        modeOfTravel: modeOfTravel || 'Public Transport',
        departureTime: depDate,
        expectedReturnTime: retDate,
        status: 'PENDING',
      },
      include: { student: true },
    });

    // Notify Warden
    const wardens = await prisma.user.findMany({ where: { role: 'WARDEN' } });
    for (const w of wardens) {
      await prisma.notification.create({
        data: {
          userId: w.id,
          title: `New ${newOutpass.type} Request`,
          message: `Resident ${newOutpass.student.name} requested ${newOutpass.type} (${newOutpass.outpassNumber}) to ${newOutpass.destination}.`,
          type: 'OUTPASS',
        },
      });
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'OUTPASS_REQUESTED',
      module: 'OUTPASS',
      details: `Requested ${newOutpass.type} #${newOutpass.outpassNumber} for ${newOutpass.destination}`,
      ipAddress: req.ip,
    });

    return res.status(201).json(newOutpass);
  } catch (error) {
    console.error('Outpass creation error:', error);
    return res.status(500).json({ error: 'Failed to submit outpass request.' });
  }
});

// Student: Cancel pending outpass
router.put('/:id/cancel', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const outpassId = parseInt(req.params.id);
    const studentId = req.studentId;

    const op = await prisma.outpass.findUnique({ where: { id: outpassId } });
    if (!op || op.studentId !== studentId) {
      return res.status(404).json({ error: 'Outpass not found or unauthorized.' });
    }

    if (op.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot cancel outpass with status '${op.status}'.` });
    }

    const updated = await prisma.outpass.update({
      where: { id: outpassId },
      data: { status: 'CANCELLED' },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'OUTPASS_CANCELLED',
      module: 'OUTPASS',
      details: `Cancelled pending outpass #${op.outpassNumber}`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to cancel outpass.' });
  }
});

// Warden / Admin: View outpass list
router.get('/', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status as string;
    if (type && type !== 'ALL') where.type = type as string;
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { outpassNumber: { contains: q } },
        { destination: { contains: q } },
        { student: { name: { contains: q } } },
        { student: { rollNumber: { contains: q } } },
      ];
    }

    const outpasses = await prisma.outpass.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: { room: { include: { block: true } } },
            },
          },
        },
      },
    });

    return res.json(outpasses);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch outpasses.' });
  }
});

// Warden: Approve outpass
router.post('/:id/approve', authenticate, requireRole(['WARDEN']), async (req: AuthRequest, res: Response) => {
  try {
    const outpassId = parseInt(req.params.id);
    const op = await prisma.outpass.findUnique({
      where: { id: outpassId },
      include: { student: { include: { user: true } } },
    });

    if (!op) return res.status(404).json({ error: 'Outpass not found.' });
    if (op.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot approve an outpass with status '${op.status}'.` });
    }

    const updated = await prisma.outpass.update({
      where: { id: outpassId },
      data: { status: 'APPROVED', rejectionReason: null },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: op.student.userId,
        title: 'Outpass Approved ✅',
        message: `Your ${op.type} request #${op.outpassNumber} to ${op.destination} has been approved. You may present this pass at the gate.`,
        type: 'OUTPASS',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'OUTPASS_APPROVED',
      module: 'OUTPASS',
      details: `Approved ${op.type} #${op.outpassNumber} for ${op.student.name}`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to approve outpass.' });
  }
});

// Warden: Reject outpass (Mandatory reason required)
router.post('/:id/reject', authenticate, requireRole(['WARDEN']), async (req: AuthRequest, res: Response) => {
  try {
    const outpassId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A specific rejection reason of at least 5 characters is mandatory.' });
    }

    const op = await prisma.outpass.findUnique({
      where: { id: outpassId },
      include: { student: { include: { user: true } } },
    });

    if (!op) return res.status(404).json({ error: 'Outpass not found.' });
    if (op.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot reject an outpass with status '${op.status}'.` });
    }

    const updated = await prisma.outpass.update({
      where: { id: outpassId },
      data: { status: 'REJECTED', rejectionReason: reason.trim() },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: op.student.userId,
        title: 'Outpass Request Rejected',
        message: `Your ${op.type} #${op.outpassNumber} was rejected by Warden. Reason: ${reason.trim()}`,
        type: 'OUTPASS',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'OUTPASS_REJECTED',
      module: 'OUTPASS',
      details: `Rejected ${op.type} #${op.outpassNumber} for ${op.student.name}. Reason: ${reason.trim()}`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reject outpass.' });
  }
});

// Security: Verify Outpass at Gate Console
router.post('/verify-gate', authenticate, requireRole(['SECURITY', 'WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.body; // outpassNumber or student roll
    if (!query) return res.status(400).json({ error: 'Outpass number or Student roll number required.' });

    const q = String(query).trim();
    const op = await prisma.outpass.findFirst({
      where: {
        OR: [
          { outpassNumber: q },
          { student: { rollNumber: q }, status: { in: ['APPROVED', 'ACTIVE'] } },
        ],
      },
      include: {
        student: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: { room: { include: { block: true } }, bed: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!op) {
      return res.status(404).json({ error: `No active or approved outpass found matching '${query}'.` });
    }

    return res.json(op);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify outpass at gate.' });
  }
});

// Security: Log Outpass Exit (Departure)
router.post('/:id/log-exit', authenticate, requireRole(['SECURITY', 'WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const outpassId = parseInt(req.params.id);
    const op = await prisma.outpass.findUnique({
      where: { id: outpassId },
      include: { student: true },
    });

    if (!op) return res.status(404).json({ error: 'Outpass not found.' });
    if (op.status !== 'APPROVED') {
      return res.status(400).json({ error: `Cannot log exit for outpass with status '${op.status}'. Must be APPROVED.` });
    }

    const now = new Date();
    const updated = await prisma.outpass.update({
      where: { id: outpassId },
      data: {
        actualExitTime: now,
        status: 'ACTIVE',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'OUTPASS_EXIT_LOGGED',
      module: 'OUTPASS',
      details: `Student ${op.student.name} logged departure for outpass #${op.outpassNumber}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Departure recorded successfully. Outpass is now ACTIVE.', outpass: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to record outpass exit.' });
  }
});

// Security: Log Outpass Return (Arrival back to hostel)
router.post('/:id/log-return', authenticate, requireRole(['SECURITY', 'WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const outpassId = parseInt(req.params.id);
    const op = await prisma.outpass.findUnique({
      where: { id: outpassId },
      include: { student: true },
    });

    if (!op) return res.status(404).json({ error: 'Outpass not found.' });
    if (!['ACTIVE', 'APPROVED'].includes(op.status)) {
      return res.status(400).json({ error: `Outpass is not active (current status: ${op.status}).` });
    }

    const now = new Date();
    // Check if overdue
    const isLate = now > new Date(op.expectedReturnTime);
    const finalStatus = isLate ? 'OVERDUE' : 'RETURNED';

    const updated = await prisma.outpass.update({
      where: { id: outpassId },
      data: {
        actualReturnTime: now,
        status: finalStatus,
      },
    });

    if (isLate) {
      // Alert Warden of overdue return
      const wardens = await prisma.user.findMany({ where: { role: 'WARDEN' } });
      for (const w of wardens) {
        await prisma.notification.create({
          data: {
            userId: w.id,
            title: '⚠️ Outpass Overdue Alert',
            message: `Student ${op.student.name} (${op.student.rollNumber}) returned late on ${op.type} #${op.outpassNumber}. Expected: ${new Date(op.expectedReturnTime).toLocaleTimeString()}, Returned: ${now.toLocaleTimeString()}.`,
            type: 'OUTPASS',
          },
        });
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: isLate ? 'OUTPASS_OVERDUE_LOGGED' : 'OUTPASS_RETURN_LOGGED',
      module: 'OUTPASS',
      details: `Student ${op.student.name} logged return for ${op.outpassNumber}. Status: ${finalStatus}.`,
      ipAddress: req.ip,
    });

    return res.json({
      message: isLate
        ? 'Return recorded. Return was AFTER expected time; outpass marked as OVERDUE and Warden notified.'
        : 'Return recorded successfully. Outpass marked as RETURNED.',
      outpass: updated,
      isOverdue: isLate,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to record outpass return.' });
  }
});

export default router;
