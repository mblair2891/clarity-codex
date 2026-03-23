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

type ResourceLibrary = {
  copingStrategies: Array<{
    title: string;
    description: string;
    whenToUse: string;
  }>;
  groundingTools: string[];
  emergencySupport: {
    crisisLine: string;
    emergency: string;
    overdose: string;
  };
  treatmentReminders: string[];
};

type ConsumerDashboardResponse = {
  consumer: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    displayName: string;
    fullName: string;
    email: string | null;
    organization: {
      id: string;
      name: string;
    } | null;
    traumaMode: boolean;
    cognitiveAssistMode: boolean;
    recoveryFocus: string | null;
    checkInPreference: string | null;
  };
  summary: {
    recoveryStatus: string;
    risk: {
      score: number;
      tier: string;
      factors: string[];
    };
    todayCheckInCompleted: boolean;
    averageMood: number | null;
    averageCravings: number | null;
    activeGoals: number;
    completedRoutinesToday: number;
    nextAppointment: {
      type: string;
      startsAt: string;
      status: string;
    } | null;
  };
  quickActions: Array<{
    id: string;
    label: string;
    section: string;
  }>;
  todayCheckIn:
    | {
        completed: false;
      }
    | {
        completed: true;
        submittedAt: string;
        mood: number;
        cravings: number;
        stressLevel: number | null;
        sleepHours: number | null;
        sleepQuality: number | null;
        motivationLevel: number | null;
        treatmentAdherence: boolean | null;
        difficultMoments: string[];
        copingToolsUsed: string[];
        wantsStaffFollowUp: boolean;
        notes: string | null;
        gratitude: string | null;
      };
  currentPlan: {
    summary: string;
    focusAreas: Array<{
      title: string;
      detail: string;
    }>;
    copingStrategies: Array<{
      title: string;
      detail: string;
    }>;
    reminders: Array<{
      title: string;
      schedule: string;
    }>;
    supportContacts: Array<{
      name: string;
      relationship: string;
      phone: string;
      availability?: string;
    }>;
    safetyPlan: Array<{
      title: string;
      action: string;
    }>;
    milestones: Array<{
      title: string;
      targetDate: string;
      status: string;
    }>;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    frequency: string;
    targetPerWeek: number | null;
    isActive: boolean;
    completedToday: boolean;
    streakDays: number;
    completionCount7d: number;
  }>;
  goals: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    targetLabel: string | null;
    targetDate: string | null;
    status: string;
  }>;
  checkInHistoryPreview: Array<{
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    stressLevel: number | null;
    motivationLevel: number | null;
    wantsStaffFollowUp: boolean;
    notes: string | null;
  }>;
  recentJournalEntries: Array<{
    id: string;
    title: string;
    content: string;
    moodScore: number | null;
    theme: string | null;
    sharedWithCareTeam: boolean;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    at: string;
  }>;
  support: {
    supportContacts: Array<{
      name: string;
      relationship: string;
      phone: string;
      availability?: string;
    }>;
    resources: ResourceLibrary;
  };
  medications: Array<{
    id: string;
    medicationName: string;
    dosage: string | null;
    schedule: string | null;
  }>;
  conditions: Array<{
    id: string;
    name: string;
    status: string;
    symptomScore: number | null;
    accommodation: string | null;
  }>;
  appointments: Array<{
    id: string;
    type: string;
    status: string;
    startsAt: string;
    endsAt: string;
  }>;
  profile: {
    preferredName: string | null;
    recoveryFocus: string | null;
    checkInPreference: string | null;
    mustChangePassword: boolean;
  };
};

type CheckInsResponse = {
  todayCompleted: boolean;
  trends: {
    averageMood7d: number | null;
    averageCravings7d: number | null;
    averageStress7d: number | null;
    followUpRequests7d: number;
    completionCount7d: number;
  };
  items: Array<{
    id: string;
    checkInDate: string;
    mood: number;
    cravings: number;
    stressLevel: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    motivationLevel: number | null;
    treatmentAdherence: boolean | null;
    difficultMoments: string[];
    copingToolsUsed: string[];
    wantsStaffFollowUp: boolean;
    notes: string | null;
    gratitude: string | null;
    createdAt: string;
  }>;
};

type JournalResponse = {
  items: Array<{
    id: string;
    title: string;
    content: string;
    moodScore: number | null;
    theme: string | null;
    sharedWithCareTeam: boolean;
    createdAt: string;
  }>;
};

