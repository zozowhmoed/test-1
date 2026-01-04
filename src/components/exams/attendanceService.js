import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

export const createExam = async (examData) => {
  try {
    const examRef = await addDoc(collection(db, 'exams'), {
      ...examData,
      createdAt: new Date(),
      status: 'draft',
      isOpen: examData.isOpen || false
    });
    return examRef.id;
  } catch (error) {
    console.error("Error creating exam:", error);
    throw error;
  }
};

export const updateExam = async (examId, updates) => {
  try {
    await updateDoc(doc(db, 'exams', examId), updates);
  } catch (error) {
    console.error("Error updating exam:", error);
    throw error;
  }
};

export const deleteExam = async (examId) => {
  try {
    await deleteDoc(doc(db, 'exams', examId));
    const resultsRef = collection(db, 'exams', examId, 'results');
    const resultsSnapshot = await getDocs(resultsRef);
    resultsSnapshot.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });
  } catch (error) {
    console.error("Error deleting exam:", error);
    throw error;
  }
};

export const submitExamResult = async (examId, resultData) => {
  try {
    await addDoc(collection(db, 'exams', examId, 'results'), {
      ...resultData,
      submittedAt: new Date()
    });
  } catch (error) {
    console.error("Error submitting exam result:", error);
    throw error;
  }
};

export const getExamsForGroup = async (groupId) => {
  try {
    const q = query(collection(db, 'exams'), where('groupId', '==', groupId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      isOpen: checkExamAvailability(doc.data())
    }));
  } catch (error) {
    console.error("Error getting exams:", error);
    throw error;
  }
};

export const listenForExams = (groupId, callback) => {
  try {
    const q = query(collection(db, 'exams'), where('groupId', '==', groupId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const exams = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isOpen: checkExamAvailability(doc.data())
      }));
      callback(exams);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error setting up listener:", error);
    throw error;
  }
};

export const getExamResults = async (examId) => {
  try {
    const querySnapshot = await getDocs(collection(db, 'exams', examId, 'results'));
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      percentage: calculatePercentage(doc.data())
    }));
  } catch (error) {
    console.error("Error getting exam results:", error);
    throw error;
  }
};

const checkExamAvailability = (exam) => {
  if (exam.status !== 'active') return false;
  
  const now = new Date();
  const start = exam.startTime?.toDate() || new Date(0);
  const end = exam.endTime?.toDate() || new Date(8640000000000000);
  
  return now >= start && now <= end;
};

const calculatePercentage = (result) => {
  const total = result.correctAnswers + result.wrongAnswers;
  return total > 0 ? Math.round((result.correctAnswers / total) * 100) : 0;
};