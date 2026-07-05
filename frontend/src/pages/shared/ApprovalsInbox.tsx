import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { useState } from 'react';

interface ApprovalInstance {
  id: string;
  status: string;
  currentStep: number;
  approvalChainId: string;
}

export function ApprovalsInbox() {
  const queryClient = useQueryClient();
  const { data: pending, isLoading } = useQuery({ queryKey: ['approvals-pending'], queryFn: () => api.get<ApprovalInstance[]>('/approvals/pending') });
  const [error, setError] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => api.patch(`/approvals/${id}/decision`, { decision }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals-pending'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Approvals Inbox</h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Instance</th>
              <th className="px-4 py-2">Step</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {pending?.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">{p.id.slice(0, 8)}</td>
                <td className="px-4 py-2">{p.currentStep + 1}</td>
                <td className="px-4 py-2 space-x-2">
                  <button onClick={() => decide.mutate({ id: p.id, decision: 'approve' })} className="text-green-600 text-xs underline">Approve</button>
                  <button onClick={() => decide.mutate({ id: p.id, decision: 'reject' })} className="text-red-600 text-xs underline">Reject</button>
                </td>
              </tr>
            ))}
            {pending?.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-gray-400">Nothing pending your approval.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
