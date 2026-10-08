import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Notice } from '../../types';
import { LoadError } from '../../components/common/LoadError';
import {
  Bell,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Paperclip,
  Tag,
  Filter,
} from 'lucide-react';

export const NoticesPage: React.FC = () => {
  const { showToast } = useToast();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await api.get('/notices');
      setNotices(data || []);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const markAsRead = async (noticeId: number) => {
    try {
      await api.post(`/notices/${noticeId}/mark-read`);
      setNotices((prev) =>
        prev.map((n) => (n.id === noticeId ? { ...n, isRead: true } : n))
      );
      showToast('Notice marked as read', 'info');
    } catch (e) {
      console.error(e);
      showToast('Failed to mark notice as read.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load notices." onRetry={fetchNotices} />;

  const filteredNotices = notices.filter(
    (n) => categoryFilter === 'ALL' || n.category === categoryFilter
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hostel Digital Notice Board</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official announcements, mess circulars, maintenance advisories, and curfew updates.
          </p>
        </div>

        {/* Categories Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm text-xs font-semibold overflow-x-auto">
          {['ALL', 'URGENT', 'GENERAL', 'EVENT', 'MAINTENANCE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl transition ${
                categoryFilter === cat
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Notices Feed */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-xs text-slate-500 border border-dashed border-slate-200">
            No notices found in this category.
          </div>
        ) : (
          filteredNotices.map((n) => {
            const isUrgent = n.isUrgent || n.category === 'URGENT';
            return (
              <div
                key={n.id}
                className={`bg-white rounded-3xl p-6 sm:p-7 border shadow-sm transition-all ${
                  isUrgent
                    ? 'border-rose-300 ring-2 ring-rose-500/10'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isUrgent && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] tracking-wide uppercase shadow-sm">
                        <AlertTriangle className="w-3 h-3" /> Pinned Urgent
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                      {n.category}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] uppercase">
                      Target: {n.target}
                    </span>
                    {!n.isRead && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>
                      {new Date(n.publishedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {!n.isRead && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-[11px]"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {n.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {n.body}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">
                    Issued by: <strong className="text-slate-700">{n.author?.name || 'Hostel Administration'}</strong>
                  </span>
                  {n.expiresAt && (
                    <span className="text-[11px]">
                      Expires: {new Date(n.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
