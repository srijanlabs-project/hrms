import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { formatCurrency } from '../../lib/format';
import { EmployeeLink } from '../../components/EmployeeLink';

interface Requisition {
  id: string;
  title: string;
  status: string;
  headcount: number;
  budgetCtcMax: string | null;
  departmentName: string | null;
  candidateCount: number;
}
interface Employee { id: string; firstName: string; lastName: string | null }
interface Candidate {
  id: string;
  name: string;
  currentStage: string;
  source: string;
  requisitionTitle: string | null;
  referrer: Employee | null;
  interviewCount: number;
}

export function Recruitment() {
  const [tab, setTab] = useState<'requisitions' | 'candidates'>('requisitions');
  const { data: requisitions, isLoading: loadingReq } = useQuery({ queryKey: ['job-requisitions'], queryFn: () => api.get<Requisition[]>('/job-requisitions') });
  const { data: candidates, isLoading: loadingCand } = useQuery({ queryKey: ['candidates'], queryFn: () => api.get<Candidate[]>('/candidates') });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Recruitment</h1>
      <div className="flex gap-4 mb-4 border-b">
        <button onClick={() => setTab('requisitions')} className={`pb-2 text-sm font-medium ${tab === 'requisitions' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>
          Job Requisitions
        </button>
        <button onClick={() => setTab('candidates')} className={`pb-2 text-sm font-medium ${tab === 'candidates' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>
          Candidates
        </button>
      </div>

      {tab === 'requisitions' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Headcount</th>
                <th className="px-4 py-2">Budget (Max CTC)</th>
                <th className="px-4 py-2">Candidates</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingReq && <tr><td colSpan={6} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
              {requisitions?.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.title}</td>
                  <td className="px-4 py-2">{r.departmentName ?? '—'}</td>
                  <td className="px-4 py-2">{r.headcount}</td>
                  <td className="px-4 py-2">{formatCurrency(r.budgetCtcMax)}</td>
                  <td className="px-4 py-2">{r.candidateCount}</td>
                  <td className="px-4 py-2"><RequisitionBadge status={r.status} /></td>
                </tr>
              ))}
              {requisitions?.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-gray-400">No requisitions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'candidates' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">Requisition</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Referred By</th>
                <th className="px-4 py-2">Interviews</th>
              </tr>
            </thead>
            <tbody>
              {loadingCand && <tr><td colSpan={6} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
              {candidates?.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.requisitionTitle ?? '—'}</td>
                  <td className="px-4 py-2"><StageBadge stage={c.currentStage} /></td>
                  <td className="px-4 py-2">{c.source}</td>
                  <td className="px-4 py-2">
                    {c.referrer ? <EmployeeLink employeeId={c.referrer.id} name={`${c.referrer.firstName} ${c.referrer.lastName ?? ''}`} /> : '—'}
                  </td>
                  <td className="px-4 py-2">{c.interviewCount}</td>
                </tr>
              ))}
              {candidates?.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-gray-400">No candidates yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RequisitionBadge({ status }: { status: string }) {
  const color = status === 'open' ? 'bg-green-100 text-green-700'
    : status === 'pending_approval' ? 'bg-amber-100 text-amber-700'
    : status === 'closed' ? 'bg-gray-200 text-gray-700'
    : 'bg-blue-100 text-blue-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}

function StageBadge({ stage }: { stage: string }) {
  const color = stage === 'hired' ? 'bg-green-100 text-green-700'
    : stage === 'rejected' || stage === 'withdrawn' ? 'bg-red-100 text-red-700'
    : stage === 'offer' ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{stage}</span>;
}
