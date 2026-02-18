// client/src/services/planService.ts
import {
  collection,
  addDoc,
  getDoc,
  doc,
  serverTimestamp,
  // Timestamp 제거 (사용하지 않음)
} from "firebase/firestore";
import { db } from "./firebase"; // 수정: '../firebase' -> './firebase' (같은 폴더임)
import type { TravelPlan } from "../types/plan";

// 여행 계획 저장
export const savePlan = async (plan: TravelPlan, userId: string) => {
  try {
    const docRef = await addDoc(collection(db, "plans"), {
      ...plan,
      ownerId: userId,
      createdAt: serverTimestamp(),
      isPublic: true,
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving plan:", error);
    throw error;
  }
};

// 여행 계획 조회 (ID로 불러오기)
export const getPlan = async (planId: string) => {
  try {
    const docRef = doc(db, "plans", planId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // 수정: 'unknown'을 거쳐서 형변환하여 에러 해결
      return { id: docSnap.id, ...data } as unknown as TravelPlan;
    } else {
      throw new Error("No such plan!");
    }
  } catch (error) {
    console.error("Error getting plan:", error);
    throw error;
  }
};
