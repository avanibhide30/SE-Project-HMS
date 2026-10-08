import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadError } from '../../components/common/LoadError';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Info,
} from 'lucide-react';

export const CurfewPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const [cRes, myRes] = await Promise.all([
          api.get('/curfew/config'),
          api.get('/curfew/my'),
        ]);
        setConfig(cRes);
        setData(myRes);
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load curfew details." onRetry={() => window.location.reload()} />;

  const records = data?.records || [];
  const violationsCount = data?.summary?.totalViolations || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hostel Curfew & Entry Tracking</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review applicable curfew regulations and your gate access verification records.
        </p>
      </div>

      {/* Disciplinary Notice if Violations Exist */}
      {violationsCount > 0 ? (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Disciplinary Alert: Curfew Violation(s) Logged</h4>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">
              You have <strong className="font-bold">{violationsCount}</strong> late gate entry violation(s) recorded.
              Accumulating more than 2 unexcused curfew breaches within a single month may lead to disciplinary review
              and temporary suspension of outpass privileges (SRS Business Rule BR-3).
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-bold">
            Exemplary Record: No unexcused curfew violations recorded for your profile.
          </span>
        </div>
      )}

      {/* Current Hostel Curfew Rules */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span>Institutional Curfew Schedule</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Weekday Curfew (Mon - Fri)
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">{config?.weekdayCurfew || '21:30'}</p>
            <p className="text-[11px] text-slate-500 mt-1">Main hostel entrance gate locked</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Weekend Curfew (Sat - Sun)
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">{config?.weekendCurfew || '22:30'}</p>
            <p className="text-[11px] text-slate-500 mt-1">Extended leisure hours</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Visitor Gate Departure
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">{config?.permittedVisitorUntil || '20:00'}</p>
            <p className="text-[11px] text-slate-500 mt-1">All guests must exit premises</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            <strong>Automatic Waiver Policy:</strong> If you enter after curfew hours with an active, approved Outpass or Leave covering that period, the system will automatically waive the violation.
          </span>
        </div>
      </div>

      {/* Student Entry Logs Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-4">Gate Entry History</h3>

        {records.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">No gate entries logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Entry Time</th>
                  <th className="py-3 px-3">Applicable Curfew</th>
                  <th className="py-3 px-3">Delay</th>
                  <th className="py-3 px-3">Status / Waiver Note</th>
                  <th className="py-3 px-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {records.map((r: any) => {
                  const isViolation = r.flaggedLate && !r.isWaived;
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50/80 transition ${isViolation ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {new Date(r.entryTime).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {new Date(r.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">{r.curfewTime}</td>
                      <td className="py-3 px-3 font-semibold">
                        {r.delayMinutes > 0 ? (
                          <span className={isViolation ? 'text-rose-600' : 'text-slate-500'}>
                            +{r.delayMinutes} mins
                          </span>
                        ) : (
                          <span className="text-emerald-600">On Time</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {r.isWaived ? (
                          <div>
                            <StatusBadge status="WAIVED" />
                            <div className="text-[10px] text-purple-700 mt-0.5">{r.waiveReason}</div>
                          </div>
                        ) : r.flaggedLate ? (
                          <StatusBadge status="LATE" />
                        ) : (
                          <StatusBadge status="ON_TIME" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">{r.recordedBy || 'Gate Guard'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
