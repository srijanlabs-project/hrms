import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate, formatTime } from '../../lib/format';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}

export function MyAttendance() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const { data: records, isLoading } = useQuery({ queryKey: ['my-attendance'], queryFn: () => api.get<AttendanceRecord[]>(`/attendance?from=${from}&to=${to}`) });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Attendance</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Check-in</th><th className="px-4 py-2">Check-out</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {records?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{formatDate(r.date)}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">{formatTime(r.checkIn)}</td>
                <td className="px-4 py-2">{formatTime(r.checkOut)}</td>
              </tr>
            ))}
            {records?.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-gray-400">No records this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
