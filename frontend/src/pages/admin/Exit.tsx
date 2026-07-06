import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';
import { EmployeeLink } from '../../components/EmployeeLink';

interface Employee { id: string; firstName: string; lastName: string | null; employeeCode: string; department?: { name: string } | null }
interface ClearanceTask { id: string; department: string; status: string; blockedReason: string | null; assigneeName: string; assigneeEmployeeId: string | null }
interface ExitRequest {
  id: string;
  status: string;
  resignationDate: string;
  lastWorkingDay: string;
  reasonCategory: string | null;
  reasonNotes: string | null;
  employee: Employee | null;
  clearanceTasks: ClearanceTask[];
}

export function Exit() {
  const { data: requests, isLoading } = useQuery({ queryKey: ['exit-requests'], queryFn: () => api.get<ExitRequest[]>('/exit-requests') });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Exit Requests</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Resigned</th>
              <th className="px-4 py-2">Last Working Day</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Clearance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {requests?.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-4 py-2 font-medium">
                    {r.employee
                      ? <EmployeeLink employeeId={r.employee.id} name={`${r.employee.firstName} ${r.employee.lastName ?? ''}`} />
                      : '—'}
                    <span className="text-gray-400 text-xs ml-1">{r.employee?.employeeCode}</span>
                  </td>
                  <td className="px-4 py-2">{r.employee?.department?.name ?? '—'}</td>
                  <td className="px-4 py-2">{r.reasonCategory ?? '—'}</td>
                  <td className="px-4 py-2">{formatDate(r.resignationDate)}</td>
                  <td className="px-4 py-2">{formatDate(r.lastWorkingDay)}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2">
                    {r.clearanceTasks.filter((t) => t.status === 'cleared').length}/{r.clearanceTasks.length} cleared
                    {r.clearanceTasks.some((t) => t.status === 'blocked') && (
                      <span className="ml-2 text-red-600 text-xs font-medium">⚠ blocked</span>
                    )}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={7} className="px-4 py-3">
                      {r.reasonNotes && <p className="text-gray-600 mb-3 text-sm">"{r.reasonNotes}"</p>}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {r.clearanceTasks.map((t) => (
                          <div key={t.id} className="bg-white rounded border p-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium capitalize">{t.department}</span>
                              <ClearanceBadge status={t.status} />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Assignee: {t.assigneeEmployeeId ? <EmployeeLink employeeId={t.assigneeEmployeeId} name={t.assigneeName} /> : t.assigneeName}
                            </div>
                            {t.status === 'blocked' && t.blockedReason && (
                              <div className="text-xs text-red-600 mt-1">Why: {t.blockedReason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {requests?.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-gray-400">No exit requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'exited' ? 'bg-gray-200 text-gray-700'
    : status === 'clearance_pending' ? 'bg-amber-100 text-amber-700'
    : status === 'withdrawn' ? 'bg-blue-100 text-blue-700'
    : 'bg-orange-100 text-orange-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}

function ClearanceBadge({ status }: { status: string }) {
  const color = status === 'cleared' ? 'bg-green-100 text-green-700'
    : status === 'blocked' ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}
