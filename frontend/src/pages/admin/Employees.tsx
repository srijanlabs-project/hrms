import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  employmentStatus: string;
  employmentType: string;
  dateOfJoining: string;
}

export function Employees() {
  const queryClient = useQueryClient();
  const { data: employees, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeCode: '', firstName: '', lastName: '', dateOfJoining: '', employmentType: 'full_time' });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.post('/employees', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowForm(false);
      setForm({ employeeCode: '', firstName: '', lastName: '', dateOfJoining: '', employmentType: 'full_time' });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <button onClick={() => setShowForm((s) => !s)} className="bg-brand-600 text-white text-sm rounded px-3 py-1.5">
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            createMutation.mutate();
          }}
          className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-2 gap-3"
        >
          <input required placeholder="Employee code" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input required type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="border rounded px-3 py-2 text-sm">
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
          <div className="col-span-2">
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button disabled={createMutation.isPending} className="bg-brand-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-50">
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>
            )}
            {employees?.map((e) => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{e.employeeCode}</td>
                <td className="px-4 py-2">
                  <Link to={`/admin/employees/${e.id}`} className="text-brand-600 hover:underline">
                    {e.firstName} {e.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2">{e.employmentStatus}</td>
                <td className="px-4 py-2">{e.employmentType}</td>
                <td className="px-4 py-2">{formatDate(e.dateOfJoining)}</td>
              </tr>
            ))}
            {employees?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No employees yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
