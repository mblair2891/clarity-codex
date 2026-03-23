'use client';

import { FormEvent, useEffect, useState } from 'react';
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

type DashboardResponse = {
  clinician: {
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
    assignedConsumers: number;
    consumersNeedingAttention: number;
    followUpRequests: number;
    checkInsToReview: number;
    todaysAppointments: number;
    highRiskConsumers: number;
  };
  quickActions: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  consumersNeedingAttention: Array<ConsumerRosterItem>;
  followUpRequests: Array<ConsumerRosterItem>;
  recentCheckInsNeedingReview: Array<ConsumerRosterItem>;
  todaysAppointments: Array<{
    id: string;
    consumerId: string;
    consumerName: string;
    type: string;
    startsAt: string;
    status: string;
  }>;
  todaysTasks: Array<{
    id: string;
    label: string;
    consumerName: string;
  }>;
  alerts: Array<QueueItem>;
  queue: Array<QueueItem>;
};

type ConsumerRosterItem = {
  id: string;
  name: string;
  displayName: string;
  organization?: {
    id: string;
    name: string;
  } | null;
  organizationName?: string;
  latestCheckIn: {
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    wantsStaffFollowUp?: boolean;
    reviewStatus?: string;
    followUpStatus?: string;
  } | null;
  followUpRequested?: boolean;
  reviewStatus?: string;
  nextAppointment: {
    id: string;
    type: string;
    startsAt: string;
    status: string;
  } | null;
  openGoals?: number;
  sharedJournalCount?: number;
  noteCount?: number;
  activeConditionFlags?: string[];
  routineCompletionCount7d?: number;
  risk: {
    score: number;
    tier: string;
    factors: string[];
  };
  needsAttention?: boolean;
};

type RosterResponse = {
  filter: string;
  query: string;
  items: ConsumerRosterItem[];
};

type QueueItem = {
  consumerId: string;
  consumerName: string;
  displayName: string;
  riskTier: string;
  riskScore: number;
  reason: string;
  checkInId: string | null;
  checkInDate: string | null;
  nextAppointment: string | null;
};

type CheckInListResponse = {
  filter: string;
  items: Array<{
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    stressLevel: number | null;
    motivationLevel: number | null;
    wantsStaffFollowUp: boolean;
    consumer: {
      id: string;
      name: string;
      displayName: string;
      organizationName: string;
    };
    review: {
      id: string;
      status: string;
      followUpStatus: string;
      reviewNote: string | null;
      reviewedAt: string | null;
      outreachCompletedAt: string | null;
      reviewer: {
        id: string;
        fullName: string;
      } | null;
    } | null;
  }>;
};

type ConsumerDetailResponse = {
  consumer: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    displayName: string;
    fullName: string;
    organization: {
      id: string;
      name: string;
    } | null;
    linkedAccount: {
      id: string;
      email: string;
      fullName: string;
      isActive: boolean;
    } | null;
    traumaMode: boolean;
    cognitiveAssistMode: boolean;
    recoveryFocus: string | null;
    checkInPreference: string | null;
  };
  risk: {
    score: number;
    tier: string;
    factors: string[];
  };
  currentPlan: {
    summary: string;
    focusAreas: Array<{ title: string; detail: string }>;
    copingStrategies: Array<{ title: string; detail: string }>;
    reminders: Array<{ title: string; schedule: string }>;
    supportContacts: Array<{ name: string; relationship: string; phone: string; availability?: string }>;
    safetyPlan: Array<{ title: string; action: string }>;
    milestones: Array<{ title: string; targetDate: string; status: string }>;
  };
  goals: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    targetLabel: string | null;
    targetDate: string | null;
    status: string;
  }>;
  routines: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    frequency: string;
    targetPerWeek: number | null;
    isActive: boolean;
    completionCount7d: number;
    completedToday: boolean;
  }>;
  checkIns: Array<{
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    stressLevel: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    motivationLevel: number | null;
    treatmentAdherence: boolean | null;
    wantsStaffFollowUp: boolean;
    difficultMoments: string[];
    copingToolsUsed: string[];
    notes: string | null;
    gratitude: string | null;
    createdAt: string;
    review: {
      id: string;
      status: string;
      followUpStatus: string;
      reviewNote: string | null;
      riskFlagged: boolean;
      reviewedAt: string | null;
      outreachCompletedAt: string | null;
      reviewer: {
        id: string;
        fullName: string;
      } | null;
    } | null;
  }>;
  sharedJournalEntries: Array<{
    id: string;
    title: string;
    content: string;
    moodScore: number | null;
    theme: string | null;
    createdAt: string;
  }>;
  medications: Array<{
    id: string;
    medicationName: string;
    dosage: string | null;
    schedule: string | null;
  }>;
  appointments: Array<{
    id: string;
    type: string;
    status: string;
    startsAt: string;
    endsAt: string;
  }>;
  conditions: Array<{
    id: string;
    name: string;
    status: string;
    symptomScore: number | null;
    accommodation: string | null;
  }>;
  notes: Array<{
    id: string;
    title: string | null;
    body: string;
    noteType: string;
    flaggedForFollowUp: boolean;
    createdAt: string;
    author: {
      id: string;
      fullName: string;
      role: string;
    };
  }>;
};

