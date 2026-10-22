import { AttendanceWorkspace } from '@/components/atendimentos/attendance-workspace';

interface AttendancePageProps {
  params: Promise<{ id: string }>;
}

export default async function AttendanceDetailPage({ params }: AttendancePageProps) {
  const { id } = await params;
  return <AttendanceWorkspace attendanceId={id} />;
}
