import { Router, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Get summary metrics for room and bed occupancy
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const totalRooms = await prisma.room.count();
    const totalBeds = await prisma.bed.count();
    const occupiedBeds = await prisma.bed.count({ where: { isOccupied: true } });
    const maintenanceRooms = await prisma.room.count({ where: { status: 'MAINTENANCE' } });
    const maintenanceBeds = await prisma.bed.count({
      where: { room: { status: 'MAINTENANCE' }, isOccupied: false },
    });
    const availableBeds = await prisma.bed.count({
      where: { isOccupied: false, room: { status: { not: 'MAINTENANCE' } } },
    });

    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const blocks = await prisma.hostelBlock.findMany({
      include: {
        rooms: {
          include: {
            beds: true,
          },
        },
      },
    });

    const blockStats = blocks.map((b) => {
      const bBeds = b.rooms.flatMap((r) => r.beds);
      const bOccupied = bBeds.filter((bd) => bd.isOccupied).length;
      const bTotal = bBeds.length;
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        genderAllowed: b.genderAllowed,
        totalRooms: b.rooms.length,
        totalBeds: bTotal,
        occupiedBeds: bOccupied,
        availableBeds: bTotal - bOccupied,
        occupancyPercent: bTotal > 0 ? Math.round((bOccupied / bTotal) * 100) : 0,
      };
    });

    return res.json({
      totalRooms,
      totalBeds,
      occupiedBeds,
      availableBeds,
      maintenanceRooms,
      maintenanceBeds,
      occupancyRate,
      blockStats,
    });
  } catch (error) {
    console.error('Room summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch room occupancy summary.' });
  }
});

// List rooms with beds and occupant details
router.get('/', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { blockId, floor, status, roomType } = req.query;

    const where: any = {};
    if (blockId && blockId !== 'ALL') where.blockId = parseInt(blockId as string);
    if (floor && floor !== 'ALL') where.floor = parseInt(floor as string);
    if (status && status !== 'ALL') where.status = status as string;
    if (roomType && roomType !== 'ALL') where.roomType = roomType as string;

    const rooms = await prisma.room.findMany({
      where,
      orderBy: [{ blockId: 'asc' }, { floor: 'asc' }, { roomNumber: 'asc' }],
      include: {
        block: true,
        beds: {
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: { id: true, name: true, rollNumber: true },
                },
              },
            },
          },
        },
      },
    });

    return res.json(rooms);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// List available beds for allocation
router.get('/available-beds', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { blockId, roomType } = req.query;
    const where: any = {
      isOccupied: false,
      room: {
        status: 'AVAILABLE',
      },
    };

    if (blockId && blockId !== 'ALL') {
      where.room.blockId = parseInt(blockId as string);
    }
    if (roomType && roomType !== 'ALL') {
      where.room.roomType = roomType as string;
    }

    const availableBeds = await prisma.bed.findMany({
      where,
      include: {
        room: {
          include: {
            block: true,
            beds: {
              include: {
                allocations: {
                  where: { status: 'ACTIVE' },
                  include: { student: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ room: { blockId: 'asc' } }, { room: { roomNumber: 'asc' } }, { bedNumber: 'asc' }],
    });

    return res.json(availableBeds);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch available beds.' });
  }
});

// Toggle Maintenance Flag on a Room
router.put('/:id/maintenance', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { beds: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const hasOccupants = room.beds.some((b) => b.isOccupied);
    if (hasOccupants && room.status !== 'MAINTENANCE') {
      return res.status(400).json({
        error: 'Cannot mark room as under maintenance while it still has active occupants. Please reallocate students first.',
      });
    }

    const newStatus = room.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { status: newStatus },
      include: { block: true },
    });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'ROOM_MAINTENANCE_TOGGLED',
      module: 'ROOM',
      details: `Room ${room.roomNumber} status set to ${newStatus}`,
      ipAddress: req.ip,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update maintenance status.' });
  }
});

// Create new room
router.post('/', authenticate, requireRole(['WARDEN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { blockId, floor, roomNumber, capacity, roomType } = req.body;
    if (!blockId || !floor || !roomNumber || !capacity || !roomType) {
      return res.status(400).json({ error: 'All room fields are required.' });
    }

    const existing = await prisma.room.findUnique({ where: { roomNumber } });
    if (existing) {
      return res.status(400).json({ error: `Room ${roomNumber} already exists.` });
    }

    const room = await prisma.room.create({
      data: {
        blockId: parseInt(blockId),
        floor: parseInt(floor),
        roomNumber: roomNumber.trim(),
        capacity: parseInt(capacity),
        roomType,
        status: 'AVAILABLE',
      },
    });

    // Create beds
    for (let b = 1; b <= room.capacity; b++) {
      await prisma.bed.create({
        data: {
          roomId: room.id,
          bedNumber: `Bed ${b}`,
          isOccupied: false,
        },
      });
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'ROOM_CREATED',
      module: 'ROOM',
      details: `Created Room ${room.roomNumber} with capacity ${room.capacity} beds.`,
      ipAddress: req.ip,
    });

    return res.status(201).json(room);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create room.' });
  }
});

export default router;
