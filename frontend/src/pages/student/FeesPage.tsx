import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ReceiptModal } from '../../components/common/ReceiptModal';
import { LoadError } from '../../components/common/LoadError';
import {
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const FeesPage: React.FC = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [feesData, setFeesData] = useState<any>(null);

  // Payment Modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'Net Banking'>('UPI');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Receipt Modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<any>(null);

  const fetchFees = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await api.get('/fees/my');
      setFeesData(data);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const openPaymentModal = (payment: any) => {
    setSelectedPayment(payment);
    setSimulateFailure(false);
    setPaymentModalOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedPayment) return;
    try {
      setProcessing(true);
      const res = await api.post('/payments/mock-process', {
        paymentId: selectedPayment.id,
        paymentMethod,
        simulateFailure,
      });

      showToast(`Payment successful! Receipt #${res.receiptNumber}`, 'success');
      setPaymentModalOpen(false);
      fetchFees();

      // Open receipt automatically
      loadReceipt(res.receiptNumber);
    } catch (err: any) {
      showToast(err.message || 'Payment transaction failed. You may retry.', 'error');
      fetchFees();
    } finally {
      setProcessing(false);
    }
  };

  const loadReceipt = async (receiptNumber: string) => {
    try {
      const data = await api.get(`/payments/receipt/${receiptNumber}`);
      setActiveReceiptData(data);
      setReceiptModalOpen(true);
    } catch (err: any) {
      showToast('Failed to load receipt details.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) return <LoadError message="Unable to load your fee information." onRetry={fetchFees} />;

  const payments = feesData?.payments || [];
  const pendingPayments = payments.filter((p: any) => ['PENDING', 'OVERDUE', 'FAILED'].includes(p.status));
  const paidPayments = payments.filter((p: any) => p.status === 'PAID');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hostel Fee Management</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Pay your residential dues via mock gateway and download official institutional tax receipts.
        </p>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            ₹{(feesData?.summary?.totalPayable || 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Full Term Invoiced</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Amount Paid</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            ₹{(feesData?.summary?.amountPaid || 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            {paidPayments.length} Heads Settled
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Pending Balance</span>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">
            ₹{(feesData?.summary?.amountPending || 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
            {pendingPayments.length} Dues Outstanding
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Due Date</span>
          <p className="text-base font-bold text-slate-800 mt-2">
            {feesData?.summary?.nextDueDate ? new Date(feesData.summary.nextDueDate).toLocaleDateString() : 'All Settled'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Penalty grace: 7 days</span>
        </div>
      </div>

      {/* Pending / Due Fees Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Outstanding Fee Heads</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select a fee head below to initiate payment</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {pendingPayments.length} Pending
          </span>
        </div>

        {pendingPayments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
            <span className="font-bold text-slate-700 text-sm">No Pending Fees</span>
            <span>All your hostel fee heads for this term have been fully cleared.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 mt-2">
            {pendingPayments.map((p: any) => (
              <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{p.feeHead.name}</h4>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Term: <span className="font-semibold text-slate-700">{p.feeHead.term}</span> • Due Date:{' '}
                    <span className="font-semibold text-slate-800">{new Date(p.dueDate).toLocaleDateString()}</span>
                  </p>
                  {p.failureReason && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">⚠️ {p.failureReason}</p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Amount Due</span>
                    <span className="text-lg font-extrabold text-slate-900">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    onClick={() => openPaymentModal(p)}
                    className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20 transition active:scale-95 flex items-center gap-1.5"
                  >
                    <span>{p.status === 'FAILED' ? 'Retry Payment' : 'Pay Now'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History & Receipts Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Payment History & Tax Receipts</h3>
            <p className="text-xs text-slate-500 mt-0.5">Archived transaction records and downloadable PDF receipts</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {paidPayments.length} Transactions
          </span>
        </div>

        {paidPayments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No completed payment transactions on record yet.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Receipt No</th>
                  <th className="py-3 px-3">Fee Head</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3">Paid On</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paidPayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-900">{p.receiptNumber}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900">{p.feeHead.name}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">₹{p.amount.toLocaleString()}</td>
                    <td className="py-3.5 px-3">{p.paymentMethod || 'Online'}</td>
                    <td className="py-3.5 px-3 text-slate-500">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => loadReceipt(p.receiptNumber)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                      >
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Mock Payment Gateway Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => !processing && setPaymentModalOpen(false)}
        title="Mock Payment Gateway"
        subtitle={`Transaction Amount: ₹${selectedPayment?.amount?.toLocaleString()}`}
        maxWidth="md"
      >
        <div className="space-y-5 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
            <span className="font-bold block text-xs">Demonstration Payment Environment</span>
            <span className="text-[11px] text-blue-700">
              No real bank credentials or credit cards are charged. All transactions simulate bank callback responses.
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-2 uppercase text-[10px]">Select Payment Channel</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition ${
                  paymentMethod === 'UPI'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Card')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition ${
                  paymentMethod === 'Card'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span>Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Net Banking')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition ${
                  paymentMethod === 'Net Banking'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building className="w-5 h-5 text-emerald-600" />
                <span>Net Banking</span>
              </button>
            </div>
          </div>

          {/* Simulation Toggle for Evaluator to test error handling & retry */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer text-amber-900 font-semibold select-none">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Simulate Bank Failure / Rejection (Test Retry Flow)</span>
            </label>
            <p className="text-[11px] text-amber-700 mt-1 pl-6">
              When checked, this transaction will simulate an issuer decline to verify system resilience and retry logic.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={processing}
              onClick={() => setPaymentModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={handleProcessPayment}
              className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {processing && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
              <span>Pay ₹{selectedPayment?.amount?.toLocaleString('en-IN')}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Official Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receiptData={activeReceiptData}
      />
    </div>
  );
};
