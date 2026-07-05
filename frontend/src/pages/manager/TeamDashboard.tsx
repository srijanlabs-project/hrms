import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/apiClient';

interface Employee {
  id: string;
  firstName: string;
  lastName: string | null;
  employmentStatus: string;
}

export function TeamDashboard() {
  const { user } = useAuth();
  const { data: reports, isLoading } = useQuery({
    queryKey: ['team', user?.employeeId],
    queryFn: () => api.get<Employee[]>(`/employees?managerId=${user!.employeeId}`),
    enabled: !!user?.employeeId,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Team</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={2} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {reports?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{r.firstName} {r.lastName}</td>
                <td className="px-4 py-2">{r.employmentStatus}</td>
              </tr>
            ))}
            {reports?.length === 0 && <tr><td colSpan={2} className="px-4 py-4 text-gray-400">No direct reports.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
