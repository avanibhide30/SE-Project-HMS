import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadError } from '../../components/common/LoadError';
import {
  Home,
  Users,
  BedDouble,
  Wifi,
  Zap,
  Droplets,
  BookOpen,
  Shield,
  Layers,
} from 'lucide-react';

export const RoomViewPage: React.FC = () => {
  const [allocation, setAllocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchAlloc = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const data = await api.get('/allocations/my');
        setAllocation(data);
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAlloc();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load your room assignment." onRetry={() => window.location.reload()} />;

  if (!allocation || !allocation.allocated) {
    return (
      <EmptyState
        title="No Room Allocated Yet"
        description="You have not been assigned a room or bed. Room allocation will be processed by the Warden after your application is approved."
        icon={BedDouble}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Room & Accommodation Details</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Your current residential room assignment, roommates, and hostel facility inventory.
        </p>
      </div>

      {/* Main Room Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Hostel Unit</span>
              <StatusBadge status="ACTIVE" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Room {allocation.roomNumber} • {allocation.bedNumber}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {allocation.blockName} ({allocation.blockCode}) • Floor {allocation.floor}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 block uppercase">Room Specification</span>
            <span className="text-sm font-bold text-slate-800">{allocation.roomType}</span>
            <span className="text-xs text-slate-500 block">
              Capacity: {allocation.capacity} Beds ({allocation.totalOccupants} Allocated)
            </span>
          </div>
        </div>

        {/* Visual Bed Occupancy Strip */}
        <div className="py-6 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Room Bed Occupancy Map
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-500 text-blue-900">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{allocation.bedNumber}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-600 text-white">Your Bed</span>
              </div>
              <p className="text-xs font-semibold text-slate-800">You (Current Resident)</p>
              <p className="text-[11px] text-slate-500 mt-1">Allotted {new Date(allocation.allocatedAt).toLocaleDateString()}</p>
            </div>

            {allocation.roommates?.map((rm: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{rm.bedNumber}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">Occupied</span>
                </div>
                <p className="text-xs font-bold text-slate-900">{rm.name}</p>
                <p className="text-[11px] text-slate-500 mt-1">{rm.course} (Yr {rm.year})</p>
              </div>
            ))}

            {/* Vacant beds if any */}
            {Array.from({ length: allocation.capacity - allocation.totalOccupants }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-50/50 border border-dashed border-slate-300 text-slate-400 flex flex-col justify-center items-center text-center">
                <BedDouble className="w-5 h-5 mb-1 text-slate-300" />
                <span className="text-xs font-bold text-slate-500">Vacant Bed</span>
                <span className="text-[10px] text-slate-400">Available for allocation</span>
              </div>
            ))}
          </div>
        </div>

        {/* Roommates Directory */}
        <div className="py-6 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Roommates Directory
          </h4>
          {allocation.roommates?.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No other resident is assigned to this room yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {allocation.roommates.map((rm: any, idx: number) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-xs">
                      {rm.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{rm.name}</p>
                      <p className="text-slate-500">
                        Roll: <span className="font-mono text-slate-700">{rm.rollNumber}</span> • {rm.course} (Year {rm.year})
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg">
                    {rm.bedNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Amenities Grid */}
        <div className="pt-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Included Room Amenities & Facilities
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Wifi className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-bold text-slate-800">Campus Wi-Fi</p>
                <p className="text-[11px] text-slate-500">100 Mbps Unlimited</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-bold text-slate-800">24/7 Power</p>
                <p className="text-[11px] text-slate-500">DG Backup Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Droplets className="w-5 h-5 text-sky-500" />
              <div>
                <p className="font-bold text-slate-800">Hot Water Supply</p>
                <p className="text-[11px] text-slate-500">Solar + Geyser</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-bold text-slate-800">Study Setup</p>
                <p className="text-[11px] text-slate-500">Desk, Lamp & Wardrobe</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
