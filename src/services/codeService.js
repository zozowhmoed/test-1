// src/services/codeService.js
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const generateSecureCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint32Array(16);
  window.crypto.getRandomValues(array);
  let code = '';
  array.forEach(value => {
    code += chars[value % chars.length];
  });
  return code;
};

export const verifyUserCode = async (userId, enteredCode) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, message: "المستخدم غير موجود" };
    }
    
    const userData = userSnap.data();
    
    if (!userData.uniqueCode) {
      return { success: false, message: "لا يوجد كود مميز لهذا المستخدم" };
    }
    
    if (userData.uniqueCode !== enteredCode) {
      return { success: false, message: "الكود غير صحيح" };
    }
    
    await updateDoc(userRef, { 
      hasVerifiedCode: true,
      codeVerifiedAt: new Date() 
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error verifying code:", error);
    return { success: false, message: "حدث خطأ أثناء التحقق" };
  }
};

export const getCodeInfo = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists() || !userSnap.data().uniqueCode) {
      return null;
    }
    
    const data = userSnap.data();
    return {
      code: data.uniqueCode,
      generatedAt: data.codeGeneratedAt?.toDate() || null,
      verified: data.hasVerifiedCode || false,
      verifiedAt: data.codeVerifiedAt?.toDate() || null
    };
  } catch (error) {
    console.error("Error getting code info:", error);
    return null;
  }
};

export default {
  verifyUserCode,
  getCodeInfo,
  generateSecureCode
};