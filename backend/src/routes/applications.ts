import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Student: Get own application status
router.get('/my', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'Student record not found for user.' });
    }

    const application = await prisma.application.findFirst({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
      include: {
        student: true,
        allocation: {
          include: {
            room: { include: { block: true } },
            bed: true,
          },
        },
      },
    });

    return res.json(application);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch application.' });
  }
});

// Student: Submit a new application
router.post('/', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'Student record not found.' });
    }

    const { roomTypePreference, supportingDoc, academicTerm, medicalInfo } = req.body;
    if (!roomTypePreference) {
      return res.status(400).json({ error: 'Room type preference is required.' });
    }

    let validatedSupportingDoc: string | null = null;
    if (supportingDoc !== undefined && supportingDoc !== null && supportingDoc !== '') {
      if (typeof supportingDoc !== 'string') {
        return res.status(400).json({ error: 'Supporting document must be a PDF, JPG, or PNG data URL.' });
      }

      const dataUrl = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(supportingDoc);
      if (!dataUrl) {
        return res.status(400).json({ error: 'Supporting document must be a PDF, JPG, or PNG data URL.' });
      }

      const contentType = dataUrl[1];
      const encodedBytes = dataUrl[2];
      const fileBytes = Buffer.from(encodedBytes, 'base64');
      if (encodedBytes.length % 4 !== 0 || fileBytes.toString('base64') !== encodedBytes) {
        return res.status(400).json({ error: 'Supporting document contains malformed base64 data.' });
      }

      const validSignature = contentType === 'application/pdf'
        ? fileBytes.subarray(0, 5).toString('ascii') === '%PDF-'
        : contentType === 'image/jpeg'
          ? fileBytes.length >= 3 && fileBytes[0] === 0xff && fileBytes[1] === 0xd8 && fileBytes[2] === 0xff
          : fileBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      if (fileBytes.length === 0 || fileBytes.length > 6 * 1024 * 1024) {
        return res.status(400).json({ error: 'Supporting documents must be 6 MB or smaller.' });
      }
      if (!validSignature) {
        return res.status(400).json({ error: 'The supporting document content does not match its file type.' });
      }

      validatedSupportingDoc = supportingDoc;
    }

    // Prevent duplicate active application
    const existingActive = await prisma.application.findFirst({
      where: {
        studentId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
      },
    });

    if (existingActive) {
      return res.status(400).json({
        error: `You already have an active application (${existingActive.applicationNumber}) with status '${existingActive.status}'. Duplicate applications are not permitted.`,
      });
    }

    const count = await prisma.application.count();
    const appNumber = `APP-2026-${String(count + 1).padStart(4, '0')}`;

    const newApp = await prisma.$transaction(async (tx) => {
      if (typeof medicalInfo === 'string') {
        await tx.student.update({
          where: { id: studentId },
          data: { medicalInfo: medicalInfo.trim() || null },
        });
      }

      return tx.application.create({
        data: {
          applicationNumber: appNumber,
          studentId,
          roomTypePreference,
          supportingDoc: validatedSupportingDoc,
          academicTerm: academicTerm || '2026-27',
          status: 'SUBMITTED',
        },
        include: { student: true },
      });
    });
    // Notify Warden
    const wardens = await prisma.user.findMany({ where: { role: 'WARDEN' } });
    for (const w of wardens) {
      await prisma.notification.create({
        data: {
          userId: w.id,
          title: 'New Hostel Application Submitted',
          message: `Student ${newApp.student.name} (${newApp.student.rollNumber}) submitted application ${newApp.applicationNumber}.`,
          type: 'APPLICATION',
        },
      });
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'APPLICATION_SUBMITTED',
      module: 'APPLICATION',
      details: `Application ${newApp.applicationNumber} submitted by ${newApp.student.name}`,
      ipAddress: req.ip,
    });

    return res.status(201).json(newApp);
  } catch (error: any) {
    console.error('Submit application error:', error);
    return res.status(500).json({ error: 'Failed to submit application.' });
  }
});

// Student: Withdraw application
router.put('/:id/withdraw', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const studentId = req.studentId;

    const app = await prisma.application.findUnique({
      where: { id: appId },
    });

    if (!app || app.studentId !== studentId) {
      return res.status(404).json({ error: 'Application not found or unauthorized.' });
    }

    if (['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(app.status)) {
      return res.status(400).json({ error: `Cannot withdraw application in '${app.status}' status.` });
    }

    const updated = await prisma.application.update({
      where: { id: appId },
      data: { status: 'WITHDRAWN' },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'APPLICATION_WITHDRAWN',
      module: 'APPLICATION',
      details: `Application ${app.applicationNumber} was withdrawn by student.`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to withdraw application.' });
  }
});

// Warden/Admin: List all applications with filtering
router.get('/', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, course, gender, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status as string;
    }
    if (course && course !== 'ALL') {
      where.student = { ...where.student, course: course as string };
    }
    if (gender && gender !== 'ALL') {
      where.student = { ...where.student, gender: gender as string };
    }
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { applicationNumber: { contains: q } },
        { student: { name: { contains: q } } },
        { student: { rollNumber: { contains: q } } },
      ];
    }

    const applications = await prisma.application.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        student: true,
        allocation: {
          include: {
            room: { include: { block: true } },
            bed: true,
          },
        },
      },
    });

    return res.json(applications);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch applications.' });
  }
});

// Warden: Approve application
router.post('/:id/approve', authenticate, requireRole(['WARDEN']), async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const app = await prisma.application.findUnique({
      where: { id: appId },
      include: { student: { include: { user: true } } },
    });

    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)) {
      return res.status(400).json({ error: `Cannot approve an application with status '${app.status}'.` });
    }

    const updated = await prisma.application.update({
      where: { id: appId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: app.student.userId,
        title: 'Hostel Application Approved! 🎉',
        message: `Your hostel application ${app.applicationNumber} has been approved by Warden ${req.user!.name}. You are now eligible for room allocation.`,
        type: 'APPLICATION',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'APPLICATION_APPROVED',
      module: 'APPLICATION',
      details: `Approved application ${app.applicationNumber} for student ${app.student.name} (${app.student.rollNumber})`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to approve application.' });
  }
});

// Warden: Reject application (Mandatory reason required)
router.post('/:id/reject', authenticate, requireRole(['WARDEN']), async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A specific rejection reason of at least 5 characters is mandatory.' });
    }

    const app = await prisma.application.findUnique({
      where: { id: appId },
      include: { student: { include: { user: true } } },
    });

    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)) {
      return res.status(400).json({ error: `Cannot reject an application with status '${app.status}'.` });
    }

    const updated = await prisma.application.update({
      where: { id: appId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        reviewedAt: new Date(),
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: app.student.userId,
        title: 'Hostel Application Status Update',
        message: `Your hostel application ${app.applicationNumber} was not approved. Reason: ${reason.trim()}`,
        type: 'APPLICATION',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'APPLICATION_REJECTED',
      module: 'APPLICATION',
      details: `Rejected application ${app.applicationNumber} for student ${app.student.name}. Reason: ${reason.trim()}`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reject application.' });
  }
});

// Warden: Set status Under Review
router.post('/:id/under-review', authenticate, requireRole(['WARDEN']), async (req: AuthRequest, res: Response) => {
  try {
    const appId = parseInt(req.params.id);
    const updated = await prisma.application.update({
      where: { id: appId },
      data: { status: 'UNDER_REVIEW' },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update application.' });
  }
});

export default router;
