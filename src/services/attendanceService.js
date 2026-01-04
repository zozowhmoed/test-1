import { db } from 'components/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export const saveAttendanceRecord = async (groupId, memberId, year, month, records) => {
  try {
    await setDoc(doc(db, "attendance", `${groupId}_${memberId}_${year}_${month}`), {
      groupId,
      memberId,
      year,
      month,
      records
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving attendance:', error);
    return false;
  }
};

export const getAttendanceRecord = async (groupId, memberId, year, month) => {
  try {
    const docRef = doc(db, "attendance", `${groupId}_${memberId}_${year}_${month}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error('Error getting attendance:', error);
    return null;
  }
};