import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { AuthRequest, authenticate } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import { isDevelopment, JWT_SECRET } from '../config';

const router = Router();

// Login with institutional email or roll number
router.post('/login', async (req, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide email/roll number and password.' });
    }

    // Try finding by email or by student roll number
    let user = await prisma.user.findUnique({
      where: { email: identifier.trim() },
      include: { student: true },
    });

    if (!user) {
      const studentByRoll = await prisma.student.findUnique({
        where: { rollNumber: identifier.trim() },
        include: { user: true },
      });
      if (studentByRoll) {
        user = {
          ...studentByRoll.user,
          student: studentByRoll,
        };
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid institutional credentials.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact Hostel Administration.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      module: 'AUTH',
      details: `User logged in from IP ${req.ip || '127.0.0.1'}`,
      ipAddress: req.ip,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student: user.student,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Quick demo login for evaluation
router.post('/demo-login', async (req, res: Response) => {
  try {
    if (!isDevelopment) {
      return res.status(404).json({ error: 'Demo login is available only in development.' });
    }

    const { role } = req.body; // STUDENT, WARDEN, ACCOUNTS, SECURITY, ADMIN
    if (!role) {
      return res.status(400).json({ error: 'Role is required for demo login.' });
    }

    const user = await prisma.user.findFirst({
      where: { role: role.toUpperCase(), isActive: true },
      include: { student: true },
    });

    if (!user) {
      return res.status(404).json({ error: `No active seeded user found for role ${role}.` });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'DEMO_LOGIN',
      module: 'AUTH',
      details: `Fast demo sign-in as ${user.role} (${user.name})`,
      ipAddress: req.ip,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student: user.student,
      },
    });
  } catch (error: any) {
    console.error('Demo login error:', error);
    return res.status(500).json({ error: 'Internal server error during demo login.' });
  }
});

// Get current profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
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

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      student: user.student,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'PASSWORD_CHANGE',
      module: 'AUTH',
      details: 'Password was updated successfully.',
      ipAddress: req.ip,
    });

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

export default router;
