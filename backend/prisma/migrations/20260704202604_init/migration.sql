-- CreateEnum
CREATE TYPE "TenantTier" AS ENUM ('core_hr', 'growth', 'enterprise');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'suspended', 'churned');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('pre_boarding', 'active', 'on_notice', 'on_leave_extended', 'exited');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'intern');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('id_proof', 'contract', 'certificate', 'offer_letter', 'other');

-- CreateEnum
CREATE TYPE "ApprovalApplicability" AS ENUM ('leave', 'regularization', 'expense', 'requisition', 'loan');

-- CreateEnum
CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('pending', 'approved', 'rejected', 'escalated');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('web', 'gps', 'qr', 'biometric', 'manual');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off', 'pending');

-- CreateEnum
CREATE TYPE "RegularizationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "LeaveAccrualFrequency" AS ENUM ('monthly', 'yearly', 'none');

-- CreateEnum
CREATE TYPE "ApplicableGender" AS ENUM ('all', 'male', 'female');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancellation_pending', 'cancelled', 'withdrawn');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('old', 'new');

-- CreateEnum
CREATE TYPE "PayrollRunType" AS ENUM ('regular', 'full_and_final', 'off_cycle');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('draft', 'processing', 'review', 'approved', 'disbursed', 'closed', 'failed');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('generated', 'held', 'paid');

-- CreateEnum
CREATE TYPE "StatutoryDeductionType" AS ENUM ('pf_employee', 'pf_employer', 'eps_employer', 'esi_employee', 'esi_employer', 'pt', 'tds', 'gratuity_accrual');

-- CreateEnum
CREATE TYPE "LoanAdvanceType" AS ENUM ('loan', 'advance', 'reimbursement');

-- CreateEnum
CREATE TYPE "LoanAdvanceStatus" AS ENUM ('pending', 'approved', 'rejected', 'active', 'closed');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'open', 'on_hold', 'closed');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('career_page', 'referral', 'job_board', 'manual');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('strong_yes', 'yes', 'no', 'strong_no');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('okr', 'kra');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('planned', 'goals_open', 'self_review', 'manager_review', 'calibration', 'closed');

-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('pending', 'self_submitted', 'manager_submitted', 'calibrated', 'acknowledged');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'overdue');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('laptop', 'mobile', 'monitor', 'id_card', 'vehicle', 'other');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('in_stock', 'allocated', 'under_repair', 'retired', 'lost');

-- CreateEnum
CREATE TYPE "AllocationCondition" AS ENUM ('good', 'damaged', 'not_returned');

-- CreateEnum
CREATE TYPE "ITAccessTrigger" AS ENUM ('joining', 'department_transfer', 'exit');

-- CreateEnum
CREATE TYPE "ITAccessStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "ExitInitiatedBy" AS ENUM ('employee', 'hr_admin');

-- CreateEnum
CREATE TYPE "ExitStatus" AS ENUM ('notice_period', 'clearance_pending', 'cleared', 'withdrawn');

-- CreateEnum
CREATE TYPE "ClearanceDept" AS ENUM ('it', 'finance', 'admin', 'manager', 'hr');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('pending', 'cleared', 'blocked');

-- CreateEnum
CREATE TYPE "ExitSentiment" AS ENUM ('positive', 'neutral', 'negative');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('all', 'department', 'location');

