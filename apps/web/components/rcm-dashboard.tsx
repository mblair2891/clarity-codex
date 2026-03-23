'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleShell } from './role-shell';
import { PasswordUpdateCard } from './password-update-card';
import {
  ApiResponseError,
  apiFetch,
  clearStoredToken,
  fetchMe,
  getApiBaseUrlState,
  getDisplayRoleForShell,
  getStoredToken,
  type AuthMeResponse
} from '../lib/beta-auth';

type QueueFilter =
  | 'all'
  | 'attention'
  | 'recent'
  | 'draft'
  | 'ready_for_review'
  | 'submitted'
  | 'needs_correction'
  | 'paid'
  | 'denied'
  | 'follow_up_needed';

type WorkItemStatus = Exclude<QueueFilter, 'all' | 'attention' | 'recent'>;
type WorkItemPriority = 'low' | 'normal' | 'high';

type AccountSummary = {
  consumerId: string;
  consumerName: string;
  displayName: string;
  organizationName: string;
  linkedAccountEmail: string | null;
  payerSummary: string;
  activeCoverage: {
    id: string;
    payerName: string;
    planName: string;
    memberId: string;
    groupNumber: string | null;
    authorizationCount: number;
  } | null;
  lastAppointment: {
    id: string;
    type: string;
    status: string;
    startsAt: string;
  } | null;
  lastCheckIn: {
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    wantsStaffFollowUp: boolean;
  } | null;
  outstandingBalanceCents: number;
  documentationReady: boolean;
  claimReadiness: string;
  claimCounts: Record<string, number>;
  workItemCounts: Record<string, number>;
  primaryWorkItem: {
    id: string;
    title: string;
    status: WorkItemStatus;
    priority: WorkItemPriority;
    nextAction: string | null;
    issueSummary: string | null;
    updatedAt: string;
  } | null;
  nextBillingAction: string;
};

type DashboardResponse = {
  billingUser: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
  };
  scopeModel: string;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  metrics: {
    accountsInScope: number;
    openWorkItems: number;
    deniedWorkItems: number;
    followUpWorkItems: number;
    unresolvedItems: number;
    outstandingBalanceCents: number;
  };
  statusCounts: Record<string, number>;
  payerDistribution: Array<{
    payerName: string;
    count: number;
  }>;
  quickActions: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  queuePreview: AccountSummary[];
  itemsNeedingAttention: AccountSummary[];
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    at: string;
    actorName: string | null;
    consumerName: string;
  }>;
};

type QueueResponse = {
  filter: QueueFilter;
  query: string;
  items: AccountSummary[];
};

type AccountDetailResponse = {
  consumer: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    fullName: string;
    organization: {
      id: string;
      name: string;
      npi: string | null;
      taxId: string | null;
    } | null;
    linkedAccount: {
      id: string;
      email: string;
      fullName: string;
      isActive: boolean;
    } | null;
    recoveryFocus: string | null;
    checkInPreference: string | null;
  };
  summary: AccountSummary;
  coverage: Array<{
    id: string;
    isActive: boolean;
    payerName: string;
    planName: string;
    memberId: string;
    groupNumber: string | null;
    authorizations: Array<{
      id: string;
      serviceType: string;
      authorizedUnits: number;
      startDate: string;
      endDate: string;
    }>;
  }>;
  recentAppointments: Array<{
    id: string;
    type: string;
    status: string;
    startsAt: string;
    endsAt: string;
  }>;
  recentCheckIns: Array<{
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    wantsStaffFollowUp: boolean;
    reviewStatus: string | null;
  }>;
  encounters: Array<{
    id: string;
    serviceCode: string;
    status: string;
    charges: Array<{
      id: string;
      cptCode: string;
      amountCents: number;
    }>;
    claims: Array<{
      id: string;
      status: string;
      billedCents: number;
      paidCents: number | null;
      denialReason: string | null;
      denials: Array<{
        id: string;
        code: string;
        reason: string;
        resolved: boolean;
      }>;
      remittance: {
        id: string;
        amountCents: number;
        receivedAt: string;
      } | null;
    }>;
  }>;
  invoices: Array<{
    id: string;
    status: string;
    totalCents: number;
    dueDate: string | null;
  }>;
  ledgerEntries: Array<{
    id: string;
    type: string;
    amountCents: number;
    occurredAt: string;
  }>;
  workItems: Array<{
    id: string;
    title: string;
    status: WorkItemStatus;
    priority: WorkItemPriority;
    encounterId: string | null;
    payerName: string | null;
    issueSummary: string | null;
    nextAction: string | null;
    amountCents: number | null;
    serviceDate: string | null;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
    coverage: {
      id: string;
      payerName: string;
      planName: string;
      memberId: string;
    } | null;
    claim: {
      id: string;
      status: string;
      billedCents: number;
      paidCents: number | null;
      denialReason: string | null;
      denialCount: number;
      remittanceAmountCents: number | null;
    } | null;
    createdBy: {
      id: string;
      fullName: string;
    };
    updatedBy: {
      id: string;
      fullName: string;
    } | null;
    notes: Array<{
      id: string;
      body: string;
      noteType: string;
      createdAt: string;
      author: {
        id: string;
        fullName: string;
      };
    }>;
    activity: Array<{
      id: string;
      action: string;
      fromStatus: string | null;
      toStatus: string | null;
      detail: string | null;
      createdAt: string;
      actor: {
        id: string;
        fullName: string;
      } | null;
    }>;
  }>;
  billingNotes: Array<{
    id: string;
    body: string;
    noteType: string;
    createdAt: string;
    author: {
      id: string;
      fullName: string;
    };
    workItem: {
      id: string;
      title: string;
      status: string;
    } | null;
  }>;
  createOptions: {
    coverage: Array<{
      id: string;
      label: string;
    }>;
    encounters: Array<{
      id: string;
      label: string;
    }>;
    claims: Array<{
      id: string;
      label: string;
    }>;
  };
};

