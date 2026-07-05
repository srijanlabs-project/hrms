/**
 * Sample data across every module, for a single demo tenant ("Demo Co"), so
 * the product can actually be explored end-to-end rather than clicked through
 * empty. Runs as `postgres` (via DATABASE_URL), which owns the tables and so
 * bypasses RLS entirely — correct for a seed script, never do this from
 * application code (see PrismaService.withTenant for why).
 *
 * Deliberately split from the app's own workflows: config/reference data and
 * plain rows are inserted directly here (fast, no business-logic dependency);
 * anything with real side effects (approval routing, statutory payroll calc,
 * hire handoff) is instead driven through the real running API by a
 * companion script — see prisma/seed-workflows.md for that half.
 */
import { PrismaClient } from '@prisma/client';
import { resolveComponents } from '../src/payroll/component-resolver';

const prisma = new PrismaClient();

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const HR_ADMIN_ROLE_ID = '22222222-2222-2222-2222-222222222222';
const ENGINEERING_DEPT_ID = '33333333-3333-3333-3333-333333333333';
const RAHUL_EMPLOYEE_ID = '44444444-4444-4444-4444-444444444444';

async function upsertRole(id: string, name: string) {
  return prisma.role.upsert({
    where: { id },
    create: { id, tenantId: null, name, isSystemRole: true },
    update: {},
  });
}

