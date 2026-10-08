import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  FileText,
  Home,
  CreditCard,
  Compass,
  Users,
  Clock,
  ArrowRight,
  Bell,
  AlertTriangle,
  Calendar,
  CheckCircle,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [appData, setAppData] = useState<any>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [feesData, setFeesData] = useState<any>(null);
  const [outpassData, setOutpassData] = useState<any>(null);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [curfewSummary, setCurfewSummary] = useState<any>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [appRes, roomRes, feeRes, outRes, visRes, notRes, curRes] = await Promise.all([
          api.get('/applications/my').catch(() => { setLoadError(true); return null; }),
          api.get('/allocations/my').catch(() => { setLoadError(true); return null; }),
          api.get('/fees/my').catch(() => { setLoadError(true); return null; }),
          api.get('/outpasses/my').catch(() => { setLoadError(true); return null; }),
          api.get('/visitors/my').catch(() => { setLoadError(true); return []; }),
          api.get('/notices').catch(() => { setLoadError(true); return []; }),
          api.get('/curfew/my').catch(() => { setLoadError(true); return null; }),
        ]);

        setAppData(appRes);
        setRoomData(roomRes);
        setFeesData(feeRes);
        setOutpassData(outRes);
        setVisitors(Array.isArray(visRes) ? visRes : []);
        setNotices(Array.isArray(notRes) ? notRes : []);
        setCurfewSummary(curRes);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading student dashboard...</p>
        </div>
      </div>
    );
  }

  const appStatus = appData?.status || 'NOT_SUBMITTED';
  const roomAllocated = roomData?.allocated;
  const pendingFeeTotal = feesData?.summary?.amountPending || 0;
  const activeOutpass = outpassData?.activePass;
  const activeVisitorsCount = visitors.filter((v) => v.status === 'INSIDE').length;
  const urgentNotices = notices.filter((n) => n.isUrgent);

  return (
    <div className="dashboard-page space-y-6">
      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span>Some dashboard information could not be loaded.</span>
          <button type="button" onClick={() => window.location.reload()} className="font-bold underline">Retry</button>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="welcome-panel rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="welcome-kicker inline-block px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-3">
            Academic Session 2026-27
          </span>
          <h1 className="welcome-title text-3xl sm:text-4xl">
            Welcome back, {user?.name}!
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Roll: <span className="text-white font-semibold">{user?.student?.rollNumber}</span> •{' '}
            {user?.student?.course} (Year {user?.student?.year}) •{' '}
            {roomAllocated ? `Room ${roomData?.roomNumber} (${roomData?.bedNumber}) in ${roomData?.blockName}` : 'No Room Allocated'}
          </p>
        </div>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Application"
          value={appStatus === 'NOT_SUBMITTED' ? 'None' : appStatus.replace('_', ' ')}
          subtitle={appData?.applicationNumber || 'Click to apply'}
          icon={FileText}
          color={appStatus === 'APPROVED' ? 'emerald' : appStatus === 'REJECTED' ? 'rose' : 'amber'}
          onClick={() => navigate('/application')}
        />

        <StatCard
          title="Room / Bed"
          value={roomAllocated ? roomData.roomNumber : 'Unassigned'}
          subtitle={roomAllocated ? `${roomData.bedNumber} • ${roomData.blockCode}` : 'Awaiting allocation'}
          icon={Home}
          color={roomAllocated ? 'blue' : 'slate'}
          onClick={() => navigate('/room')}
        />

        <StatCard
          title="Fee Dues"
          value={`₹${pendingFeeTotal.toLocaleString()}`}
          subtitle={feesData?.summary?.nextDueDate ? `Due ${new Date(feesData.summary.nextDueDate).toLocaleDateString()}` : 'No dues'}
          icon={CreditCard}
          color={pendingFeeTotal > 0 ? 'rose' : 'emerald'}
          onClick={() => navigate('/fees')}
        />

        <StatCard
          title="Active Pass"
          value={activeOutpass ? activeOutpass.type : 'None'}
          subtitle={activeOutpass ? `Status: ${activeOutpass.status}` : 'Request outpass'}
          icon={Compass}
          color={activeOutpass ? 'indigo' : 'slate'}
          onClick={() => navigate('/outpass')}
        />

        <StatCard
          title="Visitors"
          value={activeVisitorsCount}
          subtitle={`${visitors.length} total logged`}
          icon={Users}
          color={activeVisitorsCount > 0 ? 'amber' : 'slate'}
          onClick={() => navigate('/visitors')}
        />

        <StatCard
          title="Curfew"
          value={curfewSummary?.summary?.totalViolations > 0 ? `${curfewSummary.summary.totalViolations} Late` : 'Clear'}
          subtitle="Gate closes 21:30"
          icon={Clock}
          color={curfewSummary?.summary?.totalViolations > 0 ? 'rose' : 'emerald'}
          onClick={() => navigate('/curfew')}
        />
      </div>

      {/* Urgent Announcements Banner (if any) */}
      {urgentNotices.length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-600 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-rose-900">{urgentNotices[0].title}</h4>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">{urgentNotices[0].body}</p>
            </div>
            <button
              onClick={() => navigate('/notices')}
              className="text-xs font-bold text-rose-800 hover:underline flex-shrink-0"
            >
              View All
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Hostel Application Tracking */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Hostel Application</h3>
              </div>
              {appData && <StatusBadge status={appData.status} />}
            </div>

            {appData ? (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Application Number:</span>
                  <span className="font-bold text-slate-800">{appData.applicationNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Submission Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(appData.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Room Preference:</span>
                  <span className="font-semibold text-slate-800">{appData.roomTypePreference}</span>
                </div>

                {appData.rejectionReason && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <p className="font-bold text-xs">Reason for Rejection:</p>
                    <p className="text-xs mt-1">{appData.rejectionReason}</p>
                  </div>
                )}

                {/* Progress Pipeline */}
                <div className="pt-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stage Pipeline</p>
                  <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs">
                    <div className="flex-1 p-2 rounded-lg bg-blue-100 text-blue-900 font-bold text-center border border-blue-200">
                      1. Submitted
                    </div>
                    <div className={`flex-1 p-2 rounded-lg font-bold text-center border ${
                      ['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(appData.status)
                        ? 'bg-blue-100 text-blue-900 border-blue-200'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      2. Review
                    </div>
                    <div className={`flex-1 p-2 rounded-lg font-bold text-center border ${
                      appData.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : appData.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      3. Decision
                    </div>
                    <div className={`flex-1 p-2 rounded-lg font-bold text-center border ${
                      roomAllocated
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      4. Allocation
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                You haven't submitted a hostel accommodation application yet.
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/application')}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition"
          >
            <span>{appData ? 'View Full Application & Timeline' : 'Submit New Application'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Section 2: Room & Roommate Details */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Hostel Room & Roommates</h3>
              </div>
              <StatusBadge status={roomAllocated ? 'ALLOCATED' : 'NOT_ALLOCATED'} />
            </div>

            {roomAllocated ? (
              <div className="mt-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Hostel Block</span>
                    <span className="text-sm font-bold text-slate-900">{roomData.blockName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Room & Bed</span>
                    <span className="text-sm font-bold text-blue-900">
                      Room {roomData.roomNumber} ({roomData.bedNumber})
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Room Type</span>
                    <span className="font-semibold text-slate-800">{roomData.roomType}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Total Occupancy</span>
                    <span className="font-semibold text-slate-800">
                      {roomData.totalOccupants} / {roomData.capacity} Beds
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Roommates</p>
                  {roomData.roommates?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No other roommates in this room yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {roomData.roommates.map((rm: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-800">{rm.name}</span>
                            <span className="text-slate-400 text-[11px] ml-2 font-mono">({rm.rollNumber})</span>
                          </div>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {rm.bedNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                You will be allocated a room after your application is reviewed and approved by the Warden.
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/room')}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition"
          >
            <span>View Room Details & Floor Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Section 3: Fee Status & Quick Pay */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Fee Management</h3>
              </div>
              <StatusBadge status={pendingFeeTotal > 0 ? 'PENDING' : 'PAID'} />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Total Payable</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  ₹{(feesData?.summary?.totalPayable || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-700 font-bold uppercase">Amount Paid</span>
                <p className="text-sm font-bold text-emerald-800 mt-0.5">
                  ₹{(feesData?.summary?.amountPaid || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <span className="text-[10px] text-rose-700 font-bold uppercase">Pending</span>
                <p className="text-sm font-bold text-rose-800 mt-0.5">
                  ₹{pendingFeeTotal.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fee Heads Breakdown</p>
              {feesData?.payments?.slice(0, 3).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50">
                  <span className="font-medium text-slate-800">{p.feeHead.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">₹{p.amount.toLocaleString()}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/fees')}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <span>{pendingFeeTotal > 0 ? 'Pay Due Fees Online' : 'View Payment History & Receipts'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Section 4: Outpass & Curfew Snapshot */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Outpass & Curfew</h3>
              </div>
              <StatusBadge status={activeOutpass ? activeOutpass.status : 'NO_ACTIVE_PASS'} />
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {activeOutpass ? (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">
                      {activeOutpass.type} #{activeOutpass.outpassNumber}
                    </span>
                    <StatusBadge status={activeOutpass.status} />
                  </div>
                  <p className="text-slate-700">Destination: <span className="font-semibold text-slate-900">{activeOutpass.destination}</span></p>
                  <p className="text-slate-600 text-[11px]">
                    Expected Return: {new Date(activeOutpass.expectedReturnTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No active leave or same-day outpass in progress.</p>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Hostel Curfew Rule</span>
                  <span className="font-bold text-slate-800 text-xs">Weekdays: 21:30 | Weekends: 22:30</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Violations</span>
                  <span className={`font-bold text-xs ${curfewSummary?.summary?.totalViolations > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {curfewSummary?.summary?.totalViolations || 0} Recorded
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6">
            <button
              onClick={() => navigate('/outpass')}
              className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 transition"
            >
              <span>Request Pass</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate('/visitors')}
              className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 transition"
            >
              <span>Visitors & OTP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