type WorkItemFormState = {
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  issueSummary: string;
  nextAction: string;
  amountCents: string;
  payerName: string;
  serviceDate: string;
  coverageId: string;
  encounterId: string;
  claimId: string;
};

type NoteFormState = {
  noteType: string;
  body: string;
};

const queueFilterOptions: Array<{ value: QueueFilter; label: string }> = [
  { value: 'all', label: 'All accounts' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'recent', label: 'Recently updated' },
  { value: 'ready_for_review', label: 'Ready for review' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'needs_correction', label: 'Needs correction' },
  { value: 'denied', label: 'Denied' },
  { value: 'follow_up_needed', label: 'Follow-up needed' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Draft' }
];

const workItemStatusOptions: WorkItemStatus[] = [
  'draft',
  'ready_for_review',
  'submitted',
  'needs_correction',
  'paid',
  'denied',
  'follow_up_needed'
];

const workItemPriorityOptions: WorkItemPriority[] = ['low', 'normal', 'high'];

const defaultAccountNoteForm: NoteFormState = {
  noteType: 'billing_note',
  body: ''
};

const defaultWorkItemNoteForm: NoteFormState = {
  noteType: 'work_item_note',
  body: ''
};

function formatCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format((cents ?? 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Not scheduled';
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function toneForWorkItem(status: WorkItemStatus | string) {
  if (status === 'denied' || status === 'follow_up_needed' || status === 'needs_correction') {
    return 'warning';
  }

  if (status === 'submitted' || status === 'ready_for_review') {
    return 'focus';
  }

  if (status === 'paid') {
    return 'success';
  }

  return 'neutral';
}

function toneForReadiness(readiness: string) {
  if (readiness === 'coverage_gap' || readiness === 'awaiting_documentation') {
    return 'warning';
  }

  if (readiness === 'ready_for_review' || readiness === 'ready_to_bill') {
    return 'success';
  }

  return 'neutral';
}

function toneForPriority(priority: WorkItemPriority) {
  if (priority === 'high') {
    return 'warning';
  }

  if (priority === 'normal') {
    return 'focus';
  }

  return 'neutral';
}

function buildEmptyWorkItemForm(detail: AccountDetailResponse): WorkItemFormState {
  return {
    title: '',
    status: 'draft',
    priority: 'normal',
    issueSummary: '',
    nextAction: detail.summary.nextBillingAction,
    amountCents: '',
    payerName: detail.summary.activeCoverage?.payerName ?? '',
    serviceDate: '',
    coverageId: detail.createOptions.coverage[0]?.id ?? '',
    encounterId: '',
    claimId: ''
  };
}

function buildWorkItemForm(detail: AccountDetailResponse, workItem: AccountDetailResponse['workItems'][number] | null): WorkItemFormState {
  if (!workItem) {
    return buildEmptyWorkItemForm(detail);
  }

  return {
    title: workItem.title,
    status: workItem.status,
    priority: workItem.priority,
    issueSummary: workItem.issueSummary ?? '',
    nextAction: workItem.nextAction ?? '',
    amountCents: workItem.amountCents === null ? '' : String(workItem.amountCents),
    payerName: workItem.payerName ?? '',
    serviceDate: workItem.serviceDate ? workItem.serviceDate.slice(0, 10) : '',
    coverageId: workItem.coverage?.id ?? '',
    encounterId: workItem.encounterId ?? '',
    claimId: workItem.claim?.id ?? ''
  };
}

function workItemNeedsAttention(status: WorkItemStatus | null | undefined) {
  return status === 'denied' || status === 'follow_up_needed' || status === 'needs_correction';
}

export function RcmDashboard({ initialConsumerId = null }: { initialConsumerId?: string | null } = {}) {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountDetailResponse | null>(null);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string>('new');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('attention');
  const [workItemForm, setWorkItemForm] = useState<WorkItemFormState | null>(null);
  const [accountNoteForm, setAccountNoteForm] = useState<NoteFormState>(defaultAccountNoteForm);
  const [workItemNoteForm, setWorkItemNoteForm] = useState<NoteFormState>(defaultWorkItemNoteForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSavingWorkItem, setIsSavingWorkItem] = useState(false);
  const [isSavingAccountNote, setIsSavingAccountNote] = useState(false);
  const [isSavingWorkItemNote, setIsSavingWorkItemNote] = useState(false);

  const selectedWorkItem = useMemo(
    () => selectedAccount?.workItems.find((workItem) => workItem.id === selectedWorkItemId) ?? null,
    [selectedAccount, selectedWorkItemId]
  );

  async function loadAccountDetail(token: string, consumerId: string, preferredWorkItemId?: string | null) {
    if (!apiBaseUrl) {
      return;
    }

    const detail = await apiFetch<AccountDetailResponse>(apiBaseUrl, `/v1/rcm/accounts/${consumerId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    setSelectedAccount(detail);
    const nextWorkItemId =
      preferredWorkItemId && detail.workItems.some((workItem) => workItem.id === preferredWorkItemId)
        ? preferredWorkItemId
        : detail.workItems[0]?.id ?? 'new';

    setSelectedWorkItemId(nextWorkItemId);
  }

  async function loadWorkspace(token: string, knownSession?: AuthMeResponse, preferredConsumerId?: string | null) {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    setIsLoading(true);

    try {
      const session = knownSession ?? (await fetchMe(apiBaseUrl, token));

      if (!['billing', 'org_admin', 'platform_admin'].includes(session.user.role)) {
        router.replace(session.landingPath);
        return;
      }

      const [nextDashboard, nextQueue] = await Promise.all([
        apiFetch<DashboardResponse>(apiBaseUrl, '/v1/rcm/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        apiFetch<QueueResponse>(
          apiBaseUrl,
          `/v1/rcm/queue?q=${encodeURIComponent(queueSearch)}&filter=${queueFilter}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )
      ]);

      setMe(session);
      setDashboard(nextDashboard);
      setQueue(nextQueue);
      setError(null);

      const nextConsumerId =
        preferredConsumerId ??
        selectedAccount?.consumer.id ??
        initialConsumerId ??
        nextDashboard.queuePreview[0]?.consumerId ??
        nextQueue.items[0]?.consumerId ??
        null;

      if (nextConsumerId) {
        await loadAccountDetail(token, nextConsumerId, selectedWorkItemId === 'new' ? null : selectedWorkItemId);
      } else {
        setSelectedAccount(null);
        setSelectedWorkItemId('new');
        setWorkItemForm(null);
      }
    } catch (loadError) {
      if (loadError instanceof ApiResponseError && loadError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(loadError instanceof Error ? loadError.message : 'Unable to load the RCM workspace right now.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      setIsLoading(false);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    loadWorkspace(token).catch(() => {});
  }, [apiBaseUrl, apiBaseUrlError, router, queueSearch, queueFilter, initialConsumerId]);

  useEffect(() => {
    if (!selectedAccount) {
      setWorkItemForm(null);
      return;
    }

    if (selectedWorkItemId === 'new') {
      setWorkItemForm(buildEmptyWorkItemForm(selectedAccount));
      return;
    }

    const matchingWorkItem = selectedAccount.workItems.find((workItem) => workItem.id === selectedWorkItemId) ?? null;

    if (!matchingWorkItem) {
      const fallbackWorkItem = selectedAccount.workItems[0] ?? null;
      setSelectedWorkItemId(fallbackWorkItem?.id ?? 'new');
      setWorkItemForm(buildWorkItemForm(selectedAccount, fallbackWorkItem));
      return;
    }

    setWorkItemForm(buildWorkItemForm(selectedAccount, matchingWorkItem));
  }, [selectedAccount, selectedWorkItemId]);

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  function handleApiError(actionError: unknown, fallbackMessage: string) {
    if (actionError instanceof ApiResponseError && actionError.status === 401) {
      clearStoredToken();
      router.replace('/login');
      return 'Your beta session expired. Please sign in again.';
    }

    return actionError instanceof Error ? actionError.message : fallbackMessage;
  }

  async function refreshWorkspace(preferredConsumerId?: string | null) {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    await loadWorkspace(token, me ?? undefined, preferredConsumerId ?? selectedAccount?.consumer.id ?? null);
  }

  async function handleSelectAccount(consumerId: string) {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await loadAccountDetail(token, consumerId);
    } catch (loadError) {
      setError(handleApiError(loadError, 'Unable to open that billing account.'));
    }
  }

  async function handleSaveWorkItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedAccount || !workItemForm) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingWorkItem(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        consumerId: selectedAccount.consumer.id,
        title: workItemForm.title.trim(),
        status: workItemForm.status,
        priority: workItemForm.priority,
        issueSummary: workItemForm.issueSummary.trim() || null,
        nextAction: workItemForm.nextAction.trim() || null,
        amountCents: workItemForm.amountCents.trim() ? Number(workItemForm.amountCents.trim()) : null,
        payerName: workItemForm.payerName.trim() || null,
        serviceDate: workItemForm.serviceDate || null,
        coverageId: workItemForm.coverageId || null,
        encounterId: workItemForm.encounterId || null,
        claimId: workItemForm.claimId || null
      };

      if (selectedWorkItemId === 'new') {
        const response = await apiFetch<{ created: boolean; workItemId: string }>(apiBaseUrl, '/v1/rcm/work-items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        setSuccessMessage('Billing work item created.');
        await refreshWorkspace(selectedAccount.consumer.id);
        setSelectedWorkItemId(response.workItemId);
      } else {
        const updatePayload = {
          title: payload.title,
          status: payload.status,
          priority: payload.priority,
          issueSummary: payload.issueSummary,
          nextAction: payload.nextAction,
          amountCents: payload.amountCents,
          payerName: payload.payerName,
          serviceDate: payload.serviceDate,
          coverageId: payload.coverageId,
          encounterId: payload.encounterId,
          claimId: payload.claimId
        };

        await apiFetch<{ updated: boolean; workItemId: string }>(apiBaseUrl, `/v1/rcm/work-items/${selectedWorkItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(updatePayload)
        });

        setSuccessMessage('Billing work item updated.');
        await refreshWorkspace(selectedAccount.consumer.id);
      }
    } catch (saveError) {
      setError(handleApiError(saveError, 'Unable to save the billing work item.'));
    } finally {
      setIsSavingWorkItem(false);
    }
  }

  async function handleCreateAccountNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedAccount) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingAccountNote(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiFetch(apiBaseUrl, `/v1/rcm/accounts/${selectedAccount.consumer.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          noteType: accountNoteForm.noteType,
          body: accountNoteForm.body
        })
      });

      setAccountNoteForm(defaultAccountNoteForm);
      setSuccessMessage('Account note added.');
      await refreshWorkspace(selectedAccount.consumer.id);
    } catch (saveError) {
      setError(handleApiError(saveError, 'Unable to save the account note.'));
    } finally {
      setIsSavingAccountNote(false);
    }
  }

  async function handleCreateWorkItemNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedWorkItem) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingWorkItemNote(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiFetch(apiBaseUrl, `/v1/rcm/work-items/${selectedWorkItem.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          noteType: workItemNoteForm.noteType,
          body: workItemNoteForm.body
        })
      });

      setWorkItemNoteForm(defaultWorkItemNoteForm);
      setSuccessMessage('Work item note added.');
      await refreshWorkspace(selectedAccount?.consumer.id ?? null);
    } catch (saveError) {
      setError(handleApiError(saveError, 'Unable to save the work item note.'));
    } finally {
      setIsSavingWorkItemNote(false);
    }
  }

  const queueItems = queue?.items ?? [];
  const selectedCoverageOptions = selectedAccount?.createOptions.coverage ?? [];
  const selectedEncounterOptions = selectedAccount?.createOptions.encounters ?? [];
  const selectedClaimOptions = selectedAccount?.createOptions.claims ?? [];

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'billing')} title="Revenue Cycle Hub">
      {isLoading && !dashboard ? (
        <section className="consumerStack">
          <article className="card">
            <h2 className="sectionTitle">Preparing the billing queue, denial follow-up, and account workspace</h2>
            <p className="muted">Loading payer context, work-item history, and the current beta caseload.</p>
          </article>
        </section>
      ) : (
        <div className="consumerStack">
          <section className="consumerHero card">
            <div className="consumerHeroTop">
              <div>
                <p className="eyebrow">Revenue cycle workspace</p>
                <h2 className="consumerHeading">
                  Welcome back, {dashboard?.billingUser.fullName.split(' ')[0] ?? 'billing team'}.
                </h2>
                <p className="muted consumerLead">
                  Review denied claims, work submitted items before they age out, and keep each consumer account ready for the next billing step.
                </p>
              </div>
              <div className="pillRow">
                <span className={`statusPill ${dashboard?.scopeModel === 'platform_wide' ? 'focus' : 'neutral'}`}>
                  {dashboard?.scopeModel === 'platform_wide' ? 'platform-wide scope' : 'organization scope'}
                </span>
                <span className="statusPill neutral">{formatLabel(dashboard?.billingUser.role ?? 'billing')}</span>
              </div>
            </div>

            <div className="consumerQuickActions">
              {dashboard?.quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quickActionCard"
                  onClick={() => {
                    if (action.id === 'review-denials') {
                      setQueueFilter('denied');
                    } else if (action.id === 'review-ready') {
                      setQueueFilter('ready_for_review');
                    } else {
                      setQueueFilter('all');
                    }
                  }}
                >
                  <strong>{action.label}</strong>
                  <span className="muted">{action.description}</span>
                </button>
              ))}
              <button type="button" className="quickActionCard" onClick={handleLogout}>
                <strong>Log out</strong>
                <span className="muted">End this beta session and return to sign-in.</span>
              </button>
            </div>

            <div className="grid">
              <article className="card">
                <span className="muted">Accounts in scope</span>
                <span className="metric">{dashboard?.metrics.accountsInScope ?? 0}</span>
              </article>
              <article className="card">
                <span className="muted">Open work items</span>
                <span className="metric">{dashboard?.metrics.openWorkItems ?? 0}</span>
              </article>
              <article className="card">
                <span className="muted">Denied + follow-up</span>
                <span className="metric">
                  {(dashboard?.metrics.deniedWorkItems ?? 0) + (dashboard?.metrics.followUpWorkItems ?? 0)}
                </span>
              </article>
              <article className="card">
                <span className="muted">Outstanding balance</span>
                <span className="metric">{formatCurrency(dashboard?.metrics.outstandingBalanceCents)}</span>
              </article>
            </div>
          </section>

          <section className="consumerTwoColumn">
            <article className="card">
              <div className="sectionHeaderRow">
                <div>
                  <h3 className="sectionTitle">Attention queue</h3>
                  <p className="muted">Consumers with denied, correction, or payer follow-up work that should move first.</p>
                </div>
                <span className="statusPill warning">{dashboard?.itemsNeedingAttention.length ?? 0} urgent</span>
              </div>
              <div className="timeline">
                {(dashboard?.itemsNeedingAttention ?? []).slice(0, 4).map((item) => (
                  <button
                    key={item.consumerId}
                    type="button"
                    className="listItemCard rcmSelectable"
                    onClick={() => handleSelectAccount(item.consumerId)}
                  >
                    <div className="sectionHeaderRow">
                      <strong>{item.consumerName}</strong>
                      <span className={`statusPill ${toneForWorkItem(item.primaryWorkItem?.status ?? 'draft')}`}>
                        {formatLabel(item.primaryWorkItem?.status ?? 'draft')}
                      </span>
                    </div>
                    <span className="muted">{item.primaryWorkItem?.title ?? item.nextBillingAction}</span>
                    <span className="muted">{item.nextBillingAction}</span>
                  </button>
                ))}
                {!dashboard?.itemsNeedingAttention.length ? <p className="muted">No urgent queue items right now.</p> : null}
              </div>
            </article>

            <article className="card">
              <div className="sectionHeaderRow">
                <div>
                  <h3 className="sectionTitle">Recent activity</h3>
                  <p className="muted">The latest billing notes, status changes, and queue movement.</p>
                </div>
                <span className="statusPill neutral">{dashboard?.recentActivity.length ?? 0} updates</span>
              </div>
              <div className="timeline">
                {(dashboard?.recentActivity ?? []).slice(0, 6).map((activity) => (
                  <article key={activity.id} className="timelineItem">
                    <div className="sectionHeaderRow">
                      <strong>{activity.title}</strong>
                      <span className="muted">{formatDateTime(activity.at)}</span>
                    </div>
                    <span>{activity.detail}</span>
                    <span className="muted">
                      {activity.consumerName}
                      {activity.actorName ? ` • ${activity.actorName}` : ''}
                    </span>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="consumerTwoColumn">
            <article className="card">
              <div className="sectionHeaderRow">
                <div>
                  <h3 className="sectionTitle">Billing roster and work queue</h3>
                  <p className="muted">Search by consumer, payer, member ID, or work-item title to find the next account to work.</p>
                </div>
                <span className="statusPill focus">{queueItems.length} showing</span>
              </div>

              <div className="consumerFormGrid">
                <label className="fieldLabel">
                  Search queue
                  <input
                    className="inputField"
                    value={queueSearch}
                    onChange={(event) => setQueueSearch(event.target.value)}
                    placeholder="Search consumer, payer, member ID, or task"
                  />
                </label>
                <label className="fieldLabel">
                  Queue filter
                  <select
                    className="inputField"
                    value={queueFilter}
                    onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}
                  >
                    {queueFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="timeline">
                {queueItems.map((item) => {
                  const isSelected = selectedAccount?.consumer.id === item.consumerId;

                  return (
                    <button
                      key={item.consumerId}
                      type="button"
                      className={`listItemCard rcmSelectable${isSelected ? ' active' : ''}`}
                      onClick={() => handleSelectAccount(item.consumerId)}
                    >
                      <div className="sectionHeaderRow">
                        <div>
                          <strong>{item.consumerName}</strong>
                          <div className="muted">{item.organizationName}</div>
                        </div>
                        <span className={`statusPill ${toneForWorkItem(item.primaryWorkItem?.status ?? 'draft')}`}>
                          {formatLabel(item.primaryWorkItem?.status ?? item.claimReadiness)}
                        </span>
                      </div>
                      <div className="pillRow">
                        <span className={`statusPill ${toneForReadiness(item.claimReadiness)}`}>
                          {formatLabel(item.claimReadiness)}
                        </span>
                        {item.primaryWorkItem ? (
                          <span className={`statusPill ${toneForPriority(item.primaryWorkItem.priority)}`}>
                            {item.primaryWorkItem.priority} priority
                          </span>
                        ) : null}
                      </div>
                      <span className="muted">{item.payerSummary}</span>
                      <span>{item.primaryWorkItem?.title ?? item.nextBillingAction}</span>
                      <div className="consumerSectionGrid">
                        <div className="taskCard">
                          <strong>Last check-in</strong>
                          <span className="muted">
                            {item.lastCheckIn
                              ? `${formatDate(item.lastCheckIn.checkInDate)} • mood ${item.lastCheckIn.mood}/10 • cravings ${item.lastCheckIn.cravings}/10`
                              : 'No recent check-in'}
                          </span>
                        </div>
                        <div className="taskCard">
                          <strong>Next appointment</strong>
                          <span className="muted">
                            {item.lastAppointment
                              ? `${item.lastAppointment.type} • ${formatDateTime(item.lastAppointment.startsAt)}`
                              : 'No appointment linked'}
                          </span>
                        </div>
                        <div className="taskCard">
                          <strong>Outstanding balance</strong>
                          <span className="muted">{formatCurrency(item.outstandingBalanceCents)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!queueItems.length ? (
                  <article className="listItemCard">
                    <strong>No billing accounts match this filter.</strong>
                    <span className="muted">Try broadening the queue filter or clearing the search term.</span>
                  </article>
                ) : null}
              </div>
            </article>

            <article className="card">
              {selectedAccount ? (
                <div className="consumerStack">
                  <div className="sectionHeaderRow">
                    <div>
                      <h3 className="sectionTitle">{selectedAccount.consumer.fullName}</h3>
                      <p className="muted">
                        {selectedAccount.consumer.organization?.name ?? 'No organization'}
                        {selectedAccount.consumer.linkedAccount ? ` • ${selectedAccount.consumer.linkedAccount.email}` : ''}
                      </p>
                    </div>
                    <div className="pillRow">
                      <span className={`statusPill ${toneForReadiness(selectedAccount.summary.claimReadiness)}`}>
                        {formatLabel(selectedAccount.summary.claimReadiness)}
                      </span>
                      {selectedAccount.summary.primaryWorkItem ? (
                        <span className={`statusPill ${toneForWorkItem(selectedAccount.summary.primaryWorkItem.status)}`}>
                          {formatLabel(selectedAccount.summary.primaryWorkItem.status)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="consumerSectionGrid">
                    <article className="taskCard">
                      <strong>Coverage summary</strong>
                      <span className="muted">{selectedAccount.summary.payerSummary}</span>
                      <span>{selectedAccount.summary.activeCoverage?.memberId ?? 'No member ID on file'}</span>
                    </article>
                    <article className="taskCard">
                      <strong>Next billing action</strong>
                      <span className="muted">{selectedAccount.summary.nextBillingAction}</span>
                    </article>
                    <article className="taskCard">
                      <strong>Balance</strong>
                      <span className="muted">{formatCurrency(selectedAccount.summary.outstandingBalanceCents)}</span>
                    </article>
                  </div>

                  <div className="consumerTwoColumn">
                    <div className="consumerStack">
                      <article className="card">
                        <div className="sectionHeaderRow">
                          <h4 className="sectionTitle">Coverage and authorization snapshot</h4>
                          <span className="statusPill neutral">{selectedAccount.coverage.length} plans</span>
                        </div>
                        <div className="timeline">
                          {selectedAccount.coverage.map((coverage) => (
                            <article key={coverage.id} className="listItemCard">
                              <div className="sectionHeaderRow">
                                <strong>
                                  {coverage.payerName} • {coverage.planName}
                                </strong>
                                <span className={`statusPill ${coverage.isActive ? 'success' : 'warning'}`}>
                                  {coverage.isActive ? 'active' : 'inactive'}
                                </span>
                              </div>
                              <span className="muted">
                                Member ID {coverage.memberId}
                                {coverage.groupNumber ? ` • Group ${coverage.groupNumber}` : ''}
                              </span>
                              <div className="simpleList">
                                {coverage.authorizations.map((authorization) => (
                                  <span key={authorization.id}>
                                    {authorization.serviceType} • {authorization.authorizedUnits} units • {formatDate(authorization.endDate)}
                                  </span>
                                ))}
                                {!coverage.authorizations.length ? <span className="muted">No authorizations on file.</span> : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      </article>

                      <article className="card">
                        <div className="sectionHeaderRow">
                          <h4 className="sectionTitle">Recent encounters and claims</h4>
                          <span className="statusPill neutral">{selectedAccount.encounters.length} encounters</span>
                        </div>
                        <div className="timeline">
                          {selectedAccount.encounters.map((encounter) => (
                            <article key={encounter.id} className="listItemCard">
                              <div className="sectionHeaderRow">
                                <strong>{encounter.serviceCode}</strong>
                                <span className="statusPill neutral">{formatLabel(encounter.status)}</span>
                              </div>
                              <span className="muted">
                                Charges: {encounter.charges.map((charge) => `${charge.cptCode} ${formatCurrency(charge.amountCents)}`).join(' • ')}
                              </span>
                              <div className="timeline">
                                {encounter.claims.map((claim) => (
                                  <article key={claim.id} className="taskCard">
                                    <div className="sectionHeaderRow">
                                      <strong>{formatLabel(claim.status)} claim</strong>
                                      <span className={`statusPill ${toneForWorkItem(claim.status)}`}>{formatCurrency(claim.billedCents)}</span>
                                    </div>
                                    <span className="muted">
                                      Paid {formatCurrency(claim.paidCents)}
                                      {claim.remittance ? ` • Remittance ${formatDate(claim.remittance.receivedAt)}` : ''}
                                    </span>
                                    {claim.denialReason ? <span>{claim.denialReason}</span> : null}
                                    {claim.denials.map((denial) => (
                                      <span key={denial.id} className="muted">
                                        {denial.code} • {denial.reason}
                                      </span>
                                    ))}
                                  </article>
                                ))}
                                {!encounter.claims.length ? <span className="muted">No claim created from this encounter yet.</span> : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      </article>

                      <article className="card">
                        <div className="sectionHeaderRow">
                          <h4 className="sectionTitle">Appointments, check-ins, and account notes</h4>
                          <span className="statusPill focus">{selectedAccount.billingNotes.length} notes</span>
                        </div>
                        <div className="consumerSectionGrid">
                          <article className="supportPanel">
                            <strong>Recent appointments</strong>
                            <div className="simpleList">
                              {selectedAccount.recentAppointments.map((appointment) => (
                                <span key={appointment.id}>
                                  {appointment.type} • {formatLabel(appointment.status)} • {formatDateTime(appointment.startsAt)}
                                </span>
                              ))}
                            </div>
                          </article>
                          <article className="supportPanel">
                            <strong>Recent check-ins</strong>
                            <div className="simpleList">
                              {selectedAccount.recentCheckIns.map((checkIn) => (
                                <span key={checkIn.id}>
                                  {formatDate(checkIn.checkInDate)} • mood {checkIn.mood}/10 • cravings {checkIn.cravings}/10
                                  {checkIn.wantsStaffFollowUp ? ' • follow-up requested' : ''}
                                </span>
                              ))}
                            </div>
                          </article>
                        </div>
                        <div className="timeline">
                          {selectedAccount.billingNotes.map((note) => (
                            <article key={note.id} className="timelineItem">
                              <div className="sectionHeaderRow">
                                <strong>{formatLabel(note.noteType)}</strong>
                                <span className="muted">{formatDateTime(note.createdAt)}</span>
                              </div>
                              <span>{note.body}</span>
                              <span className="muted">
                                {note.author.fullName}
                                {note.workItem ? ` • ${note.workItem.title}` : ' • account-level note'}
                              </span>
                            </article>
                          ))}
                        </div>
                        <form className="consumerFormGrid" onSubmit={handleCreateAccountNote}>
                          <label className="fieldLabel">
                            Account note type
                            <input
                              className="inputField"
                              value={accountNoteForm.noteType}
                              onChange={(event) => setAccountNoteForm((current) => ({ ...current, noteType: event.target.value }))}
                            />
                          </label>
                          <label className="fieldLabel fieldSpan">
                            Add account note
                            <textarea
                              className="inputField textareaField"
                              value={accountNoteForm.body}
                              onChange={(event) => setAccountNoteForm((current) => ({ ...current, body: event.target.value }))}
                              placeholder="Capture coverage issues, payer calls, or account-level follow-up."
                            />
                          </label>
                          <div className="fieldSpan">
                            <button type="submit" className="primaryButton" disabled={isSavingAccountNote}>
                              {isSavingAccountNote ? 'Saving account note...' : 'Add account note'}
                            </button>
                          </div>
                        </form>
                      </article>
                    </div>

                    <div className="consumerStack">
                      <article className="card">
                        <div className="sectionHeaderRow">
                          <div>
                            <h4 className="sectionTitle">Claims and work items</h4>
                            <p className="muted">Track what is ready, submitted, denied, or waiting on corrections.</p>
                          </div>
                          <button
                            type="button"
                            className="secondaryButton"
                            onClick={() => {
                              setSelectedWorkItemId('new');
                              setWorkItemForm(buildEmptyWorkItemForm(selectedAccount));
                            }}
                          >
                            New work item
                          </button>
                        </div>

                        <div className="timeline">
                          {selectedAccount.workItems.map((workItem) => (
                            <button
                              key={workItem.id}
                              type="button"
                              className={`listItemCard rcmSelectable${selectedWorkItemId === workItem.id ? ' active' : ''}`}
                              onClick={() => {
                                setSelectedWorkItemId(workItem.id);
                                setWorkItemForm(buildWorkItemForm(selectedAccount, workItem));
                              }}
                            >
                              <div className="sectionHeaderRow">
                                <strong>{workItem.title}</strong>
                                <span className={`statusPill ${toneForWorkItem(workItem.status)}`}>
                                  {formatLabel(workItem.status)}
                                </span>
                              </div>
                              <div className="pillRow">
                                <span className={`statusPill ${toneForPriority(workItem.priority)}`}>
                                  {workItem.priority} priority
                                </span>
                                <span className="statusPill neutral">{formatCurrency(workItem.amountCents)}</span>
                              </div>
                              <span className="muted">{workItem.nextAction ?? 'No next action recorded.'}</span>
                            </button>
                          ))}
                          {!selectedAccount.workItems.length ? (
                            <article className="listItemCard">
                              <strong>No work items yet.</strong>
                              <span className="muted">Create the first billing task for this account below.</span>
                            </article>
                          ) : null}
                        </div>

                        {workItemForm ? (
                          <form className="consumerFormGrid" onSubmit={handleSaveWorkItem}>
                            <label className="fieldLabel">
                              Work item title
                              <input
                                className="inputField"
                                value={workItemForm.title}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, title: event.target.value } : current)}
                                placeholder="Example: Correct denied case management claim"
                              />
                            </label>
                            <label className="fieldLabel">
                              Status
                              <select
                                className="inputField"
                                value={workItemForm.status}
                                onChange={(event) =>
                                  setWorkItemForm((current) =>
                                    current ? { ...current, status: event.target.value as WorkItemStatus } : current
                                  )
                                }
                              >
                                {workItemStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {formatLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="fieldLabel">
                              Priority
                              <select
                                className="inputField"
                                value={workItemForm.priority}
                                onChange={(event) =>
                                  setWorkItemForm((current) =>
                                    current ? { ...current, priority: event.target.value as WorkItemPriority } : current
                                  )
                                }
                              >
                                {workItemPriorityOptions.map((priority) => (
                                  <option key={priority} value={priority}>
                                    {priority}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="fieldLabel">
                              Payer
                              <input
                                className="inputField"
                                value={workItemForm.payerName}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, payerName: event.target.value } : current)}
                              />
                            </label>
                            <label className="fieldLabel">
                              Amount (cents)
                              <input
                                className="inputField"
                                value={workItemForm.amountCents}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, amountCents: event.target.value } : current)}
                                inputMode="numeric"
                                placeholder="15200"
                              />
                            </label>
                            <label className="fieldLabel">
                              Service date
                              <input
                                className="inputField"
                                type="date"
                                value={workItemForm.serviceDate}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, serviceDate: event.target.value } : current)}
                              />
                            </label>
                            <label className="fieldLabel">
                              Coverage link
                              <select
                                className="inputField"
                                value={workItemForm.coverageId}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, coverageId: event.target.value } : current)}
                              >
                                <option value="">No linked coverage</option>
                                {selectedCoverageOptions.map((coverage) => (
                                  <option key={coverage.id} value={coverage.id}>
                                    {coverage.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="fieldLabel">
                              Encounter link
                              <select
                                className="inputField"
                                value={workItemForm.encounterId}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, encounterId: event.target.value } : current)}
                              >
                                <option value="">No linked encounter</option>
                                {selectedEncounterOptions.map((encounter) => (
                                  <option key={encounter.id} value={encounter.id}>
                                    {encounter.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="fieldLabel">
                              Claim link
                              <select
                                className="inputField"
                                value={workItemForm.claimId}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, claimId: event.target.value } : current)}
                              >
                                <option value="">No linked claim</option>
                                {selectedClaimOptions.map((claim) => (
                                  <option key={claim.id} value={claim.id}>
                                    {claim.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="fieldLabel fieldSpan">
                              Issue summary
                              <textarea
                                className="inputField textareaField"
                                value={workItemForm.issueSummary}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, issueSummary: event.target.value } : current)}
                                placeholder="What is blocking payment or submission?"
                              />
                            </label>
                            <label className="fieldLabel fieldSpan">
                              Next action
                              <textarea
                                className="inputField textareaField"
                                value={workItemForm.nextAction}
                                onChange={(event) => setWorkItemForm((current) => current ? { ...current, nextAction: event.target.value } : current)}
                                placeholder="What should the billing team do next?"
                              />
                            </label>
                            <div className="fieldSpan">
                              <button type="submit" className="primaryButton" disabled={isSavingWorkItem}>
                                {isSavingWorkItem
                                  ? 'Saving work item...'
                                  : selectedWorkItemId === 'new'
                                    ? 'Create work item'
                                    : 'Save work item'}
                              </button>
                            </div>
                          </form>
                        ) : null}
                      </article>

                      <article className="card">
                        <div className="sectionHeaderRow">
                          <div>
                            <h4 className="sectionTitle">Work item history and notes</h4>
                            <p className="muted">
                              {selectedWorkItem
                                ? `Focused on ${selectedWorkItem.title}`
                                : 'Choose a work item to review the status history and note trail.'}
                            </p>
                          </div>
                          {selectedWorkItem ? (
                            <span className={`statusPill ${toneForWorkItem(selectedWorkItem.status)}`}>
                              {formatLabel(selectedWorkItem.status)}
                            </span>
                          ) : null}
                        </div>

                        {selectedWorkItem ? (
                          <>
                            <div className="consumerSectionGrid">
                              <article className="supportPanel">
                                <strong>Claim snapshot</strong>
                                <div className="simpleList">
                                  <span>{selectedWorkItem.claim ? formatLabel(selectedWorkItem.claim.status) : 'No claim linked yet'}</span>
                                  <span>{formatCurrency(selectedWorkItem.amountCents)}</span>
                                  {selectedWorkItem.claim?.denialReason ? <span>{selectedWorkItem.claim.denialReason}</span> : null}
                                </div>
                              </article>
                              <article className="supportPanel">
                                <strong>Ownership</strong>
                                <div className="simpleList">
                                  <span>Created by {selectedWorkItem.createdBy.fullName}</span>
                                  <span>
                                    Updated by {selectedWorkItem.updatedBy?.fullName ?? selectedWorkItem.createdBy.fullName}
                                  </span>
                                  <span>Updated {formatDateTime(selectedWorkItem.updatedAt)}</span>
                                </div>
                              </article>
                            </div>
                            <div className="timeline">
                              {selectedWorkItem.activity.map((activity) => (
                                <article key={activity.id} className="timelineItem">
                                  <div className="sectionHeaderRow">
                                    <strong>{formatLabel(activity.action)}</strong>
                                    <span className="muted">{formatDateTime(activity.createdAt)}</span>
                                  </div>
                                  <span>{activity.detail ?? 'No detail recorded.'}</span>
                                  <span className="muted">
                                    {activity.actor?.fullName ?? 'System'}
                                    {activity.fromStatus || activity.toStatus
                                      ? ` • ${formatLabel(activity.fromStatus ?? 'none')} -> ${formatLabel(activity.toStatus ?? 'none')}`
                                      : ''}
                                  </span>
                                </article>
                              ))}
                            </div>
                            <div className="timeline">
                              {selectedWorkItem.notes.map((note) => (
                                <article key={note.id} className="timelineItem">
                                  <div className="sectionHeaderRow">
                                    <strong>{formatLabel(note.noteType)}</strong>
                                    <span className="muted">{formatDateTime(note.createdAt)}</span>
                                  </div>
                                  <span>{note.body}</span>
                                  <span className="muted">{note.author.fullName}</span>
                                </article>
                              ))}
                            </div>
                            <form className="consumerFormGrid" onSubmit={handleCreateWorkItemNote}>
                              <label className="fieldLabel">
                                Work item note type
                                <input
                                  className="inputField"
                                  value={workItemNoteForm.noteType}
                                  onChange={(event) => setWorkItemNoteForm((current) => ({ ...current, noteType: event.target.value }))}
                                />
                              </label>
                              <label className="fieldLabel fieldSpan">
                                Add work item note
                                <textarea
                                  className="inputField textareaField"
                                  value={workItemNoteForm.body}
                                  onChange={(event) => setWorkItemNoteForm((current) => ({ ...current, body: event.target.value }))}
                                  placeholder="Record payer call results, correction details, or claim follow-up."
                                />
                              </label>
                              <div className="fieldSpan">
                                <button type="submit" className="primaryButton" disabled={isSavingWorkItemNote}>
                                  {isSavingWorkItemNote ? 'Saving work item note...' : 'Add work item note'}
                                </button>
                              </div>
                            </form>
                          </>
                        ) : (
                          <article className="listItemCard">
                            <strong>No work item selected.</strong>
                            <span className="muted">Pick an existing work item or create a new one to start documenting the workflow.</span>
                          </article>
                        )}
                      </article>
                    </div>
                  </div>

                  <article className="card">
                    <div className="sectionHeaderRow">
                      <h4 className="sectionTitle">Operational overview</h4>
                      <span className="statusPill neutral">{dashboard?.payerDistribution.length ?? 0} payers</span>
                    </div>
                    <div className="consumerSectionGrid">
                      <article className="taskCard">
                        <strong>Status mix</strong>
                        <div className="simpleList">
                          {Object.entries(dashboard?.statusCounts ?? {}).map(([status, count]) => (
                            <span key={status}>
                              {formatLabel(status)} • {count}
                            </span>
                          ))}
                        </div>
                      </article>
                      <article className="taskCard">
                        <strong>Payer distribution</strong>
                        <div className="simpleList">
                          {(dashboard?.payerDistribution ?? []).map((payer) => (
                            <span key={payer.payerName}>
                              {payer.payerName} • {payer.count}
                            </span>
                          ))}
                        </div>
                      </article>
                      <article className="taskCard">
                        <strong>Invoices and ledger</strong>
                        <div className="simpleList">
                          {selectedAccount.invoices.map((invoice) => (
                            <span key={invoice.id}>
                              Invoice {formatLabel(invoice.status)} • {formatCurrency(invoice.totalCents)} • due {formatDate(invoice.dueDate)}
                            </span>
                          ))}
                          {selectedAccount.ledgerEntries.map((entry) => (
                            <span key={entry.id}>
                              {formatLabel(entry.type)} • {formatCurrency(entry.amountCents)} • {formatDateTime(entry.occurredAt)}
                            </span>
                          ))}
                        </div>
                      </article>
                    </div>
                  </article>
                </div>
              ) : (
                <div className="consumerStack">
                  <h3 className="sectionTitle">No billing account selected</h3>
                  <p className="muted">Choose a consumer from the billing queue to open the financial workspace.</p>
                </div>
              )}
            </article>
          </section>

          {successMessage ? <div className="banner">{successMessage}</div> : null}
          {error ? <div className="banner rcmErrorBanner">{error}</div> : null}

          <section>
            <PasswordUpdateCard mustChangePassword={dashboard?.billingUser.mustChangePassword ?? me?.user.mustChangePassword} />
          </section>
        </div>
      )}
    </RoleShell>
  );
}
