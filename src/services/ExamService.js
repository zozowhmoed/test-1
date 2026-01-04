import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

const ExamService = {
  createExam: async (examData) => {
    try {
      const examWithTimestamp = {
        ...examData,
        createdAt: Timestamp.now(),
        status: 'draft'
      };
      const docRef = await addDoc(collection(db, "exams"), examWithTimestamp);
      return docRef.id;
    } catch (error) {
      console.error("Error creating exam:", error);
      throw new Error("حدث خطأ أثناء إنشاء الامتحان");
    }
  },

  activateExam: async (examId) => {
    try {
      await updateDoc(doc(db, "exams", examId), {
        status: 'active',
        activatedAt: Timestamp.now(),
        deactivatedAt: null
      });
    } catch (error) {
      console.error("Error activating exam:", error);
      throw new Error("حدث خطأ أثناء تفعيل الامتحان");
    }
  },

  deactivateExam: async (examId) => {
    try {
      await updateDoc(doc(db, "exams", examId), {
        status: 'draft',
        deactivatedAt: Timestamp.now(),
        activatedAt: null
      });
    } catch (error) {
      console.error("Error deactivating exam:", error);
      throw new Error("حدث خطأ أثناء إيقاف الامتحان");
    }
  },

  getExamById: async (examId) => {
    try {
      const docSnap = await getDoc(doc(db, "exams", examId));
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          activatedAt: docSnap.data().activatedAt?.toDate(),
          deactivatedAt: docSnap.data().deactivatedAt?.toDate()
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting exam:", error);
      throw new Error("حدث خطأ أثناء جلب بيانات الامتحان");
    }
  },

  deleteExam: async (examId) => {
    try {
      const batch = writeBatch(db);
      
      const resultsQuery = query(collection(db, "examResults"), where("examId", "==", examId));
      const resultsSnapshot = await getDocs(resultsQuery);
      resultsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      batch.delete(doc(db, "exams", examId));
      
      await batch.commit();
    } catch (error) {
      console.error("Error deleting exam:", error);
      throw new Error("حدث خطأ أثناء حذف الامتحان");
    }
  },

  checkExamAttempt: async (examId, userId) => {
    try {
      const resultsRef = collection(db, "examResults");
      const q = query(
        resultsRef,
        where("examId", "==", examId),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(q);
      const attempts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate()
      }));

      const examDoc = await getDoc(doc(db, "exams", examId));
      if (!examDoc.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      const examData = examDoc.data();
      
      return {
        attempted: attempts.length > 0,
        lastAttempt: attempts[0],
        canRetake: examData.unlimitedAttempts || 
                 (examData.allowRetake && attempts.length < (examData.maxAttempts || 1))
      };
    } catch (error) {
      console.error("Error checking exam attempt:", error);
      throw new Error("حدث خطأ أثناء التحقق من المحاولات السابقة");
    }
  },

  submitExamResult: async (resultData) => {
    try {
      const examDoc = await getDoc(doc(db, "exams", resultData.examId));
      if (!examDoc.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      const examData = examDoc.data();
      const totalQuestions = resultData.totalQuestions || examData.questions?.length || 0;
      const totalPoints = examData.questions?.reduce((sum, q) => sum + (q.points || 1), 0) || totalQuestions;
      const correctAnswers = resultData.correctAnswers || 0;
      const percentage = Math.round((correctAnswers / totalPoints) * 100);
      const passingGrade = resultData.passingGrade || examData.passingGrade || Math.ceil(totalPoints * 0.6);
      const passed = correctAnswers >= passingGrade;
      
      const resultWithDetails = {
        ...resultData,
        examTitle: examData.title,
        totalQuestions,
        totalPoints,
        correctAnswers,
        passingGrade,
        percentage,
        passed,
        submittedAt: Timestamp.now()
      };
      
      const docRef = await addDoc(collection(db, "examResults"), resultWithDetails);
      return docRef.id;
    } catch (error) {
      console.error("Error submitting exam result:", error);
      throw new Error("حدث خطأ أثناء تسليم نتيجة الامتحان");
    }
  },

  getExamResults: async (examId) => {
    try {
      const q = query(collection(db, "examResults"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate()
      }));
    } catch (error) {
      console.error("Error fetching exam results:", error);
      throw new Error("حدث خطأ أثناء جلب نتائج الامتحان");
    }
  },

  updateExam: async (examId, updates) => {
    try {
      await updateDoc(doc(db, "exams", examId), updates);
    } catch (error) {
      console.error("Error updating exam:", error);
      throw new Error("حدث خطأ أثناء تحديث بيانات الامتحان");
    }
  }
};

export default ExamService;