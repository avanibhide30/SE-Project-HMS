import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Student: View own room & roommate details
router.get('/my', authenticate, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'Student record not found.' });
    }

    const allocation = await prisma.allocation.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: {
        room: {
          include: {
            block: true,
            beds: {
              include: {
                allocations: {
                  where: { status: 'ACTIVE' },
                  include: {
                    student: true,
                  },
                },
              },
            },
          },
        },
        bed: true,
      },
    });

    if (!allocation) {
      return res.json({ allocated: false, message: 'No active room allocation found.' });
    }

    // Extract roommates (other students in same room)
    const roommates = allocation.room.beds
      .flatMap((b) => b.allocations)
      .filter((a) => a.studentId !== studentId)
      .map((a) => ({
        name: a.student.name,
        rollNumber: a.student.rollNumber,
        course: a.student.course,
        year: a.student.year,
        bedNumber: allocation.room.beds.find((b) => b.id === a.bedId)?.bedNumber,
      }));

    return res.json({
      allocated: true,
      allocationId: allocation.id,
      blockName: allocation.room.block.name,
      blockCode: allocation.room.block.code,
      floor: allocation.room.floor,
      roomNumber: allocation.room.roomNumber,
      roomType: allocation.room.roomType,
      capacity: allocation.room.capacity,
      bedNumber: allocation.bed.bedNumber,
      allocatedAt: allocation.allocatedAt,
      roommates,
      totalOccupants: roommates.length + 1,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch allocation details.' });
  }
});

// Warden: Get list of approved students eligible for room allocation
router.get('/eligible-students', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    // Approved students without an active allocation
    const approvedApps = await prisma.application.findMany({
      where: {
        status: 'APPROVED',
        student: {
          allocations: {
            none: { status: 'ACTIVE' },
          },
        },
      },
      include: {
        student: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    return res.json(approvedApps);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch eligible students.' });
  }
});

// Warden: Allocate Room and Bed to an approved student
router.post('/', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, roomId, bedId, applicationId } = req.body;
    if (!studentId || !roomId || !bedId) {
      return res.status(400).json({ error: 'studentId, roomId, and bedId are required.' });
    }

    // 1. Check if student already has active allocation
    const existingAlloc = await prisma.allocation.findFirst({
      where: { studentId: parseInt(studentId), status: 'ACTIVE' },
    });
    if (existingAlloc) {
      return res.status(400).json({ error: 'Student already has an active room allocation.' });
    }

    // 2. Check room & maintenance status
    const room = await prisma.room.findUnique({
      where: { id: parseInt(roomId) },
      include: { block: true, beds: true },
    });
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    if (room.status === 'MAINTENANCE') {
      return res.status(400).json({ error: 'Cannot allocate beds in a room currently under maintenance.' });
    }

    // 3. Check bed occupancy
    const bed = await prisma.bed.findUnique({ where: { id: parseInt(bedId) } });
    if (!bed || bed.roomId !== room.id) {
      return res.status(404).json({ error: 'Selected bed does not belong to this room.' });
    }
    if (bed.isOccupied) {
      return res.status(400).json({ error: 'This bed is already occupied by another student.' });
    }

    // 4. Perform atomic allocation
    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const newAlloc = await prisma.$transaction(async (tx) => {
      // Mark bed occupied
      await tx.bed.update({
        where: { id: bed.id },
        data: { isOccupied: true },
      });

      // Create allocation record
      const alloc = await tx.allocation.create({
        data: {
          studentId: student.id,
          roomId: room.id,
          bedId: bed.id,
          applicationId: applicationId ? parseInt(applicationId) : null,
          status: 'ACTIVE',
        },
      });

      // Check if room is now fully occupied
      const allBeds = await tx.bed.findMany({ where: { roomId: room.id } });
      if (allBeds.every((b) => b.isOccupied)) {
        await tx.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED' } });
      }

      return alloc;
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: student.userId,
        title: 'Room Allotted Successfully! 🏠',
        message: `You have been allocated Room ${room.roomNumber} (${bed.bedNumber}) in ${room.block.name}.`,
        type: 'ALLOCATION',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'ROOM_ALLOCATED',
      module: 'ROOM',
      details: `Allocated Room ${room.roomNumber} ${bed.bedNumber} to student ${student.name} (${student.rollNumber}).`,
      ipAddress: req.ip,
    });

    return res.status(201).json(newAlloc);
  } catch (error: any) {
    console.error('Allocation error:', error);
    return res.status(500).json({ error: 'Failed to create room allocation.' });
  }
});

