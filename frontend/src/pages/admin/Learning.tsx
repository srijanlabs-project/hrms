import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';

interface Course {
  id: string;
  title: string;
  category: string | null;
  isMandatory: boolean;
  assignedCount: number;
  completedCount: number;
}
interface Employee { firstName: string; lastName: string | null; employeeCode: string }
interface Assignment { id: string; status: string; dueDate: string | null; employee: Employee | null }

export function Learning() {
  const { data: courses, isLoading } = useQuery({ queryKey: ['courses'], queryFn: () => api.get<Course[]>('/courses') });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: assignments } = useQuery({
    queryKey: ['training-assignments', expanded],
    queryFn: () => api.get<Assignment[]>(`/training-assignments?courseId=${expanded}`),
    enabled: !!expanded,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Learning — Courses</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Mandatory</th>
              <th className="px-4 py-2">Assigned</th>
              <th className="px-4 py-2">Completed</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {courses?.map((c) => (
              <Fragment key={c.id}>
                <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  <td className="px-4 py-2 font-medium text-brand-600">{c.title}</td>
                  <td className="px-4 py-2">{c.category ?? '—'}</td>
                  <td className="px-4 py-2">{c.isMandatory ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{c.assignedCount}</td>
                  <td className="px-4 py-2">
                    {c.completedCount} / {c.assignedCount}
                    {c.assignedCount > 0 && (
                      <span className="text-gray-400 ml-1">({Math.round((c.completedCount / c.assignedCount) * 100)}%)</span>
                    )}
                  </td>
                </tr>
                {expanded === c.id && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={5} className="px-4 py-3">
                      {!assignments?.length && <p className="text-gray-400 text-sm">No one assigned yet.</p>}
                      {!!assignments?.length && (
                        <table className="w-full text-xs">
                          <thead className="text-gray-500 text-left">
                            <tr><th className="pb-1">Employee</th><th className="pb-1">Status</th><th className="pb-1">Due Date</th></tr>
                          </thead>
                          <tbody>
                            {assignments.map((a) => (
                              <tr key={a.id} className="border-t">
                                <td className="py-1">{a.employee ? `${a.employee.firstName} ${a.employee.lastName ?? ''}` : '—'}</td>
                                <td className="py-1"><AssignmentBadge status={a.status} /></td>
                                <td className="py-1">{formatDate(a.dueDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {courses?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No courses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssignmentBadge({ status }: { status: string }) {
  const color = status === 'completed' ? 'bg-green-100 text-green-700'
    : status === 'overdue' ? 'bg-red-100 text-red-700'
    : status === 'in_progress' ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`px-1.5 py-0.5 rounded font-medium ${color}`}>{status}</span>;
}
