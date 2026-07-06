import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { useState } from 'react';
import { EmployeeLink } from '../../components/EmployeeLink';

interface Summary {
  type: string;
  employee: { id: string; firstName: string; lastName: string | null } | null;
  headline: string;
  detail: string;
}
interface ApprovalInstance {
  id: string;
  status: string;
  currentStep: number;
  summary: Summary | null;
}

export function ApprovalsInbox() {
  const queryClient = useQueryClient();
  const { data: pending, isLoading } = useQuery({ queryKey: ['approvals-pending'], queryFn: () => api.get<ApprovalInstance[]>('/approvals/pending') });
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api.patch(`/approvals/${id}/decision`, { decision, comment: comment[id] || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals-pending'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Approvals Inbox</h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {isLoading && <p className="text-gray-400">Loading...</p>}
      {pending?.length === 0 && <p className="text-gray-400">Nothing pending your approval.</p>}
      <div className="space-y-3">
        {pending?.map((p) => (
          <div key={p.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{p.summary?.type ?? 'Approval'}</div>
                <div className="font-medium mt-0.5">
                  {p.summary?.employee
                    ? <EmployeeLink employeeId={p.summary.employee.id} name={`${p.summary.employee.firstName} ${p.summary.employee.lastName ?? ''}`} />
                    : 'Unknown requester'}
                  {p.summary && <span className="text-gray-600 font-normal"> — {p.summary.headline}</span>}
                </div>
                {p.summary?.detail && <div className="text-sm text-gray-500 mt-1">{p.summary.detail}</div>}
              </div>
              <span className="text-xs text-gray-400">Step {p.currentStep + 1}</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                placeholder="Comment (optional)"
                value={comment[p.id] ?? ''}
                onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })}
                className="border rounded px-2 py-1 text-sm flex-1"
              />
              <button onClick={() => decide.mutate({ id: p.id, decision: 'approve' })} className="bg-green-600 text-white text-xs rounded px-3 py-1.5">
                Approve
              </button>
              <button onClick={() => decide.mutate({ id: p.id, decision: 'reject' })} className="bg-red-600 text-white text-xs rounded px-3 py-1.5">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
