-- This migration exists only to make migration history reproducible from
-- scratch. Everything below was already present in the real database
-- before this file was written (recruitment, calendar, leave, timesheets,
-- workload, contracts, Employee, and the access-permission tables/enum
-- types) — most likely applied directly with `prisma db push` during
-- feature development rather than `prisma migrate dev`, since several
-- migration folders from that period (e.g. 20261006140919_add_contracts)
-- are empty placeholders rather than the real SQL.
--
-- This was discovered because 20261010152731_department_lead_references_
-- employee references the "Employee" table, which no tracked migration
-- ever created, so `prisma migrate dev`'s shadow-database replay failed
-- with "relation \"Employee\" does not exist".
--
-- Generated with `prisma migrate diff` between (a) a scratch database with
-- only the migrations before this one applied and (b) the real database,
-- then verified by re-introspecting both and confirming an identical
-- schema (including the 5 CHECK constraints at the bottom, which `migrate
-- diff --script` does not emit and were added by hand from
-- `pg_get_constraintdef`). Marked as already-applied on the real database
-- with `prisma migrate resolve --applied`, since its effects already
-- exist there — this file is never actually run against the real
-- database, only replayed when rebuilding a fresh shadow/dev database.
--
-- The next migration, 20261010173235_add_access_permissions, originally
-- tried to create the AccessAction/AccessScope enums and PermissionGrant/
-- AccessInvite tables again; since those are now created here instead,
-- its migration.sql has been emptied out (same pattern as
-- 20261006140919_add_contracts).

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'MANAGE', 'APPROVE');

-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('OWN', 'DEPARTMENT', 'ALL');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'ASSESSMENT', 'FINAL_INTERVIEW', 'OFFER', 'HIRED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CalendarAttendanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "CalendarEventPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CalendarEventScope" AS ENUM ('PERSONAL', 'TEAM', 'DEPARTMENT', 'COMPANY', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('MEETING', 'DEADLINE', 'MILESTONE', 'DEPLOYMENT', 'RELEASE', 'FINANCE', 'SUPPORT', 'MAINTENANCE', 'COMPANY', 'PERSONAL', 'FOCUS', 'REMINDER', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateDocumentType" AS ENUM ('CV', 'RESUME', 'COVER_LETTER', 'PORTFOLIO', 'CERTIFICATE', 'ASSESSMENT', 'OFFER', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('CAREERS_PAGE', 'LINKEDIN', 'INSTAGRAM', 'REFERRAL', 'DIRECT', 'RECRUITER', 'AGENCY', 'UNIVERSITY', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('ACTIVE', 'TALENT_POOL', 'HIRED', 'DO_NOT_CONTACT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractActivityType" AS ENUM ('CONTRACT_CREATED', 'CONTRACT_UPDATED', 'SENT_FOR_SIGNATURE', 'SIGNED', 'ACTIVATED', 'DOCUMENT_ADDED', 'DOCUMENT_REPLACED', 'RENEWAL_UPDATED', 'RENEWED', 'EXPIRED', 'TERMINATED', 'CANCELLED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('DEVELOPMENT', 'MAINTENANCE', 'SUPPORT', 'RETAINER', 'HOSTING', 'LICENSING', 'CONSULTING', 'PARTNERSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'OFFBOARDING', 'FORMER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('STRONG_YES', 'YES', 'MIXED', 'NO', 'STRONG_NO');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL', 'PORTFOLIO', 'CULTURE', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveActivityType" AS ENUM ('REQUEST_CREATED', 'REQUEST_UPDATED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'REQUEST_CANCELLED', 'REQUEST_RECORDED', 'BALANCE_ADJUSTED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "LeaveDayPortion" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'RECORDED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'PERSONAL', 'COMPASSIONATE', 'PARENTAL', 'UNPAID', 'STUDY', 'OTHER');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'APPROVAL_PENDING', 'APPROVED', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecruitmentActivityType" AS ENUM ('APPLICATION_RECEIVED', 'APPLICATION_UPDATED', 'STAGE_CHANGED', 'CANDIDATE_UPDATED', 'NOTE_ADDED', 'DOCUMENT_ADDED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_RESCHEDULED', 'INTERVIEW_COMPLETED', 'INTERVIEW_CANCELLED', 'INTERVIEW_FEEDBACK_SUBMITTED', 'OFFER_CREATED', 'OFFER_UPDATED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'OFFER_WITHDRAWN', 'OFFER_EXPIRED', 'CANDIDATE_REJECTED', 'CANDIDATE_WITHDREW', 'CANDIDATE_HIRED', 'EMPLOYEE_CREATED');

