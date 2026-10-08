import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadError } from '../../components/common/LoadError';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  User,
  GraduationCap,
  HeartPulse,
  Send,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const ApplicationPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Form states
  const [roomTypePreference, setRoomTypePreference] = useState('Double Non-AC');
  const [academicTerm, setAcademicTerm] = useState('2026-27');
  const [medicalInfo, setMedicalInfo] = useState(user?.student?.medicalInfo || '');
  const [supportingDoc, setSupportingDoc] = useState('');
  const [supportingDocName, setSupportingDocName] = useState('');

  const handleDocumentSelect = (file?: File) => {
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Choose a PDF, JPG, or PNG document.', 'warning');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast('Supporting documents must be 6 MB or smaller.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSupportingDoc(reader.result);
        setSupportingDocName(file.name);
      } else {
        showToast('Unable to read the selected document.', 'error');
      }
    };
    reader.onerror = () => showToast('Unable to read the selected document.', 'error');
    reader.readAsDataURL(file);
  };

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await api.get('/applications/my');
      setApplication(data);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post('/applications', {
        roomTypePreference,
        academicTerm,
        supportingDoc,
        medicalInfo,
      });
      setApplication(res);
      showToast('Hostel application submitted successfully! Application ID: ' + res.applicationNumber, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit application.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!application || withdrawing) return;
    try {
      setWithdrawing(true);
      await api.put(`/applications/${application.id}/withdraw`);
      showToast('Application withdrawn successfully.', 'info');
      setWithdrawDialogOpen(false);
      fetchApplication();
    } catch (err: any) {
      showToast(err.message || 'Failed to withdraw application.', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load your application." onRetry={fetchApplication} />;

  const stages = [
    { key: 'SUBMITTED', title: '1. Application Submitted', desc: 'Received & logged in registry' },
    { key: 'UNDER_REVIEW', title: '2. Under Review', desc: 'Warden verification & eligibility check' },
    { key: 'APPROVED', title: '3. Approval / Decision', desc: 'Candidate approved for room allocation' },
    { key: 'ALLOCATED', title: '4. Room Allocated', desc: 'Bed assignment confirmed' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hostel Accommodation Application</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Apply for campus residential hostel admission and track verification status in real time.
        </p>
      </div>

      {application && !['REJECTED', 'WITHDRAWN'].includes(application.status) ? (
        /* Active Application Status & Progression Card */
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Active Application</span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                  {application.applicationNumber}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted on {new Date(application.submittedAt).toLocaleDateString()} for Term {application.academicTerm}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={application.status} className="text-sm px-3.5 py-1" />
                {['SUBMITTED', 'UNDER_REVIEW'].includes(application.status) && (
                  <button
                    onClick={() => setWithdrawDialogOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Withdraw</span>
                  </button>
                )}
              </div>
            </div>

            {/* Rejection Alert Banner */}
            {application.status === 'REJECTED' && (
              <div className="my-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Application Not Approved by Warden</h4>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    Reason: <span className="font-semibold">{application.rejectionReason}</span>
                  </p>
                  <p className="text-[11px] text-rose-600 mt-2">
                    You may contact the Warden Office or update your preference criteria for consideration.
                  </p>
                </div>
              </div>
            )}

            {/* Stage Timeline */}
            <div className="py-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                Lifecycle Progression
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {stages.map((stage, idx) => {
                  let isDone = false;
                  let isCurrent = false;

                  if (application.status === 'SUBMITTED') {
                    if (idx === 0) isCurrent = true;
                  } else if (application.status === 'UNDER_REVIEW') {
                    if (idx === 0) isDone = true;
                    if (idx === 1) isCurrent = true;
                  } else if (application.status === 'APPROVED') {
                    if (idx <= 1) isDone = true;
                    if (idx === 2) isDone = true;
                    if (idx === 3 && application.allocation) isDone = true;
                    if (idx === 3 && !application.allocation) isCurrent = true;
                  } else if (application.status === 'REJECTED') {
                    if (idx <= 1) isDone = true;
                  }

                  return (
                    <div
                      key={stage.key}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDone
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : isCurrent
                          ? 'bg-blue-50/70 border-blue-300 text-blue-950 ring-2 ring-blue-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase">{stage.title}</span>
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isCurrent ? (
                          <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                        ) : null}
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">{stage.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student Application Summary Details */}
            <div className="mt-4 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Applicant</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{user?.name}</span>
                <span className="text-slate-500">Roll: {user?.student?.rollNumber}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Course & Category</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{user?.student?.course}</span>
                <span className="text-slate-500">Year {user?.student?.year} • {user?.student?.category}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected Preference</span>
                <span className="font-bold text-blue-900 text-sm mt-0.5 block">{application.roomTypePreference}</span>
                <span className="text-slate-500">Academic Term {application.academicTerm}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Submission Form (Shown when student has no active application) */
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          {/* Section 1: Pre-filled Profile Info */}
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <User className="w-4 h-4 text-blue-600" />
              <span>Personal & Institutional Profile (Pre-filled from SIS)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-xs">
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  disabled
                  value={user?.name || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Roll Number / UID</label>
                <input
                  type="text"
                  disabled
                  value={user?.student?.rollNumber || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Gender & Category</label>
                <input
                  type="text"
                  disabled
                  value={`${user?.student?.gender || 'N/A'} • ${user?.student?.category || 'General'}`}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Course & Department</label>
                <input
                  type="text"
                  disabled
                  value={user?.student?.course || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Registered Phone</label>
                <input
                  type="text"
                  disabled
                  value={user?.student?.phone || ''}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Guardian Contact</label>
                <input
                  type="text"
                  disabled
                  value={`${user?.student?.guardianName} (${user?.student?.guardianPhone})`}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Hostel Preferences */}
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Room Preference & Academic Term</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">
                  Room Type Preference <span className="text-rose-500">*</span>
                </label>
                <select
                  value={roomTypePreference}
                  onChange={(e) => setRoomTypePreference(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Single AC">Single Occupancy (Air Conditioned)</option>
                  <option value="Double Non-AC">Double Occupancy (Non-AC)</option>
                  <option value="Triple Non-AC">Triple Occupancy (Non-AC)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Allotment is subject to Warden approval & availability.</p>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Academic Session</label>
                <input
                  type="text"
                  value={academicTerm}
                  onChange={(e) => setAcademicTerm(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Optional Medical & Documents */}
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <HeartPulse className="w-4 h-4 text-blue-600" />
              <span>Medical Information & Supporting Documents</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Medical Conditions / Allergies (Optional)</label>
                <textarea
                  rows={3}
                  value={medicalInfo}
                  onChange={(e) => setMedicalInfo(e.target.value)}
                  placeholder="Specify any dietary restrictions, chronic asthma, medications..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Supporting Document Attachment</label>
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => handleDocumentSelect(e.target.files?.[0])}
                    className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-900 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-slate-600 font-semibold mt-2">
                    {supportingDocName || 'Optional: attach an ID or verification document'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">PDF, JPG, or PNG up to 6 MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Hostel Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Withdraw Confirmation Dialog */}
      <ConfirmDialog
        isOpen={withdrawDialogOpen}
        onClose={() => !withdrawing && setWithdrawDialogOpen(false)}
        onConfirm={handleWithdraw}
        title="Withdraw Hostel Application?"
        message="Are you sure you want to withdraw this application? Once withdrawn, you will lose your queue position and must submit a fresh request."
        confirmText="Yes, Withdraw"
        isDestructive={true}
        isLoading={withdrawing}
      />
    </div>
  );
};
