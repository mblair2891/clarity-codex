import { ClinicalDashboard } from '../../../../components/clinical-dashboard';

export default async function ClinicalCheckInPage({
  params
}: {
  params: Promise<{ checkInId: string }>;
}) {
  const { checkInId } = await params;

  return <ClinicalDashboard initialCheckInId={checkInId} />;
}
