import { PlatformOrganizationDetail } from '../../../../components/platform-organization-detail';

export const dynamic = 'force-dynamic';

export default async function PlatformOrganizationDetailRoute({
  params
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  return <PlatformOrganizationDetail organizationId={organizationId} />;
}
