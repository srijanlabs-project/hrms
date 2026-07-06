import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';
import { EmployeeLink } from '../../components/EmployeeLink';

interface EmployeeRef { id: string; firstName: string; lastName: string | null }
interface DelegationGiven { id: string; delegateEmployeeId: string; startDate: string; endDate: string; reason: string | null; revokedAt: string | null; delegate: EmployeeRef | null }
interface DelegationReceived { id: string; delegatorEmployeeId: string; startDate: string; endDate: string; reason: string | null; revokedAt: string | null; delegator: EmployeeRef | null }
interface DelegationsResponse { given: DelegationGiven[]; received: DelegationReceived[] }

export function Delegations() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['delegations'], queryFn: () => api.get<DelegationsResponse>('/delegations') });
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => api.get<EmployeeRef[]>('/employees') });
  const [form, setForm] = useState({ delegateEmployeeId: '', startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post('/delegations', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      setForm({ delegateEmployeeId: '', startDate: '', endDate: '', reason: '' });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/delegations/${id}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegations'] }),
  });

  const isActive = (d: { startDate: string; endDate: string; revokedAt: string | null }) => {
    if (d.revokedAt) return false;
    const today = new Date().toISOString().slice(0, 10);
    return d.startDate.slice(0, 10) <= today && today <= d.endDate.slice(0, 10);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Delegations</h1>
      <p className="text-sm text-gray-500 mb-6">While you're away, hand off your pending approvals to a colleague for a date range.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate(); }}
        className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-2 gap-3"
      >
        <select required value={form.delegateEmployeeId} onChange={(e) => setForm({ ...form, delegateEmployeeId: e.target.value })} className="border rounded px-3 py-2 text-sm">
          <option value="">Delegate to...</option>
          {employees?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <input placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <div className="col-span-2">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <button disabled={create.isPending} className="bg-brand-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-50">
            {create.isPending ? 'Saving...' : 'Create Delegation'}
          </button>
        </div>
      </form>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      <h2 className="text-lg font-semibold mb-3">Given by you</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr><th className="px-4 py-2">Delegate</th><th className="px-4 py-2">Dates</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {data?.given.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.delegate ? <EmployeeLink employeeId={d.delegate.id} name={`${d.delegate.firstName} ${d.delegate.lastName ?? ''}`} /> : '—'}</td>
                <td className="px-4 py-2">{formatDate(d.startDate)} - {formatDate(d.endDate)}</td>
                <td className="px-4 py-2">{d.reason ?? '—'}</td>
                <td className="px-4 py-2">
                  {d.revokedAt ? <span className="text-gray-400">Revoked</span> : isActive(d) ? <span className="text-green-600 font-medium">Active</span> : <span className="text-gray-400">Scheduled/Past</span>}
                </td>
                <td className="px-4 py-2">
                  {!d.revokedAt && <button onClick={() => revoke.mutate(d.id)} className="text-red-600 text-xs underline">Revoke</button>}
                </td>
              </tr>
            ))}
            {data?.given.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">You haven't delegated to anyone.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">Received (you may act on their behalf)</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr><th className="px-4 py-2">From</th><th className="px-4 py-2">Dates</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {data?.received.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.delegator ? <EmployeeLink employeeId={d.delegator.id} name={`${d.delegator.firstName} ${d.delegator.lastName ?? ''}`} /> : '—'}</td>
                <td className="px-4 py-2">{formatDate(d.startDate)} - {formatDate(d.endDate)}</td>
                <td className="px-4 py-2">{d.reason ?? '—'}</td>
                <td className="px-4 py-2">
                  {d.revokedAt ? <span className="text-gray-400">Revoked</span> : isActive(d) ? <span className="text-green-600 font-medium">Active</span> : <span className="text-gray-400">Scheduled/Past</span>}
                </td>
              </tr>
            ))}
            {data?.received.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-gray-400">No one has delegated to you.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
