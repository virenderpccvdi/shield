import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChildProfile {
  id: string;
  name: string;
  age?: number;
  avatarUrl?: string;
  dnsClientId?: string;
  filterLevel?: string;
}

interface ProfileStore {
  profiles: ChildProfile[];
  selectedProfileId: string | null;
  setProfiles: (profiles: ChildProfile[]) => void;
  selectProfile: (id: string) => void;
  selectedProfile: () => ChildProfile | null;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      selectedProfileId: null,
      setProfiles: (profiles) => set({ profiles }),
      selectProfile: (id) => set({ selectedProfileId: id }),
      selectedProfile: () => {
        const { profiles, selectedProfileId } = get();
        return profiles.find(p => p.id === selectedProfileId) ?? profiles[0] ?? null;
      },
    }),
    { name: 'shield-profiles' }
  )
);
