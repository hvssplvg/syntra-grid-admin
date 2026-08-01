import { esteemFirestore } from './client';

export type EsteemOverview = {
  students: number;
  teachers: number;
  admins: number;
  lessonPlans: number;
  assignments: number;
  examRequests: number;
  pendingExamRequests: number;
};

async function countCollection(collectionName: string): Promise<number> {
  const result = await esteemFirestore
    .collection(collectionName)
    .count()
    .get();

  return result.data().count;
}

async function countQuery(
  collectionName: string,
  field: string,
  value: string
): Promise<number> {
  const result = await esteemFirestore
    .collection(collectionName)
    .where(field, '==', value)
    .count()
    .get();

  return result.data().count;
}

export async function getEsteemOverview(): Promise<EsteemOverview> {
  const [
    students,
    teachers,
    admins,
    lessonPlans,
    assignments,
    examRequests,
    pendingExamRequests,
  ] = await Promise.all([
    countQuery('users', 'role', 'student'),
    countQuery('users', 'role', 'teacher'),
    countQuery('users', 'role', 'admin'),
    countCollection('lessonPlans'),
    countCollection('assignments'),
    countCollection('examPrintRequests'),
    countQuery('examPrintRequests', 'status', 'sent_to_admin'),
  ]);

  return {
    students,
    teachers,
    admins,
    lessonPlans,
    assignments,
    examRequests,
    pendingExamRequests,
  };
}