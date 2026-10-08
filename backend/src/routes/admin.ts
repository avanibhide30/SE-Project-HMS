import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
const VALID_USER_ROLES = ['STUDENT', 'WARDEN', 'ACCOUNTS', 'SECURITY', 'ADMIN'];

// Admin: System overview metrics
router.get('/system-stats', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const students = await prisma.user.count({ where: { role: 'STUDENT' } });
    const wardens = await prisma.user.count({ where: { role: 'WARDEN' } });
    const accounts = await prisma.user.count({ where: { role: 'ACCOUNTS' } });
    const security = await prisma.user.count({ where: { role: 'SECURITY' } });
    const activeUsers = await prisma.user.count({ where: { isActive: true } });

    const totalRooms = await prisma.room.count();
    const totalBeds = await prisma.bed.count();
    const occupiedBeds = await prisma.bed.count({ where: { isOccupied: true } });
    const totalApplications = await prisma.application.count();
    const pendingOutpasses = await prisma.outpass.count({ where: { status: 'PENDING' } });
    const activeVisitors = await prisma.visitorRequest.count({ where: { status: 'INSIDE' } });

    return res.json({
      users: {
        totalUsers,
        students,
        wardens,
        accounts,
        security,
        activeUsers,
      },
      hostel: {
        totalRooms,
        totalBeds,
        occupiedBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        totalApplications,
        pendingOutpasses,
        activeVisitors,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch admin system stats.' });
  }
});

// Admin: List all users
router.get('/users', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { role, search, status } = req.query;

    const where: any = {};
    if (role && role !== 'ALL') where.role = role as string;
    if (status && status !== 'ALL') where.isActive = status === 'ACTIVE';
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: { room: true, bed: true },
            },
          },
        },
      },
    });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Admin: Create new user
router.post('/users', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role, password, rollNumber, course, year, gender, category, phone, guardianName, guardianPhone } = req.body;
    const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : '';
    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      !VALID_USER_ROLES.includes(normalizedRole) ||
      typeof password !== 'string' || password.length < 6
    ) {
      return res.status(400).json({ error: 'Name, email, valid role, and a password of at least 6 characters are required.' });
    }

    if (normalizedRole === 'STUDENT' && (typeof rollNumber !== 'string' || !rollNumber.trim())) {
      return res.status(400).json({ error: 'A student roll number is required for student accounts.' });
    }

    if (normalizedRole === 'STUDENT') {
      const existingStudent = await prisma.student.findUnique({
        where: { rollNumber: rollNumber.trim() },
      });
      if (existingStudent) {
        return res.status(400).json({ error: 'A student with this roll number already exists.' });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.trim(),
          role: normalizedRole,
          passwordHash,
          isActive: true,
        },
      });

      if (u.role === 'STUDENT') {
        await tx.student.create({
          data: {
            userId: u.id,
            name: u.name,
            rollNumber: rollNumber.trim(),
            email: u.email,
            phone: phone || '+91 99999 99999',
            gender: gender || 'Male',
            category: category || 'General',
            course: course || 'B.Tech',
            year: year ? parseInt(year) : 1,
            guardianName: guardianName || 'Guardian',
            guardianPhone: guardianPhone || '+91 99999 99999',
          },
        });
      }

      return u;
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_CREATED',
      module: 'ADMIN',
      details: `Created user ${newUser.name} with role ${newUser.role}`,
      ipAddress: req.ip,
    });

    return res.status(201).json(newUser);
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Admin: Update user (role, active state)
router.put('/users/:id', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, role, isActive } = req.body;
    const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : undefined;

    if (role !== undefined && (!normalizedRole || !VALID_USER_ROLES.includes(normalizedRole))) {
      return res.status(400).json({ error: 'A valid role is required.' });
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'A non-empty name is required.' });
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Account status must be a boolean.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { student: true } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (normalizedRole === 'STUDENT' && !user.student) {
      return res.status(400).json({ error: 'A student profile is required before assigning the STUDENT role.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name.trim() : user.name,
        role: normalizedRole ?? user.role,
        isActive: isActive ?? user.isActive,
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_UPDATED',
      module: 'ADMIN',
      details: `Updated user ${user.email} (Role: ${updated.role}, Active: ${updated.isActive})`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Admin: Reset password
router.post('/users/:id/reset-password', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'PASSWORD_RESET_ADMIN',
      module: 'ADMIN',
      details: `Admin reset password for user ${user.email}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Admin: Query Audit Logs
router.get('/audit-logs', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { module, action, search } = req.query;

    const where: any = {};
    if (module && module !== 'ALL') where.module = module as string;
    if (action && action !== 'ALL') where.action = action as string;
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { userName: { contains: q } },
        { details: { contains: q } },
        { action: { contains: q } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

export default router;
