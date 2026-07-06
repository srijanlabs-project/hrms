import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';
import { EmployeeLink } from '../../components/EmployeeLink';

interface Cycle {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  reviewCount: number;
  calibratedCount: number;
}
interface Employee { id: string; firstName: string; lastName: string | null }
interface Review {
  id: string;
  status: string;
  selfRating: string | null;
  managerRating: string | null;
  effectiveRating: string | null;
  employee: Employee | null;
}

export function Performance() {
  const { data: cycles, isLoading } = useQuery({ queryKey: ['review-cycles'], queryFn: () => api.get<Cycle[]>('/review-cycles') });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: reviews } = useQuery({
    queryKey: ['reviews', expanded],
    queryFn: () => api.get<Review[]>(`/review-cycles/${expanded}/reviews`),
    enabled: !!expanded,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Performance — Review Cycles</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Cycle</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reviews</th>
              <th className="px-4 py-2">Calibrated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {cycles?.map((c) => (
              <Fragment key={c.id}>
                <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  <td className="px-4 py-2 font-medium text-brand-600">{c.name}</td>
                  <td className="px-4 py-2">{formatDate(c.periodStart)} - {formatDate(c.periodEnd)}</td>
                  <td className="px-4 py-2"><CycleBadge status={c.status} /></td>
                  <td className="px-4 py-2">{c.reviewCount}</td>
                  <td className="px-4 py-2">{c.calibratedCount} / {c.reviewCount}</td>
                </tr>
                {expanded === c.id && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={5} className="px-4 py-3">
                      {!reviews?.length && <p className="text-gray-400 text-sm">No reviews yet.</p>}
                      {!!reviews?.length && (
                        <table className="w-full text-xs">
                          <thead className="text-gray-500 text-left">
                            <tr><th className="pb-1">Employee</th><th className="pb-1">Status</th><th className="pb-1">Self</th><th className="pb-1">Manager</th><th className="pb-1">Final</th></tr>
                          </thead>
                          <tbody>
                            {reviews.map((r) => (
                              <tr key={r.id} className="border-t">
                                <td className="py-1">{r.employee ? <EmployeeLink employeeId={r.employee.id} name={`${r.employee.firstName} ${r.employee.lastName ?? ''}`} /> : '—'}</td>
                                <td className="py-1">{r.status}</td>
                                <td className="py-1">{r.selfRating ?? '—'}</td>
                                <td className="py-1">{r.managerRating ?? '—'}</td>
                                <td className="py-1 font-medium">{r.effectiveRating ?? '—'}</td>
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
            {cycles?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No review cycles yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CycleBadge({ status }: { status: string }) {
  const color = status === 'closed' ? 'bg-gray-200 text-gray-700'
    : status === 'calibration' ? 'bg-purple-100 text-purple-700'
    : status === 'planned' ? 'bg-gray-100 text-gray-500'
    : 'bg-blue-100 text-blue-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}
