import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';

interface EmployeeFull {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  employmentStatus: string;
  employmentType: string;
  dateOfJoining: string;
  personalEmail: string | null;
  phone: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  manager?: { firstName: string; lastName: string | null } | null;
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get<EmployeeFull>(`/employees/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <p className="text-gray-400">Loading...</p>;
  if (!employee) return <p className="text-gray-400">Employee not found.</p>;

  return (
    <div>
      <Link to="/admin/employees" className="text-sm text-brand-600 hover:underline">&larr; Back to Employees</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">
        {employee.firstName} {employee.lastName}
      </h1>
      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Employee Code</span><div>{employee.employeeCode}</div></div>
        <div><span className="text-gray-500">Status</span><div>{employee.employmentStatus}</div></div>
        <div><span className="text-gray-500">Employment Type</span><div>{employee.employmentType}</div></div>
        <div><span className="text-gray-500">Date of Joining</span><div>{formatDate(employee.dateOfJoining)}</div></div>
        <div><span className="text-gray-500">Department</span><div>{employee.department?.name ?? '—'}</div></div>
        <div><span className="text-gray-500">Designation</span><div>{employee.designation?.name ?? '—'}</div></div>
        <div><span className="text-gray-500">Manager</span><div>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName ?? ''}` : '—'}</div></div>
        <div><span className="text-gray-500">Email</span><div>{employee.personalEmail ?? '—'}</div></div>
        <div><span className="text-gray-500">Phone</span><div>{employee.phone ?? '—'}</div></div>
        <div><span className="text-gray-500">PAN</span><div>{employee.panNumber ?? '—'}</div></div>
        {/* Aadhaar is a sensitive national ID — mask all but the last 4 digits in the UI. */}
        <div><span className="text-gray-500">Aadhaar</span><div>{employee.aadhaarNumber ? `XXXX-XXXX-${employee.aadhaarNumber.slice(-4)}` : '—'}</div></div>
      </div>
    </div>
  );
}
