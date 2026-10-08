import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadError } from '../../components/common/LoadError';
import {
  Compass,
  Plus,
  QrCode,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileBadge,
} from 'lucide-react';

export const OutpassPage: React.FC = () => {
  const { showToast } = useToast();

  const [outpassData, setOutpassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedToCancel, setSelectedToCancel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Form states
  const [type, setType] = useState<'OUTPASS' | 'LEAVE'>('OUTPASS');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [modeOfTravel, setModeOfTravel] = useState('Public Transport');
  const [departureTime, setDepartureTime] = useState('');
  const [expectedReturnTime, setExpectedReturnTime] = useState('');

  const fetchOutpasses = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await api.get('/outpasses/my');
      setOutpassData(data);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutpasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !destination || !departureTime || !expectedReturnTime) {
      showToast('Please fill all required outpass fields.', 'warning');
      return;
    }

    if (new Date(expectedReturnTime) <= new Date(departureTime)) {
      showToast('Expected return time must be later than departure time.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/outpasses', {
        type,
        reason,
        destination,
        modeOfTravel,
        departureTime,
        expectedReturnTime,
      });

      showToast(`${res.type} request #${res.outpassNumber} submitted for Warden approval!`, 'success');
      setModalOpen(false);
      setReason('');
      setDestination('');
      fetchOutpasses();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit outpass request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedToCancel || cancelling) return;
    try {
      setCancelling(true);
      await api.put(`/outpasses/${selectedToCancel.id}/cancel`);
      showToast('Outpass request cancelled successfully.', 'info');
      setCancelDialogOpen(false);
      fetchOutpasses();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel outpass.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load your outpass requests." onRetry={fetchOutpasses} />;

  const activePass = outpassData?.activePass;
  const history = outpassData?.history || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hostel Outpass & Leave Gate Pass</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Request same-day outpass or overnight leave. Approved passes are scanned at the security gate.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20 transition active:scale-95 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Outpass / Leave</span>
        </button>
      </div>

      {/* Active Gate Pass Card (if approved or active) */}
      {activePass && (
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
                  Official Digital Gate Pass
                </span>
                <StatusBadge status={activePass.status} />
              </div>
              <h2 className="text-3xl font-mono font-black tracking-wider text-emerald-400">
                {activePass.outpassNumber}
              </h2>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                {activePass.type}: {activePass.destination}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Reason: {activePass.reason}</p>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Departure Time</span>
                  <span className="font-bold text-white">
                    {new Date(activePass.departureTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Expected Return</span>
                  <span className="font-bold text-amber-300">
                    {new Date(activePass.expectedReturnTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>
            </div>

            {/* QR Gate Pass Simulation Card */}
            <div className="bg-white text-slate-900 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg w-48 flex-shrink-0 self-center md:self-auto">
              <div className="w-28 h-28 bg-slate-900 rounded-xl p-2 flex items-center justify-center text-white mb-2">
                <QrCode className="w-24 h-24" />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-700">{activePass.outpassNumber}</span>
              <span className="text-[9px] text-slate-600 uppercase font-semibold">Scan at Gate Terminal</span>
            </div>
          </div>
        </div>
      )}

      {/* History and Status Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-4">Outpass & Leave History</h3>

        {history.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No previous outpass or leave requests found. Click "Apply for Outpass / Leave" to submit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Pass No</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Destination & Reason</th>
                  <th className="py-3 px-3">Out Time</th>
                  <th className="py-3 px-3">Expected In</th>
                  <th className="py-3 px-3">Actual Return</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {history.map((op: any) => (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-blue-900">{op.outpassNumber}</td>
                    <td className="py-3 px-3 font-semibold">{op.type}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{op.destination}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{op.reason}</div>
                      {op.rejectionReason && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          Reason: {op.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {new Date(op.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <div className="text-[10px] text-slate-400">{new Date(op.departureTime).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {new Date(op.expectedReturnTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <div className="text-[10px] text-slate-400">{new Date(op.expectedReturnTime).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {op.actualReturnTime ? (
                        <>
                          <span className="font-semibold text-slate-800">
                            {new Date(op.actualReturnTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="text-[10px] text-slate-400">{new Date(op.actualReturnTime).toLocaleDateString()}</div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={op.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {op.status === 'PENDING' && (
                        <button
                          onClick={() => {
                            setSelectedToCancel(op);
                            setCancelDialogOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outpass Request Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title="Apply for Outpass / Leave"
        subtitle="Submitted requests require Warden approval before gate clearance"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Pass Category *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('OUTPASS')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  type === 'OUTPASS'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Same-Day Outpass
              </button>
              <button
                type="button"
                onClick={() => setType('LEAVE')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  type === 'LEAVE'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Multi-Day Leave
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Destination Address *</label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Central Library / Home (Pune)"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Purpose / Reason *</label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Specific academic, personal or medical justification..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Mode of Travel</label>
            <input
              type="text"
              value={modeOfTravel}
              onChange={(e) => setModeOfTravel(e.target.value)}
              placeholder="e.g. Metro / Train / Cab / Walking"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Departure Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expected Return Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={expectedReturnTime}
                onChange={(e) => setExpectedReturnTime(e.target.value)}
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
              {submitting ? 'Submitting...' : 'Submit for Warden Approval'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        onClose={() => !cancelling && setCancelDialogOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Outpass Request?"
        message={`Are you sure you want to cancel outpass request #${selectedToCancel?.outpassNumber}?`}
        confirmText="Yes, Cancel Request"
        isDestructive={true}
        isLoading={cancelling}
      />
    </div>
  );
};
