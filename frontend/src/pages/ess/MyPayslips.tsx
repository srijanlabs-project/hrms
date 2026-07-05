import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../lib/auth';
import { formatCurrency, formatDate } from '../../lib/format';

interface Payslip {
  id: string;
  grossEarnings: string;
  totalDeductions: string;
  netPay: string;
  status: string;
  createdAt: string;
}

export function MyPayslips() {
  const { user } = useAuth();
  const { data: payslips, isLoading } = useQuery({
    queryKey: ['my-payslips', user?.employeeId],
    queryFn: () => api.get<Payslip[]>(`/payslips/${user!.employeeId}`),
    enabled: !!user?.employeeId,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Payslips</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-500">
            <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Gross</th><th className="px-4 py-2">Deductions</th><th className="px-4 py-2">Net Pay</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">Loading...</td></tr>}
            {payslips?.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-2">{formatCurrency(p.grossEarnings)}</td>
                <td className="px-4 py-2">{formatCurrency(p.totalDeductions)}</td>
                <td className="px-4 py-2 font-medium">{formatCurrency(p.netPay)}</td>
                <td className="px-4 py-2">{p.status}</td>
              </tr>
            ))}
            {payslips?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No payslips yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
