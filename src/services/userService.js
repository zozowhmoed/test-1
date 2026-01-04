import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const userService = {
  getUserData: async (userId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return {
          ...userSnap.data(),
          studyStats: {
            totalHours: userSnap.data().totalHours || 0,
            weeklyGoal: userSnap.data().weeklyGoal || 10,
            streak: userSnap.data().streak || 0
          }
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting user data:", error);
      throw error;
    }
  },

  updateProfile: async (userId, profileData) => {
    try {
      await updateDoc(doc(db, "users", userId), profileData);
      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }
};

export default userService;