-- CreateEnum
CREATE TYPE "RecognitionVisibility" AS ENUM ('public', 'manager_only');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "tier" "TenantTier" NOT NULL DEFAULT 'core_hr',
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "billing_cycle_start" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "mobile_number" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "role_id" UUID NOT NULL,
    "employee_id" UUID,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mobile_number" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "notice_period_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "date_of_birth" DATE,
    "gender" "Gender",
    "personal_email" TEXT,
    "phone" TEXT,
    "department_id" UUID,
    "designation_id" UUID,
    "manager_id" UUID,
    "date_of_joining" DATE NOT NULL,
    "date_of_exit" DATE,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'pre_boarding',
    "employment_type" "EmploymentType" NOT NULL,
    "work_location_id" UUID,
    "birthday_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bank_name" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "doc_type" "DocType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "expiry_date" DATE,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_chains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "applies_to" "ApprovalApplicability" NOT NULL,
    "steps" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "approval_chain_id" UUID NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'pending',
    "step_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 0,
    "half_day_threshold_minutes" INTEGER NOT NULL DEFAULT 240,
    "weekly_off_days" INTEGER[] DEFAULT ARRAY[0, 6]::INTEGER[],
    "overtime_enabled" BOOLEAN NOT NULL DEFAULT false,
    "overtime_threshold_minutes" INTEGER,
    "overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "applicable_department_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shift_policy_id" UUID NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "check_in_source" "CheckInSource",
    "check_in_latitude" DECIMAL(9,6),
    "check_in_longitude" DECIMAL(9,6),
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'absent',
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_regularized" BOOLEAN NOT NULL DEFAULT false,
    "source_leave_request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regularization_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "requested_check_in" TIMESTAMP(3),
    "requested_check_out" TIMESTAMP(3),
    "requested_status" "AttendanceStatus",
    "reason" TEXT NOT NULL,
    "status" "RegularizationStatus" NOT NULL DEFAULT 'pending',
    "approval_instance_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regularization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_user_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "biometric_device_id" UUID NOT NULL,
    "device_user_code" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,

    CONSTRAINT "biometric_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accrual_frequency" "LeaveAccrualFrequency" NOT NULL DEFAULT 'yearly',
    "accrual_rate" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrual_day_of_month" INTEGER,
    "max_balance" DECIMAL(6,2),
    "max_carry_forward" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "encashable" BOOLEAN NOT NULL DEFAULT false,
    "encashment_max_days" DECIMAL(6,2),
    "requires_document_above_days" INTEGER,
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "allow_half_day" BOOLEAN NOT NULL DEFAULT true,
    "min_days_notice" INTEGER NOT NULL DEFAULT 0,
    "max_consecutive_days" INTEGER,
    "applicable_gender" "ApplicableGender" NOT NULL DEFAULT 'all',
    "applicable_employment_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "opening_balance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjusted" DECIMAL(6,2) NOT NULL DEFAULT 0,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_start_half_day" BOOLEAN NOT NULL DEFAULT false,
    "is_end_half_day" BOOLEAN NOT NULL DEFAULT false,
    "total_days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "document_url" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "approval_instance_id" UUID,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decision_comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_compensations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "salary_structure_id" UUID NOT NULL,
    "annual_ctc" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "resolved_components" JSONB NOT NULL,
    "tax_regime" "TaxRegime" NOT NULL DEFAULT 'new',
    "pf_opted_out" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "run_type" "PayrollRunType" NOT NULL DEFAULT 'regular',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'draft',
    "processed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "disbursed_at" TIMESTAMP(3),
    "approved_by" UUID,
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "disbursement_file_url" TEXT,
    "exit_request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "gross_earnings" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "lop_days" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "line_items" JSONB NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'generated',
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_deductions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payslip_id" UUID NOT NULL,
    "type" "StatutoryDeductionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "computation_basis" JSONB NOT NULL,

    CONSTRAINT "statutory_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_advances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" "LoanAdvanceType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "installments" INTEGER,
    "installments_paid" INTEGER NOT NULL DEFAULT 0,
    "status" "LoanAdvanceStatus" NOT NULL DEFAULT 'pending',
    "approval_instance_id" UUID,

    CONSTRAINT "loan_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_parameters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "effective_from" DATE NOT NULL,

    CONSTRAINT "statutory_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_pt_slabs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "state" TEXT NOT NULL,
    "monthly_gross_min" DECIMAL(10,2) NOT NULL,
    "monthly_gross_max" DECIMAL(10,2),
    "pt_amount" DECIMAL(6,2) NOT NULL,
    "month_override" INTEGER,
    "effective_from" DATE NOT NULL,

    CONSTRAINT "statutory_pt_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_tds_slabs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fiscal_year" TEXT NOT NULL,
    "tax_regime" "TaxRegime" NOT NULL,
    "income_min" DECIMAL(12,2) NOT NULL,
    "income_max" DECIMAL(12,2),
    "rate_percent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "statutory_tds_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "headcount" INTEGER NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "budget_ctc_max" DECIMAL(12,2),
    "status" "RequisitionStatus" NOT NULL DEFAULT 'draft',
    "approval_instance_id" UUID,
    "requested_by" UUID NOT NULL,
    "target_close_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "resume_url" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'manual',
    "current_stage" "CandidateStage" NOT NULL DEFAULT 'applied',
    "rejection_reason" TEXT,
    "referred_by_employee_id" UUID,
    "hired_employee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "interviewer_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "scorecard" JSONB NOT NULL DEFAULT '[]',
    "recommendation" "InterviewRecommendation",
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "salary_structure_id" UUID NOT NULL,
    "annual_ctc" DECIMAL(12,2) NOT NULL,
    "proposed_doj" DATE NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "esign_reference" TEXT,
    "expiry_date" DATE NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "parent_goal_id" UUID,
    "cycle_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "target_value" DECIMAL(10,2),
    "current_value" DECIMAL(10,2),
    "weight_percent" INTEGER NOT NULL DEFAULT 100,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "self_review_start" TIMESTAMP(3) NOT NULL,
    "self_review_end" TIMESTAMP(3) NOT NULL,
    "manager_review_start" TIMESTAMP(3) NOT NULL,
    "manager_review_end" TIMESTAMP(3) NOT NULL,
    "calibration_start" TIMESTAMP(3),
    "calibration_end" TIMESTAMP(3),
    "status" "CycleStatus" NOT NULL DEFAULT 'planned',
    "require_self_first" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "self_rating" DECIMAL(2,1),
    "self_comments" TEXT,
    "manager_rating" DECIMAL(2,1),
    "manager_comments" TEXT,
    "peer_ratings" JSONB,
    "calibrated_rating" DECIMAL(2,1),
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_url" TEXT,
    "duration_minutes" INTEGER,
    "category" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "applicable_department_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_by" UUID,
    "due_date" DATE,
    "status" "TrainingStatus" NOT NULL DEFAULT 'assigned',
    "completed_at" TIMESTAMP(3),
    "feedback_rating" INTEGER,
    "feedback_comments" TEXT,

    CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_body" TEXT,
    "issued_date" DATE NOT NULL,
    "expiry_date" DATE,
    "document_url" TEXT,
    "reminder_sent_at" TIMESTAMP(3),

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "make_model" TEXT,
    "serial_number" TEXT,
    "purchase_date" DATE,
    "purchase_value" DECIMAL(10,2),
    "status" "AssetStatus" NOT NULL DEFAULT 'in_stock',

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "allocated_on" DATE NOT NULL,
    "expected_return_on" DATE,
    "returned_on" DATE,
    "condition_on_return" "AllocationCondition",
    "acknowledgement_signed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "asset_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "trigger_event" "ITAccessTrigger" NOT NULL,
    "access_items" JSONB NOT NULL,
    "status" "ITAccessStatus" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "it_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "initiated_by" "ExitInitiatedBy" NOT NULL,
    "resignation_date" DATE NOT NULL,
    "notice_period_days" INTEGER NOT NULL,
    "last_working_day" DATE NOT NULL,
    "reason_category" TEXT,
    "reason_notes" TEXT,
    "status" "ExitStatus" NOT NULL DEFAULT 'notice_period',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exit_request_id" UUID NOT NULL,
    "department" "ClearanceDept" NOT NULL,
    "assignee_id" UUID NOT NULL,
    "checklist_items" JSONB NOT NULL DEFAULT '[]',
    "status" "ClearanceStatus" NOT NULL DEFAULT 'pending',
    "blocked_reason" TEXT,
    "cleared_at" TIMESTAMP(3),

    CONSTRAINT "clearance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exit_request_id" UUID NOT NULL,
    "conducted_by" UUID,
    "responses" JSONB NOT NULL DEFAULT '[]',
    "overall_sentiment" "ExitSentiment",
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "exit_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'all',
    "audience_ref_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "given_by_employee_id" UUID NOT NULL,
    "given_to_employee_id" UUID NOT NULL,
    "category" TEXT,
    "message" TEXT NOT NULL,
    "visibility" "RecognitionVisibility" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recognitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "employee_id" UUID,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_has_responded" (
    "survey_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_has_responded_pkey" PRIMARY KEY ("survey_id","employee_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_number_key" ON "users"("mobile_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "otp_challenges_mobile_number_idx" ON "otp_challenges"("mobile_number");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_location_id_date_key" ON "holidays"("location_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenant_id_employee_code_key" ON "employees"("tenant_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_bank_accounts_employee_id_key" ON "employee_bank_accounts"("employee_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_policies_tenant_id_name_key" ON "shift_policies"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_date_key" ON "attendance_records"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "regularization_requests_approval_instance_id_key" ON "regularization_requests"("approval_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_tenant_id_device_id_key" ON "biometric_devices"("tenant_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_user_mappings_biometric_device_id_device_user_cod_key" ON "biometric_user_mappings"("biometric_device_id", "device_user_code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_tenant_id_name_key" ON "leave_types"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_tenant_id_code_key" ON "leave_types"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_period_key" ON "leave_balances"("employee_id", "leave_type_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_approval_instance_id_key" ON "leave_requests"("approval_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_tenant_id_name_key" ON "salary_structures"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_exit_request_id_key" ON "payroll_runs"("exit_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_tenant_id_period_run_type_key" ON "payroll_runs"("tenant_id", "period", "run_type");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_id_employee_id_key" ON "payslips"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_advances_approval_instance_id_key" ON "loan_advances"("approval_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_parameters_key_effective_from_key" ON "statutory_parameters"("key", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "job_requisitions_approval_instance_id_key" ON "job_requisitions"("approval_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_candidate_id_interviewer_id_scheduled_at_key" ON "interview_feedback"("candidate_id", "interviewer_id", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "offers_candidate_id_key" ON "offers"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_cycle_id_employee_id_key" ON "performance_reviews"("cycle_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_assignments_course_id_employee_id_key" ON "training_assignments"("course_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenant_id_asset_tag_key" ON "assets"("tenant_id", "asset_tag");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenant_id_serial_number_key" ON "assets"("tenant_id", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_tasks_exit_request_id_department_key" ON "clearance_tasks"("exit_request_id", "department");

-- CreateIndex
CREATE UNIQUE INDEX "exit_interviews_exit_request_id_key" ON "exit_interviews"("exit_request_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_approval_chain_id_fkey" FOREIGN KEY ("approval_chain_id") REFERENCES "approval_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_policy_id_fkey" FOREIGN KEY ("shift_policy_id") REFERENCES "shift_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularization_requests" ADD CONSTRAINT "regularization_requests_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularization_requests" ADD CONSTRAINT "regularization_requests_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_user_mappings" ADD CONSTRAINT "biometric_user_mappings_biometric_device_id_fkey" FOREIGN KEY ("biometric_device_id") REFERENCES "biometric_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_salary_structure_id_fkey" FOREIGN KEY ("salary_structure_id") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_exit_request_id_fkey" FOREIGN KEY ("exit_request_id") REFERENCES "exit_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_deductions" ADD CONSTRAINT "statutory_deductions_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_advances" ADD CONSTRAINT "loan_advances_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_salary_structure_id_fkey" FOREIGN KEY ("salary_structure_id") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_tasks" ADD CONSTRAINT "clearance_tasks_exit_request_id_fkey" FOREIGN KEY ("exit_request_id") REFERENCES "exit_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_tasks" ADD CONSTRAINT "clearance_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interviews" ADD CONSTRAINT "exit_interviews_exit_request_id_fkey" FOREIGN KEY ("exit_request_id") REFERENCES "exit_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_has_responded" ADD CONSTRAINT "survey_has_responded_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
