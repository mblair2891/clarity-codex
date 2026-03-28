import { ClinicalDashboard } from '../../../../components/clinical-dashboard';

export default async function ClinicalConsumerPage({
  params
}: {
  params: Promise<{ consumerId: string }>;
}) {
  const { consumerId } = await params;

  return <ClinicalDashboard initialConsumerId={consumerId} />;
}
