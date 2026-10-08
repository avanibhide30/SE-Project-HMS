import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadError } from '../../components/common/LoadError';
import {
  Users,
  UserPlus,
  KeyRound,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Phone,
  ShieldAlert,
} from 'lucide-react';

const localDateInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const VisitorPage: React.FC = () => {
  const { showToast } = useToast();

  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [visitorName, setVisitorName] = useState('');
  const [visitorContact, setVisitorContact] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [purpose, setPurpose] = useState('');
  const [visitDate, setVisitDate] = useState(localDateInputValue);
  const [expectedTime, setExpectedTime] = useState('16:00');

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await api.get('/visitors/my');
      setVisitors(data || []);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName || !visitorContact || !purpose) {
      showToast('Please fill all visitor information fields.', 'warning');
      return;
    }
    if (visitDate < localDateInputValue()) {
      showToast('Visit date cannot be in the past.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/visitors', {
        visitorName,
        visitorContact,
        relationship,
        purpose,
        visitDate,
        expectedTime,
      });

      showToast(`Visitor ${res.visitorName} pre-registered. OTP generated!`, 'success');
      setModalOpen(false);
      setVisitorName('');
      setVisitorContact('');
      setPurpose('');
      fetchVisitors();
    } catch (err: any) {
      showToast(err.message || 'Failed to register visitor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateOTP = async (visitorId: number) => {
    try {
      const res = await api.post(`/visitors/${visitorId}/generate-otp`);
      showToast(`New OTP: ${res.otp} (Valid 10 minutes)`, 'success');
      fetchVisitors();
    } catch (err: any) {
      showToast(err.message || 'Failed to regenerate OTP.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load your visitor requests." onRetry={fetchVisitors} />;

  const activeOrPendingVisitors = visitors.filter((v) => ['OTP_GENERATED', 'INSIDE', 'PENDING', 'OVERSTAY'].includes(v.status));
  const completedVisitors = visitors.filter((v) => ['COMPLETED', 'DENIED', 'EXPIRED'].includes(v.status));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Visitor Management & OTP Entry</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pre-register guests, share 6-digit gate OTPs, and track real-time entry and departure.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20 transition active:scale-95 flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Pre-Register Visitor</span>
        </button>
      </div>

      {/* Demo helper banner explaining OTP gate workflow */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-3">
        <KeyRound className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-sm">Visitor OTP Verification Workflow</span>
          <p className="text-blue-800 mt-0.5 leading-relaxed">
            When a visitor arrives at the gate, provide the 6-digit OTP displayed on the visitor card below to the
            Security Guard. The Guard will enter this OTP into the <strong>Gate Console</strong> to log entry.
            OTPs expire after 10 minutes and lock after 3 invalid attempts.
          </p>
        </div>
      </div>

      {/* Active / Pending Visitors Cards */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Active & Upcoming Visitors</h3>

        {activeOrPendingVisitors.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No active or upcoming visitors right now. Click "Pre-Register Visitor" above to schedule a visit.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrPendingVisitors.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {v.relationship}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900">{v.visitorName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{v.visitorContact}</p>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>

                  <div className="py-3 space-y-1.5 text-xs text-slate-600">
                    <p><span className="text-slate-400">Purpose:</span> <span className="font-medium text-slate-800">{v.purpose}</span></p>
                    <p><span className="text-slate-400">Expected:</span> <span className="font-medium text-slate-800">{v.visitDate} at {v.expectedTime}</span></p>
                    {v.visitorLog?.entryTime && (
                      <p><span className="text-slate-400">Checked In:</span> <span className="font-semibold text-emerald-700">{new Date(v.visitorLog.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>
                    )}
                  </div>

                  {/* Overstay Alert if flagged */}
                  {v.status === 'OVERSTAY' && (
                    <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span className="font-bold">Overstay Warning: Visitor has exceeded permitted visiting hours.</span>
                    </div>
                  )}

                  {/* 6-Digit OTP Highlight Box */}
                  {v.otp ? (
                    <div className="my-3 p-4 bg-slate-900 rounded-2xl text-center text-white">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block mb-1">
                        Gate Verification OTP
                      </span>
                      <span className="text-3xl font-mono font-black tracking-widest text-emerald-400 block">
                        {v.otp}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        Valid for 10 min from issuance • Single-use
                      </p>
                    </div>
                  ) : v.status === 'INSIDE' ? (
                    <div className="my-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-center text-blue-900 text-xs font-semibold">
                      ✓ Visitor Verified & Currently Inside Hostel Premises
                    </div>
                  ) : null}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Failed attempts: {v.otpAttempts || 0}/3
                  </span>
                  {v.status !== 'INSIDE' && (
                    <button
                      onClick={() => handleRegenerateOTP(v.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Regenerate OTP</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visitor History Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-4">Past Visitor Logs</h3>
        {completedVisitors.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No historical completed visits recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Visitor Name</th>
                  <th className="py-3 px-3">Relation</th>
                  <th className="py-3 px-3">Purpose</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Exit Time</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {completedVisitors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">{v.visitorName}</td>
                    <td className="py-3 px-3">{v.relationship}</td>
                    <td className="py-3 px-3">{v.purpose}</td>
                    <td className="py-3 px-3 text-slate-500">{v.visitDate}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {v.visitorLog?.exitTime ? new Date(v.visitorLog.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pre-Register Visitor Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title="Pre-Register Expected Visitor"
        subtitle="A single-use 6-digit OTP will be generated for gate security verification"
        maxWidth="md"
      >
        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Visitor Full Name *</label>
            <input
              type="text"
              required
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="e.g. Sudhir Bhide"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Contact Phone *</label>
              <input
                type="text"
                required
                value={visitorContact}
                onChange={(e) => setVisitorContact(e.target.value)}
                placeholder="+91 98200 12345"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Relationship *</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium bg-white"
              >
                <option value="Parent">Parent</option>
                <option value="Guardian">Guardian</option>
                <option value="Sibling">Sibling</option>
                <option value="Relative">Relative</option>
                <option value="Friend">Friend / Classmate</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Purpose of Visit *</label>
            <input
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Delivering study notes & family visit"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expected Date *</label>
              <input
                type="date"
                required
                min={localDateInputValue()}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expected Arrival Time *</label>
              <input
                type="time"
                required
                value={expectedTime}
                onChange={(e) => setExpectedTime(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Generating OTP...' : 'Register & Generate OTP'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