async function main() {
  console.log('Seeding roles...');
  const managerRole = await upsertRole('66666666-6666-6666-6666-666666666666', 'Manager');
  const employeeRole = await upsertRole('77777777-7777-7777-7777-777777777777', 'Employee');
  const financeRole = await upsertRole('88888888-8888-8888-8888-888888888888', 'Finance');
  await upsertRole('99999999-9999-9999-9999-999999999999', 'Platform Admin');

  console.log('Backfilling PAN/Aadhaar on the existing demo employee...');
  await prisma.employee.update({
    where: { id: RAHUL_EMPLOYEE_ID },
    data: { panNumber: 'ABCPF1234K', aadhaarNumber: '234501234501', gender: 'male', dateOfBirth: new Date('1990-04-12') },
  });

  console.log('Seeding departments...');
  const salesDept = await prisma.department.upsert({
    where: { id: 'd0000000-0000-0000-0000-000000000001' },
    create: { id: 'd0000000-0000-0000-0000-000000000001', tenantId: TENANT_ID, name: 'Sales' },
    update: {},
  });
  const hrDept = await prisma.department.upsert({
    where: { id: 'd0000000-0000-0000-0000-000000000002' },
    create: { id: 'd0000000-0000-0000-0000-000000000002', tenantId: TENANT_ID, name: 'Human Resources' },
    update: {},
  });
  const financeDept = await prisma.department.upsert({
    where: { id: 'd0000000-0000-0000-0000-000000000003' },
    create: { id: 'd0000000-0000-0000-0000-000000000003', tenantId: TENANT_ID, name: 'Finance & Accounts' },
    update: {},
  });

  console.log('Seeding designations...');
  const desigSwe = await prisma.designation.upsert({
    where: { id: 'de000000-0000-0000-0000-000000000001' },
    create: { id: 'de000000-0000-0000-0000-000000000001', tenantId: TENANT_ID, name: 'Software Engineer', noticePeriodDays: 30 },
    update: {},
  });
  const desigMgr = await prisma.designation.upsert({
    where: { id: 'de000000-0000-0000-0000-000000000002' },
    create: { id: 'de000000-0000-0000-0000-000000000002', tenantId: TENANT_ID, name: 'Engineering Manager', noticePeriodDays: 60 },
    update: {},
  });
  const desigSales = await prisma.designation.upsert({
    where: { id: 'de000000-0000-0000-0000-000000000003' },
    create: { id: 'de000000-0000-0000-0000-000000000003', tenantId: TENANT_ID, name: 'Sales Executive', noticePeriodDays: 30 },
    update: {},
  });
  const desigHr = await prisma.designation.upsert({
    where: { id: 'de000000-0000-0000-0000-000000000004' },
    create: { id: 'de000000-0000-0000-0000-000000000004', tenantId: TENANT_ID, name: 'HR Manager', noticePeriodDays: 60 },
    update: {},
  });
  const desigAcct = await prisma.designation.upsert({
    where: { id: 'de000000-0000-0000-0000-000000000005' },
    create: { id: 'de000000-0000-0000-0000-000000000005', tenantId: TENANT_ID, name: 'Accountant', noticePeriodDays: 30 },
    update: {},
  });

  console.log('Seeding locations (Bangalore HQ with geofence, Mumbai branch)...');
  const bangalore = await prisma.location.upsert({
    where: { id: 'b1000000-0000-0000-0000-000000000001' },
    create: {
      id: 'b1000000-0000-0000-0000-000000000001', tenantId: TENANT_ID, name: 'Bangalore HQ', state: 'Karnataka',
      geofenceLatitude: 12.9716, geofenceLongitude: 77.5946, geofenceRadiusMeters: 300,
    },
    update: {},
  });
  await prisma.location.upsert({
    where: { id: 'b1000000-0000-0000-0000-000000000002' },
    create: { id: 'b1000000-0000-0000-0000-000000000002', tenantId: TENANT_ID, name: 'Mumbai Branch', state: 'Maharashtra' },
    update: {},
  });

  console.log('Seeding 2026 holidays for Bangalore...');
  const holidays: [string, string][] = [
    ['Republic Day', '2026-01-26'],
    ['Holi', '2026-03-04'],
    ['Independence Day', '2026-08-15'],
    ['Gandhi Jayanti', '2026-10-02'],
    ['Diwali', '2026-11-08'],
  ];
  for (const [name, date] of holidays) {
    await prisma.holiday.upsert({
      where: { locationId_date: { locationId: bangalore.id, date: new Date(date) } },
      create: { tenantId: TENANT_ID, locationId: bangalore.id, name, date: new Date(date) },
      update: {},
    });
  }

  console.log('Seeding default shift policy (9:30-18:30, Sat/Sun off)...');
  const shiftPolicy = await prisma.shiftPolicy.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: 'Standard Shift' } },
    create: {
      tenantId: TENANT_ID, name: 'Standard Shift',
      startTime: new Date('1970-01-01T09:30:00Z'), endTime: new Date('1970-01-01T18:30:00Z'),
      graceMinutes: 10, halfDayThresholdMinutes: 240, weeklyOffDays: [0, 6],
      overtimeEnabled: true, overtimeThresholdMinutes: 30, overtimeMultiplier: 1.5, isDefault: true,
    },
    update: {},
  });

  console.log('Seeding leave types (CL/SL/EL/ML)...');
  const clType = await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'CL' } },
    create: { tenantId: TENANT_ID, name: 'Casual Leave', code: 'CL', accrualFrequency: 'monthly', accrualRate: 1, accrualDayOfMonth: 1, maxBalance: 12, allowHalfDay: true },
    update: {},
  });
  const slType = await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'SL' } },
    create: { tenantId: TENANT_ID, name: 'Sick Leave', code: 'SL', accrualFrequency: 'monthly', accrualRate: 1, accrualDayOfMonth: 1, maxBalance: 12, requiresDocumentAboveDays: 2 },
    update: {},
  });
  const elType = await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'EL' } },
    create: { tenantId: TENANT_ID, name: 'Earned Leave', code: 'EL', accrualFrequency: 'monthly', accrualRate: 1.25, accrualDayOfMonth: 1, maxBalance: 30, maxCarryForward: 30, encashable: true, encashmentMaxDays: 15, minDaysNotice: 3 },
    update: {},
  });
  await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: 'ML' } },
    create: { tenantId: TENANT_ID, name: 'Maternity Leave', code: 'ML', accrualFrequency: 'yearly', accrualRate: 0, maxBalance: 182, applicableGender: 'female', minDaysNotice: 30 },
    update: {},
  });

  console.log('Seeding approval chains (leave, regularization, requisition)...');
  const chainConfigs: { name: string; appliesTo: 'leave' | 'regularization' | 'requisition' }[] = [
    { name: 'Standard Leave Approval', appliesTo: 'leave' },
    { name: 'Standard Regularization Approval', appliesTo: 'regularization' },
  ];
  for (const c of chainConfigs) {
    const existing = await prisma.approvalChain.findFirst({ where: { tenantId: TENANT_ID, appliesTo: c.appliesTo } });
    if (!existing) {
      await prisma.approvalChain.create({
        data: { tenantId: TENANT_ID, name: c.name, appliesTo: c.appliesTo, steps: [{ approverType: 'manager', escalationHours: 48 }] },
      });
    }
  }
  const existingRequisitionChain = await prisma.approvalChain.findFirst({ where: { tenantId: TENANT_ID, appliesTo: 'requisition' } });
  if (!existingRequisitionChain) {
    await prisma.approvalChain.create({
      data: {
        tenantId: TENANT_ID, name: 'Standard Requisition Approval', appliesTo: 'requisition',
        steps: [{ approverType: 'role', roleId: HR_ADMIN_ROLE_ID, escalationHours: 72 }],
      },
    });
  }

  console.log('Seeding illustrative Indian statutory parameters (VERIFY before real go-live)...');
  const statutoryParams: [string, number][] = [
    ['pf_wage_ceiling', 15000], ['pf_employee_rate', 0.12], ['pf_employer_rate', 0.12],
    ['eps_rate', 0.0833], ['eps_wage_ceiling', 15000],
    ['esi_wage_threshold', 21000], ['esi_employee_rate', 0.0075], ['esi_employer_rate', 0.0325],
  ];
  for (const [key, value] of statutoryParams) {
    await prisma.statutoryParameter.upsert({
      where: { key_effectiveFrom: { key, effectiveFrom: new Date('2025-04-01') } },
      create: { key, value, effectiveFrom: new Date('2025-04-01') },
      update: {},
    });
  }

  console.log('Seeding illustrative Karnataka Professional Tax slabs...');
  const existingPt = await prisma.statutoryPtSlab.findFirst({ where: { state: 'Karnataka' } });
  if (!existingPt) {
    await prisma.statutoryPtSlab.createMany({
      data: [
        { state: 'Karnataka', monthlyGrossMin: 0, monthlyGrossMax: 14999.99, ptAmount: 0, effectiveFrom: new Date('2025-04-01') },
        { state: 'Karnataka', monthlyGrossMin: 15000, monthlyGrossMax: null, ptAmount: 200, effectiveFrom: new Date('2025-04-01') },
      ],
    });
  }

  console.log('Seeding illustrative FY2026-27 new-regime TDS slabs...');
  const existingTds = await prisma.statutoryTdsSlab.findFirst({ where: { fiscalYear: '2026-27' } });
  if (!existingTds) {
    await prisma.statutoryTdsSlab.createMany({
      data: [
        { fiscalYear: '2026-27', taxRegime: 'new', incomeMin: 0, incomeMax: 300000, ratePercent: 0 },
        { fiscalYear: '2026-27', taxRegime: 'new', incomeMin: 300000, incomeMax: 700000, ratePercent: 5 },
        { fiscalYear: '2026-27', taxRegime: 'new', incomeMin: 700000, incomeMax: 1000000, ratePercent: 10 },
        { fiscalYear: '2026-27', taxRegime: 'new', incomeMin: 1000000, incomeMax: 1200000, ratePercent: 15 },
        { fiscalYear: '2026-27', taxRegime: 'new', incomeMin: 1200000, incomeMax: 1500000, ratePercent: 20 },
        { fiscalYear: '2026-27', taxRegime: 'new', incomeMin: 1500000, incomeMax: null, ratePercent: 30 },
      ],
    });
  }

  console.log('Seeding standard CTC salary structure...');
  const salaryStructure = await prisma.salaryStructure.upsert({
    where: { tenantId_name: { tenantId: TENANT_ID, name: 'Standard CTC Structure' } },
    create: {
      tenantId: TENANT_ID, name: 'Standard CTC Structure',
      components: [
        { code: 'BASIC', name: 'Basic', type: 'earning', calcType: 'percentage_of_ctc', value: 40, taxable: true, pfApplicable: true },
        { code: 'HRA', name: 'House Rent Allowance', type: 'earning', calcType: 'percentage_of_basic', value: 50, taxable: true, pfApplicable: false },
        { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', type: 'earning', calcType: 'percentage_of_ctc', value: 40, taxable: true, pfApplicable: false },
      ],
    },
    update: {},
  });

  console.log('Seeding employees...');
  type NewEmployee = {
    id: string; code: string; first: string; last: string; deptId: string; desigId: string; managerId: string | null;
    doj: string; pan: string; aadhaar: string; gender: 'male' | 'female'; dob: string; phone: string; email: string;
  };
  const employees: NewEmployee[] = [
    { id: 'e0000000-0000-0000-0000-000000000001', code: 'EMP-002', first: 'Priya', last: 'Sharma', deptId: ENGINEERING_DEPT_ID, desigId: desigMgr.id, managerId: null, doj: '2024-01-15', pan: 'ABCPS5678L', aadhaar: '234501234502', gender: 'female', dob: '1988-06-20', phone: '9876543210', email: 'priya.sharma@democo.in' },
    { id: 'e0000000-0000-0000-0000-000000000002', code: 'EMP-003', first: 'Arjun', last: 'Mehta', deptId: ENGINEERING_DEPT_ID, desigId: desigSwe.id, managerId: 'e0000000-0000-0000-0000-000000000001', doj: '2024-08-01', pan: 'ABCPM4321M', aadhaar: '234501234503', gender: 'male', dob: '1996-11-02', phone: '9876543211', email: 'arjun.mehta@democo.in' },
    { id: 'e0000000-0000-0000-0000-000000000003', code: 'EMP-004', first: 'Sneha', last: 'Reddy', deptId: ENGINEERING_DEPT_ID, desigId: desigSwe.id, managerId: 'e0000000-0000-0000-0000-000000000001', doj: '2025-02-10', pan: 'ABCPR8765N', aadhaar: '234501234504', gender: 'female', dob: '1997-03-15', phone: '9876543212', email: 'sneha.reddy@democo.in' },
    { id: 'e0000000-0000-0000-0000-000000000004', code: 'EMP-005', first: 'Karan', last: 'Singh', deptId: salesDept.id, desigId: desigSales.id, managerId: null, doj: '2023-05-20', pan: 'ABCPK2468P', aadhaar: '234501234505', gender: 'male', dob: '1992-09-08', phone: '9876543213', email: 'karan.singh@democo.in' },
    { id: 'e0000000-0000-0000-0000-000000000005', code: 'EMP-006', first: 'Anita', last: 'Desai', deptId: hrDept.id, desigId: desigHr.id, managerId: null, doj: '2022-11-01', pan: 'ABCPD1357Q', aadhaar: '234501234506', gender: 'female', dob: '1985-01-30', phone: '9876543214', email: 'anita.desai@democo.in' },
    { id: 'e0000000-0000-0000-0000-000000000006', code: 'EMP-007', first: 'Vikram', last: 'Rao', deptId: financeDept.id, desigId: desigAcct.id, managerId: null, doj: '2023-09-12', pan: 'ABCPV9753R', aadhaar: '234501234507', gender: 'male', dob: '1990-07-25', phone: '9876543215', email: 'vikram.rao@democo.in' },
  ];

  const annualCtc: Record<string, number> = {
    'e0000000-0000-0000-0000-000000000001': 1800000,
    'e0000000-0000-0000-0000-000000000002': 900000,
    'e0000000-0000-0000-0000-000000000003': 850000,
    'e0000000-0000-0000-0000-000000000004': 600000,
    'e0000000-0000-0000-0000-000000000005': 1200000,
    'e0000000-0000-0000-0000-000000000006': 700000,
  };

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      create: {
        id: e.id, tenantId: TENANT_ID, employeeCode: e.code, firstName: e.first, lastName: e.last,
        dateOfBirth: new Date(e.dob), gender: e.gender, personalEmail: e.email, phone: e.phone,
        panNumber: e.pan, aadhaarNumber: e.aadhaar,
        departmentId: e.deptId, designationId: e.desigId, managerId: e.managerId,
        dateOfJoining: new Date(e.doj), employmentType: 'full_time', employmentStatus: 'active', workLocationId: bangalore.id,
      },
      update: {},
    });

    const resolved = resolveComponents(salaryStructure.components as never, annualCtc[e.id]);
    await prisma.employeeCompensation.upsert({
      where: { id: `c${e.id.slice(1)}` },
      create: {
        id: `c${e.id.slice(1)}`, tenantId: TENANT_ID, employeeId: e.id, salaryStructureId: salaryStructure.id,
        annualCtc: annualCtc[e.id], effectiveFrom: new Date(e.doj), resolvedComponents: resolved as never, taxRegime: 'new',
      },
      update: {},
    });

    for (const [type, opening] of [[clType, 6], [slType, 6], [elType, 8]] as const) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_period: { employeeId: e.id, leaveTypeId: type.id, period: '2026-07' } },
        create: { tenantId: TENANT_ID, employeeId: e.id, leaveTypeId: type.id, period: '2026-07', openingBalance: opening, accrued: type.code === 'EL' ? 1.25 * 6 : 6 },
        update: {},
      });
    }
  }
  // Give Rahul (HR Admin/founder) balances too so his own ESS screens aren't empty.
  for (const [type, opening] of [[clType, 12], [slType, 12], [elType, 15]] as const) {
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_period: { employeeId: RAHUL_EMPLOYEE_ID, leaveTypeId: type.id, period: '2026-07' } },
      create: { tenantId: TENANT_ID, employeeId: RAHUL_EMPLOYEE_ID, leaveTypeId: type.id, period: '2026-07', openingBalance: opening, accrued: 0 },
      update: {},
    });
  }

  console.log('Seeding users (Priya=Manager, Arjun=Employee, Vikram=Finance w/ password)...');
  await prisma.user.upsert({
    where: { id: 'b2000000-0000-0000-0000-000000000001' },
    create: { id: 'b2000000-0000-0000-0000-000000000001', tenantId: TENANT_ID, mobileNumber: '9876543210', roleId: managerRole.id, employeeId: 'e0000000-0000-0000-0000-000000000001' },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: 'b2000000-0000-0000-0000-000000000002' },
    create: { id: 'b2000000-0000-0000-0000-000000000002', tenantId: TENANT_ID, mobileNumber: '9876543211', roleId: employeeRole.id, employeeId: 'e0000000-0000-0000-0000-000000000002' },
    update: {},
  });
  // scrypt hash of "Finance@123" — format matches password.util.ts's `${salt}:${hash}` (hashPasswordForSeed logic).
  const { scryptSync, randomBytes } = await import('crypto');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('Finance@123', salt, 64).toString('hex');
  await prisma.user.upsert({
    where: { id: 'b2000000-0000-0000-0000-000000000003' },
    create: {
      id: 'b2000000-0000-0000-0000-000000000003', tenantId: TENANT_ID, mobileNumber: '9000000003',
      email: 'vikram.rao@democo.in', passwordHash: `${salt}:${hash}`, roleId: financeRole.id, employeeId: 'e0000000-0000-0000-0000-000000000006',
    },
    update: {},
  });

  console.log('Seeding attendance for the last 10 calendar days (Priya, Arjun, Sneha)...');
  const today = new Date('2026-07-05');
  for (const empId of ['e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003']) {
    for (let i = 1; i <= 10; i++) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - i);
      const weekday = date.getUTCDay();
      if (weekday === 0 || weekday === 6) continue; // weekly off, nightly job would set this — skip for seed simplicity
      const isLateDay = i === 3;
      const isAbsentDay = i === 7 && empId === 'e0000000-0000-0000-0000-000000000003';
      if (isAbsentDay) {
        await prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: empId, date } },
          create: { tenantId: TENANT_ID, employeeId: empId, date, shiftPolicyId: shiftPolicy.id, status: 'absent' },
          update: {},
        });
        continue;
      }
      const checkIn = new Date(date);
      checkIn.setUTCHours(isLateDay ? 4 : 4, isLateDay ? 15 : 0, 0, 0); // 09:30/09:45 IST = 04:00/04:15 UTC
      const checkOut = new Date(date);
      checkOut.setUTCHours(13, 0, 0, 0); // 18:30 IST
      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: empId, date } },
        create: {
          tenantId: TENANT_ID, employeeId: empId, date, shiftPolicyId: shiftPolicy.id, status: 'present',
          checkIn, checkOut, checkInSource: 'web', workedMinutes: 540, isLate: isLateDay,
        },
        update: {},
      });
    }
  }

  console.log('Seeding courses (Learning)...');
  await prisma.course.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    create: { id: 'c0000000-0000-0000-0000-000000000001', tenantId: TENANT_ID, title: 'POSH Awareness Training', category: 'Compliance', durationMinutes: 45, isMandatory: true },
    update: {},
  });
  await prisma.course.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000002' },
    create: { id: 'c0000000-0000-0000-0000-000000000002', tenantId: TENANT_ID, title: 'Excel for Beginners', category: 'Skills', durationMinutes: 90, isMandatory: false },
    update: {},
  });

  console.log('Seeding assets (Assets & IT)...');
  await prisma.asset.upsert({
    where: { id: 'a0000000-0000-0000-0000-000000000001' },
    create: { id: 'a0000000-0000-0000-0000-000000000001', tenantId: TENANT_ID, assetTag: 'LAP-001', type: 'laptop', makeModel: 'Dell Latitude 5440', status: 'in_stock' },
    update: {},
  });
  await prisma.asset.upsert({
    where: { id: 'a0000000-0000-0000-0000-000000000002' },
    create: { id: 'a0000000-0000-0000-0000-000000000002', tenantId: TENANT_ID, assetTag: 'LAP-002', type: 'laptop', makeModel: 'HP ProBook 450', status: 'in_stock' },
    update: {},
  });

  console.log('Done. See prisma/seed-workflows.md for the API-driven half (leave/payroll/recruitment/etc).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
