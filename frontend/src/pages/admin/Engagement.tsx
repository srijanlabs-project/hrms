import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatDate } from '../../lib/format';
import { EmployeeLink } from '../../components/EmployeeLink';

interface Announcement { id: string; title: string; body: string; audience: string; publishedAt: string | null }
interface Employee { id: string; firstName: string; lastName: string | null }
interface Recognition { id: string; message: string; category: string | null; visibility: string; createdAt: string; givenBy: Employee | null; givenTo: Employee | null }
interface Survey { id: string; title: string; isAnonymous: boolean; opensAt: string; closesAt: string; responseCount: number }

export function Engagement() {
  const [tab, setTab] = useState<'announcements' | 'recognitions' | 'surveys'>('announcements');
  const { data: announcements, isLoading: la } = useQuery({ queryKey: ['announcements'], queryFn: () => api.get<Announcement[]>('/announcements'), enabled: tab === 'announcements' });
  const { data: recognitions, isLoading: lr } = useQuery({ queryKey: ['recognitions'], queryFn: () => api.get<Recognition[]>('/recognitions'), enabled: tab === 'recognitions' });
  const { data: surveys, isLoading: ls } = useQuery({ queryKey: ['surveys'], queryFn: () => api.get<Survey[]>('/surveys'), enabled: tab === 'surveys' });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Engagement</h1>
      <div className="flex gap-4 mb-4 border-b">
        {(['announcements', 'recognitions', 'surveys'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'announcements' && (
        <div className="space-y-3">
          {la && <p className="text-gray-400">Loading...</p>}
          {announcements?.map((a) => (
            <div key={a.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{a.title}</h3>
                <span className="text-xs text-gray-400">{a.publishedAt ? formatDate(a.publishedAt) : 'Draft'}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{a.body}</p>
              <span className="text-xs text-gray-400 mt-2 inline-block capitalize">Audience: {a.audience}</span>
            </div>
          ))}
          {announcements?.length === 0 && <p className="text-gray-400">No announcements yet.</p>}
        </div>
      )}

      {tab === 'recognitions' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-500">
              <tr><th className="px-4 py-2">From</th><th className="px-4 py-2">To</th><th className="px-4 py-2">Message</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Date</th></tr>
            </thead>
            <tbody>
              {lr && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
              {recognitions?.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{r.givenBy ? <EmployeeLink employeeId={r.givenBy.id} name={`${r.givenBy.firstName} ${r.givenBy.lastName ?? ''}`} /> : '—'}</td>
                  <td className="px-4 py-2">{r.givenTo ? <EmployeeLink employeeId={r.givenTo.id} name={`${r.givenTo.firstName} ${r.givenTo.lastName ?? ''}`} /> : '—'}</td>
                  <td className="px-4 py-2">{r.message}</td>
                  <td className="px-4 py-2">{r.category ?? '—'}</td>
                  <td className="px-4 py-2">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
              {recognitions?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No recognitions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'surveys' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-500">
              <tr><th className="px-4 py-2">Survey</th><th className="px-4 py-2">Anonymous</th><th className="px-4 py-2">Window</th><th className="px-4 py-2">Responses</th></tr>
            </thead>
            <tbody>
              {ls && <tr><td colSpan={4} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
              {surveys?.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{s.title}</td>
                  <td className="px-4 py-2">{s.isAnonymous ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{formatDate(s.opensAt)} - {formatDate(s.closesAt)}</td>
                  <td className="px-4 py-2">{s.responseCount}</td>
                </tr>
              ))}
              {surveys?.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-gray-400">No surveys yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
