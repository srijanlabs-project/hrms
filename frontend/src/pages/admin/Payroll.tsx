import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { formatCurrency } from '../../lib/format';
import { StatusBadge } from './Leave';

interface PayrollRun {
  id: string;
  period: string;
  runType: string;
  status: string;
  totalNet: string | null;
}

export function Payroll() {
  const queryClient = useQueryClient();
  const { data: runs, isLoading } = useQuery({ queryKey: ['payroll-runs'], queryFn: () => api.get<PayrollRun[]>('/payroll-runs') });
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);

  const createRun = useMutation({
    mutationFn: () => api.post('/payroll-runs', { period }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-runs'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const processRun = useMutation({
    mutationFn: (id: string) => api.post(`/payroll-runs/${id}/process`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-runs'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Payroll Runs</h1>
      <div className="flex items-center gap-2 mb-4">
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="border rounded px-3 py-2 text-sm" />
        <button onClick={() => { setError(null); createRun.mutate(); }} disabled={createRun.isPending} className="bg-brand-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-50">
          New Run
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Total Net</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {runs?.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{r.period}</td>
                <td className="px-4 py-2">{r.runType}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2">{formatCurrency(r.totalNet)}</td>
                <td className="px-4 py-2">
                  {r.status === 'draft' && (
                    <button onClick={() => { setError(null); processRun.mutate(r.id); }} className="text-brand-600 text-xs underline">
                      Process
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {runs?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No payroll runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
