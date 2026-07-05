import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

interface Employee {
  id: string;
  employmentStatus: string;
}

export function AdminDashboard() {
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const { data: pendingApprovals } = useQuery({ queryKey: ['approvals-pending'], queryFn: () => api.get<unknown[]>('/approvals/pending') });

  const active = employees?.filter((e) => e.employmentStatus === 'active').length ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Employees</div>
          <div className="text-3xl font-semibold mt-1">{employees?.length ?? '—'}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-3xl font-semibold mt-1">{active}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pending Approvals</div>
          <div className="text-3xl font-semibold mt-1">{pendingApprovals?.length ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
