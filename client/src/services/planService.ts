import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeTravelPlan, type TravelPlan } from "../types/plan";

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
