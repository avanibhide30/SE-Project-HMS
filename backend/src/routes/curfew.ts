import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Helper to convert "HH:mm" to total minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Get current Curfew Configuration
router.get('/config', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let config = await prisma.curfewConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      config = await prisma.curfewConfig.create({
        data: {
          weekdayCurfew: '21:30',
          weekendCurfew: '22:30',
          specialCurfew: '23:00',
          permittedVisitorUntil: '20:00',
          isActive: true,
        },
      });
    }
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch curfew configuration.' });
  }
});

// Warden: Update Curfew Configuration
router.put('/config', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { weekdayCurfew, weekendCurfew, specialCurfew, permittedVisitorUntil } = req.body;

    let config = await prisma.curfewConfig.findFirst({ where: { isActive: true } });
    if (config) {
      config = await prisma.curfewConfig.update({
        where: { id: config.id },
        data: {
          weekdayCurfew: weekdayCurfew || config.weekdayCurfew,
          weekendCurfew: weekendCurfew || config.weekendCurfew,
          specialCurfew: specialCurfew || config.specialCurfew,
          permittedVisitorUntil: permittedVisitorUntil || config.permittedVisitorUntil,
        },
      });
    } else {
      config = await prisma.curfewConfig.create({
        data: {
          weekdayCurfew: weekdayCurfew || '21:30',
          weekendCurfew: weekendCurfew || '22:30',
          specialCurfew: specialCurfew || '23:00',
          permittedVisitorUntil: permittedVisitorUntil || '20:00',
        },
      });
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'CURFEW_CONFIG_UPDATED',
      module: 'CURFEW',
      details: `Updated curfew: Weekdays ${config.weekdayCurfew}, Weekends ${config.weekendCurfew}, Visitors until ${config.permittedVisitorUntil}`,
      ipAddress: req.ip,
    });

    return res.json(config);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update curfew settings.' });
  }
});

// Student: View own curfew records
router.get('/my', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) return res.status(400).json({ error: 'Student record not found.' });

    const records = await prisma.curfewRecord.findMany({
      where: { studentId },
      orderBy: { entryTime: 'desc' },
    });

    const totalEntries = records.length;
    const totalViolations = records.filter((r) => r.flaggedLate && !r.isWaived).length;
    const waivedEntries = records.filter((r) => r.isWaived).length;

    return res.json({
      summary: { totalEntries, totalViolations, waivedEntries },
      records,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch curfew records.' });
  }
});

// Warden / Security: View all curfew records and violations
router.get('/records', authenticate, requireRole(['WARDEN', 'SECURITY', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { violationsOnly, studentRoll, blockId } = req.query;

    const where: any = {};
    if (violationsOnly === 'true') {
      where.flaggedLate = true;
      where.isWaived = false;
    }
    if (studentRoll) {
      where.student = { rollNumber: String(studentRoll).trim() };
    }
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

    const records = await prisma.curfewRecord.findMany({
      where,
      orderBy: { entryTime: 'desc' },
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

    // Detect repeat violators (> 2 violations in the current month)
    const violationCounts: { [key: number]: number } = {};
    for (const r of records) {
      if (r.flaggedLate && !r.isWaived) {
        violationCounts[r.studentId] = (violationCounts[r.studentId] || 0) + 1;
      }
    }

    const repeatViolatorIds = Object.keys(violationCounts)
      .filter((sId) => violationCounts[parseInt(sId)] >= 2)
      .map(Number);

    return res.json({
      records,
      repeatViolatorStudentIds: repeatViolatorIds,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch curfew records.' });
  }
});

// Security: Log Student Entry at Gate (Curfew Check)
router.post('/log-entry', authenticate, requireRole(['SECURITY', 'WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { studentRoll, manualTime } = req.body;
    if (!studentRoll) {
      return res.status(400).json({ error: 'Student Roll Number or ID is required.' });
    }

    const student = await prisma.student.findUnique({
      where: { rollNumber: studentRoll.trim() },
      include: {
        allocations: {
          where: { status: 'ACTIVE' },
          include: { room: { include: { block: true } }, bed: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: `Student with roll ${studentRoll} not found in hostel records.` });
    }

    const now = manualTime ? new Date(manualTime) : new Date();
    const entryHours = now.getHours();
    const entryMinutes = now.getMinutes();
    const currentEntryTimeMinutes = entryHours * 60 + entryMinutes;

    // Fetch curfew config
    const config = (await prisma.curfewConfig.findFirst({ where: { isActive: true } })) || {
      weekdayCurfew: '21:30',
      weekendCurfew: '22:30',
      specialCurfew: '23:00',
    };

    const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const applicableCurfewStr = isWeekend ? config.weekendCurfew : config.weekdayCurfew;
    const curfewMinutes = timeToMinutes(applicableCurfewStr);

    let flaggedLate = false;
    let delayMinutes = 0;
    let isWaived = false;
    let waiveReason: string | null = null;

    if (currentEntryTimeMinutes > curfewMinutes) {
      delayMinutes = currentEntryTimeMinutes - curfewMinutes;

      // Check if student has an active approved Outpass/Leave covering this time
      const activeOutpass = await prisma.outpass.findFirst({
        where: {
          studentId: student.id,
          status: { in: ['APPROVED', 'ACTIVE'] },
          departureTime: { lte: now },
          expectedReturnTime: { gte: now },
        },
      });

      if (activeOutpass) {
        isWaived = true;
        waiveReason = `Covered by approved Outpass #${activeOutpass.outpassNumber} (${activeOutpass.destination})`;
      } else {
        flaggedLate = true;
      }
    }

    // Save Curfew Record
    const record = await prisma.curfewRecord.create({
      data: {
        studentId: student.id,
        entryTime: now,
        curfewTime: applicableCurfewStr,
        delayMinutes,
        flaggedLate,
        isWaived,
        waiveReason,
        recordedBy: `${req.user!.name} (${req.user!.role})`,
      },
    });

    // If flagged late, send alert notification to Warden
    if (flaggedLate) {
      const wardens = await prisma.user.findMany({ where: { role: 'WARDEN' } });
      for (const w of wardens) {
        await prisma.notification.create({
          data: {
            userId: w.id,
            title: '⚠️ Curfew Violation Alert',
            message: `Resident ${student.name} (${student.rollNumber}) entered the gate ${delayMinutes} minutes late (Curfew was ${applicableCurfewStr}).`,
            type: 'CURFEW',
          },
        });
      }

      await logAudit({
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: 'CURFEW_VIOLATION_LOGGED',
        module: 'CURFEW',
        details: `Student ${student.name} entered ${delayMinutes} mins after curfew (${applicableCurfewStr}).`,
        ipAddress: req.ip,
      });
    }

    return res.status(201).json({
      success: true,
      record,
      studentName: student.name,
      studentRoll: student.rollNumber,
      roomInfo: student.allocations[0]?.room.roomNumber || 'N/A',
      curfewTime: applicableCurfewStr,
      entryTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      flaggedLate,
      delayMinutes,
      isWaived,
      waiveReason,
    });
  } catch (error) {
    console.error('Curfew entry log error:', error);
    return res.status(500).json({ error: 'Failed to record gate entry.' });
  }
});

export default router;
