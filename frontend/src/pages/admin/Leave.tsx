import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  status: string;
  reason: string;
}

export function AdminLeave() {
  const { data: requests, isLoading } = useQuery({ queryKey: ['leave-requests'], queryFn: () => api.get<LeaveRequest[]>('/leave-requests') });
  const { data: leaveTypes } = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get<{ id: string; name: string }[]>('/leave-types') });

  const typeName = (id: string) => leaveTypes?.find((t) => t.id === id)?.name ?? id.slice(0, 8);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Leave Requests</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Leave Type</th>
              <th className="px-4 py-2">Dates</th>
              <th className="px-4 py-2">Days</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {requests?.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{typeName(r.leaveTypeId)}</td>
                <td className="px-4 py-2">{formatDate(r.startDate)} - {formatDate(r.endDate)}</td>
                <td className="px-4 py-2">{r.totalDays}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2">{r.reason}</td>
              </tr>
            ))}
            {requests?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = status === 'approved' ? 'bg-green-100 text-green-700'
    : status === 'rejected' ? 'bg-red-100 text-red-700'
    : status === 'pending' ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}
