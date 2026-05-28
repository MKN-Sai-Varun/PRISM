import { create } from 'zustand';

export interface EnrolledUser {
  id: string;
  name: string;
  employeeId: string;
  rgbEmbedding: number[];
  geoVector: number[];
  enrolledAt: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  confidence: number;
  channel: 'rgb' | 'geo' | 'fusion';
  synced: boolean;
}

interface AppState {
  enrolledUsers: EnrolledUser[];
  attendanceLogs: AttendanceLog[];
  isSyncing: boolean;
  isOnline: boolean;
  addUser: (user: EnrolledUser) => void;
  addLog: (log: AttendanceLog) => void;
  setOnline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  enrolledUsers: [],
  attendanceLogs: [],
  isSyncing: false,
  isOnline: false,
  addUser: (user) =>
    set((state) => ({ enrolledUsers: [...state.enrolledUsers, user] })),
  addLog: (log) =>
    set((state) => ({ attendanceLogs: [...state.attendanceLogs, log] })),
  setOnline: (status) => set({ isOnline: status }),
  setSyncing: (status) => set({ isSyncing: status }),
}));