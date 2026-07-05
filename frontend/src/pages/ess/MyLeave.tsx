import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { StatusBadge } from '../admin/Leave';

interface LeaveType { id: string; name: string }
interface LeaveBalance { leaveTypeCode: string; balance: number }
interface LeaveRequest { id: string; leaveTypeId: string; startDate: string; endDate: string; totalDays: string; status: string; reason: string }

export function MyLeave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: leaveTypes } = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get<LeaveType[]>('/leave-types') });
  const { data: balances } = useQuery({
    queryKey: ['my-leave-balances', user?.employeeId],
    queryFn: () => api.get<{ balances: LeaveBalance[] }>(`/leave-balances/${user!.employeeId}`),
    enabled: !!user?.employeeId,
  });
  const { data: requests } = useQuery({ queryKey: ['my-leave-requests'], queryFn: () => api.get<LeaveRequest[]>(`/leave-requests?employeeId=${user?.employeeId}`) });

  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () => api.post('/leave-requests', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Leave</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {balances?.balances.map((b) => (
          <div key={b.leaveTypeCode} className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">{b.leaveTypeCode}</div>
            <div className="text-2xl font-semibold">{b.balance}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); apply.mutate(); }}
        className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-2 gap-3"
      >
        <select required value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} className="border rounded px-3 py-2 text-sm">
          <option value="">Leave type...</option>
          {leaveTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input required placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <div className="col-span-2">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <button disabled={apply.isPending} className="bg-brand-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-50">
            {apply.isPending ? 'Applying...' : 'Apply for Leave'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr><th className="px-4 py-2">Dates</th><th className="px-4 py-2">Days</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Reason</th></tr>
          </thead>
          <tbody>
            {requests?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{formatDate(r.startDate)} - {formatDate(r.endDate)}</td>
                <td className="px-4 py-2">{r.totalDays}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2">{r.reason}</td>
              </tr>
            ))}
            {requests?.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-gray-400">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
