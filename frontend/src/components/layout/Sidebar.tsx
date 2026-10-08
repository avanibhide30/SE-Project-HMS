import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Home,
  CreditCard,
  Users,
  Compass,
  Bell,
  Clock,
  CheckSquare,
  BedDouble,
  ShieldAlert,
  BarChart3,
  Receipt,
  QrCode,
  UserCog,
  Settings,
  History,
  DoorOpen,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const role = user?.role || 'STUDENT';

  // Navigation Items per Role
  const navItems = {
    STUDENT: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/application', label: 'Hostel Application', icon: FileText },
      { to: '/room', label: 'Room & Roommates', icon: Home },
      { to: '/fees', label: 'Fees & Receipts', icon: CreditCard },
      { to: '/visitors', label: 'Visitors & OTP', icon: Users },
      { to: '/outpass', label: 'Outpass / Leave', icon: Compass },
      { to: '/notices', label: 'Notice Board', icon: Bell },
      { to: '/curfew', label: 'Curfew Status', icon: Clock },
    ],
    WARDEN: [
      { to: '/warden/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/warden/applications', label: 'Applications', icon: CheckSquare },
      { to: '/warden/rooms', label: 'Rooms & Beds', icon: BedDouble },
      { to: '/warden/outpasses', label: 'Outpass Requests', icon: Compass },
      { to: '/warden/curfew', label: 'Curfew Violations', icon: ShieldAlert },
      { to: '/warden/notices', label: 'Notice Board', icon: Bell },
      { to: '/warden/visitors', label: 'Visitor Logs', icon: Users },
      { to: '/warden/fees', label: 'Fee Ledger', icon: CreditCard },
      { to: '/warden/defaulters', label: 'Defaulters', icon: Receipt },
      { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
    ],
    ACCOUNTS: [
      { to: '/accounts/dashboard', label: 'Accounts Overview', icon: LayoutDashboard },
      { to: '/accounts/fee-heads', label: 'Fee Heads & Dues', icon: Receipt },
      { to: '/accounts/defaulters', label: 'Defaulters & Ledger', icon: CreditCard },
      { to: '/reports', label: 'Financial Reports', icon: BarChart3 },
    ],
    SECURITY: [
      { to: '/security/gate-console', label: 'Gate Console (Tablet)', icon: QrCode },
      { to: '/security/visitors', label: 'Visitor Register', icon: Users },
      { to: '/security/curfew', label: 'Curfew Gate Entries', icon: Clock },
      { to: '/security/outpasses', label: 'Outpass Gate Passes', icon: DoorOpen },
    ],
    ADMIN: [
      { to: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
      { to: '/admin/applications', label: 'Applications', icon: CheckSquare },
      { to: '/admin/rooms', label: 'Rooms & Beds', icon: BedDouble },
      { to: '/admin/notices', label: 'Notice Board', icon: Bell },
      { to: '/accounts/dashboard', label: 'Fee Ledger', icon: CreditCard },
      { to: '/accounts/fee-heads', label: 'Fee Heads', icon: Receipt },
      { to: '/accounts/defaulters', label: 'Defaulters', icon: CreditCard },
      { to: '/admin/users', label: 'User Management', icon: UserCog },
      { to: '/admin/settings', label: 'Hostel & Curfew Rules', icon: Settings },
      { to: '/admin/audit-logs', label: 'Immutable Audit Log', icon: History },
      { to: '/reports', label: 'System Reports', icon: BarChart3 },
    ],
  }[role] || [];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`site-sidebar fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header / Logo */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="sidebar-mark w-8 h-8 rounded-lg text-white flex items-center justify-center font-black text-sm">
              H
            </div>
            <div>
              <span className="text-white font-extrabold tracking-wide text-sm uppercase">
                Hostel Nexus
              </span>
              <span className="block text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
                {role} Portal
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.student?.rollNumber ? `Roll: ${user.student.rollNumber}` : user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
          <p className="font-semibold text-slate-400">Hostel Management v1.0</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Secure Institutional Gateway</p>
        </div>
      </aside>
    </>
  );
};