// Warden: Reallocate student to another room/bed
router.post('/reallocate', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, newRoomId, newBedId, reason } = req.body;
    if (!studentId || !newRoomId || !newBedId) {
      return res.status(400).json({ error: 'studentId, newRoomId, and newBedId are required.' });
    }

    const currentAlloc = await prisma.allocation.findFirst({
      where: { studentId: parseInt(studentId), status: 'ACTIVE' },
      include: { room: true, bed: true },
    });

    if (!currentAlloc) {
      return res.status(400).json({ error: 'Student does not have an active allocation to reallocate from.' });
    }

    const newRoom = await prisma.room.findUnique({
      where: { id: parseInt(newRoomId) },
      include: { block: true },
    });
    if (!newRoom || newRoom.status === 'MAINTENANCE') {
      return res.status(400).json({ error: 'Target room not available or under maintenance.' });
    }

    const newBed = await prisma.bed.findUnique({ where: { id: parseInt(newBedId) } });
    if (!newBed || newBed.isOccupied) {
      return res.status(400).json({ error: 'Target bed is occupied or invalid.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    await prisma.$transaction(async (tx) => {
      // 1. Vacate current bed & allocation
      await tx.bed.update({ where: { id: currentAlloc.bedId }, data: { isOccupied: false } });
      await tx.room.update({ where: { id: currentAlloc.roomId }, data: { status: 'AVAILABLE' } });
      await tx.allocation.update({
        where: { id: currentAlloc.id },
        data: { status: 'REALLOCATED', vacatedAt: new Date() },
      });

      // 2. Occupy new bed & create new allocation
      await tx.bed.update({ where: { id: newBed.id }, data: { isOccupied: true } });
      await tx.allocation.create({
        data: {
          studentId: student.id,
          roomId: newRoom.id,
          bedId: newBed.id,
          status: 'ACTIVE',
        },
      });

      // Check if new room full
      const targetBeds = await tx.bed.findMany({ where: { roomId: newRoom.id } });
      if (targetBeds.every((b) => b.isOccupied)) {
        await tx.room.update({ where: { id: newRoom.id }, data: { status: 'OCCUPIED' } });
      }
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: student.userId,
        title: 'Room Reallocation Notice',
        message: `Your room has been reallocated to Room ${newRoom.roomNumber} (${newBed.bedNumber}) in ${newRoom.block.name}. ${reason ? 'Reason: ' + reason : ''}`,
        type: 'ALLOCATION',
      },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'ROOM_REALLOCATED',
      module: 'ROOM',
      details: `Reallocated student ${student.name} from Room ${currentAlloc.room.roomNumber} to Room ${newRoom.roomNumber} (${newBed.bedNumber}).`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Reallocation successful.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reallocate student.' });
  }
});

// Warden: Vacate bed
router.post('/:id/vacate', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const allocId = parseInt(req.params.id);
    const alloc = await prisma.allocation.findUnique({
      where: { id: allocId },
      include: { room: true, bed: true, student: true },
    });

    if (!alloc || alloc.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Active allocation not found.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bed.update({ where: { id: alloc.bedId }, data: { isOccupied: false } });
      await tx.room.update({ where: { id: alloc.roomId }, data: { status: 'AVAILABLE' } });
      await tx.allocation.update({
        where: { id: alloc.id },
        data: { status: 'VACATED', vacatedAt: new Date() },
      });
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'BED_VACATED',
      module: 'ROOM',
      details: `Vacated Room ${alloc.room.roomNumber} ${alloc.bed.bedNumber} for student ${alloc.student.name}`,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Bed successfully vacated.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to vacate bed.' });
  }
});

export default router;
