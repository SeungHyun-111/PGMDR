import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCompetitorVisibilityStore = create(persist(set => ({
  hidden: false,
  setHidden: hidden => set({ hidden }),
}), { name: 'competitor-search-visibility' }))

export default useCompetitorVisibilityStore