type CheckInDetailResponse = {
  consumer: {
    id: string;
    name: string;
    displayName: string;
    organization: {
      id: string;
      name: string;
    } | null;
  };
  checkIn: {
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    stressLevel: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    motivationLevel: number | null;
    treatmentAdherence: boolean | null;
    wantsStaffFollowUp: boolean;
    difficultMoments: string[];
    copingToolsUsed: string[];
    notes: string | null;
    gratitude: string | null;
    createdAt: string;
  };
  review: {
    id: string;
    status: string;
    followUpStatus: string;
    reviewNote: string | null;
    riskFlagged: boolean;
    reviewedAt: string | null;
    outreachCompletedAt: string | null;
    reviewer: {
      id: string;
      fullName: string;
    } | null;
  } | null;
};

type NoteFormState = {
  title: string;
  body: string;
  noteType: string;
  flaggedForFollowUp: boolean;
};

type PlanFormState = {
  preferredName: string;
  recoveryFocus: string;
  checkInPreference: string;
  recoveryPlanSummary: string;
};

type ReviewFormState = {
  status: 'pending' | 'reviewed' | 'needs_follow_up';
  followUpStatus: 'not_needed' | 'needed' | 'planned' | 'completed';
  reviewNote: string;
  riskFlagged: boolean;
  outreachCompleted: boolean;
};

const defaultNoteForm: NoteFormState = {
  title: '',
  body: '',
  noteType: 'progress',
  flaggedForFollowUp: false
};

const defaultPlanForm: PlanFormState = {
  preferredName: '',
  recoveryFocus: '',
  checkInPreference: '',
  recoveryPlanSummary: ''
};

const defaultReviewForm: ReviewFormState = {
  status: 'reviewed',
  followUpStatus: 'not_needed',
  reviewNote: '',
  riskFlagged: false,
  outreachCompleted: false
};

