import { useEffect } from 'react'
import useCultureCodeMasterStore, { ensureCultureCodeSubscription } from '../store/useCultureCodeMasterStore'

export default function useCultureCodeMaster() {
  const state = useCultureCodeMasterStore()
  useEffect(() => {
    ensureCultureCodeSubscription()
  }, [])
  return state
}
