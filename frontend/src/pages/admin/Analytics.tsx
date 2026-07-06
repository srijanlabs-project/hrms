import { ReactElement, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../../lib/apiClient';
import { formatCurrency } from '../../lib/format';

interface Overview {
  headcount: { total: number; active: number; onNotice: number; preBoarding: number; exited: number; byDepartment: { name: string; count: number }[] };
  headcountTrend: { month: string; joined: number; exited: number }[];
  attritionRatePercent: number;
  genderDiversity: { gender: string; count: number }[];
  attendanceRatePercent: number | null;
  leaveTrend: { month: string; days: number }[];
  payrollTrend: { month: string; totalNet: number }[];
  recruitmentFunnel: { stage: string; count: number }[];
}

const COLORS = ['#2f4bc4', '#3b5bdb', '#6b8afd', '#a3b8ff', '#d9e6ff'];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        {children as ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function Analytics() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-overview'], queryFn: () => api.get<Overview>('/analytics/overview') });

  if (isLoading) return <p className="text-gray-400">Loading...</p>;
  if (!data) return <p className="text-gray-400">No data.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={data.headcount.total} sub={`${data.headcount.active} active`} />
        <StatCard label="On Notice" value={data.headcount.onNotice} />
        <StatCard label="Attrition (12mo)" value={`${data.attritionRatePercent}%`} />
        <StatCard label="Attendance (this month)" value={data.attendanceRatePercent != null ? `${data.attendanceRatePercent}%` : '—'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Headcount by Department">
          <BarChart data={data.headcount.byDepartment}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Gender Diversity">
          <PieChart>
            <Pie data={data.genderDiversity} dataKey="count" nameKey="gender" cx="50%" cy="50%" outerRadius={70} label>
              {data.genderDiversity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        <ChartCard title="Headcount Trend (12 months) — Joined vs Exited">
          <LineChart data={data.headcountTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="joined" stroke={COLORS[0]} strokeWidth={2} />
            <Line type="monotone" dataKey="exited" stroke="#dc2626" strokeWidth={2} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Leave Days Taken (6 months)">
          <BarChart data={data.leaveTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="days" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Payroll Cost Trend (6 months)">
          <LineChart data={data.payrollTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={80} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Line type="monotone" dataKey="totalNet" stroke={COLORS[0]} strokeWidth={2} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Recruitment Funnel">
          <BarChart data={data.recruitmentFunnel} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
            <Tooltip />
            <Bar dataKey="count" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
