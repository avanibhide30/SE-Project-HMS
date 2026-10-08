export type UserRole = 'STUDENT' | 'WARDEN' | 'ACCOUNTS' | 'SECURITY' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  student?: Student | null;
}

export interface Student {
  id: number;
  userId: number;
  name: string;
  rollNumber: string;
  email: string;
  phone: string;
  gender: string;
  category: string;
  course: string;
  year: number;
  guardianName: string;
  guardianPhone: string;
  medicalInfo?: string | null;
  allocations?: Allocation[];
}

export interface HostelBlock {
  id: number;
  name: string;
  code: string;
  genderAllowed: string;
  totalFloors: number;
  rooms?: Room[];
}

export interface Room {
  id: number;
  blockId: number;
  block?: HostelBlock;
  floor: number;
  roomNumber: string;
  capacity: number;
  roomType: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  beds?: Bed[];
}

export interface Bed {
  id: number;
  roomId: number;
  room?: Room;
  bedNumber: string;
  isOccupied: boolean;
  allocations?: Allocation[];
}

export interface Application {
  id: number;
  applicationNumber: string;
  studentId: number;
  student: Student;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  roomTypePreference: string;
  supportingDoc?: string | null;
  rejectionReason?: string | null;
  academicTerm: string;
  submittedAt: string;
  reviewedAt?: string | null;
  allocation?: Allocation;
}

export interface Allocation {
  id: number;
  studentId: number;
  student: Student;
  roomId: number;
  room: Room;
  bedId: number;
  bed: Bed;
  applicationId?: number | null;
  status: 'ACTIVE' | 'REALLOCATED' | 'VACATED';
  allocatedAt: string;
  vacatedAt?: string | null;
}

export interface FeeHead {
  id: number;
  name: string;
  amount: number;
  term: string;
  roomCategory: string;
  _count?: { payments: number };
}

export interface Payment {
  id: number;
  studentId: number;
  student?: Student;
  feeHeadId: number;
  feeHead: FeeHead;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'FAILED';
  transactionId?: string | null;
  receiptNumber?: string | null;
  paymentMethod?: string | null;
  dueDate: string;
  paidAt?: string | null;
  failureReason?: string | null;
}

export interface VisitorRequest {
  id: number;
  studentId: number;
  student: Student;
  visitorName: string;
  visitorContact: string;
  relationship: string;
  purpose: string;
  visitDate: string;
  expectedTime: string;
  otp?: string | null;
  otpExpiry?: string | null;
  otpAttempts: number;
  isLockedUntil?: string | null;
  status: 'PENDING' | 'OTP_GENERATED' | 'ALLOWED' | 'INSIDE' | 'COMPLETED' | 'DENIED' | 'EXPIRED' | 'OVERSTAY';
  createdAt: string;
  visitorLog?: VisitorLog | null;
  isOverstay?: boolean;
}

export interface VisitorLog {
  id: number;
  visitorRequestId: number;
  entryTime: string;
  exitTime?: string | null;
  status: 'INSIDE' | 'COMPLETED' | 'OVERSTAY';
  verifiedBy?: string | null;
}

export interface CurfewConfig {
  id: number;
  weekdayCurfew: string;
  weekendCurfew: string;
  specialCurfew: string;
  permittedVisitorUntil: string;
  isActive: boolean;
}

export interface CurfewRecord {
  id: number;
  studentId: number;
  student: Student;
  entryTime: string;
  curfewTime: string;
  delayMinutes: number;
  flaggedLate: boolean;
  isWaived: boolean;
  waiveReason?: string | null;
  recordedBy?: string | null;
}

export interface Outpass {
  id: number;
  outpassNumber: string;
  studentId: number;
  student: Student;
  type: 'OUTPASS' | 'LEAVE';
  reason: string;
  destination: string;
  modeOfTravel?: string | null;
  departureTime: string;
  expectedReturnTime: string;
  actualExitTime?: string | null;
  actualReturnTime?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  rejectionReason?: string | null;
  createdAt: string;
}

export interface Notice {
  id: number;
  title: string;
  body: string;
  category: 'GENERAL' | 'URGENT' | 'EVENT' | 'MAINTENANCE';
  target: string;
  isUrgent: boolean;
  attachmentUrl?: string | null;
  author: { name: string; role: string };
  publishedAt: string;
  expiresAt?: string | null;
  isRead?: boolean;
}

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: number;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  module: string;
  details: string;
  ipAddress?: string | null;
  createdAt: string;
}
