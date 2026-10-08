import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Get active notices for user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    // Student targeting filter
    let studentBlockCode = 'ALL';
    if (req.user!.role === 'STUDENT' && req.studentId) {
      const alloc = await prisma.allocation.findFirst({
        where: { studentId: req.studentId, status: 'ACTIVE' },
        include: { room: { include: { block: true } } },
      });
      if (alloc) {
        studentBlockCode = alloc.room.block.code;
      }
    }

    const notices = await prisma.notice.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
        AND: [
          {
            OR: [
              { target: 'ALL' },
              { target: studentBlockCode },
            ],
          },
        ],
      },
      include: {
        author: { select: { name: true, role: true } },
        reads: { where: { userId } },
      },
      orderBy: [
        { isUrgent: 'desc' },
        { publishedAt: 'desc' },
      ],
    });

    const enrichedNotices = notices.map((n) => ({
      ...n,
      isRead: n.reads.length > 0,
    }));

    return res.json(enrichedNotices);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch notices.' });
  }
});

// Student: Mark notice as read
router.post('/:id/mark-read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const noticeId = parseInt(req.params.id);
    const userId = req.user!.id;

    await prisma.noticeRead.upsert({
      where: {
        noticeId_userId: { noticeId, userId },
      },
      create: { noticeId, userId },
      update: { readAt: new Date() },
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to mark notice read.' });
  }
});

// Warden: Create notice
router.post('/', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, category, target, isUrgent, expiresAt, attachmentUrl } = req.body;
    if (!title || !body || !category) {
      return res.status(400).json({ error: 'Title, body, and category are required.' });
    }

    const notice = await prisma.notice.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        category,
        target: target || 'ALL',
        isUrgent: Boolean(isUrgent),
        attachmentUrl: attachmentUrl || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        authorId: req.user!.id,
      },
      include: { author: true },
    });

    // If Urgent, broadcast notification to all students
    if (isUrgent) {
      const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });
      for (const s of students) {
        await prisma.notification.create({
          data: {
            userId: s.id,
            title: `🚨 Urgent Notice: ${notice.title}`,
            message: notice.body.slice(0, 120) + '...',
            type: 'NOTICE',
          },
        });
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'NOTICE_PUBLISHED',
      module: 'NOTICE',
      details: `Published ${isUrgent ? 'URGENT ' : ''}notice: "${notice.title}" for target ${notice.target}`,
      ipAddress: req.ip,
    });

    return res.status(201).json(notice);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create notice.' });
  }
});

// Warden: Edit notice
router.put('/:id', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const noticeId = parseInt(req.params.id);
    const { title, body, category, target, isUrgent, expiresAt } = req.body;

    const updated = await prisma.notice.update({
      where: { id: noticeId },
      data: {
        title,
        body,
        category,
        target,
        isUrgent: Boolean(isUrgent),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'NOTICE_UPDATED',
      module: 'NOTICE',
      details: `Updated notice "${updated.title}"`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update notice.' });
  }
});

// Warden: Delete notice
router.delete('/:id', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const noticeId = parseInt(req.params.id);
    const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice) return res.status(404).json({ error: 'Notice not found.' });

    await prisma.notice.delete({ where: { id: noticeId } });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'NOTICE_DELETED',
      module: 'NOTICE',
      details: `Deleted notice "${notice.title}"`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Notice deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete notice.' });
  }
});

export default router;
