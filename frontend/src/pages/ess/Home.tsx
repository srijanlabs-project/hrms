import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../lib/auth';

export function EssHome() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const punch = useMutation({
    mutationFn: (type: 'check_in' | 'check_out') =>
      api.post('/attendance/punch', { type, source: 'web', clientTimestamp: new Date().toISOString() }),
    onSuccess: (_, type) => {
      setError(null);
      setMessage(type === 'check_in' ? 'Checked in!' : 'Checked out!');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
      <p className="text-gray-500 mb-6">Employee ID: {user?.employeeId?.slice(0, 8)}</p>
      <div className="bg-white rounded-lg shadow p-6 max-w-sm">
        <h2 className="font-medium mb-4">Today</h2>
        <div className="flex gap-3">
          <button onClick={() => punch.mutate('check_in')} disabled={punch.isPending} className="flex-1 bg-brand-600 text-white rounded py-2 text-sm disabled:opacity-50">
            Check In
          </button>
          <button onClick={() => punch.mutate('check_out')} disabled={punch.isPending} className="flex-1 bg-gray-700 text-white rounded py-2 text-sm disabled:opacity-50">
            Check Out
          </button>
        </div>
        {message && <p className="text-sm text-green-600 mt-3">{message}</p>}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
