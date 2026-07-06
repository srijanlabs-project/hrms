import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { formatDate } from '../lib/format';
import { Modal } from './Modal';

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
  department?: { name: string } | null;
  designation?: { name: string } | null;
  manager?: { id: string; firstName: string; lastName: string | null } | null;
}

/**
 * Every place an employee's name is rendered as plain text should use this
 * instead — click opens a profile summary in a modal without navigating away
 * from whatever list/detail screen you were on.
 */
export function EmployeeLink({ employeeId, name }: { employeeId: string | null | undefined; name: string }) {
  const [open, setOpen] = useState(false);
  if (!employeeId) return <span>{name}</span>;

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="text-brand-600 hover:underline text-left">
        {name}
      </button>
      {open && <EmployeeProfileModal employeeId={employeeId} onClose={() => setOpen(false)} />}
    </>
  );
}

function EmployeeProfileModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get<EmployeeFull>(`/employees/${employeeId}`),
  });

  return (
    <Modal title={isLoading ? 'Loading...' : `${employee?.firstName ?? ''} ${employee?.lastName ?? ''}`} onClose={onClose}>
      {isLoading && <p className="text-gray-400 text-sm">Loading...</p>}
      {employee && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Code</span><div>{employee.employeeCode}</div></div>
            <div><span className="text-gray-500">Status</span><div>{employee.employmentStatus}</div></div>
            <div><span className="text-gray-500">Department</span><div>{employee.department?.name ?? '—'}</div></div>
            <div><span className="text-gray-500">Designation</span><div>{employee.designation?.name ?? '—'}</div></div>
            <div>
              <span className="text-gray-500">Manager</span>
              <div>{employee.manager ? <EmployeeLink employeeId={employee.manager.id} name={`${employee.manager.firstName} ${employee.manager.lastName ?? ''}`} /> : '—'}</div>
            </div>
            <div><span className="text-gray-500">Joined</span><div>{formatDate(employee.dateOfJoining)}</div></div>
            <div><span className="text-gray-500">Email</span><div>{employee.personalEmail ?? '—'}</div></div>
            <div><span className="text-gray-500">Phone</span><div>{employee.phone ?? '—'}</div></div>
          </div>
          <Link to={`/admin/employees/${employee.id}`} onClick={onClose} className="text-sm text-brand-600 hover:underline block">
            View full profile &rarr;
          </Link>
        </div>
      )}
    </Modal>
  );
}
