import React from 'react';
import { Modal } from './Modal';
import { Printer, CheckCircle2, Building, ShieldCheck } from 'lucide-react';

interface ReceiptData {
  receiptNumber: string;
  transactionId: string;
  date: string;
  amount: number;
  paymentMethod: string;
  status: string;
  feeHeadName: string;
  academicTerm: string;
  institution: {
    name: string;
    subText: string;
    address: string;
    contact: string;
  };
  student: {
    name: string;
    rollNumber: string;
    course: string;
    year: number;
    gender: string;
    hostelBlock: string;
    roomNumber: string;
    bedNumber: string;
  };
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, receiptData }) => {
  if (!receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Official Hostel Fee Receipt" maxWidth="2xl">
      <div className="flex flex-col gap-6">
        {/* Printable Card Area */}
        <div id="printable-receipt" className="border border-slate-300 rounded-xl p-6 bg-white shadow-sm font-sans">
          {/* Institution Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-900 text-white rounded-xl">
                <Building className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  {receiptData.institution.name}
                </h1>
                <p className="text-xs font-semibold text-slate-600">{receiptData.institution.subText}</p>
                <p className="text-[11px] text-slate-700">{receiptData.institution.address}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" /> PAID
              </span>
              <p className="text-xs font-bold text-slate-900 mt-1">NO: {receiptData.receiptNumber}</p>
              <p className="text-[11px] text-slate-700">{new Date(receiptData.date).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Student & Allocation Details */}
          <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-slate-200">
            <div>
              <p className="text-slate-700 uppercase font-semibold text-[10px]">Student Name</p>
              <p className="text-sm font-bold text-slate-900">{receiptData.student.name}</p>
              <p className="text-slate-700 mt-1">Roll: <span className="font-semibold text-slate-800">{receiptData.student.rollNumber}</span></p>
              <p className="text-slate-700">Course: <span className="font-medium text-slate-800">{receiptData.student.course} (Yr {receiptData.student.year})</span></p>
            </div>
            <div className="text-right sm:text-left">
              <p className="text-slate-700 uppercase font-semibold text-[10px]">Accommodation</p>
              <p className="text-sm font-bold text-slate-900">{receiptData.student.hostelBlock}</p>
              <p className="text-slate-700 mt-1">Room: <span className="font-semibold text-slate-800">{receiptData.student.roomNumber}</span> | Bed: <span className="font-semibold text-slate-800">{receiptData.student.bedNumber}</span></p>
              <p className="text-slate-700">Gender: <span className="font-medium text-slate-800">{receiptData.student.gender}</span></p>
            </div>
          </div>

          {/* Fee Breakdown Table */}
          <div className="py-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700 uppercase text-[10px]">
                  <th className="text-left py-2">Sl.</th>
                  <th className="text-left py-2">Description / Fee Head</th>
                  <th className="text-left py-2">Academic Term</th>
                  <th className="text-right py-2">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-semibold text-slate-700">1</td>
                  <td className="py-3 font-bold text-slate-900">{receiptData.feeHeadName}</td>
                  <td className="py-3 text-slate-600">{receiptData.academicTerm}</td>
                  <td className="py-3 text-right font-bold text-slate-900">₹{receiptData.amount.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 text-sm">
                  <td colSpan={3} className="py-3 font-bold text-slate-900 uppercase">Total Amount Paid</td>
                  <td className="py-3 text-right font-extrabold text-blue-900 text-base">
                    ₹{receiptData.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Transaction Metadata Footer */}
          <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-200 grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-slate-700">Transaction ID: <span className="font-mono font-semibold text-slate-900">{receiptData.transactionId}</span></p>
              <p className="text-slate-700">Payment Channel: <span className="font-medium text-slate-900">{receiptData.paymentMethod}</span></p>
            </div>
            <div className="text-right flex items-center justify-end gap-2 text-slate-700">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div className="text-left">
                <p className="font-bold text-[11px] text-slate-800">Digitally Verified & Sealed</p>
                <p className="text-[10px] text-slate-700">Hostel Accounts Administration</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-900/20 transition active:scale-95"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};
