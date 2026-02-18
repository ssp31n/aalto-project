import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeTravelPlan, type TravelPlan } from "../types/plan";

export interface UserPlanSummary {
  id: string;
  title: string;
  destination?: string;
  daysCount: number;
  createdAt?: Date;
}

export const savePlan = async (plan: TravelPlan, userId: string) => {
  const docRef = await addDoc(collection(db, "plans"), {
    ...plan,
    ownerId: userId,
    createdAt: serverTimestamp(),
    isPublic: true,
  });
  return docRef.id;
};

export const getPlan = async (planId: string) => {
  const docRef = doc(db, "plans", planId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("No such plan");
  }

  const data = docSnap.data();
  return normalizeTravelPlan({ id: docSnap.id, ...data });
};

export const deletePlan = async (planId: string) => {
  await deleteDoc(doc(db, "plans", planId));
};

export const listUserPlans = async (userId: string): Promise<UserPlanSummary[]> => {
  const q = query(
    collection(db, "plans"),
    where("ownerId", "==", userId),
  );

  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map((item) => {
    const data = item.data() as {
      title?: string;
      destination?: string;
      days?: unknown[];
      createdAt?: { toDate?: () => Date };
    };

    return {
      id: item.id,
      title: data.title || "Untitled plan",
      destination: data.destination,
      daysCount: Array.isArray(data.days) ? data.days.length : 0,
      createdAt: data.createdAt?.toDate?.(),
    };
  });
  rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return rows;
};
