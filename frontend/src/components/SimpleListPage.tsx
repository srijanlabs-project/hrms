import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient';
import { formatDate } from '../lib/format';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Generic real-data list view for lower-priority screens — renders whatever
// fields come back as a simple table. Bespoke pages (Leave, Attendance,
// Payslips) replace this where the interaction is more than "view a list".
export function SimpleListPage({ title, path, columns }: { title: string; path: string; columns: string[] }) {
  const { data, isLoading, error } = useQuery<Record<string, unknown>[]>({
    queryKey: ['simple-list', path],
    queryFn: () => api.get(path),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{title}</h1>
      {error && <p className="text-sm text-red-600 mb-4">Failed to load: {(error as Error).message}</p>}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-4 py-2 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={columns.length} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {data?.map((row, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c} className="px-4 py-2 whitespace-nowrap">{formatCell(row[c])}</td>
                ))}
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-4 text-gray-400">No records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) return formatDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
