// These accounts are provisioned by the administrator in Firebase Authentication.
export const APPROVED_ACCOUNTS = Object.freeze({
  Y8vw5cfhULNq4iL4InucSYLyc943: '강은비',
  MQMIBvrKmMQXCvFh4gcnlMiTYnv1: '안선민',
  np1FxuALXqQ6PFN60ItL6ypBuqi1: '이승현',
  gzDFPbI2tLX02RcddeXzVjPWbsO2: '이상학',
  jejvUmlynrPv1WfvStgHeipDjH62: '최희우',
  '7nF7yOQ6gFS2C5t2yTQygF1Uym62': '임상훈',
})

export function accountName(user) {
  if (!user || !Object.hasOwn(APPROVED_ACCOUNTS, user.uid)) return ''
  const name = user.email?.split('@')[0] || ''
  return name === APPROVED_ACCOUNTS[user.uid] ? name : ''
}
