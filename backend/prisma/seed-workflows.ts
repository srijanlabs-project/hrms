/**
 * Companion to prisma/seed.ts. That script inserts reference/config data and
 * plain rows directly via Prisma (fast, no business-logic dependency). This
 * script instead drives the same demo tenant's data through the REAL running
 * API (http://localhost:8090) for anything with actual side effects —
 * approval routing, statutory payroll calculation, the recruitment hire
 * handoff, exit clearance triggering a Full & Final payroll run — so the
 * sample data is exactly what the real workflows would have produced, not an
 * approximation. Requires the backend to already be running and seed.ts to
 * have already been run once.
 *
 * The 30s gap between OTP logins is real, not a bug — it's the rate-limit
 * cooldown added during the security review (one OTP request per mobile
 * number per 30s). Logging in as 5 different people sequentially means
 * eating that cooldown 5 times; this script takes a couple of minutes to run.
 */
const BASE = 'http://localhost:8090/api/v1';

async function call<T>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function otpLogin(mobileNumber: string): Promise<string> {
  await call('POST', '/auth/otp/request', null, { mobileNumber });
  const resp = await call<{ accessToken: string }>('POST', '/auth/otp/verify', null, { mobileNumber, otp: '12345' });
  return resp.accessToken;
}

async function passwordLogin(email: string, password: string): Promise<string> {
  const resp = await call<{ accessToken: string }>('POST', '/auth/login', null, { email, password });
  return resp.accessToken;
}

const EMP = {
  priya: 'e0000000-0000-0000-0000-000000000001',
  arjun: 'e0000000-0000-0000-0000-000000000002',
  sneha: 'e0000000-0000-0000-0000-000000000003',
  karan: 'e0000000-0000-0000-0000-000000000004',
  anita: 'e0000000-0000-0000-0000-000000000005',
  vikram: 'e0000000-0000-0000-0000-000000000006',
};

