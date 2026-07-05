import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';

interface Employee { id: string; firstName: string; lastName: string | null; employeeCode: string }
interface Allocation { employeeId: string; allocatedOn: string; expectedReturnOn: string | null; employee: Employee | null }
interface Asset {
  id: string;
  assetTag: string;
  type: string;
  makeModel: string | null;
  status: string;
  currentAllocation: Allocation | null;
}

export function Assets() {
  const { data: assets, isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => api.get<Asset[]>('/assets') });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Assets</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Tag</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Make / Model</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Allocated To</th>
              <th className="px-4 py-2">Since</th>
              <th className="px-4 py-2">Expected Return</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {assets?.map((a) => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{a.assetTag}</td>
                <td className="px-4 py-2">{a.type}</td>
                <td className="px-4 py-2">{a.makeModel ?? '—'}</td>
                <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-2">
                  {a.currentAllocation?.employee
                    ? `${a.currentAllocation.employee.firstName} ${a.currentAllocation.employee.lastName ?? ''}`
                    : <span className="text-gray-400">Unallocated</span>}
                </td>
                <td className="px-4 py-2">{a.currentAllocation ? formatDate(a.currentAllocation.allocatedOn) : '—'}</td>
                <td className="px-4 py-2">{a.currentAllocation?.expectedReturnOn ? formatDate(a.currentAllocation.expectedReturnOn) : '—'}</td>
              </tr>
            ))}
            {assets?.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-gray-400">No assets yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'in_stock' ? 'bg-green-100 text-green-700'
    : status === 'allocated' ? 'bg-blue-100 text-blue-700'
    : status === 'under_repair' ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}
