export const themes = {
  light: {
    '--bg': '#f5f6fa',
    '--bg2': '#ffffff',
    '--bg3': '#f0f1f7',
    '--bg4': '#e8eaf2',
    '--border': '#e2e4ef',
    '--border2': '#c8cade',
    '--text': '#1a1d2e',
    '--text2': '#4a4f6e',
    '--text3': '#8b90ab',
    '--accent': '#4a6cf7',
    '--accent2': '#3a5ce5',
    '--ca': '#dbeafe',
    '--ca2': '#2563eb',
    '--ca-t': '#1d4ed8',
    '--ip': '#ede9fe',
    '--ip2': '#7c3aed',
    '--ip-t': '#6d28d9',
    '--all': '#dcfce7',
    '--all2': '#16a34a',
    '--all-t': '#15803d',
    '--green': '#16a34a',
    '--yellow': '#d97706',
    '--red': '#dc2626',
    '--orange': '#ea580c',
  },
  dark: {
    '--bg': '#0f1117',
    '--bg2': '#161820',
    '--bg3': '#1e2028',
    '--bg4': '#252730',
    '--border': '#2e3040',
    '--border2': '#3a3d52',
    '--text': '#e8eaf2',
    '--text2': '#9095b0',
    '--text3': '#565a75',
    '--accent': '#4a6cf7',
    '--accent2': '#6a8cf9',
    '--ca': '#2a3a5c',
    '--ca2': '#3d5a8a',
    '--ca-t': '#7eb3f5',
    '--ip': '#3a2a4a',
    '--ip2': '#6a3d8a',
    '--ip-t': '#c47ef5',
    '--all': '#2a3d2a',
    '--all2': '#3d7a3d',
    '--all-t': '#7fd47f',
    '--green': '#42d4a0',
    '--yellow': '#f5c842',
    '--red': '#f56b6b',
    '--orange': '#f5934a',
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  Object.entries(themes[theme]).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  localStorage.setItem('theme', theme)
}

export function getStoredTheme() {
  return localStorage.getItem('theme') || 'light'
}