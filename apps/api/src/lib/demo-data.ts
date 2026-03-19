export const demoTenant = {
  id: 'tenant_demo',
  slug: 'clarity-demo',
  name: 'Clarity Demo Recovery Center'
};

export const demoConsumer = {
  id: 'consumer_ava',
  firstName: 'Ava',
  lastName: 'Martinez',
  traumaMode: true,
  cognitiveAssistMode: true,
  conditions: [
    { name: 'PTSD', symptomScore: 6, accommodation: 'Gentle prompts and reduced urgency language' },
    { name: 'insomnia', symptomScore: 4, accommodation: 'Sleep routine reminders and morning check-ins' }
  ],
  checkIns: [
    { mood: 6, cravings: 4, sleepHours: 5.5, gratitude: 'My peer mentor and a safe morning walk.' },
    { mood: 7, cravings: 3, sleepHours: 6.2, gratitude: 'Finishing my group session worksheet.' }
  ],
  goals: [
    { title: 'Attend 3 support meetings this week', status: 'in_progress' },
    { title: 'Practice grounding exercise twice daily', status: 'in_progress' }
  ],
  supportContacts: [
    { name: 'Jordan P.', relationship: 'Peer mentor', phone: '555-0101' },
    { name: 'Maya L.', relationship: 'Sibling', phone: '555-0110' }
  ]
};

export const demoClinical = {
  appointmentsToday: 12,
  pendingIntakes: 4,
  riskAlerts: 3,
  groupSessions: [
    { name: 'Trauma & Recovery Skills', startsAt: '10:00', facilitator: 'Dr. Renee Cole' },
    { name: 'Cognitive Pacing for TBI', startsAt: '14:00', facilitator: 'Alex Reed, LCSW' }
  ]
};

export const demoRcm = {
  openClaims: 118,
  deniedClaims: 12,
  arOver90DaysCents: 428500,
  topDenials: [
    { code: 'CO-16', reason: 'Missing information', count: 5 },
    { code: 'CO-197', reason: 'Authorization required', count: 4 }
  ]
};