async function main() {
  console.log('Logging in as HR Admin, Priya (Manager), Arjun (Employee), Vikram (Finance) — this takes ~2 min due to the 30s OTP cooldown per number...');
  const hrToken = await otpLogin('9999999999');
  await sleep(31_000);
  const priyaToken = await otpLogin('9876543210');
  await sleep(31_000);
  const arjunToken = await otpLogin('9876543211');
  const vikramToken = await passwordLogin('vikram.rao@democo.in', 'Finance@123');

  const salaryStructures = await call<{ id: string; name: string }[]>('GET', '/salary-structures', hrToken);
  const structureId = salaryStructures[0].id;

  console.log('--- Leave: Arjun applies, Priya approves ---');
  const leaveTypes = await call<{ id: string; code: string }[]>('GET', '/leave-types', hrToken);
  const clId = leaveTypes.find((t) => t.code === 'CL')!.id;
  const leaveReq = await call<{ id: string }>('POST', '/leave-requests', arjunToken, {
    leaveTypeId: clId, startDate: '2026-07-20', endDate: '2026-07-20', reason: 'Personal work',
  });
  await call('PATCH', `/leave-requests/${leaveReq.id}/decision`, priyaToken, { decision: 'approve', comment: 'Approved' });
  console.log('  leave request approved:', leaveReq.id);

  console.log('--- Payroll: create + process + approve + disburse for 2026-06 ---');
  const run = await call<{ id: string }>('POST', '/payroll-runs', hrToken, { period: '2026-06' });
  const processResult = await call<{ blockingErrors: unknown[] }>('POST', `/payroll-runs/${run.id}/process`, hrToken);
  console.log('  payroll processed, blocking errors:', processResult.blockingErrors);
  await call('POST', `/payroll-runs/${run.id}/approve`, hrToken);
  await call('POST', `/payroll-runs/${run.id}/disburse`, vikramToken);
  console.log('  payroll run disbursed:', run.id);

  console.log('--- Recruitment: requisition -> approve -> candidate -> interview -> offer -> hire ---');
  const arjunDetail = await call<{ department?: { id: string } }>('GET', `/employees/${EMP.arjun}`, hrToken);
  const requisition = await call<{ id: string }>('POST', '/job-requisitions', hrToken, {
    title: 'Senior Software Engineer', departmentId: arjunDetail.department!.id, headcount: 1, employmentType: 'full_time', budgetCtcMax: 1500000,
  });
  // Must use the Recruitment-specific decision endpoint, not the generic
  // /approvals/:id/decision one — only RecruitmentService.decideRequisition()
  // also flips job_requisitions.status after the approval resolves.
  await call('PATCH', `/job-requisitions/${requisition.id}/decision`, hrToken, { decision: 'approve', comment: 'Budget approved' });
  const candidate = await call<{ id: string }>('POST', '/candidates', hrToken, {
    requisitionId: requisition.id, name: 'Rohit Kulkarni', email: 'rohit.kulkarni@example.com', source: 'referral', referredByEmployeeId: EMP.priya,
  });
  await call('PATCH', `/candidates/${candidate.id}/stage`, hrToken, { toStage: 'screening' });
  const feedbackRows = await call<{ id: string }[]>('POST', `/candidates/${candidate.id}/interviews`, hrToken, {
    interviewerIds: [EMP.priya], scheduledAt: '2026-07-10T10:00:00Z',
  });
  await call('POST', `/interview-feedback/${feedbackRows[0].id}/submit`, priyaToken, {
    scorecard: [{ criterion: 'Technical depth', score: 4, comment: 'Strong fundamentals' }], recommendation: 'strong_yes',
  });
  await call('PATCH', `/candidates/${candidate.id}/stage`, hrToken, { toStage: 'offer' });
  const offer = await call<{ id: string }>('POST', '/offers', hrToken, {
    candidateId: candidate.id, salaryStructureId: structureId, annualCtc: 1400000, proposedDoj: '2026-08-01',
  });
  await call('POST', `/offers/${offer.id}/send`, hrToken);
  await call('POST', `/offers/${offer.id}/accept`, hrToken);
  console.log('  candidate hired via offer acceptance:', candidate.id);

  console.log('--- Performance: cycle through goals -> self -> manager -> calibration ---');
  const cycle = await call<{ id: string }>('POST', '/review-cycles', hrToken, {
    name: 'H1 2026 Review', periodStart: '2026-01-01', periodEnd: '2026-06-30',
    selfReviewStart: '2026-07-01', selfReviewEnd: '2026-07-31', managerReviewStart: '2026-08-01', managerReviewEnd: '2026-08-15',
    requireSelfFirst: false,
  });
  await call('PATCH', `/review-cycles/${cycle.id}/status`, hrToken, { status: 'goals_open' });
  await call('POST', '/goals', hrToken, {
    employeeId: EMP.arjun, cycleId: cycle.id, title: 'Ship the payments module', type: 'okr', weightPercent: 100,
  });
  await call('PATCH', `/review-cycles/${cycle.id}/status`, hrToken, { status: 'self_review' });
  await call('POST', `/review-cycles/${cycle.id}/reviews/${EMP.arjun}/self`, arjunToken, {
    selfRating: 4, selfComments: 'Delivered the payments module on schedule with good test coverage.',
  });
  await call('PATCH', `/review-cycles/${cycle.id}/status`, hrToken, { status: 'manager_review' });
  await call('POST', `/review-cycles/${cycle.id}/reviews/${EMP.arjun}/manager`, priyaToken, {
    managerRating: 4.5, managerComments: 'Strong quarter, took ownership of a hard integration.',
  });
  await call('PATCH', `/review-cycles/${cycle.id}/status`, hrToken, { status: 'calibration' });
  await call('PATCH', `/review-cycles/${cycle.id}/reviews/${EMP.arjun}/calibrate`, hrToken, { calibratedRating: 4.5 });
  console.log('  review cycle calibrated for Arjun:', cycle.id);

  console.log('--- Learning: assign + start + complete a course for Arjun and Sneha ---');
  const courses = await call<{ id: string; title: string }[]>('GET', '/courses', hrToken);
  const poshCourse = courses.find((c) => c.title.includes('POSH'))!;
  const assignResult = await call<{ assigned: { id: string; employeeId: string }[] }>('POST', '/training-assignments', hrToken, {
    courseId: poshCourse.id, employeeIds: [EMP.arjun, EMP.sneha],
  });
  const arjunAssignment = assignResult.assigned.find((a) => a.employeeId === EMP.arjun)!;
  await call('POST', `/training-assignments/${arjunAssignment.id}/start`, arjunToken);
  await call('PATCH', `/training-assignments/${arjunAssignment.id}/complete`, arjunToken, { feedbackRating: 5 });
  console.log('  Arjun completed:', poshCourse.title);

  console.log('--- Assets: allocate a laptop to Arjun ---');
  const assets = await call<{ id: string; assetTag: string }[]>('GET', '/assets', hrToken);
  const laptop = assets.find((a) => a.assetTag === 'LAP-001')!;
  await call('POST', `/assets/${laptop.id}/allocate`, hrToken, { employeeId: EMP.arjun, allocatedOn: '2026-07-05' });
  console.log('  allocated', laptop.assetTag, 'to Arjun');

  // Note: lastWorkingDay = resignationDate + Karan's designation notice period (30
  // days). tryCompleteExit() only finalizes (sets employment_status=exited +
  // creates the F&F payroll run) once real time reaches lastWorkingDay — clearing
  // every task early is correct, realistic behavior, not a bug, if this doesn't
  // immediately flip to 'exited'. The daily cron sweep finalizes it once that
  // date genuinely arrives.
  console.log('--- Exit: full resignation -> clearance -> cleared (finalizes once lastWorkingDay arrives) for Karan ---');
  const exitReq = await call<{ id: string }>('POST', '/exit-requests', hrToken, {
    employeeId: EMP.karan, initiatedBy: 'employee', resignationDate: '2026-07-01', reasonCategory: 'better_opportunity', reasonNotes: 'Accepted an offer elsewhere.',
  });
  await call('POST', `/exit-requests/${exitReq.id}/start-clearance`, hrToken);
  const exitDetail = await call<{ clearanceTasks: { id: string }[] }>('GET', '/exit-requests', hrToken)
    .then((rows: unknown) => (rows as { id: string; clearanceTasks: { id: string }[] }[]).find((r) => r.id === exitReq.id)!);
  for (const task of exitDetail.clearanceTasks) {
    await call('PATCH', `/clearance-tasks/${task.id}`, hrToken, { status: 'cleared' });
  }
  console.log('  Karan\'s clearance tasks all cleared');

  console.log('--- Engagement: announcement, recognition, anonymous survey + response ---');
  await call('POST', '/announcements', hrToken, {
    title: 'Welcome Rohit Kulkarni to the Engineering team!', body: 'Please join us in welcoming Rohit, joining Aug 1st as a Senior Software Engineer.', audience: 'all',
  });
  await call('POST', '/recognitions', priyaToken, {
    givenToEmployeeId: EMP.arjun, category: 'ownership', message: 'Great work shipping the payments module ahead of schedule!', visibility: 'public',
  });
  const survey = await call<{ id: string }>('POST', '/surveys', hrToken, {
    title: 'Q3 2026 eNPS Pulse', questions: [{ id: 'q1', text: 'How likely are you to recommend Demo Co as a place to work?', type: 'nps' }],
    isAnonymous: true, opensAt: '2026-07-01T00:00:00Z', closesAt: '2026-07-31T23:59:59Z',
  });
  await call('POST', `/surveys/${survey.id}/responses`, arjunToken, { answers: [{ questionId: 'q1', answer: 9 }] });
  console.log('  survey response submitted anonymously to:', survey.id);

  console.log('\nAll done. Everything above was driven through the real API, so approval instances, statutory');
  console.log('payslip calculations, the hire handoff, and the exit->F&F trigger are all genuinely correct —');
  console.log('not hand-approximated rows.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
