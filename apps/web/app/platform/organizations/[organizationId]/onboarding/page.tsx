import { PlatformOrganizationOnboardingWizard } from '../../../../../components/platform-organization-onboarding';

export const dynamic = 'force-dynamic';

export default async function PlatformOrganizationOnboardingRoute({
  params
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  return <PlatformOrganizationOnboardingWizard organizationId={organizationId} />;
}