function formatDate(value: string | null) {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(value: string | null) {
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

function formatPercentage(value: number, total = 10) {
  return `${Math.round((value / total) * 100)}%`;
}

function toneForRisk(tier: string) {
  if (tier === 'high') {
    return 'warning';
  }

  if (tier === 'moderate') {
    return 'focus';
  }

  return 'success';
}

function toneForReview(status: string) {
  if (status === 'needs_follow_up') {
    return 'warning';
  }

  if (status === 'pending') {
    return 'focus';
  }

  return 'success';
}

function buildPlanForm(detail: ConsumerDetailResponse): PlanFormState {
  return {
    preferredName: detail.consumer.preferredName ?? '',
    recoveryFocus: detail.consumer.recoveryFocus ?? '',
    checkInPreference: detail.consumer.checkInPreference ?? '',
    recoveryPlanSummary: detail.currentPlan.summary ?? ''
  };
}

function buildReviewForm(detail: CheckInDetailResponse): ReviewFormState {
  return {
    status: (detail.review?.status as ReviewFormState['status']) ?? (detail.checkIn.wantsStaffFollowUp ? 'needs_follow_up' : 'reviewed'),
    followUpStatus: (detail.review?.followUpStatus as ReviewFormState['followUpStatus']) ?? (detail.checkIn.wantsStaffFollowUp ? 'needed' : 'not_needed'),
    reviewNote: detail.review?.reviewNote ?? '',
    riskFlagged: detail.review?.riskFlagged ?? (detail.checkIn.cravings >= 7 || detail.checkIn.mood <= 4),
    outreachCompleted: Boolean(detail.review?.outreachCompletedAt)
  };
}

export function ClinicalDashboard({
  initialConsumerId = null,
  initialCheckInId = null
}: {
  initialConsumerId?: string | null;
  initialCheckInId?: string | null;
}) {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInListResponse | null>(null);
  const [selectedConsumer, setSelectedConsumer] = useState<ConsumerDetailResponse | null>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckInDetailResponse | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'attention' | 'follow_up' | 'high_risk' | 'recent'>('all');
  const [checkInFilter, setCheckInFilter] = useState<'recent' | 'needs_follow_up' | 'high_craving' | 'low_mood' | 'unreviewed'>('recent');
  const [noteForm, setNoteForm] = useState<NoteFormState>(defaultNoteForm);
  const [planForm, setPlanForm] = useState<PlanFormState>(defaultPlanForm);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(defaultReviewForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);

  async function loadConsumerDetail(token: string, consumerId: string) {
    const detail = await apiFetch<ConsumerDetailResponse>(apiBaseUrl!, `/v1/clinical/consumers/${consumerId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    setSelectedConsumer(detail);
    setPlanForm(buildPlanForm(detail));
  }

  async function loadCheckInDetail(token: string, checkInId: string) {
    const detail = await apiFetch<CheckInDetailResponse>(apiBaseUrl!, `/v1/clinical/check-ins/${checkInId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    setSelectedCheckIn(detail);
    setReviewForm(buildReviewForm(detail));
  }

  async function loadWorkspace(token: string, knownSession?: AuthMeResponse) {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    setIsLoading(true);

    try {
      const session = knownSession ?? await fetchMe(apiBaseUrl, token);

      if (!['/clinical', '/admin'].includes(session.landingPath) && session.user.role !== 'clinical_staff' && session.user.role !== 'clinician' && session.user.role !== 'case_manager') {
        router.replace(session.landingPath);
        return;
      }

      const [nextDashboard, nextRoster, nextCheckIns] = await Promise.all([
        apiFetch<DashboardResponse>(apiBaseUrl, '/v1/clinical/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        apiFetch<RosterResponse>(
          apiBaseUrl,
          `/v1/clinical/roster?q=${encodeURIComponent(rosterSearch)}&filter=${rosterFilter}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        ),
        apiFetch<CheckInListResponse>(apiBaseUrl, `/v1/clinical/check-ins?filter=${checkInFilter}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      setMe(session);
      setDashboard(nextDashboard);
      setRoster(nextRoster);
      setCheckIns(nextCheckIns);

      const fallbackConsumerId = initialConsumerId ?? nextDashboard.consumersNeedingAttention[0]?.id ?? nextRoster.items[0]?.id ?? null;
      const fallbackCheckInId = initialCheckInId ?? nextCheckIns.items[0]?.id ?? null;

      if (fallbackConsumerId) {
        await loadConsumerDetail(token, fallbackConsumerId);
      } else {
        setSelectedConsumer(null);
      }

      if (fallbackCheckInId) {
        await loadCheckInDetail(token, fallbackCheckInId);
      } else {
        setSelectedCheckIn(null);
      }

      setError(null);
    } catch (loadError) {
      if (loadError instanceof ApiResponseError && loadError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(loadError instanceof Error ? loadError.message : 'Unable to load the clinical workspace right now.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setRosterSearch((current) => current);
  }, [initialConsumerId, initialCheckInId]);

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
  }, [apiBaseUrl, apiBaseUrlError, router, rosterSearch, rosterFilter, checkInFilter, initialConsumerId, initialCheckInId]);

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedConsumer) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingNote(true);
    setSuccessMessage(null);
    setError(null);

    try {
      await apiFetch(apiBaseUrl, `/v1/clinical/consumers/${selectedConsumer.consumer.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: noteForm.title || undefined,
          body: noteForm.body,
          noteType: noteForm.noteType,
          flaggedForFollowUp: noteForm.flaggedForFollowUp
        })
      });

      setNoteForm(defaultNoteForm);
      await loadConsumerDetail(token, selectedConsumer.consumer.id);
      setSuccessMessage('Clinical note saved.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save the clinical note.');
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedConsumer) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingPlan(true);
    setSuccessMessage(null);
    setError(null);

    try {
      await apiFetch(apiBaseUrl, `/v1/clinical/consumers/${selectedConsumer.consumer.id}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preferredName: planForm.preferredName || null,
          recoveryFocus: planForm.recoveryFocus || null,
          checkInPreference: planForm.checkInPreference || null,
          recoveryPlanSummary: planForm.recoveryPlanSummary || null
        })
      });

      await loadConsumerDetail(token, selectedConsumer.consumer.id);
      setSuccessMessage('Clinical plan view updated.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to update the care plan summary.');
    } finally {
      setIsSavingPlan(false);
    }
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedCheckIn) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingReview(true);
    setSuccessMessage(null);
    setError(null);

    try {
      await apiFetch(apiBaseUrl, `/v1/clinical/check-ins/${selectedCheckIn.checkIn.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(reviewForm)
      });

      await Promise.all([
        loadCheckInDetail(token, selectedCheckIn.checkIn.id),
        loadWorkspace(token, me ?? undefined)
      ]);
      setSuccessMessage('Check-in review saved.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save the check-in review.');
    } finally {
      setIsSavingReview(false);
    }
  }

  const welcomeName = dashboard?.clinician.fullName ?? me?.user.fullName ?? 'Clinical team';

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'clinical_staff')} title="Clinical Command">
      {isLoading ? (
        <section className="consumerStack">
          <article className="card">
            <p className="eyebrow">Loading clinical workspace</p>
            <h2 className="sectionTitle">Preparing the caseload, queue, and chart review tools</h2>
            <p className="muted">Pulling today’s clinical priorities from the beta API.</p>
          </article>
          <section className="grid">
            <article className="card"><span className="metric">...</span><span className="muted">Assigned consumers</span></article>
            <article className="card"><span className="metric">...</span><span className="muted">Needs attention</span></article>
            <article className="card"><span className="metric">...</span><span className="muted">Check-ins to review</span></article>
          </section>
        </section>
      ) : (
        <div className="consumerStack">
          <section className="consumerHero card">
            <div className="consumerHeroTop">
              <div>
                <p className="eyebrow">Clinical beta workspace</p>
                <h2 className="consumerHeading">Welcome, {welcomeName}</h2>
                <p className="muted consumerLead">
                  Review the attention queue, move through the caseload, and close the loop on follow-up requests without leaving the clinical workspace.
                </p>
              </div>
              <div className="consumerActions">
                <button type="button" className="primaryButton" onClick={() => router.push('/clinical/check-ins')}>
                  Review check-ins
                </button>
                <button type="button" className="secondaryButton" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>

            <div className="consumerStatusRow">
              <span className="statusPill success">Scope: {dashboard?.scopeModel === 'organization_membership' ? 'Org-scoped clinical access' : 'Clinical access'}</span>
              <span className="muted">{dashboard?.organizations.map((organization) => organization.name).join(' • ')}</span>
            </div>

            <div className="consumerQuickActions">
              {dashboard?.quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quickActionCard"
                  onClick={() => router.push(action.href)}
                >
                  <strong>{action.label}</strong>
                  <span>{action.href === '/clinical' ? 'Stay in the clinical workspace' : 'Open a focused clinical view'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid">
            <article className="card">
              <span className="muted">Assigned consumers</span>
              <span className="metric">{dashboard?.metrics.assignedConsumers ?? 0}</span>
            </article>
            <article className="card">
              <span className="muted">Consumers needing attention</span>
              <span className="metric">{dashboard?.metrics.consumersNeedingAttention ?? 0}</span>
            </article>
            <article className="card">
              <span className="muted">Follow-up requests</span>
              <span className="metric">{dashboard?.metrics.followUpRequests ?? 0}</span>
            </article>
            <article className="card">
              <span className="muted">Check-ins to review</span>
              <span className="metric">{dashboard?.metrics.checkInsToReview ?? 0}</span>
            </article>
            <article className="card">
              <span className="muted">Today’s appointments</span>
              <span className="metric">{dashboard?.metrics.todaysAppointments ?? 0}</span>
            </article>
            <article className="card">
              <span className="muted">High-risk consumers</span>
              <span className="metric">{dashboard?.metrics.highRiskConsumers ?? 0}</span>
            </article>
          </section>

          <section className="consumerTwoColumn">
            <article className="card">
              <div className="sectionHeaderRow">
                <div>
                  <h3 className="sectionTitle">Attention queue</h3>
                  <p className="muted">Work the highest-risk and unresolved follow-up items first.</p>
                </div>
                <button type="button" className="secondaryButton" onClick={() => setRosterFilter('attention')}>
                  Filter roster to attention
                </button>
              </div>
              <div className="timeline">
                {dashboard?.queue.length ? dashboard.queue.map((item) => (
                  <button
                    key={`${item.consumerId}-${item.checkInId ?? 'queue'}`}
                    type="button"
                    className="listItemCard"
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => router.push(item.checkInId ? `/clinical/check-ins/${item.checkInId}` : `/clinical/consumers/${item.consumerId}`)}
                  >
                    <div className="infoRow">
                      <strong>{item.displayName}</strong>
                      <span className={`statusPill ${toneForRisk(item.riskTier)}`}>{item.riskTier} risk</span>
                    </div>
                    <span className="muted">{item.reason}</span>
                    <span className="muted">
                      {item.checkInDate ? `Latest check-in ${formatDateTime(item.checkInDate)}` : 'No recent check-in'}
                      {item.nextAppointment ? ` • Next appointment ${formatDateTime(item.nextAppointment)}` : ''}
                    </span>
                  </button>
                )) : <p className="muted">No current clinical queue items.</p>}
              </div>
            </article>

            <article className="card">
              <h3 className="sectionTitle">Today’s schedule and tasks</h3>
              <div className="timeline">
                {dashboard?.todaysAppointments.length ? dashboard.todaysAppointments.map((appointment) => (
                  <div key={appointment.id} className="listItemCard">
                    <div className="infoRow">
                      <strong>{appointment.consumerName}</strong>
                      <span className="statusPill neutral">{appointment.status}</span>
                    </div>
                    <span>{appointment.type}</span>
                    <span className="muted">{formatDateTime(appointment.startsAt)}</span>
                  </div>
                )) : <p className="muted">No appointments are scheduled for today.</p>}

                {dashboard?.todaysTasks.length ? (
                  <div className="supportPanel">
                    <h4 className="sectionTitle">Quick task list</h4>
                    <ul className="simpleList">
                      {dashboard.todaysTasks.map((task) => (
                        <li key={task.id}>
                          {task.label} for {task.consumerName}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </article>
          </section>

          <section className="card">
            <div className="sectionHeaderRow">
              <div>
                <h3 className="sectionTitle">Caseload roster</h3>
                <p className="muted">Search, filter, and open the full consumer workspace.</p>
              </div>
            </div>
            <div className="consumerFormGrid">
              <label className="fieldLabel">
                Search consumers
                <input
                  className="inputField"
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                  placeholder="Search by name or organization"
                />
              </label>
              <label className="fieldLabel">
                Filter
                <select className="inputField" value={rosterFilter} onChange={(event) => setRosterFilter(event.target.value as typeof rosterFilter)}>
                  <option value="all">All consumers</option>
                  <option value="attention">Needs attention</option>
                  <option value="follow_up">Follow-up requested</option>
                  <option value="high_risk">High risk</option>
                  <option value="recent">Recently active</option>
                </select>
              </label>
            </div>
            <div className="consumerSectionGrid" style={{ marginTop: 16 }}>
              {roster?.items.length ? roster.items.map((consumer) => (
                <button
                  key={consumer.id}
                  type="button"
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => router.push(`/clinical/consumers/${consumer.id}`)}
                >
                  <div className="infoRow">
                    <strong>{consumer.displayName}</strong>
                    <span className={`statusPill ${toneForRisk(consumer.risk.tier)}`}>{consumer.risk.tier} risk</span>
                  </div>
                  <span className="muted">{consumer.organizationName ?? consumer.organization?.name ?? 'Unassigned organization'}</span>
                  <span className="muted">
                    {consumer.latestCheckIn
                      ? `Last check-in ${formatDateTime(consumer.latestCheckIn.checkInDate)} • mood ${consumer.latestCheckIn.mood}/10 • cravings ${consumer.latestCheckIn.cravings}/10`
                      : 'No recent check-in'}
                  </span>
                  <span className="muted">
                    {consumer.followUpRequested || consumer.latestCheckIn?.wantsStaffFollowUp ? 'Follow-up requested' : 'No follow-up request'}
                    {consumer.nextAppointment ? ` • Next appointment ${formatDateTime(consumer.nextAppointment.startsAt)}` : ''}
                  </span>
                </button>
              )) : <p className="muted">No consumers matched the current search and filter.</p>}
            </div>
          </section>

          <section className="consumerTwoColumn">
            <article className="card">
              <div className="sectionHeaderRow">
                <div>
                  <h3 className="sectionTitle">Recent check-in review workflow</h3>
                  <p className="muted">Move through unresolved check-ins, follow-up requests, and high-risk submissions.</p>
                </div>
              </div>
              <label className="fieldLabel" style={{ marginBottom: 16 }}>
                Filter check-ins
                <select className="inputField" value={checkInFilter} onChange={(event) => setCheckInFilter(event.target.value as typeof checkInFilter)}>
                  <option value="recent">Recent</option>
                  <option value="needs_follow_up">Needs follow-up</option>
                  <option value="high_craving">High craving</option>
                  <option value="low_mood">Low mood</option>
                  <option value="unreviewed">Unreviewed</option>
                </select>
              </label>
              <div className="timeline">
                {checkIns?.items.length ? checkIns.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="listItemCard"
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => router.push(`/clinical/check-ins/${item.id}`)}
                  >
                    <div className="infoRow">
                      <strong>{item.consumer.displayName}</strong>
                      <span className={`statusPill ${toneForReview(item.review?.status ?? 'pending')}`}>
                        {item.review?.status ?? 'pending'}
                      </span>
                    </div>
                    <span className="muted">{formatDateTime(item.checkInDate)} • mood {item.mood}/10 • cravings {item.cravings}/10</span>
                    <span className="muted">
                      {item.wantsStaffFollowUp ? 'Consumer requested follow-up' : 'No explicit follow-up request'}
                    </span>
                  </button>
                )) : <p className="muted">No check-ins matched the current review filter.</p>}
              </div>
            </article>

            <article className="card">
              <h3 className="sectionTitle">Alerts and follow-up requests</h3>
              <div className="timeline">
                {dashboard?.alerts.length ? dashboard.alerts.map((alert) => (
                  <button
                    key={`${alert.consumerId}-${alert.checkInId ?? 'alert'}`}
                    type="button"
                    className="supportCard"
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => router.push(alert.checkInId ? `/clinical/check-ins/${alert.checkInId}` : `/clinical/consumers/${alert.consumerId}`)}
                  >
                    <strong>{alert.displayName}</strong>
                    <span className="muted">{alert.reason}</span>
                    <span className={`statusPill ${toneForRisk(alert.riskTier)}`}>{alert.riskTier} risk • {alert.riskScore}/100</span>
                  </button>
                )) : <p className="muted">No current alerts.</p>}
              </div>
            </article>
          </section>

          {selectedConsumer ? (
            <section className="card">
              <div className="sectionHeaderRow">
                <div>
                  <p className="eyebrow">Consumer clinical workspace</p>
                  <h3 className="sectionTitle">{selectedConsumer.consumer.fullName}</h3>
                  <p className="muted">
                    {selectedConsumer.consumer.organization?.name ?? 'Unassigned organization'} • {selectedConsumer.consumer.linkedAccount?.email ?? 'No linked consumer login'}
                  </p>
                </div>
                <div className="consumerActions">
                  <span className={`statusPill ${toneForRisk(selectedConsumer.risk.tier)}`}>{selectedConsumer.risk.tier} risk • {selectedConsumer.risk.score}/100</span>
                  <button type="button" className="secondaryButton" onClick={() => router.push(`/clinical/consumers/${selectedConsumer.consumer.id}`)}>
                    Open dedicated chart
                  </button>
                </div>
              </div>

              <div className="consumerSectionGrid">
                <article className="taskCard">
                  <strong>Profile snapshot</strong>
                  <span className="muted">{selectedConsumer.consumer.recoveryFocus ?? 'No recovery focus documented yet.'}</span>
                  <div className="pillRow">
                    <span className="statusPill neutral">{selectedConsumer.consumer.traumaMode ? 'Trauma-informed mode' : 'Standard mode'}</span>
                    <span className="statusPill neutral">{selectedConsumer.consumer.cognitiveAssistMode ? 'Cognitive assist mode' : 'Standard prompts'}</span>
                  </div>
                </article>
                <article className="taskCard">
                  <strong>Current plan summary</strong>
                  <span className="muted">{selectedConsumer.currentPlan.summary || 'No recovery plan summary yet.'}</span>
                </article>
                <article className="taskCard">
                  <strong>Risk indicators</strong>
                  <ul className="simpleList">
                    {(selectedConsumer.risk.factors.length ? selectedConsumer.risk.factors : ['No elevated risk factors detected']).map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                </article>
              </div>

              <div className="consumerTwoColumn" style={{ marginTop: 20 }}>
                <article className="card">
                  <h4 className="sectionTitle">Recovery plan, goals, and routines</h4>
                  <form onSubmit={handlePlanSubmit} className="consumerFormGrid">
                    <label className="fieldLabel">
                      Preferred name
                      <input className="inputField" value={planForm.preferredName} onChange={(event) => setPlanForm((current) => ({ ...current, preferredName: event.target.value }))} />
                    </label>
                    <label className="fieldLabel">
                      Check-in preference
                      <input className="inputField" value={planForm.checkInPreference} onChange={(event) => setPlanForm((current) => ({ ...current, checkInPreference: event.target.value }))} />
                    </label>
                    <label className="fieldLabel fieldSpan">
                      Recovery focus
                      <textarea className="inputField textareaField" value={planForm.recoveryFocus} onChange={(event) => setPlanForm((current) => ({ ...current, recoveryFocus: event.target.value }))} />
                    </label>
                    <label className="fieldLabel fieldSpan">
                      Recovery plan summary
                      <textarea className="inputField textareaField" value={planForm.recoveryPlanSummary} onChange={(event) => setPlanForm((current) => ({ ...current, recoveryPlanSummary: event.target.value }))} />
                    </label>
                    <div className="fieldSpan">
                      <button type="submit" className="primaryButton" disabled={isSavingPlan}>
                        {isSavingPlan ? 'Saving plan...' : 'Save beta plan updates'}
                      </button>
                    </div>
                  </form>

                  <div className="consumerSectionGrid" style={{ marginTop: 16 }}>
                    <article className="taskCard">
                      <strong>Goals</strong>
                      <ul className="simpleList">
                        {selectedConsumer.goals.map((goal) => (
                          <li key={goal.id}>{goal.title} • {goal.status}</li>
                        ))}
                      </ul>
                    </article>
                    <article className="taskCard">
                      <strong>Routines and adherence</strong>
                      <ul className="simpleList">
                        {selectedConsumer.routines.map((routine) => (
                          <li key={routine.id}>
                            {routine.title} • {routine.completionCount7d} completions in 7d{routine.completedToday ? ' • done today' : ''}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </div>
                </article>

                <article className="card">
                  <h4 className="sectionTitle">Clinical notes</h4>
                  <form onSubmit={handleNoteSubmit} className="consumerFormGrid">
                    <label className="fieldLabel">
                      Note type
                      <select className="inputField" value={noteForm.noteType} onChange={(event) => setNoteForm((current) => ({ ...current, noteType: event.target.value }))}>
                        <option value="progress">Progress note</option>
                        <option value="follow_up">Follow-up note</option>
                        <option value="engagement">Engagement note</option>
                        <option value="risk">Risk note</option>
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Title
                      <input className="inputField" value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label className="fieldLabel fieldSpan">
                      Note body
                      <textarea className="inputField textareaField" value={noteForm.body} onChange={(event) => setNoteForm((current) => ({ ...current, body: event.target.value }))} />
                    </label>
                    <label className="checkboxRow fieldSpan">
                      <input type="checkbox" checked={noteForm.flaggedForFollowUp} onChange={(event) => setNoteForm((current) => ({ ...current, flaggedForFollowUp: event.target.checked }))} />
                      Flag this note for follow-up
                    </label>
                    <div className="fieldSpan">
                      <button type="submit" className="primaryButton" disabled={isSavingNote}>
                        {isSavingNote ? 'Saving note...' : 'Add clinician note'}
                      </button>
                    </div>
                  </form>

                  <div className="timeline" style={{ marginTop: 16 }}>
                    {selectedConsumer.notes.length ? selectedConsumer.notes.map((note) => (
                      <div key={note.id} className="listItemCard">
                        <div className="infoRow">
                          <strong>{note.title ?? 'Untitled note'}</strong>
                          <span className={`statusPill ${note.flaggedForFollowUp ? 'warning' : 'neutral'}`}>{note.noteType}</span>
                        </div>
                        <span>{note.body}</span>
                        <span className="muted">{note.author.fullName} • {formatDateTime(note.createdAt)}</span>
                      </div>
                    )) : <p className="muted">No clinician notes yet for this consumer.</p>}
                  </div>
                </article>
              </div>

              <div className="consumerTwoColumn" style={{ marginTop: 20 }}>
                <article className="card">
                  <h4 className="sectionTitle">Recent check-ins and shared journals</h4>
                  <div className="timeline">
                    {selectedConsumer.checkIns.map((checkIn) => (
                      <button
                        key={checkIn.id}
                        type="button"
                        className="listItemCard"
                        style={{ textAlign: 'left', cursor: 'pointer' }}
                        onClick={() => router.push(`/clinical/check-ins/${checkIn.id}`)}
                      >
                        <div className="infoRow">
                          <strong>{formatDateTime(checkIn.checkInDate)}</strong>
                          <span className={`statusPill ${toneForReview(checkIn.review?.status ?? 'pending')}`}>
                            {checkIn.review?.status ?? 'pending'}
                          </span>
                        </div>
                        <span className="muted">Mood {checkIn.mood}/10 • Cravings {checkIn.cravings}/10 • Stress {checkIn.stressLevel ?? 'n/a'}/10</span>
                        <span className="muted">{checkIn.wantsStaffFollowUp ? 'Requested follow-up' : 'No follow-up requested'}</span>
                      </button>
                    ))}
                  </div>

                  <div className="supportPanel">
                    <h4 className="sectionTitle">Shared journals only</h4>
                    <div className="timeline">
                      {selectedConsumer.sharedJournalEntries.length ? selectedConsumer.sharedJournalEntries.map((entry) => (
                        <div key={entry.id} className="supportCard">
                          <strong>{entry.title}</strong>
                          <span>{entry.content}</span>
                          <span className="muted">{entry.theme ?? 'No theme'} • {formatDateTime(entry.createdAt)}</span>
                        </div>
                      )) : <p className="muted">No journal entries have been shared with the care team.</p>}
                    </div>
                  </div>
                </article>

                <article className="card">
                  <h4 className="sectionTitle">Clinical supports</h4>
                  <div className="consumerSectionGrid">
                    <article className="taskCard">
                      <strong>Medications</strong>
                      <ul className="simpleList">
                        {selectedConsumer.medications.length ? selectedConsumer.medications.map((medication) => (
                          <li key={medication.id}>{medication.medicationName}{medication.dosage ? ` • ${medication.dosage}` : ''}{medication.schedule ? ` • ${medication.schedule}` : ''}</li>
                        )) : <li>No medications documented.</li>}
                      </ul>
                    </article>
                    <article className="taskCard">
                      <strong>Appointments</strong>
                      <ul className="simpleList">
                        {selectedConsumer.appointments.length ? selectedConsumer.appointments.map((appointment) => (
                          <li key={appointment.id}>{appointment.type} • {appointment.status} • {formatDateTime(appointment.startsAt)}</li>
                        )) : <li>No appointments documented.</li>}
                      </ul>
                    </article>
                    <article className="taskCard">
                      <strong>Conditions</strong>
                      <ul className="simpleList">
                        {selectedConsumer.conditions.length ? selectedConsumer.conditions.map((condition) => (
                          <li key={condition.id}>{condition.name} • {condition.status}{condition.symptomScore !== null ? ` • symptom ${condition.symptomScore}/10` : ''}</li>
                        )) : <li>No conditions documented.</li>}
                      </ul>
                    </article>
                    <article className="taskCard">
                      <strong>Care-plan reminders</strong>
                      <ul className="simpleList">
                        {selectedConsumer.currentPlan.reminders.length ? selectedConsumer.currentPlan.reminders.map((reminder) => (
                          <li key={`${reminder.title}-${reminder.schedule}`}>{reminder.title} • {reminder.schedule}</li>
                        )) : <li>No reminders documented.</li>}
                      </ul>
                    </article>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {selectedCheckIn ? (
            <section className="card">
              <div className="sectionHeaderRow">
                <div>
                  <p className="eyebrow">Check-in review detail</p>
                  <h3 className="sectionTitle">{selectedCheckIn.consumer.name}</h3>
                  <p className="muted">{formatDateTime(selectedCheckIn.checkIn.checkInDate)} • mood {selectedCheckIn.checkIn.mood}/10 • cravings {selectedCheckIn.checkIn.cravings}/10</p>
                </div>
                <div className="consumerActions">
                  <button type="button" className="secondaryButton" onClick={() => router.push(`/clinical/consumers/${selectedCheckIn.consumer.id}`)}>
                    Open consumer chart
                  </button>
                </div>
              </div>

              <div className="consumerTwoColumn">
                <article className="card">
                  <h4 className="sectionTitle">Check-in detail</h4>
                  <div className="timeline">
                    <div className="listItemCard">
                      <strong>Difficult moments</strong>
                      <ul className="simpleList">
                        {selectedCheckIn.checkIn.difficultMoments.length ? selectedCheckIn.checkIn.difficultMoments.map((item) => (
                          <li key={item}>{item}</li>
                        )) : <li>No difficult moments recorded.</li>}
                      </ul>
                    </div>
                    <div className="listItemCard">
                      <strong>Coping tools used</strong>
                      <ul className="simpleList">
                        {selectedCheckIn.checkIn.copingToolsUsed.length ? selectedCheckIn.checkIn.copingToolsUsed.map((item) => (
                          <li key={item}>{item}</li>
                        )) : <li>No coping tools documented.</li>}
                      </ul>
                    </div>
                    <div className="listItemCard">
                      <strong>Clinical context</strong>
                      <span className="muted">Stress {selectedCheckIn.checkIn.stressLevel ?? 'n/a'}/10 • Motivation {selectedCheckIn.checkIn.motivationLevel ?? 'n/a'}/10 • Sleep {selectedCheckIn.checkIn.sleepHours ?? 'n/a'}h</span>
                      <span>{selectedCheckIn.checkIn.notes ?? 'No additional consumer note provided.'}</span>
                      <span className="muted">{selectedCheckIn.checkIn.wantsStaffFollowUp ? 'Consumer requested follow-up.' : 'No explicit follow-up request.'}</span>
                    </div>
                  </div>
                </article>

                <article className="card">
                  <h4 className="sectionTitle">Review and outreach</h4>
                  <form onSubmit={handleReviewSubmit} className="consumerFormGrid">
                    <label className="fieldLabel">
                      Review status
                      <select className="inputField" value={reviewForm.status} onChange={(event) => setReviewForm((current) => ({ ...current, status: event.target.value as ReviewFormState['status'] }))}>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="needs_follow_up">Needs follow-up</option>
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Follow-up status
                      <select className="inputField" value={reviewForm.followUpStatus} onChange={(event) => setReviewForm((current) => ({ ...current, followUpStatus: event.target.value as ReviewFormState['followUpStatus'] }))}>
                        <option value="not_needed">Not needed</option>
                        <option value="needed">Needed</option>
                        <option value="planned">Planned</option>
                        <option value="completed">Completed</option>
                      </select>
                    </label>
                    <label className="fieldLabel fieldSpan">
                      Review note
                      <textarea className="inputField textareaField" value={reviewForm.reviewNote} onChange={(event) => setReviewForm((current) => ({ ...current, reviewNote: event.target.value }))} />
                    </label>
                    <label className="checkboxRow">
                      <input type="checkbox" checked={reviewForm.riskFlagged} onChange={(event) => setReviewForm((current) => ({ ...current, riskFlagged: event.target.checked }))} />
                      Risk flag remains active
                    </label>
                    <label className="checkboxRow">
                      <input type="checkbox" checked={reviewForm.outreachCompleted} onChange={(event) => setReviewForm((current) => ({ ...current, outreachCompleted: event.target.checked }))} />
                      Outreach completed
                    </label>
                    <div className="fieldSpan">
                      <button type="submit" className="primaryButton" disabled={isSavingReview}>
                        {isSavingReview ? 'Saving review...' : 'Save review'}
                      </button>
                    </div>
                  </form>

                  <div className="supportPanel">
                    <h4 className="sectionTitle">Current review state</h4>
                    <div className="timeline">
                      <div className="supportCard">
                        <span className={`statusPill ${toneForReview(selectedCheckIn.review?.status ?? 'pending')}`}>{selectedCheckIn.review?.status ?? 'pending'}</span>
                        <span className="muted">Follow-up: {selectedCheckIn.review?.followUpStatus ?? 'not_started'}</span>
                        <span className="muted">{selectedCheckIn.review?.reviewedAt ? `Reviewed ${formatDateTime(selectedCheckIn.review.reviewedAt)}` : 'Not yet reviewed'}</span>
                        <span className="muted">{selectedCheckIn.review?.outreachCompletedAt ? `Outreach completed ${formatDateTime(selectedCheckIn.review.outreachCompletedAt)}` : 'Outreach not marked complete'}</span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {error ? <p style={{ color: '#b42318' }}>{error}</p> : null}
          {successMessage ? <p style={{ color: '#0b6a38' }}>{successMessage}</p> : null}

          <section>
            <PasswordUpdateCard mustChangePassword={me?.user.mustChangePassword} />
          </section>
        </div>
      )}
    </RoleShell>
  );
}
