const PREFIX = 'pgmdr:competitor-meeting-draft:v1:'

export function meetingDraftKey(userName, week, organization, company) {
  return PREFIX + JSON.stringify([userName || '', week, organization, company])
}

export function readMeetingDraft(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return typeof value === 'string' ? value : null
  } catch { return null }
}

export function cachedMeetingOrganizations(userName, week) {
  const names = new Set()
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key?.startsWith(PREFIX)) continue
      const [user, savedWeek, organization] = JSON.parse(key.slice(PREFIX.length))
      if (user === (userName || '') && savedWeek === week) names.add(organization)
    }
  } catch { /* The editor reports storage failures when typing. */ }
  return [...names]
}