type ProfileResponse = {
  profile: {
    firstName: string;
    lastName: string;
    preferredName: string | null;
    fullName: string;
    email: string | null;
    recoveryFocus: string | null;
    checkInPreference: string | null;
    traumaMode: boolean;
    cognitiveAssistMode: boolean;
    mustChangePassword: boolean;
  };
};

type RoutineCompletionResponse = {
  saved: boolean;
  routine: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    frequency: string;
    targetPerWeek: number | null;
    isActive: boolean;
    completedToday: boolean;
    completionCount7d: number;
  } | null;
};

type CheckInFormState = {
  mood: number;
  cravings: number;
  stressLevel: number;
  sleepHours: string;
  sleepQuality: number;
  motivationLevel: number;
  treatmentAdherence: boolean;
  difficultMoments: string;
  copingToolsUsed: string;
  wantsStaffFollowUp: boolean;
  notes: string;
  gratitude: string;
};

type JournalFormState = {
  title: string;
  content: string;
  moodScore: string;
  theme: string;
  sharedWithCareTeam: boolean;
};

type ProfileFormState = {
  preferredName: string;
  recoveryFocus: string;
  checkInPreference: string;
};

const defaultCheckInForm: CheckInFormState = {
  mood: 6,
  cravings: 2,
  stressLevel: 3,
  sleepHours: '7',
  sleepQuality: 4,
  motivationLevel: 7,
  treatmentAdherence: true,
  difficultMoments: '',
  copingToolsUsed: '',
  wantsStaffFollowUp: false,
  notes: '',
  gratitude: ''
};

const defaultJournalForm: JournalFormState = {
  title: '',
  content: '',
  moodScore: '',
  theme: '',
  sharedWithCareTeam: false
};

function buildCheckInForm(todayCheckIn: ConsumerDashboardResponse['todayCheckIn']): CheckInFormState {
  if (!todayCheckIn.completed) {
    return defaultCheckInForm;
  }

  return {
    mood: todayCheckIn.mood,
    cravings: todayCheckIn.cravings,
    stressLevel: todayCheckIn.stressLevel ?? 3,
    sleepHours: todayCheckIn.sleepHours?.toString() ?? '',
    sleepQuality: todayCheckIn.sleepQuality ?? 3,
    motivationLevel: todayCheckIn.motivationLevel ?? 6,
    treatmentAdherence: todayCheckIn.treatmentAdherence ?? true,
    difficultMoments: todayCheckIn.difficultMoments.join(', '),
    copingToolsUsed: todayCheckIn.copingToolsUsed.join(', '),
    wantsStaffFollowUp: todayCheckIn.wantsStaffFollowUp,
    notes: todayCheckIn.notes ?? '',
    gratitude: todayCheckIn.gratitude ?? ''
  };
}

function buildProfileForm(profile: ProfileResponse['profile'] | ConsumerDashboardResponse['profile']): ProfileFormState {
  return {
    preferredName: profile.preferredName ?? '',
    recoveryFocus: profile.recoveryFocus ?? '',
    checkInPreference: profile.checkInPreference ?? ''
  };
}

function toList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function scrollToSection(section: string) {
  document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes('high')) {
    return 'warning';
  }

  if (normalized.includes('follow')) {
    return 'focus';
  }

  if (normalized.includes('track') || normalized.includes('ready')) {
    return 'success';
  }

  return 'neutral';
}

