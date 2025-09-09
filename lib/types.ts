// lib/types.ts
import type { Timestamp } from "firebase/firestore";

export type Hall = "HallA" | "HallB";
export type Role = "AUDIO" | "LIGHTING" | "VIDEO";

export interface EntryDoc {
  id: string;
  hall: Hall;
  role: Role;
  memberNames: string[];
  date: string; // 'YYYY-MM-DD'
  checkIn?: Timestamp | Date; // Firestore Timestamp or Date
  checkOut?: Timestamp | Date;
  minutes?: number;
  status: "IN_PROGRESS" | "DONE";
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}