-- CreateEnum
CREATE TYPE "TimesheetActivityType" AS ENUM ('TIMESHEET_CREATED', 'ENTRY_ADDED', 'ENTRY_UPDATED', 'ENTRY_REMOVED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED', 'LOCKED', 'UNLOCKED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "TimesheetEntryType" AS ENUM ('PROJECT', 'CLIENT_SUPPORT', 'MAINTENANCE', 'MEETING', 'INTERNAL', 'PRODUCT', 'SALES', 'RECRUITMENT', 'TRAINING', 'ADMIN', 'TRAVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "WorkArrangement" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "WorkloadAllocationMode" AS ENUM ('HOURS', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "WorkloadAllocationStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkloadAllocationType" AS ENUM ('PROJECT', 'CLIENT_SUPPORT', 'MAINTENANCE', 'INTERNAL', 'PRODUCT', 'SALES', 'RECRUITMENT', 'TRAINING', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkloadPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_leadId_fkey";

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "restrictedAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AccessInvite" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "scope" "CalendarEventScope" NOT NULL DEFAULT 'PERSONAL',
    "priority" "CalendarEventPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "meetingUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "departmentId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "CalendarAttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "country" TEXT,
    "city" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "websiteUrl" TEXT,
    "currentJobTitle" TEXT,
    "currentCompany" TEXT,
    "summary" TEXT,
    "notes" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'OTHER',
    "sourceDetail" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateDocument" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" "CandidateDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractRef" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "value" DECIMAL(18,2),
    "currency" "CurrencyCode" NOT NULL DEFAULT 'GBP',
    "billingCycle" "BillingCycle",
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "noticePeriodDays" INTEGER,
    "signedAt" TIMESTAMP(3),
    "signedByClientName" TEXT,
    "signedByCompanyName" TEXT,
    "documentName" TEXT,
    "documentUrl" TEXT,
    "documentMimeType" TEXT,
    "documentSizeBytes" BIGINT,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractActivity" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "ContractActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeRef" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "personalEmail" TEXT,
    "workEmail" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "country" TEXT,
    "city" TEXT,
    "jobTitle" TEXT NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ONBOARDING',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "workArrangement" "WorkArrangement",
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "departmentId" TEXT,
    "managerId" TEXT,
    "adminUserId" TEXT,
    "linkedinUrl" TEXT,
    "bio" TEXT,
    "notes" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeWorkSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weeklyHours" DECIMAL(6,2) NOT NULL DEFAULT 40,
    "mondayHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "tuesdayHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "wednesdayHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "thursdayHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "fridayHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "saturdayHours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sundayHours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "billableTargetPercent" DECIMAL(5,2),
    "timezone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL DEFAULT 'VIDEO',
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "timezone" TEXT,
    "location" TEXT,
    "meetingUrl" TEXT,
    "instructions" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "recommendation" "InterviewRecommendation" NOT NULL,
    "score" INTEGER,
    "strengths" TEXT,
    "concerns" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewInterviewer" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewInterviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "applicationRef" TEXT,
    "candidateId" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shortlistedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "hiredAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "withdrawalReason" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "hiredEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "jobRef" TEXT,
    "title" TEXT NOT NULL,
    "departmentId" TEXT,
    "description" TEXT,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "benefits" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "workArrangement" "WorkArrangement",
    "country" TEXT,
    "city" TEXT,
    "salaryMin" DECIMAL(18,2),
    "salaryMax" DECIMAL(18,2),
    "currency" "CurrencyCode",
    "vacancies" INTEGER NOT NULL DEFAULT 1,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "targetStartDate" TIMESTAMP(3),
    "hiringManagerId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveActivity" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actorId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "LeaveActivityType" NOT NULL,

    CONSTRAINT "LeaveActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitlement" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carriedOver" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "booked" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjustedById" TEXT,
    "adjustmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "LeaveType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "annualAllowance" DECIMAL(6,2),
    "carryOverEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryOverDays" DECIMAL(6,2),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "allowBackdated" BOOLEAN NOT NULL DEFAULT false,
    "reasonRequired" BOOLEAN NOT NULL DEFAULT false,
    "countWeekends" BOOLEAN NOT NULL DEFAULT false,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "minimumNoticeDays" INTEGER,
    "maximumDaysPerRequest" DECIMAL(6,2),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "requestRef" TEXT,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startPortion" "LeaveDayPortion" NOT NULL DEFAULT 'FULL_DAY',
    "endPortion" "LeaveDayPortion" NOT NULL DEFAULT 'FULL_DAY',
    "totalDays" DECIMAL(6,2) NOT NULL,
    "reason" TEXT,
    "employeeNote" TEXT,
    "internalNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "recordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "scope" "AccessScope" NOT NULL DEFAULT 'ALL',
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentActivity" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "actorId" TEXT,
    "type" "RecruitmentActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentNote" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentOffer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "jobTitle" TEXT NOT NULL,
    "departmentId" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "workArrangement" "WorkArrangement",
    "salary" DECIMAL(18,2),
    "currency" "CurrencyCode",
    "proposedStartDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timesheetRef" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "billableHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "expectedHours" DECIMAL(8,2),
    "employeeNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetActivity" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "TimesheetActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "allocationId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "type" "TimesheetEntryType" NOT NULL DEFAULT 'PROJECT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hours" DECIMAL(6,2) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "billedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkloadAllocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkloadAllocationType" NOT NULL DEFAULT 'PROJECT',
    "status" "WorkloadAllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" "WorkloadPriority" NOT NULL DEFAULT 'NORMAL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allocationMode" "WorkloadAllocationMode" NOT NULL DEFAULT 'HOURS',
    "hoursPerWeek" DECIMAL(6,2),
    "allocationPercent" DECIMAL(5,2),
    "budgetHours" DECIMAL(8,2),
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkloadAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessInvite_adminUserId_key" ON "AccessInvite"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessInvite_tokenHash_key" ON "AccessInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessInvite_expiresAt_idx" ON "AccessInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_clientId_idx" ON "CalendarEvent"("clientId");

-- CreateIndex
CREATE INDEX "CalendarEvent_clientId_startAt_idx" ON "CalendarEvent"("clientId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdById_idx" ON "CalendarEvent"("createdById");

-- CreateIndex
CREATE INDEX "CalendarEvent_departmentId_idx" ON "CalendarEvent"("departmentId");

-- CreateIndex
CREATE INDEX "CalendarEvent_departmentId_startAt_idx" ON "CalendarEvent"("departmentId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_endAt_idx" ON "CalendarEvent"("endAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_ownerId_idx" ON "CalendarEvent"("ownerId");

-- CreateIndex
CREATE INDEX "CalendarEvent_ownerId_startAt_idx" ON "CalendarEvent"("ownerId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_priority_idx" ON "CalendarEvent"("priority");

-- CreateIndex
CREATE INDEX "CalendarEvent_projectId_idx" ON "CalendarEvent"("projectId");

-- CreateIndex
CREATE INDEX "CalendarEvent_projectId_startAt_idx" ON "CalendarEvent"("projectId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_scope_idx" ON "CalendarEvent"("scope");

-- CreateIndex
CREATE INDEX "CalendarEvent_scope_startAt_idx" ON "CalendarEvent"("scope", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_endAt_idx" ON "CalendarEvent"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_status_idx" ON "CalendarEvent"("status");

-- CreateIndex
CREATE INDEX "CalendarEvent_status_startAt_idx" ON "CalendarEvent"("status", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_type_idx" ON "CalendarEvent"("type");

-- CreateIndex
CREATE INDEX "CalendarEvent_updatedById_idx" ON "CalendarEvent"("updatedById");

-- CreateIndex
CREATE INDEX "CalendarEventAttendee_employeeId_idx" ON "CalendarEventAttendee"("employeeId");

-- CreateIndex
CREATE INDEX "CalendarEventAttendee_employeeId_status_idx" ON "CalendarEventAttendee"("employeeId", "status");

-- CreateIndex
CREATE INDEX "CalendarEventAttendee_eventId_idx" ON "CalendarEventAttendee"("eventId");

-- CreateIndex
CREATE INDEX "CalendarEventAttendee_status_idx" ON "CalendarEventAttendee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventAttendee_eventId_employeeId_key" ON "CalendarEventAttendee"("eventId", "employeeId");

-- CreateIndex
CREATE INDEX "Candidate_createdAt_idx" ON "Candidate"("createdAt");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_firstName_lastName_idx" ON "Candidate"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Candidate_phone_idx" ON "Candidate"("phone");

-- CreateIndex
CREATE INDEX "Candidate_source_idx" ON "Candidate"("source");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "CandidateDocument_applicationId_idx" ON "CandidateDocument"("applicationId");

-- CreateIndex
CREATE INDEX "CandidateDocument_candidateId_idx" ON "CandidateDocument"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateDocument_createdAt_idx" ON "CandidateDocument"("createdAt");

-- CreateIndex
CREATE INDEX "CandidateDocument_type_idx" ON "CandidateDocument"("type");

-- CreateIndex
CREATE INDEX "CandidateDocument_uploadedById_idx" ON "CandidateDocument"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractRef_key" ON "Contract"("contractRef");

-- CreateIndex
CREATE INDEX "Contract_clientId_endDate_idx" ON "Contract"("clientId", "endDate");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "Contract_clientId_status_idx" ON "Contract"("clientId", "status");

-- CreateIndex
CREATE INDEX "Contract_createdById_idx" ON "Contract"("createdById");

-- CreateIndex
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- CreateIndex
CREATE INDEX "Contract_renewalAt_idx" ON "Contract"("renewalAt");

-- CreateIndex
CREATE INDEX "Contract_startDate_idx" ON "Contract"("startDate");

-- CreateIndex
CREATE INDEX "Contract_status_endDate_idx" ON "Contract"("status", "endDate");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_status_renewalAt_idx" ON "Contract"("status", "renewalAt");

-- CreateIndex
CREATE INDEX "Contract_type_idx" ON "Contract"("type");

-- CreateIndex
CREATE INDEX "Contract_updatedById_idx" ON "Contract"("updatedById");

-- CreateIndex
CREATE INDEX "ContractActivity_actorId_idx" ON "ContractActivity"("actorId");

-- CreateIndex
CREATE INDEX "ContractActivity_contractId_createdAt_idx" ON "ContractActivity"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "ContractActivity_contractId_idx" ON "ContractActivity"("contractId");

-- CreateIndex
CREATE INDEX "ContractActivity_createdAt_idx" ON "ContractActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ContractActivity_type_idx" ON "ContractActivity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeRef_key" ON "Employee"("employeeRef");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_adminUserId_key" ON "Employee"("adminUserId");

-- CreateIndex
CREATE INDEX "Employee_createdAt_idx" ON "Employee"("createdAt");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_employmentType_idx" ON "Employee"("employmentType");

-- CreateIndex
CREATE INDEX "Employee_firstName_lastName_idx" ON "Employee"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_startDate_idx" ON "Employee"("startDate");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_active_idx" ON "EmployeeWorkSchedule"("active");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_createdById_idx" ON "EmployeeWorkSchedule"("createdById");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_effectiveFrom_idx" ON "EmployeeWorkSchedule"("effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_effectiveUntil_idx" ON "EmployeeWorkSchedule"("effectiveUntil");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_employeeId_active_idx" ON "EmployeeWorkSchedule"("employeeId", "active");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_employeeId_effectiveFrom_idx" ON "EmployeeWorkSchedule"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_employeeId_idx" ON "EmployeeWorkSchedule"("employeeId");

-- CreateIndex
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");

-- CreateIndex
CREATE INDEX "Interview_createdAt_idx" ON "Interview"("createdAt");

-- CreateIndex
CREATE INDEX "Interview_createdById_idx" ON "Interview"("createdById");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewId_idx" ON "InterviewFeedback"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_recommendation_idx" ON "InterviewFeedback"("recommendation");

-- CreateIndex
CREATE INDEX "InterviewFeedback_reviewerId_idx" ON "InterviewFeedback"("reviewerId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_submittedAt_idx" ON "InterviewFeedback"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewFeedback_interviewId_reviewerId_key" ON "InterviewFeedback"("interviewId", "reviewerId");

-- CreateIndex
CREATE INDEX "InterviewInterviewer_adminUserId_idx" ON "InterviewInterviewer"("adminUserId");

-- CreateIndex
CREATE INDEX "InterviewInterviewer_interviewId_idx" ON "InterviewInterviewer"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewInterviewer_interviewId_adminUserId_key" ON "InterviewInterviewer"("interviewId", "adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_applicationRef_key" ON "JobApplication"("applicationRef");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_hiredEmployeeId_key" ON "JobApplication"("hiredEmployeeId");

-- CreateIndex
CREATE INDEX "JobApplication_appliedAt_idx" ON "JobApplication"("appliedAt");

-- CreateIndex
CREATE INDEX "JobApplication_candidateId_idx" ON "JobApplication"("candidateId");

-- CreateIndex
CREATE INDEX "JobApplication_createdAt_idx" ON "JobApplication"("createdAt");

-- CreateIndex
CREATE INDEX "JobApplication_jobOpeningId_idx" ON "JobApplication"("jobOpeningId");

-- CreateIndex
CREATE INDEX "JobApplication_ownerId_idx" ON "JobApplication"("ownerId");

-- CreateIndex
CREATE INDEX "JobApplication_stageChangedAt_idx" ON "JobApplication"("stageChangedAt");

-- CreateIndex
CREATE INDEX "JobApplication_stage_idx" ON "JobApplication"("stage");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_candidateId_jobOpeningId_key" ON "JobApplication"("candidateId", "jobOpeningId");

-- CreateIndex
CREATE UNIQUE INDEX "JobOpening_jobRef_key" ON "JobOpening"("jobRef");

-- CreateIndex
CREATE INDEX "JobOpening_closesAt_idx" ON "JobOpening"("closesAt");

-- CreateIndex
CREATE INDEX "JobOpening_createdAt_idx" ON "JobOpening"("createdAt");

-- CreateIndex
CREATE INDEX "JobOpening_departmentId_idx" ON "JobOpening"("departmentId");

-- CreateIndex
CREATE INDEX "JobOpening_employmentType_idx" ON "JobOpening"("employmentType");

-- CreateIndex
CREATE INDEX "JobOpening_hiringManagerId_idx" ON "JobOpening"("hiringManagerId");

-- CreateIndex
CREATE INDEX "JobOpening_openedAt_idx" ON "JobOpening"("openedAt");

-- CreateIndex
CREATE INDEX "JobOpening_published_idx" ON "JobOpening"("published");

-- CreateIndex
CREATE INDEX "JobOpening_status_idx" ON "JobOpening"("status");

-- CreateIndex
CREATE INDEX "JobOpening_workArrangement_idx" ON "JobOpening"("workArrangement");

-- CreateIndex
CREATE INDEX "LeaveActivity_actorId_idx" ON "LeaveActivity"("actorId");

-- CreateIndex
CREATE INDEX "LeaveActivity_createdAt_idx" ON "LeaveActivity"("createdAt");

-- CreateIndex
CREATE INDEX "LeaveActivity_employeeId_idx" ON "LeaveActivity"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveActivity_leaveRequestId_idx" ON "LeaveActivity"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveActivity_type_idx" ON "LeaveActivity"("type");

-- CreateIndex
CREATE INDEX "LeaveBalance_adjustedById_idx" ON "LeaveBalance"("adjustedById");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_year_idx" ON "LeaveBalance"("employeeId", "year");

-- CreateIndex
CREATE INDEX "LeaveBalance_policyId_idx" ON "LeaveBalance"("policyId");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_policyId_year_key" ON "LeaveBalance"("employeeId", "policyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_code_key" ON "LeavePolicy"("code");

-- CreateIndex
CREATE INDEX "LeavePolicy_active_idx" ON "LeavePolicy"("active");

-- CreateIndex
CREATE INDEX "LeavePolicy_createdById_idx" ON "LeavePolicy"("createdById");

-- CreateIndex
CREATE INDEX "LeavePolicy_displayOrder_idx" ON "LeavePolicy"("displayOrder");

-- CreateIndex
CREATE INDEX "LeavePolicy_type_idx" ON "LeavePolicy"("type");

-- CreateIndex
CREATE INDEX "LeavePolicy_updatedById_idx" ON "LeavePolicy"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_requestRef_key" ON "LeaveRequest"("requestRef");

-- CreateIndex
CREATE INDEX "LeaveRequest_createdAt_idx" ON "LeaveRequest"("createdAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_policyId_idx" ON "LeaveRequest"("policyId");

-- CreateIndex
CREATE INDEX "LeaveRequest_reviewedById_idx" ON "LeaveRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "PermissionGrant_adminUserId_idx" ON "PermissionGrant"("adminUserId");

-- CreateIndex
CREATE INDEX "PermissionGrant_module_idx" ON "PermissionGrant"("module");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_adminUserId_module_action_key" ON "PermissionGrant"("adminUserId", "module", "action");

-- CreateIndex
CREATE INDEX "RecruitmentActivity_actorId_idx" ON "RecruitmentActivity"("actorId");

-- CreateIndex
CREATE INDEX "RecruitmentActivity_applicationId_idx" ON "RecruitmentActivity"("applicationId");

-- CreateIndex
CREATE INDEX "RecruitmentActivity_candidateId_idx" ON "RecruitmentActivity"("candidateId");

-- CreateIndex
CREATE INDEX "RecruitmentActivity_createdAt_idx" ON "RecruitmentActivity"("createdAt");

-- CreateIndex
CREATE INDEX "RecruitmentActivity_type_idx" ON "RecruitmentActivity"("type");

-- CreateIndex
CREATE INDEX "RecruitmentNote_applicationId_idx" ON "RecruitmentNote"("applicationId");

-- CreateIndex
CREATE INDEX "RecruitmentNote_authorId_idx" ON "RecruitmentNote"("authorId");

-- CreateIndex
CREATE INDEX "RecruitmentNote_candidateId_idx" ON "RecruitmentNote"("candidateId");

-- CreateIndex
CREATE INDEX "RecruitmentNote_createdAt_idx" ON "RecruitmentNote"("createdAt");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_applicationId_idx" ON "RecruitmentOffer"("applicationId");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_createdAt_idx" ON "RecruitmentOffer"("createdAt");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_createdById_idx" ON "RecruitmentOffer"("createdById");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_departmentId_idx" ON "RecruitmentOffer"("departmentId");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_proposedStartDate_idx" ON "RecruitmentOffer"("proposedStartDate");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_status_idx" ON "RecruitmentOffer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_timesheetRef_key" ON "Timesheet"("timesheetRef");

-- CreateIndex
CREATE INDEX "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");

-- CreateIndex
CREATE INDEX "Timesheet_employeeId_periodStart_idx" ON "Timesheet"("employeeId", "periodStart");

-- CreateIndex
CREATE INDEX "Timesheet_employeeId_status_idx" ON "Timesheet"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Timesheet_lockedById_idx" ON "Timesheet"("lockedById");

-- CreateIndex
CREATE INDEX "Timesheet_periodEnd_idx" ON "Timesheet"("periodEnd");

-- CreateIndex
CREATE INDEX "Timesheet_periodStart_idx" ON "Timesheet"("periodStart");

-- CreateIndex
CREATE INDEX "Timesheet_reviewedById_idx" ON "Timesheet"("reviewedById");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "Timesheet_status_periodStart_idx" ON "Timesheet"("status", "periodStart");

-- CreateIndex
CREATE INDEX "Timesheet_submittedAt_idx" ON "Timesheet"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_employeeId_periodStart_periodEnd_key" ON "Timesheet"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TimesheetActivity_actorId_idx" ON "TimesheetActivity"("actorId");

-- CreateIndex
CREATE INDEX "TimesheetActivity_createdAt_idx" ON "TimesheetActivity"("createdAt");

-- CreateIndex
CREATE INDEX "TimesheetActivity_employeeId_idx" ON "TimesheetActivity"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetActivity_timesheetId_idx" ON "TimesheetActivity"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetActivity_type_idx" ON "TimesheetActivity"("type");

-- CreateIndex
CREATE INDEX "TimesheetEntry_allocationId_idx" ON "TimesheetEntry"("allocationId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_allocationId_workDate_idx" ON "TimesheetEntry"("allocationId", "workDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_billable_idx" ON "TimesheetEntry"("billable");

-- CreateIndex
CREATE INDEX "TimesheetEntry_clientId_billable_invoiceId_idx" ON "TimesheetEntry"("clientId", "billable", "invoiceId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_clientId_idx" ON "TimesheetEntry"("clientId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_clientId_workDate_idx" ON "TimesheetEntry"("clientId", "workDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_employeeId_idx" ON "TimesheetEntry"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_employeeId_workDate_idx" ON "TimesheetEntry"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_invoiceId_idx" ON "TimesheetEntry"("invoiceId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_projectId_idx" ON "TimesheetEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_projectId_workDate_idx" ON "TimesheetEntry"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_timesheetId_idx" ON "TimesheetEntry"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_timesheetId_workDate_idx" ON "TimesheetEntry"("timesheetId", "workDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_type_idx" ON "TimesheetEntry"("type");

-- CreateIndex
CREATE INDEX "TimesheetEntry_workDate_idx" ON "TimesheetEntry"("workDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_clientId_idx" ON "WorkloadAllocation"("clientId");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_clientId_startDate_endDate_idx" ON "WorkloadAllocation"("clientId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_createdById_idx" ON "WorkloadAllocation"("createdById");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_departmentId_idx" ON "WorkloadAllocation"("departmentId");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_employeeId_idx" ON "WorkloadAllocation"("employeeId");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_employeeId_startDate_endDate_idx" ON "WorkloadAllocation"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_employeeId_status_idx" ON "WorkloadAllocation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_endDate_idx" ON "WorkloadAllocation"("endDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_priority_idx" ON "WorkloadAllocation"("priority");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_projectId_idx" ON "WorkloadAllocation"("projectId");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_projectId_startDate_endDate_idx" ON "WorkloadAllocation"("projectId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_startDate_endDate_idx" ON "WorkloadAllocation"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_startDate_idx" ON "WorkloadAllocation"("startDate");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_status_idx" ON "WorkloadAllocation"("status");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_type_idx" ON "WorkloadAllocation"("type");

-- CreateIndex
CREATE INDEX "WorkloadAllocation_updatedById_idx" ON "WorkloadAllocation"("updatedById");

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractActivity" ADD CONSTRAINT "ContractActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractActivity" ADD CONSTRAINT "ContractActivity_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkSchedule" ADD CONSTRAINT "EmployeeWorkSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkSchedule" ADD CONSTRAINT "EmployeeWorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewInterviewer" ADD CONSTRAINT "InterviewInterviewer_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewInterviewer" ADD CONSTRAINT "InterviewInterviewer_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_hiredEmployeeId_fkey" FOREIGN KEY ("hiredEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveActivity" ADD CONSTRAINT "LeaveActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveActivity" ADD CONSTRAINT "LeaveActivity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveActivity" ADD CONSTRAINT "LeaveActivity_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentActivity" ADD CONSTRAINT "RecruitmentActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentActivity" ADD CONSTRAINT "RecruitmentActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentActivity" ADD CONSTRAINT "RecruitmentActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentNote" ADD CONSTRAINT "RecruitmentNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentNote" ADD CONSTRAINT "RecruitmentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentNote" ADD CONSTRAINT "RecruitmentNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetActivity" ADD CONSTRAINT "TimesheetActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetActivity" ADD CONSTRAINT "TimesheetActivity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetActivity" ADD CONSTRAINT "TimesheetActivity_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "WorkloadAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkloadAllocation" ADD CONSTRAINT "WorkloadAllocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkloadAllocation" ADD CONSTRAINT "WorkloadAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkloadAllocation" ADD CONSTRAINT "WorkloadAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkloadAllocation" ADD CONSTRAINT "WorkloadAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkloadAllocation" ADD CONSTRAINT "WorkloadAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkloadAllocation" ADD CONSTRAINT "WorkloadAllocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CheckConstraint (not representable in schema.prisma; added to match the
-- real database exactly — see https://pris.ly/d/check-constraints)
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_duration_check" CHECK ((("durationMinutes" IS NULL) OR ("durationMinutes" > 0)));
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_score_check" CHECK (((score IS NULL) OR ((score >= 1) AND (score <= 5))));
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_rating_check" CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))));
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_salary_range_check" CHECK ((("salaryMin" IS NULL) OR ("salaryMax" IS NULL) OR ("salaryMax" >= "salaryMin")));
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_vacancies_check" CHECK ((vacancies >= 1));