export function ConsumerPortal() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<ConsumerDashboardResponse | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInsResponse | null>(null);
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [resources, setResources] = useState<ResourceLibrary | null>(null);
  const [checkInForm, setCheckInForm] = useState<CheckInFormState>(defaultCheckInForm);
  const [journalForm, setJournalForm] = useState<JournalFormState>(defaultJournalForm);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    preferredName: '',
    recoveryFocus: '',
    checkInPreference: ''
  });
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [routineSavingId, setRoutineSavingId] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [journalSuccess, setJournalSuccess] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  async function loadPortalData(token: string, knownSession?: AuthMeResponse) {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    setIsLoading(true);

    try {
      const session = knownSession ?? await fetchMe(apiBaseUrl, token);

      if (session.landingPath !== '/consumer') {
        router.replace(session.landingPath);
        return;
      }

      const [nextDashboard, nextCheckIns, nextJournal, nextProfile, nextResources] = await Promise.all([
        apiFetch<ConsumerDashboardResponse>(apiBaseUrl, '/v1/consumer/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        apiFetch<CheckInsResponse>(apiBaseUrl, '/v1/consumer/check-ins', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        apiFetch<JournalResponse>(apiBaseUrl, '/v1/consumer/journal', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        apiFetch<ProfileResponse>(apiBaseUrl, '/v1/consumer/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        apiFetch<ResourceLibrary>(apiBaseUrl, '/v1/consumer/resources', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      setMe(session);
      setDashboard(nextDashboard);
      setCheckIns(nextCheckIns);
      setJournal(nextJournal);
      setProfile(nextProfile);
      setResources(nextResources);
      setCheckInForm(buildCheckInForm(nextDashboard.todayCheckIn));
      setProfileForm(buildProfileForm(nextProfile.profile));
      setError(null);
    } catch (loadError) {
      if (loadError instanceof ApiResponseError && loadError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(loadError instanceof Error ? loadError.message : 'Unable to load your recovery workspace right now.');
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

    loadPortalData(token).catch(() => {});
  }, [apiBaseUrl, apiBaseUrlError, router]);

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  async function handleCheckInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingCheckIn(true);
    setCheckInSuccess(null);
    setError(null);

    try {
      await apiFetch(apiBaseUrl, '/v1/consumer/check-ins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mood: checkInForm.mood,
          cravings: checkInForm.cravings,
          stressLevel: checkInForm.stressLevel,
          sleepHours: checkInForm.sleepHours ? Number(checkInForm.sleepHours) : undefined,
          sleepQuality: checkInForm.sleepQuality,
          motivationLevel: checkInForm.motivationLevel,
          treatmentAdherence: checkInForm.treatmentAdherence,
          difficultMoments: toList(checkInForm.difficultMoments),
          copingToolsUsed: toList(checkInForm.copingToolsUsed),
          wantsStaffFollowUp: checkInForm.wantsStaffFollowUp,
          notes: checkInForm.notes || undefined,
          gratitude: checkInForm.gratitude || undefined
        })
      });

      await loadPortalData(token, me ?? undefined);
      setCheckInSuccess('Today’s recovery check-in is saved.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save today’s check-in.');
    } finally {
      setIsSavingCheckIn(false);
    }
  }

  async function handleJournalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingJournal(true);
    setJournalSuccess(null);
    setError(null);

    try {
      await apiFetch(apiBaseUrl, '/v1/consumer/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: journalForm.title,
          content: journalForm.content,
          moodScore: journalForm.moodScore ? Number(journalForm.moodScore) : undefined,
          theme: journalForm.theme || undefined,
          sharedWithCareTeam: journalForm.sharedWithCareTeam
        })
      });

      setJournalForm(defaultJournalForm);
      await loadPortalData(token, me ?? undefined);
      setJournalSuccess('Reflection saved to your journal.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save your journal entry.');
    } finally {
      setIsSavingJournal(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingProfile(true);
    setProfileSuccess(null);
    setError(null);

    try {
      await apiFetch(apiBaseUrl, '/v1/consumer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preferredName: profileForm.preferredName || null,
          recoveryFocus: profileForm.recoveryFocus || null,
          checkInPreference: profileForm.checkInPreference || null
        })
      });

      await loadPortalData(token, me ?? undefined);
      setProfileSuccess('Profile settings updated.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to save profile settings.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleRoutineToggle(routineId: string, completed: boolean) {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setRoutineSavingId(routineId);
    setError(null);

    try {
      const response = await apiFetch<RoutineCompletionResponse>(apiBaseUrl, `/v1/consumer/routines/${routineId}/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          completed
        })
      });

      setDashboard((current) => current
        ? {
            ...current,
            tasks: current.tasks.map((routine) => routine.id === routineId && response.routine
              ? {
                  ...routine,
                  completedToday: response.routine.completedToday,
                  completionCount7d: response.routine.completionCount7d
                }
              : routine
            )
          }
        : current
      );

      await loadPortalData(token, me ?? undefined);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to update this recovery habit.');
    } finally {
      setRoutineSavingId(null);
    }
  }

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'consumer')} title="Recovery Hub">
      {isLoading ? (
        <section className="consumerStack">
          <section className="consumerHero card">
            <p className="eyebrow">Preparing your recovery workspace</p>
            <h2 className="sectionTitle" style={{ marginBottom: 0 }}>Loading your beta consumer experience</h2>
            <p className="muted">Pulling check-ins, routines, journal entries, and support tools from the beta API.</p>
          </section>
          <section className="grid">
            <article className="card"><span className="metric">...</span><span className="muted">Recovery status</span></article>
            <article className="card"><span className="metric">...</span><span className="muted">Today’s check-in</span></article>
            <article className="card"><span className="metric">...</span><span className="muted">Habits completed</span></article>
          </section>
        </section>
      ) : (
        <div className="consumerStack">
          <section className="consumerHero card">
            <div className="consumerHeroTop">
              <div>
                <p className="eyebrow">Consumer beta workspace</p>
                <h2 className="consumerHeading">Welcome back, {dashboard?.consumer.displayName ?? 'there'}</h2>
                <p className="muted consumerLead">
                  {dashboard?.consumer.recoveryFocus
                    ? dashboard.consumer.recoveryFocus
                    : 'Use this space to check in, keep routines moving, and reach out before a difficult moment turns into a setback.'}
                </p>
              </div>
              <div className="consumerActions">
                <button type="button" className="primaryButton" onClick={() => scrollToSection('checkin')}>
                  {dashboard?.todayCheckIn.completed ? 'Update today’s check-in' : 'Start today’s check-in'}
                </button>
                <button type="button" className="secondaryButton" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>

            <div className="consumerStatusRow">
              <span className={`statusPill ${statusTone(dashboard?.summary.recoveryStatus ?? '')}`}>
                {dashboard?.summary.recoveryStatus ?? 'Recovery status'}
              </span>
              <span className="muted">
                {dashboard?.consumer.organization?.name ?? 'Consumer beta tenant'}{dashboard?.consumer.checkInPreference ? ` • ${dashboard.consumer.checkInPreference}` : ''}
              </span>
            </div>

            <div className="consumerQuickActions">
              {dashboard?.quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quickActionCard"
                  onClick={() => scrollToSection(action.section)}
                >
                  <strong>{action.label}</strong>
                  <span>Jump to {action.section}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid">
            <article className="card">
              <span className="muted">Risk tier</span>
              <span className="metric">{dashboard?.summary.risk.tier ?? 'n/a'}</span>
              <p className="muted">Score {dashboard?.summary.risk.score ?? 0}/100</p>
            </article>
            <article className="card">
              <span className="muted">Today’s check-in</span>
              <span className="metric">{dashboard?.summary.todayCheckInCompleted ? 'Done' : 'Open'}</span>
              <p className="muted">
                {dashboard?.todayCheckIn.completed
                  ? `Saved ${formatDateTime(dashboard.todayCheckIn.submittedAt)}`
                  : 'Complete your recovery check-in to update your status.'}
              </p>
            </article>
            <article className="card">
              <span className="muted">Habits completed today</span>
              <span className="metric">{dashboard?.summary.completedRoutinesToday ?? 0}</span>
              <p className="muted">{dashboard?.summary.activeGoals ?? 0} active goals in your plan</p>
            </article>
            <article className="card">
              <span className="muted">Next appointment</span>
              <span className="metric">{dashboard?.summary.nextAppointment?.type ?? 'None'}</span>
              <p className="muted">
                {dashboard?.summary.nextAppointment
                  ? formatDateTime(dashboard.summary.nextAppointment.startsAt)
                  : 'No upcoming appointment is scheduled yet.'}
              </p>
            </article>
          </section>

          <section className="consumerTwoColumn">
            <article className="card" id="dashboard">
              <h3 className="sectionTitle">Current recovery status</h3>
              <div className="list">
                <div className="infoRow">
                  <strong>Average mood</strong>
                  <span>{checkIns?.trends.averageMood7d ?? dashboard?.summary.averageMood ?? 'n/a'}/10</span>
                </div>
                <div className="infoRow">
                  <strong>Average cravings</strong>
                  <span>{checkIns?.trends.averageCravings7d ?? dashboard?.summary.averageCravings ?? 'n/a'}/10</span>
                </div>
                <div className="infoRow">
                  <strong>Average stress</strong>
                  <span>{checkIns?.trends.averageStress7d ?? 'n/a'}/10</span>
                </div>
                <div className="infoRow">
                  <strong>Requested follow-up in last 7 days</strong>
                  <span>{checkIns?.trends.followUpRequests7d ?? 0}</span>
                </div>
              </div>
              {dashboard?.summary.risk.factors.length ? (
                <div style={{ marginTop: 16 }}>
                  <p className="muted">What is influencing today’s status</p>
                  <div className="pillRow">
                    {dashboard.summary.risk.factors.map((factor) => (
                      <span key={factor} className="statusPill neutral">{factor}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>

            <article className="card">
              <h3 className="sectionTitle">Support and help</h3>
              {dashboard?.support.supportContacts.length ? (
                <div className="list">
                  {dashboard.support.supportContacts.map((contact) => (
                    <div key={contact.name} className="supportCard">
                      <strong>{contact.name}</strong>
                      <span>{contact.relationship}</span>
                      <span>{contact.phone}</span>
                      {contact.availability ? <span className="muted">{contact.availability}</span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Support contacts will appear here when available.</p>
              )}
              <div className="supportPanel">
                <strong>Need urgent help?</strong>
                <p>{resources?.emergencySupport.crisisLine ?? 'Call or text 988 any time for immediate crisis support.'}</p>
                <p>{resources?.emergencySupport.emergency ?? 'If you are in immediate danger, call 911 now.'}</p>
              </div>
            </article>
          </section>

          <section className="consumerTwoColumn">
            <article className="card" id="plan">
              <h3 className="sectionTitle">Recovery plan</h3>
              <p>{dashboard?.currentPlan.summary}</p>
              <div className="consumerSectionGrid">
                <div>
                  <p className="muted">Focus areas</p>
                  {dashboard?.currentPlan.focusAreas.length ? (
                    <ul className="detailList">
                      {dashboard.currentPlan.focusAreas.map((item) => (
                        <li key={item.title}>
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No focus areas yet.</p>
                  )}
                </div>
                <div>
                  <p className="muted">Reminders and milestones</p>
                  {dashboard?.currentPlan.reminders.length ? (
                    <ul className="detailList">
                      {dashboard.currentPlan.reminders.map((item) => (
                        <li key={item.title}>
                          <strong>{item.title}</strong>
                          <span>{item.schedule}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No reminders configured yet.</p>
                  )}
                  {dashboard?.currentPlan.milestones.length ? (
                    <ul className="detailList" style={{ marginTop: 16 }}>
                      {dashboard.currentPlan.milestones.map((item) => (
                        <li key={item.title}>
                          <strong>{item.title}</strong>
                          <span>{formatDate(item.targetDate)} • {item.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <p className="muted">Goals</p>
                {dashboard?.goals.length ? (
                  <div className="list">
                    {dashboard.goals.map((goal) => (
                      <div key={goal.id} className="listItemCard">
                        <strong>{goal.title}</strong>
                        {goal.description ? <span>{goal.description}</span> : null}
                        <span className="muted">
                          {[goal.category, goal.targetLabel, goal.targetDate ? formatDate(goal.targetDate) : null, goal.status]
                            .filter(Boolean)
                            .join(' • ')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Goals will appear here once they are added to your recovery plan.</p>
                )}
              </div>
            </article>

            <article className="card">
              <h3 className="sectionTitle">Recent activity</h3>
              {dashboard?.recentActivity.length ? (
                <div className="timeline">
                  {dashboard.recentActivity.map((activity) => (
                    <div key={activity.id} className="timelineItem">
                      <strong>{activity.title}</strong>
                      <span>{activity.detail}</span>
                      <span className="muted">{formatDateTime(activity.at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">As you use the recovery hub, your recent activity will show up here.</p>
              )}
            </article>
          </section>

          <section className="card" id="checkin">
            <div className="sectionHeaderRow">
              <div>
                <h3 className="sectionTitle">Daily check-in</h3>
                <p className="muted">Track how you are doing today and flag when support would help.</p>
              </div>
              <span className={`statusPill ${dashboard?.todayCheckIn.completed ? 'success' : 'focus'}`}>
                {dashboard?.todayCheckIn.completed ? 'Completed today' : 'Not completed yet'}
              </span>
            </div>

            <form onSubmit={handleCheckInSubmit} className="consumerFormGrid">
              <label className="fieldLabel">
                Mood: <strong>{checkInForm.mood}/10</strong>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={checkInForm.mood}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, mood: Number(event.target.value) }))}
                />
              </label>
              <label className="fieldLabel">
                Cravings: <strong>{checkInForm.cravings}/10</strong>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={checkInForm.cravings}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, cravings: Number(event.target.value) }))}
                />
              </label>
              <label className="fieldLabel">
                Stress / anxiety: <strong>{checkInForm.stressLevel}/10</strong>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={checkInForm.stressLevel}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, stressLevel: Number(event.target.value) }))}
                />
              </label>
              <label className="fieldLabel">
                Sleep quality: <strong>{checkInForm.sleepQuality}/5</strong>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={checkInForm.sleepQuality}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, sleepQuality: Number(event.target.value) }))}
                />
              </label>
              <label className="fieldLabel">
                Recovery confidence: <strong>{checkInForm.motivationLevel}/10</strong>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={checkInForm.motivationLevel}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, motivationLevel: Number(event.target.value) }))}
                />
              </label>
              <label className="fieldLabel">
                Sleep hours
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.1"
                  className="inputField"
                  value={checkInForm.sleepHours}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, sleepHours: event.target.value }))}
                />
              </label>
              <label className="fieldLabel fieldSpan">
                Difficult moments or triggers
                <input
                  type="text"
                  className="inputField"
                  value={checkInForm.difficultMoments}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, difficultMoments: event.target.value }))}
                  placeholder="Example: family conflict, old neighborhood, poor sleep"
                />
              </label>
              <label className="fieldLabel fieldSpan">
                Coping tools used today
                <input
                  type="text"
                  className="inputField"
                  value={checkInForm.copingToolsUsed}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, copingToolsUsed: event.target.value }))}
                  placeholder="Example: grounding, walking, called sponsor"
                />
              </label>
              <label className="fieldLabel fieldSpan">
                Notes or journal reflection
                <textarea
                  className="inputField textareaField"
                  value={checkInForm.notes}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="What happened today, what helped, and what do you need next?"
                />
              </label>
              <label className="fieldLabel fieldSpan">
                Gratitude or win from today
                <input
                  type="text"
                  className="inputField"
                  value={checkInForm.gratitude}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, gratitude: event.target.value }))}
                  placeholder="One thing that felt grounding or encouraging"
                />
              </label>
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={checkInForm.treatmentAdherence}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, treatmentAdherence: event.target.checked }))}
                />
                I stayed on track with my treatment or medication plan today
              </label>
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={checkInForm.wantsStaffFollowUp}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, wantsStaffFollowUp: event.target.checked }))}
                />
                I want staff follow-up
              </label>
              <div className="fieldSpan">
                <button type="submit" className="primaryButton" disabled={isSavingCheckIn}>
                  {isSavingCheckIn ? 'Saving check-in...' : 'Save check-in'}
                </button>
              </div>
            </form>
            {checkInSuccess ? <p className="successText">{checkInSuccess}</p> : null}
          </section>

          <section className="consumerTwoColumn" id="history">
            <article className="card">
              <h3 className="sectionTitle">Check-in history</h3>
              {checkIns?.items.length ? (
                <div className="list">
                  {checkIns.items.map((entry) => (
                    <div key={entry.id} className="listItemCard">
                      <div className="infoRow">
                        <strong>{formatDate(entry.checkInDate)}</strong>
                        <span className={`statusPill ${entry.wantsStaffFollowUp ? 'focus' : 'neutral'}`}>
                          mood {entry.mood}/10
                        </span>
                      </div>
                      <span>Cravings {entry.cravings}/10 • Stress {entry.stressLevel ?? 'n/a'}/10 • Confidence {entry.motivationLevel ?? 'n/a'}/10</span>
                      {entry.notes ? <span>{entry.notes}</span> : null}
                      <span className="muted">
                        {entry.copingToolsUsed.length ? `Coping tools: ${entry.copingToolsUsed.join(', ')}` : 'No coping tools logged'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Your recent check-ins will appear here after you complete your first one.</p>
              )}
            </article>

            <article className="card">
              <h3 className="sectionTitle">Trend summary</h3>
              <div className="trendBlock">
                <div>
                  <span className="muted">Mood trend</span>
                  <strong>{checkIns?.trends.averageMood7d ?? 'n/a'}/10</strong>
                </div>
                <div className="trendBar">
                  <span style={{ width: `${((checkIns?.trends.averageMood7d ?? 0) / 10) * 100}%` }} />
                </div>
              </div>
              <div className="trendBlock">
                <div>
                  <span className="muted">Craving trend</span>
                  <strong>{checkIns?.trends.averageCravings7d ?? 'n/a'}/10</strong>
                </div>
                <div className="trendBar">
                  <span style={{ width: `${((checkIns?.trends.averageCravings7d ?? 0) / 10) * 100}%` }} />
                </div>
              </div>
              <div className="trendBlock">
                <div>
                  <span className="muted">Stress trend</span>
                  <strong>{checkIns?.trends.averageStress7d ?? 'n/a'}/10</strong>
                </div>
                <div className="trendBar">
                  <span style={{ width: `${((checkIns?.trends.averageStress7d ?? 0) / 10) * 100}%` }} />
                </div>
              </div>
              <div className="supportPanel">
                <strong>Weekly consistency</strong>
                <p>{checkIns?.trends.completionCount7d ?? 0} check-ins completed in the last 7 days.</p>
                <p>{checkIns?.trends.followUpRequests7d ?? 0} follow-up requests submitted in the last 7 days.</p>
              </div>
            </article>
          </section>

          <section className="card" id="routines">
            <div className="sectionHeaderRow">
              <div>
                <h3 className="sectionTitle">Tasks, habits, and routines</h3>
                <p className="muted">Mark the habits that help keep recovery steady.</p>
              </div>
            </div>
            {dashboard?.tasks.length ? (
              <div className="consumerSectionGrid">
                {dashboard.tasks.map((routine) => (
                  <article key={routine.id} className="taskCard">
                    <div className="infoRow">
                      <strong>{routine.title}</strong>
                      <span className={`statusPill ${routine.completedToday ? 'success' : 'neutral'}`}>
                        {routine.completedToday ? 'Done today' : 'Open today'}
                      </span>
                    </div>
                    {routine.description ? <p>{routine.description}</p> : null}
                    <p className="muted">
                      {[routine.category, routine.frequency, routine.targetPerWeek ? `${routine.targetPerWeek}/week` : null]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                    <div className="infoRow">
                      <span>{routine.completionCount7d} completions in 7 days</span>
                      <button
                        type="button"
                        className={routine.completedToday ? 'secondaryButton' : 'primaryButton'}
                        onClick={() => handleRoutineToggle(routine.id, !routine.completedToday)}
                        disabled={routineSavingId === routine.id}
                      >
                        {routineSavingId === routine.id
                          ? 'Saving...'
                          : routine.completedToday
                            ? 'Mark as not done'
                            : 'Mark complete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Your active routines will appear here.</p>
            )}
          </section>

          <section className="consumerTwoColumn" id="journal">
            <article className="card">
              <h3 className="sectionTitle">Journal and reflections</h3>
              <form onSubmit={handleJournalSubmit} className="consumerFormGrid">
                <label className="fieldLabel fieldSpan">
                  Title
                  <input
                    type="text"
                    className="inputField"
                    value={journalForm.title}
                    onChange={(event) => setJournalForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="What stood out today?"
                  />
                </label>
                <label className="fieldLabel">
                  Mood tag
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="inputField"
                    value={journalForm.moodScore}
                    onChange={(event) => setJournalForm((current) => ({ ...current, moodScore: event.target.value }))}
                    placeholder="1-10"
                  />
                </label>
                <label className="fieldLabel">
                  Theme
                  <input
                    type="text"
                    className="inputField"
                    value={journalForm.theme}
                    onChange={(event) => setJournalForm((current) => ({ ...current, theme: event.target.value }))}
                    placeholder="connection, craving, sleep"
                  />
                </label>
                <label className="fieldLabel fieldSpan">
                  Reflection
                  <textarea
                    className="inputField textareaField"
                    value={journalForm.content}
                    onChange={(event) => setJournalForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Write about what happened, what you noticed, and what support you want next."
                  />
                </label>
                <label className="checkboxRow fieldSpan">
                  <input
                    type="checkbox"
                    checked={journalForm.sharedWithCareTeam}
                    onChange={(event) => setJournalForm((current) => ({ ...current, sharedWithCareTeam: event.target.checked }))}
                  />
                  Share this entry with the care team
                </label>
                <div className="fieldSpan">
                  <button type="submit" className="primaryButton" disabled={isSavingJournal}>
                    {isSavingJournal ? 'Saving reflection...' : 'Add journal entry'}
                  </button>
                </div>
              </form>
              {journalSuccess ? <p className="successText">{journalSuccess}</p> : null}
            </article>

            <article className="card">
              <h3 className="sectionTitle">Previous journal entries</h3>
              {journal?.items.length ? (
                <div className="list">
                  {journal.items.map((entry) => (
                    <div key={entry.id} className="listItemCard">
                      <div className="infoRow">
                        <strong>{entry.title}</strong>
                        <span className={`statusPill ${entry.sharedWithCareTeam ? 'focus' : 'neutral'}`}>
                          {entry.sharedWithCareTeam ? 'Shared with care team' : 'Private'}
                        </span>
                      </div>
                      <span>{entry.content}</span>
                      <span className="muted">
                        {[entry.theme, entry.moodScore ? `Mood ${entry.moodScore}/10` : null, formatDateTime(entry.createdAt)]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Your reflections will appear here once you save your first entry.</p>
              )}
            </article>
          </section>

          <section className="consumerTwoColumn" id="resources">
            <article className="card">
              <h3 className="sectionTitle">Resources and coping tools</h3>
              {resources?.copingStrategies.length ? (
                <div className="list">
                  {resources.copingStrategies.map((strategy) => (
                    <div key={strategy.title} className="listItemCard">
                      <strong>{strategy.title}</strong>
                      <span>{strategy.description}</span>
                      <span className="muted">Use when: {strategy.whenToUse}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Helpful coping strategies will appear here.</p>
              )}
            </article>

            <article className="card">
              <h3 className="sectionTitle">Grounding and emergency support</h3>
              <div className="supportPanel">
                <strong>Crisis and emergency guidance</strong>
                <p>{resources?.emergencySupport.crisisLine}</p>
                <p>{resources?.emergencySupport.emergency}</p>
                <p>{resources?.emergencySupport.overdose}</p>
              </div>
              <div style={{ marginTop: 16 }}>
                <p className="muted">Grounding tools</p>
                <ul className="simpleList">
                  {resources?.groundingTools.map((tool) => (
                    <li key={tool}>{tool}</li>
                  ))}
                </ul>
              </div>
              <div style={{ marginTop: 16 }}>
                <p className="muted">Treatment reminders</p>
                <ul className="simpleList">
                  {resources?.treatmentReminders.map((reminder) => (
                    <li key={reminder}>{reminder}</li>
                  ))}
                </ul>
              </div>
            </article>
          </section>

          <section className="consumerTwoColumn" id="profile">
            <article className="card">
              <h3 className="sectionTitle">Profile and settings</h3>
              <div className="profileSummary">
                <div>
                  <span className="muted">Signed in as</span>
                  <strong>{profile?.profile.fullName ?? me?.user.fullName ?? 'Consumer account'}</strong>
                  <span>{profile?.profile.email ?? dashboard?.consumer.email ?? 'No email found'}</span>
                </div>
                <div>
                  <span className="muted">Preferences</span>
                  <strong>{profile?.profile.preferredName || 'No preferred name set'}</strong>
                  <span>{profile?.profile.checkInPreference || 'No check-in preference set'}</span>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="consumerFormGrid" style={{ marginTop: 20 }}>
                <label className="fieldLabel">
                  Preferred name
                  <input
                    type="text"
                    className="inputField"
                    value={profileForm.preferredName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, preferredName: event.target.value }))}
                    placeholder="What should we call you?"
                  />
                </label>
                <label className="fieldLabel">
                  Check-in preference
                  <input
                    type="text"
                    className="inputField"
                    value={profileForm.checkInPreference}
                    onChange={(event) => setProfileForm((current) => ({ ...current, checkInPreference: event.target.value }))}
                    placeholder="Morning, lunch break, evening"
                  />
                </label>
                <label className="fieldLabel fieldSpan">
                  Recovery focus
                  <textarea
                    className="inputField textareaField"
                    value={profileForm.recoveryFocus}
                    onChange={(event) => setProfileForm((current) => ({ ...current, recoveryFocus: event.target.value }))}
                    placeholder="What are you trying to protect or build right now?"
                  />
                </label>
                <div className="profileFlags fieldSpan">
                  <span className={`statusPill ${profile?.profile.traumaMode ? 'focus' : 'neutral'}`}>Trauma-informed mode {profile?.profile.traumaMode ? 'on' : 'off'}</span>
                  <span className={`statusPill ${profile?.profile.cognitiveAssistMode ? 'focus' : 'neutral'}`}>Cognitive assist {profile?.profile.cognitiveAssistMode ? 'on' : 'off'}</span>
                </div>
                <div className="fieldSpan consumerActions">
                  <button type="submit" className="primaryButton" disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving settings...' : 'Save settings'}
                  </button>
                  <button type="button" className="secondaryButton" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </form>
              {profileSuccess ? <p className="successText">{profileSuccess}</p> : null}
            </article>

            <div className="consumerStack">
              <PasswordUpdateCard mustChangePassword={profile?.profile.mustChangePassword ?? dashboard?.profile.mustChangePassword} />
              <article className="card">
                <h3 className="sectionTitle">What is still visible to staff</h3>
                <p className="muted">
                  Journal entries stay private unless you choose to share them. Daily check-ins and follow-up requests are part of your recovery support workflow.
                </p>
              </article>
            </div>
          </section>

          {error ? (
            <section className="card" style={{ borderColor: '#f4c7c3' }}>
              <h3 className="sectionTitle">Something needs attention</h3>
              <p style={{ color: '#b42318', margin: 0 }}>{error}</p>
            </section>
          ) : null}
        </div>
      )}
    </RoleShell>
  );
}
