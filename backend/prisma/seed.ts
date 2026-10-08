import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Seed data contains demo users and clears tables; it may run only with NODE_ENV=development.');
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Hostel Management System database...');

  // Clean existing tables
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.noticeRead.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.curfewRecord.deleteMany();
  await prisma.curfewConfig.deleteMany();
  await prisma.outpass.deleteMany();
  await prisma.visitorLog.deleteMany();
  await prisma.visitorRequest.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feeHead.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.room.deleteMany();
  await prisma.hostelBlock.deleteMany();
  await prisma.application.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Create Core Staff & Admin Accounts
  const adminUser = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@hostel.edu',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const wardenUser = await prisma.user.create({
    data: {
      name: 'Dr. Rajesh Sharma',
      email: 'warden@hostel.edu',
      passwordHash: defaultPasswordHash,
      role: 'WARDEN',
      isActive: true,
    },
  });

  const accountsUser = await prisma.user.create({
    data: {
      name: 'Sunil Verma',
      email: 'accounts@hostel.edu',
      passwordHash: defaultPasswordHash,
      role: 'ACCOUNTS',
      isActive: true,
    },
  });

  const securityUser = await prisma.user.create({
    data: {
      name: 'Ramesh Kumar (Gate 1)',
      email: 'security@hostel.edu',
      passwordHash: defaultPasswordHash,
      role: 'SECURITY',
      isActive: true,
    },
  });

  // 2. Create Hostel Blocks
  const blockA = await prisma.hostelBlock.create({
    data: {
      name: 'Nilgiri Hostel (Block A)',
      code: 'BLK-A',
      genderAllowed: 'Male',
      totalFloors: 3,
    },
  });

  const blockB = await prisma.hostelBlock.create({
    data: {
      name: 'Sahyadri Hostel (Block B)',
      code: 'BLK-B',
      genderAllowed: 'Female',
      totalFloors: 3,
    },
  });

  const blockC = await prisma.hostelBlock.create({
    data: {
      name: 'Aravali Hostel (Block C)',
      code: 'BLK-C',
      genderAllowed: 'Co-ed',
      totalFloors: 2,
    },
  });

  // 3. Create 60+ Rooms and Beds across Blocks
  const blocks = [blockA, blockB, blockC];
  const allRooms: any[] = [];
  const allBeds: any[] = [];

  for (const block of blocks) {
    const floorsCount = block.totalFloors;
    const roomsPerFloor = block.code === 'BLK-C' ? 8 : 10;

    for (let f = 1; f <= floorsCount; f++) {
      for (let r = 1; r <= roomsPerFloor; r++) {
        const roomNumber = `${block.code.replace('BLK-', '')}-${f}0${r}`;
        const roomType = r % 3 === 0 ? 'Single AC' : r % 2 === 0 ? 'Double Non-AC' : 'Triple Non-AC';
        const capacity = roomType === 'Single AC' ? 1 : roomType === 'Double Non-AC' ? 2 : 3;
        const isMaintenance = (block.code === 'BLK-A' && f === 2 && r === 10) || (block.code === 'BLK-B' && f === 3 && r === 8);

        const room = await prisma.room.create({
          data: {
            blockId: block.id,
            floor: f,
            roomNumber,
            capacity,
            roomType,
            status: isMaintenance ? 'MAINTENANCE' : 'AVAILABLE',
          },
        });
        allRooms.push(room);

        for (let b = 1; b <= capacity; b++) {
          const bed = await prisma.bed.create({
            data: {
              roomId: room.id,
              bedNumber: `Bed ${b}`,
              isOccupied: false,
            },
          });
          allBeds.push({ bed, room, block });
        }
      }
    }
  }

  console.log(`Created ${allRooms.length} rooms and ${allBeds.length} beds.`);

  // 4. Create Fee Heads
  const feeRent = await prisma.feeHead.create({
    data: { name: 'Hostel Room Rent', amount: 45000, term: '2026-27 Semester 1', roomCategory: 'All' },
  });
  const feeMess = await prisma.feeHead.create({
    data: { name: 'Hostel Mess Fee', amount: 28000, term: '2026-27 Semester 1', roomCategory: 'All' },
  });
  const feeSecurity = await prisma.feeHead.create({
    data: { name: 'Security Deposit (Refundable)', amount: 10000, term: '2026-27 Annual', roomCategory: 'All' },
  });
  const feeMaintenance = await prisma.feeHead.create({
    data: { name: 'Amenities & Maintenance Charge', amount: 4500, term: '2026-27 Semester 1', roomCategory: 'All' },
  });

  // 5. Create Primary Student (Avani Bhide)
  const studentUser1 = await prisma.user.create({
    data: {
      name: 'Avani Bhide',
      email: 'student@hostel.edu',
      passwordHash: defaultPasswordHash,
      role: 'STUDENT',
      isActive: true,
    },
  });

  const student1 = await prisma.student.create({
    data: {
      userId: studentUser1.id,
      name: 'Avani Bhide',
      rollNumber: '2024300022',
      email: 'student@hostel.edu',
      phone: '+91 98765 43210',
      gender: 'Female',
      category: 'General',
      course: 'B.Tech Computer Engineering',
      year: 3,
      guardianName: 'Sudhir Bhide',
      guardianPhone: '+91 98200 11223',
      medicalInfo: 'None. No food allergies.',
    },
  });

  // 6. Generate 110+ Realistic Students
  const firstNamesM = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Rohan', 'Kabir', 'Anish', 'Dhruv', 'Siddharth', 'Tanmay', 'Yash', 'Nikhil', 'Dev', 'Manish', 'Harsh', 'Om', 'Tejas', 'Rishi', 'Mayank', 'Karan'];
  const firstNamesF = ['Anusha', 'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Isha', 'Riya', 'Kavya', 'Sneha', 'Tanvi', 'Meera', 'Roshni', 'Pooja', 'Shreya', 'Siddhi', 'Gayatri', 'Neha', 'Sakshi', 'Anjali', 'Akanksha', 'Prachi', 'Nandini', 'Divya', 'Kriti', 'Simran', 'Pallavi', 'Richa', 'Shruti', 'Ira'];
  const lastNames = ['Dalal', 'Patel', 'Deshmukh', 'Kulkarni', 'Joshi', 'Mehta', 'Sharma', 'Verma', 'Gupta', 'Singh', 'Chopra', 'Nair', 'Menon', 'Rao', 'Reddy', 'Iyer', 'Bhat', 'Shetty', 'Pawar', 'More', 'Chavan', 'Jadhav', 'Gaikwad', 'Shinde', 'Patil'];
  const courses = ['B.Tech Computer Engineering', 'B.Tech Electronics & Telecomm', 'B.Tech Information Technology', 'M.Tech Data Science', 'MCA', 'MBA Tech'];
  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];

  const studentEntities: any[] = [student1];

  let bedIndex = 0;

  for (let i = 2; i <= 110; i++) {
    const isMale = i % 2 === 0;
    const fnList = isMale ? firstNamesM : firstNamesF;
    const fName = fnList[(i * 7) % fnList.length];
    const lName = lastNames[(i * 11) % lastNames.length];
    const fullName = `${fName} ${lName}`;
    const roll = i === 22 ? `2024300999` : `20243000${i < 10 ? '0' + i : i}`;
    const sEmail = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}_${Date.now() % 1000}@hostel.edu`;

    const u = await prisma.user.create({
      data: {
        name: fullName,
        email: sEmail,
        passwordHash: defaultPasswordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });

    const s = await prisma.student.create({
      data: {
        userId: u.id,
        name: fullName,
        rollNumber: roll,
        email: sEmail,
        phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
        gender: isMale ? 'Male' : 'Female',
        category: categories[i % categories.length],
        course: courses[i % courses.length],
        year: (i % 4) + 1,
        guardianName: `Guardian of ${fName}`,
        guardianPhone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
        medicalInfo: i % 10 === 0 ? 'Mild Asthma, carrying personal inhaler' : null,
      },
    });

    studentEntities.push(s);
  }

  console.log(`Created ${studentEntities.length} students.`);

  // 7. Seed Allocations for 75 students
  // Allocate primary student Avani Bhide in Sahyadri Block B room B-101 Bed 1
  const b101Room = allRooms.find((r) => r.roomNumber === 'B-101');
  const b101Beds = allBeds.filter((b) => b.room.roomNumber === 'B-101');

  if (b101Room && b101Beds.length > 0) {
    const avaniBed = b101Beds[0].bed;
    await prisma.bed.update({ where: { id: avaniBed.id }, data: { isOccupied: true } });
    // Keep the in-memory inventory in sync with the database. The later
    // allocation pass selects from allBeds before the database is reloaded.
    b101Beds[0].bed.isOccupied = true;

    const app1 = await prisma.application.create({
      data: {
        applicationNumber: 'APP-2026-0001',
        studentId: student1.id,
        status: 'APPROVED',
        roomTypePreference: 'Double Non-AC',
        submittedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        reviewedAt: new Date(Date.now() - 25 * 24 * 3600 * 1000),
      },
    });

    await prisma.allocation.create({
      data: {
        studentId: student1.id,
        roomId: b101Room.id,
        bedId: avaniBed.id,
        applicationId: app1.id,
        status: 'ACTIVE',
        allocatedAt: new Date(Date.now() - 24 * 24 * 3600 * 1000),
      },
    });

    // Also allocate a roommate for Avani in Bed 2 (Anusha Dalal)
    if (b101Beds.length > 1) {
      const roommateBed = b101Beds[1].bed;
      const roommateStudent = studentEntities[1]; // student #2
      await prisma.bed.update({ where: { id: roommateBed.id }, data: { isOccupied: true } });
      b101Beds[1].bed.isOccupied = true;
      const rApp = await prisma.application.create({
        data: {
          applicationNumber: 'APP-2026-0002',
          studentId: roommateStudent.id,
          status: 'APPROVED',
          roomTypePreference: 'Double Non-AC',
          submittedAt: new Date(Date.now() - 29 * 24 * 3600 * 1000),
          reviewedAt: new Date(Date.now() - 24 * 24 * 3600 * 1000),
        },
      });
      await prisma.allocation.create({
        data: {
          studentId: roommateStudent.id,
          roomId: b101Room.id,
          bedId: roommateBed.id,
          applicationId: rApp.id,
          status: 'ACTIVE',
        },
      });
    }
  }

  // Allocate ~70 more students to beds matching their gender/block
  let allocCount = 2;
  let appSeq = 3;
  for (let sIdx = 2; sIdx < studentEntities.length; sIdx++) {
    const student = studentEntities[sIdx];
    const targetBlockCode = student.gender === 'Male' ? 'BLK-A' : 'BLK-B';

    if (allocCount < 75) {
      // Find an available bed in the right block
      const candidate = allBeds.find(
        (b) => b.block.code === targetBlockCode && !b.bed.isOccupied && b.room.status === 'AVAILABLE'
      );

      if (candidate) {
        candidate.bed.isOccupied = true;
        await prisma.bed.update({ where: { id: candidate.bed.id }, data: { isOccupied: true } });

        const app = await prisma.application.create({
          data: {
            applicationNumber: `APP-2026-${String(appSeq++).padStart(4, '0')}`,
            studentId: student.id,
            status: 'APPROVED',
            roomTypePreference: candidate.room.roomType,
            submittedAt: new Date(Date.now() - (20 + (sIdx % 10)) * 24 * 3600 * 1000),
            reviewedAt: new Date(Date.now() - (15 + (sIdx % 5)) * 24 * 3600 * 1000),
          },
        });

        await prisma.allocation.create({
          data: {
            studentId: student.id,
            roomId: candidate.room.id,
            bedId: candidate.bed.id,
            applicationId: app.id,
            status: 'ACTIVE',
            allocatedAt: new Date(Date.now() - (14 + (sIdx % 5)) * 24 * 3600 * 1000),
          },
        });
        allocCount++;
      }
    } else if (allocCount < 90) {
      // Create applications in SUBMITTED state (pending Warden review)
      await prisma.application.create({
        data: {
          applicationNumber: `APP-2026-${String(appSeq++).padStart(4, '0')}`,
          studentId: student.id,
          status: 'SUBMITTED',
          roomTypePreference: sIdx % 2 === 0 ? 'Single AC' : 'Double Non-AC',
          submittedAt: new Date(Date.now() - (sIdx % 7) * 24 * 3600 * 1000),
        },
      });
      allocCount++;
    } else if (allocCount < 98) {
      // Create applications in UNDER_REVIEW state
      await prisma.application.create({
        data: {
          applicationNumber: `APP-2026-${String(appSeq++).padStart(4, '0')}`,
          studentId: student.id,
          status: 'UNDER_REVIEW',
          roomTypePreference: 'Triple Non-AC',
          submittedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
        },
      });
      allocCount++;
    } else if (allocCount < 105) {
      // Create applications in REJECTED state with mandatory reason
      await prisma.application.create({
        data: {
          applicationNumber: `APP-2026-${String(appSeq++).padStart(4, '0')}`,
          studentId: student.id,
          status: 'REJECTED',
          roomTypePreference: 'Single AC',
          rejectionReason: 'Hostel preference quota exceeded for course. Please re-apply under Double Non-AC.',
          submittedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
          reviewedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
        },
      });
      allocCount++;
    }
  }

  // Update room occupancy status based on occupied beds
  for (const r of allRooms) {
    const beds = await prisma.bed.findMany({ where: { roomId: r.id } });
    const allOccupied = beds.every((b) => b.isOccupied);
    if (r.status !== 'MAINTENANCE') {
      if (allOccupied && beds.length > 0) {
        await prisma.room.update({ where: { id: r.id }, data: { status: 'OCCUPIED' } });
      }
    }
  }

  // 8. Seed Fees and Payments
  // Avani Bhide: Paid Room Rent, Paid Mess Fee, Pending Maintenance
  await prisma.payment.create({
    data: {
      studentId: student1.id,
      feeHeadId: feeRent.id,
      amount: feeRent.amount,
      status: 'PAID',
      transactionId: 'TXN-20260901-8841',
      receiptNumber: 'RCP-2026-0012',
      paymentMethod: 'UPI',
      dueDate: new Date('2026-09-15'),
      paidAt: new Date('2026-09-05T14:32:00Z'),
    },
  });

  await prisma.payment.create({
    data: {
      studentId: student1.id,
      feeHeadId: feeMess.id,
      amount: feeMess.amount,
      status: 'PAID',
      transactionId: 'TXN-20260902-9112',
      receiptNumber: 'RCP-2026-0015',
      paymentMethod: 'Card',
      dueDate: new Date('2026-09-20'),
      paidAt: new Date('2026-09-10T10:15:00Z'),
    },
  });

  await prisma.payment.create({
    data: {
      studentId: student1.id,
      feeHeadId: feeMaintenance.id,
      amount: feeMaintenance.amount,
      status: 'PENDING',
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // Seed payments across allocated students
  for (let i = 1; i < 50; i++) {
    const s = studentEntities[i];
    const isPaid = i % 3 !== 0;
    const isOverdue = i % 5 === 0;

    await prisma.payment.create({
      data: {
        studentId: s.id,
        feeHeadId: feeRent.id,
        amount: feeRent.amount,
        status: isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING',
        transactionId: isPaid ? `TXN-202609-${1000 + i}` : null,
        receiptNumber: isPaid ? `RCP-2026-${1000 + i}` : null,
        paymentMethod: isPaid ? (i % 2 === 0 ? 'UPI' : 'Net Banking') : null,
        dueDate: isOverdue ? new Date(Date.now() - 15 * 24 * 3600 * 1000) : new Date(Date.now() + 10 * 24 * 3600 * 1000),
        paidAt: isPaid ? new Date(Date.now() - (20 - (i % 15)) * 24 * 3600 * 1000) : null,
      },
    });

    await prisma.payment.create({
      data: {
        studentId: s.id,
        feeHeadId: feeMess.id,
        amount: feeMess.amount,
        status: isPaid ? 'PAID' : 'PENDING',
        transactionId: isPaid ? `TXN-202609-${2000 + i}` : null,
        receiptNumber: isPaid ? `RCP-2026-${2000 + i}` : null,
        paymentMethod: isPaid ? 'UPI' : null,
        dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        paidAt: isPaid ? new Date(Date.now() - (15 - (i % 10)) * 24 * 3600 * 1000) : null,
      },
    });
  }

  // 9. Curfew Configuration & Records
  await prisma.curfewConfig.create({
    data: {
      weekdayCurfew: '21:30',
      weekendCurfew: '22:30',
      specialCurfew: '23:00',
      permittedVisitorUntil: '20:00',
      isActive: true,
    },
  });

  // Curfew records for Avani and others
  await prisma.curfewRecord.create({
    data: {
      studentId: student1.id,
      entryTime: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 20 * 3600 * 1000), // 8:00 PM
      curfewTime: '21:30',
      delayMinutes: 0,
      flaggedLate: false,
      isWaived: false,
      recordedBy: 'Ramesh Kumar (Security)',
    },
  });

  // A late entry for student 3
  await prisma.curfewRecord.create({
    data: {
      studentId: studentEntities[3].id,
      entryTime: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 22 * 3600 * 1000 + 15 * 60 * 1000), // 10:15 PM (45 min late)
      curfewTime: '21:30',
      delayMinutes: 45,
      flaggedLate: true,
      isWaived: false,
      recordedBy: 'Ramesh Kumar (Security)',
    },
  });

  // A late entry that was waived by approved Outpass
  await prisma.curfewRecord.create({
    data: {
      studentId: studentEntities[4].id,
      entryTime: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 22 * 3600 * 1000 + 40 * 60 * 1000),
      curfewTime: '21:30',
      delayMinutes: 70,
      flaggedLate: false,
      isWaived: true,
      waiveReason: 'Covered by approved Outpass #OP-2026-0044 (Academic Project Work)',
      recordedBy: 'Ramesh Kumar (Security)',
    },
  });

  // 10. Visitor Requests & Logs
  // Visitor 1 for Avani: inside right now
  const vr1 = await prisma.visitorRequest.create({
    data: {
      studentId: student1.id,
      visitorName: 'Sudhir Bhide (Father)',
      visitorContact: '+91 98200 11223',
      relationship: 'Parent',
      purpose: 'Delivering semester study material & clothing',
      visitDate: new Date().toISOString().split('T')[0],
      expectedTime: '15:30',
      otp: '749215',
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      otpAttempts: 0,
      status: 'INSIDE',
    },
  });

  await prisma.visitorLog.create({
    data: {
      visitorRequestId: vr1.id,
      entryTime: new Date(Date.now() - 45 * 60 * 1000),
      status: 'INSIDE',
      verifiedBy: 'Ramesh Kumar (Security)',
    },
  });

  // Visitor 2 for Avani: pending with live OTP for testing!
  await prisma.visitorRequest.create({
    data: {
      studentId: student1.id,
      visitorName: 'Neha Bhide (Sister)',
      visitorContact: '+91 98200 99887',
      relationship: 'Sibling',
      purpose: 'Family visit during weekend',
      visitDate: new Date().toISOString().split('T')[0],
      expectedTime: '17:00',
      otp: '482910',
      otpExpiry: new Date(Date.now() + 9 * 60 * 1000),
      otpAttempts: 0,
      status: 'OTP_GENERATED',
    },
  });

  // An overstayed visitor for student 5 to demonstrate security alert!
  const vrOverstay = await prisma.visitorRequest.create({
    data: {
      studentId: studentEntities[5].id,
      visitorName: 'Amit Shah (Friend)',
      visitorContact: '+91 98111 22334',
      relationship: 'Friend',
      purpose: 'Project group discussion',
      visitDate: new Date().toISOString().split('T')[0],
      expectedTime: '14:00',
      otp: '193847',
      status: 'OVERSTAY',
    },
  });

  await prisma.visitorLog.create({
    data: {
      visitorRequestId: vrOverstay.id,
      entryTime: new Date(Date.now() - 5 * 3600 * 1000), // 5 hours ago!
      status: 'OVERSTAY',
      verifiedBy: 'Ramesh Kumar (Security)',
    },
  });

  // 11. Outpasses
  // Avani's past completed outpass
  await prisma.outpass.create({
    data: {
      outpassNumber: 'OP-2026-0021',
      studentId: student1.id,
      type: 'OUTPASS',
      reason: 'Visit to local market & book depot',
      destination: 'Andheri West Market',
      modeOfTravel: 'Metro',
      departureTime: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 16 * 3600 * 1000),
      expectedReturnTime: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 20 * 3600 * 1000),
      actualExitTime: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 16 * 3600 * 1000 + 5 * 60 * 1000),
      actualReturnTime: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 19 * 3600 * 1000 + 40 * 60 * 1000),
      status: 'RETURNED',
    },
  });

  // Avani's active approved outpass for today!
  await prisma.outpass.create({
    data: {
      outpassNumber: 'OP-2026-0042',
      studentId: student1.id,
      type: 'OUTPASS',
      reason: 'Library Research & Department Seminar',
      destination: 'Central University Library',
      modeOfTravel: 'Walking',
      departureTime: new Date(Date.now() - 2 * 3600 * 1000),
      expectedReturnTime: new Date(Date.now() + 3 * 3600 * 1000),
      actualExitTime: new Date(Date.now() - 1 * 3600 * 1000),
      status: 'ACTIVE',
    },
  });

  // Other outpasses: Pending for warden review, Overdue outpass
  await prisma.outpass.create({
    data: {
      outpassNumber: 'OP-2026-0089',
      studentId: studentEntities[6].id,
      type: 'LEAVE',
      reason: 'Attending elder sister wedding ceremony',
      destination: 'Pune, Maharashtra',
      modeOfTravel: 'Intercity Express Train',
      departureTime: new Date(Date.now() + 24 * 3600 * 1000),
      expectedReturnTime: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      status: 'PENDING',
    },
  });

  await prisma.outpass.create({
    data: {
      outpassNumber: 'OP-2026-0077',
      studentId: studentEntities[7].id,
      type: 'OUTPASS',
      reason: 'Dentist appointment',
      destination: 'City Dental Clinic',
      modeOfTravel: 'Cab',
      departureTime: new Date(Date.now() - 6 * 3600 * 1000),
      expectedReturnTime: new Date(Date.now() - 2 * 3600 * 1000), // expected back 2 hours ago!
      actualExitTime: new Date(Date.now() - 6 * 3600 * 1000),
      status: 'OVERDUE',
    },
  });

  // 12. Notices
  const nUrgent = await prisma.notice.create({
    data: {
      title: '🚨 Mandatory Biometric Verification & Fire Drill This Friday',
      body: 'All residents of Nilgiri (Block A) and Sahyadri (Block B) are required to be present on ground floor quads at 17:00 hrs for the mandatory semester fire drill and verification. Attendance is compulsory.',
      category: 'URGENT',
      target: 'ALL',
      isUrgent: true,
      authorId: wardenUser.id,
      publishedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 5 * 24 * 3600 * 1000),
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Revised Dining Mess Menu for Autumn Semester 2026',
      body: 'Based on feedback from the Student Mess Committee, weekend dinner and breakfast timings have been extended by 30 minutes. Special nutritional breakfast options have been added on Tuesday and Thursday.',
      category: 'GENERAL',
      target: 'ALL',
      isUrgent: false,
      authorId: wardenUser.id,
      publishedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Scheduled Water Tank Cleaning & Maintenance - Block A',
      body: 'Water supply to Nilgiri Hostel (Block A) 2nd and 3rd floors will remain suspended between 10:00 AM and 02:00 PM tomorrow due to high-pressure overhead tank descaling and disinfection.',
      category: 'MAINTENANCE',
      target: 'BLK-A',
      isUrgent: false,
      authorId: wardenUser.id,
      publishedAt: new Date(Date.now() - 12 * 3600 * 1000),
    },
  });

  // 13. Notifications
  await prisma.notification.create({
    data: {
      userId: studentUser1.id,
      title: 'Room Allotted Successfully',
      message: 'You have been allocated Room B-101 (Bed 1) in Sahyadri Hostel (Block B).',
      type: 'ALLOCATION',
      isRead: true,
    },
  });

  await prisma.notification.create({
    data: {
      userId: studentUser1.id,
      title: 'Fee Payment Received',
      message: 'Your payment of ₹45,000 for Hostel Room Rent has been confirmed (Receipt #RCP-2026-0012).',
      type: 'PAYMENT',
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: studentUser1.id,
      title: 'Outpass Approved',
      message: 'Your outpass request OP-2026-0042 has been approved by Warden Dr. Rajesh Sharma.',
      type: 'OUTPASS',
      isRead: false,
    },
  });

  // 14. Initial Audit Logs
  await prisma.auditLog.create({
    data: {
      userId: wardenUser.id,
      userName: wardenUser.name,
      userRole: wardenUser.role,
      action: 'SYSTEM_INITIALIZATION',
      module: 'ADMIN',
      details: 'Hostel Management System academic session 2026-27 initialized with 64 rooms, 4 fee heads, and curfew rules.',
      ipAddress: '127.0.0.1',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: wardenUser.id,
      userName: wardenUser.name,
      userRole: wardenUser.role,
      action: 'APPLICATION_APPROVED',
      module: 'APPLICATION',
      details: 'Approved hostel application APP-2026-0001 for student Avani Bhide (Roll: 2024300022).',
      ipAddress: '192.168.1.10',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: wardenUser.id,
      userName: wardenUser.name,
      userRole: wardenUser.role,
      action: 'ROOM_ALLOCATED',
      module: 'ROOM',
      details: 'Allocated Room B-101 Bed 1 to student Avani Bhide.',
      ipAddress: '192.168.1.10',
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
