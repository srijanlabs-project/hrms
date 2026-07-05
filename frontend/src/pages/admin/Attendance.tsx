import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate, formatTime } from '../../lib/format';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
}

export function AdminAttendance() {
  const [employeeId, setEmployeeId] = useState('');
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => api.get<{ id: string; firstName: string; lastName: string | null }[]>('/employees') });
  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance', employeeId, from, to],
    queryFn: () => api.get<AttendanceRecord[]>(`/attendance?employeeId=${employeeId}&from=${from}&to=${to}`),
    enabled: !!employeeId,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Attendance (this month)</h1>
      <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="border rounded px-3 py-2 text-sm mb-4">
        <option value="">Select employee...</option>
        {employees?.map((e) => (
          <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
        ))}
      </select>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Check-in</th>
              <th className="px-4 py-2">Check-out</th>
              <th className="px-4 py-2">Worked (min)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {!employeeId && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Select an employee to view attendance.</td></tr>}
            {records?.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{formatDate(r.date)}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">{formatTime(r.checkIn)}</td>
                <td className="px-4 py-2">{formatTime(r.checkOut)}</td>
                <td className="px-4 py-2">{r.workedMinutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
