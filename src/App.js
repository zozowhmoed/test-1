import React, { useState, useEffect, useRef } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  setDoc, 
  onSnapshot, 
  runTransaction, 
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import './App.css';
import AttendanceCalendar from './components/AttendanceCalendar';
import Profile from './components/Profile';
import HomePage from './components/HomePage';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ExamsList from './components/exams/ExamsList';
import ExamResults from './exams/ExamResults';
import TakeExam from './exams/TakeExam';
import CreateExam from './exams/CreateExam';
import ArrowChartPage from './components/ArrowChartPage';

const firebaseConfig = {
  apiKey: "AIzaSyDoLr3Dnb5YbCnUtTexaz84YOH5h8Ukfoc",
  authDomain: "frist-b073a.firebaseapp.com",
  projectId: "frist-b073a",
  storageBucket: "frist-b073a.appspot.com",
  messagingSenderId: "580630150830",
  appId: "1:580630150830:web:815ba6942a64909329b73f",
  measurementId: "G-GH3D6EMB6L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const generateUniqueCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// خدمات Firebase المحسنة
const userService = {
  createOrUpdateUser: async (user) => {
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const uniqueCode = generateUniqueCode();
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          uniqueCode,
          hasVerifiedCode: false,
          createdAt: new Date(),
          points: 0,
          level: 1,
          totalStudyTime: 0,
          hasCrown: false,
          crownExpires: null
        });
        return { uniqueCode, hasVerifiedCode: false };
      } else {
        return {
          uniqueCode: userSnap.data().uniqueCode,
          hasVerifiedCode: userSnap.data().hasVerifiedCode || false
        };
      }
    } catch (error) {
      console.error("Error creating/updating user:", error);
      return null;
    }
  },

  verifyUserCode: async (userId, enteredCode) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return { success: false, message: "المستخدم غير موجود" };
      }
      
      const userData = userSnap.data();
      
      if (userData.hasVerifiedCode) {
        return { success: true, message: "تم التحقق مسبقاً" };
      }
      
      if (userData.uniqueCode === enteredCode) {
        await updateDoc(userRef, {
          hasVerifiedCode: true,
          codeVerifiedAt: new Date()
        });
        return { success: true, message: "تم التحقق بنجاح" };
      } else {
        return { success: false, message: "الكود غير صحيح" };
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      return { success: false, message: "حدث خطأ أثناء التحقق" };
    }
  },

  createUserCode: async (userId) => {
    try {
      const code = generateUniqueCode();
      await setDoc(doc(db, "userCodes", userId), {
        code,
        verified: false,
        createdAt: new Date(),
        attempts: 0
      });
      return { code, verified: false };
    } catch (error) {
      console.error("Error creating user code:", error);
      throw error;
    }
  },

  getCodeInfo: async (userId) => {
    try {
      const codeRef = doc(db, "userCodes", userId);
      const codeSnap = await getDoc(codeRef);
      
      if (!codeSnap.exists()) {
        return null;
      }
      
      return codeSnap.data();
    } catch (error) {
      console.error("Error getting code info:", error);
      throw error;
    }
  },

  checkCodeVerification: async (userId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return false;
      }
      
      return userSnap.data().hasVerifiedCode || false;
    } catch (error) {
      console.error("Error checking code verification:", error);
      throw error;
    }
  },

  updateUserStudyTime: async (userId, additionalTime) => {
    try {
      const userRef = doc(db, "users", userId);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists()) {
          const currentTime = userDoc.data().totalStudyTime || 0;
          transaction.update(userRef, {
            totalStudyTime: currentTime + additionalTime,
            lastStudySession: new Date()
          });
        }
      });
    } catch (error) {
      console.error("Error updating study time:", error);
      throw error;
    }
  }
};

const groupService = {
  saveStudyTime: async (groupId, userId, studyTime) => {
    try {
      const groupRef = doc(db, "studyGroups", groupId);
      const userStudyRef = doc(db, "userStudySessions", `${groupId}_${userId}`);
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      await runTransaction(db, async (transaction) => {
        const groupDoc = await transaction.get(groupRef);
        if (groupDoc.exists()) {
          const currentTotal = groupDoc.data().totalStudyTime || 0;
          transaction.update(groupRef, {
            totalStudyTime: currentTotal + studyTime,
            lastUpdated: now
          });
        }
        
        const studyDoc = await transaction.get(userStudyRef);
        if (studyDoc.exists()) {
          const sessions = studyDoc.data().sessions || [];
          transaction.update(userStudyRef, {
            sessions: [...sessions, {
              startTime: new Date(now.getTime() - studyTime * 1000),
              endTime: now,
              duration: studyTime,
              date: today
            }],
            totalTime: (studyDoc.data().totalTime || 0) + studyTime,
            lastSession: now,
            dailyTime: {
              ...studyDoc.data().dailyTime,
              [today.toISOString().split('T')[0]]: 
                (studyDoc.data().dailyTime?.[today.toISOString().split('T')[0]] || 0) + studyTime
            }
          });
        } else {
          transaction.set(userStudyRef, {
            groupId,
            userId,
            sessions: [{
              startTime: new Date(now.getTime() - studyTime * 1000),
              endTime: now,
              duration: studyTime,
              date: today
            }],
            totalTime: studyTime,
            lastSession: now,
            dailyTime: {
              [today.toISOString().split('T')[0]]: studyTime
            },
            createdAt: now
          });
        }
      });
      
      return true;
    } catch (error) {
      console.error("Error saving study time:", error);
      throw error;
    }
  },

  getUserStudyTime: async (groupId, userId) => {
    try {
      const studyRef = doc(db, "userStudySessions", `${groupId}_${userId}`);
      const studyDoc = await getDoc(studyRef);
      
      if (studyDoc.exists()) {
        const data = studyDoc.data();
        return {
          totalTime: data.totalTime || 0,
          sessions: data.sessions || [],
          dailyTime: data.dailyTime || {},
          lastSession: data.lastSession?.toDate() || null
        };
      }
      
      return {
        totalTime: 0,
        sessions: [],
        dailyTime: {},
        lastSession: null
      };
    } catch (error) {
      console.error("Error getting study time:", error);
      throw error;
    }
  },

  getGroupStats: async (groupId) => {
    try {
      const groupRef = doc(db, "studyGroups", groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        return {
          totalStudyTime: groupDoc.data().totalStudyTime || 0,
          memberCount: groupDoc.data().members?.length || 0,
          createdAt: groupDoc.data().createdAt?.toDate() || null
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error getting group stats:", error);
      throw error;
    }
  }
};

const shopService = {
  purchaseItem: async (userId, item, currentPoints) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error("المستخدم غير موجود");
        }
        
        const userData = userDoc.data();
        
        if (userData.points < item.price) {
          throw new Error("نقاط غير كافية");
        }
        
        transaction.update(userRef, {
          points: userData.points - item.price
        });
        
        const inventoryRef = doc(db, "userInventory", userId);
        const inventoryDoc = await transaction.get(inventoryRef);
        
        const newItem = {
          id: item.id,
          name: item.name,
          purchaseDate: new Date(),
          expiresAt: new Date(Date.now() + (item.duration || 24 * 60 * 60 * 1000)),
          active: true
        };
        
        if (inventoryDoc.exists()) {
          const currentItems = inventoryDoc.data().items || [];
          transaction.update(inventoryRef, {
            items: [...currentItems, newItem],
            totalPurchases: (inventoryDoc.data().totalPurchases || 0) + 1
          });
        } else {
          transaction.set(inventoryRef, {
            userId,
            items: [newItem],
            totalPurchases: 1,
            createdAt: new Date()
          });
        }
        
        if (item.id === 'crown') {
          transaction.update(userRef, {
            hasCrown: true,
            crownExpires: new Date(Date.now() + item.duration)
          });
        }
        
        const purchaseRef = doc(collection(db, "purchaseHistory"));
        transaction.set(purchaseRef, {
          userId,
          itemId: item.id,
          itemName: item.name,
          price: item.price,
          purchaseDate: new Date(),
          newBalance: userData.points - item.price
        });
        
        return {
          success: true,
          newPoints: userData.points - item.price,
          item: newItem
        };
      });
    } catch (error) {
      console.error("Error purchasing item:", error);
      throw error;
    }
  },

  getUserInventory: async (userId) => {
    try {
      const inventoryRef = doc(db, "userInventory", userId);
      const inventoryDoc = await getDoc(inventoryRef);
      
      if (inventoryDoc.exists()) {
        const data = inventoryDoc.data();
        const activeItems = data.items.filter(item => 
          item.expiresAt?.toDate() > new Date() && item.active !== false
        );
        
        return {
          items: activeItems,
          totalPurchases: data.totalPurchases || 0
        };
      }
      
      return { items: [], totalPurchases: 0 };
    } catch (error) {
      console.error("Error getting user inventory:", error);
      throw error;
    }
  },

  activateItem: async (userId, itemId) => {
    try {
      const inventoryRef = doc(db, "userInventory", userId);
      const inventoryDoc = await getDoc(inventoryRef);
      
      if (!inventoryDoc.exists()) {
        throw new Error("المخزون غير موجود");
      }
      
      const items = inventoryDoc.data().items;
      const itemIndex = items.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        throw new Error("العنصر غير موجود");
      }
      
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        activatedAt: new Date(),
        active: true
      };
      
      await updateDoc(inventoryRef, {
        items: updatedItems
      });
      
      return { success: true, item: updatedItems[itemIndex] };
    } catch (error) {
      console.error("Error activating item:", error);
      throw error;
    }
  }
};

const examService = {
  getExamsForGroup: async (groupId) => {
    try {
      const q = query(collection(db, "exams"), where("groupId", "==", groupId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching exams:", error);
      return [];
    }
  },

  listenForExams: (groupId, callback) => {
    const q = query(collection(db, "exams"), where("groupId", "==", groupId));
    return onSnapshot(q, (querySnapshot) => {
      const exams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(exams);
    });
  },

  createExam: async (examData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examWithCreator = {
        ...examData,
        creatorId: user.uid,
        createdAt: new Date(),
        status: 'draft'
      };
      
      const docRef = await addDoc(collection(db, "exams"), examWithCreator);
      return docRef.id;
    } catch (error) {
      console.error("Error creating exam:", error);
      throw error;
    }
  },

  activateExam: async (examId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      
      if (!examSnap.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      if (examSnap.data().creatorId !== user.uid) {
        throw new Error("ليس لديك صلاحية تفعيل هذا الامتحان");
      }
      
      await updateDoc(examRef, {
        status: 'active',
        activatedAt: new Date()
      });
    } catch (error) {
      console.error("Error activating exam:", error);
      throw error;
    }
  },

  deactivateExam: async (examId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      
      if (!examSnap.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      if (examSnap.data().creatorId !== user.uid) {
        throw new Error("ليس لديك صلاحية إيقاف هذا الامتحان");
      }
      
      await updateDoc(examRef, {
        status: 'inactive',
        deactivatedAt: new Date()
      });
    } catch (error) {
      console.error("Error deactivating exam:", error);
      throw error;
    }
  },

  updateExam: async (examId, updates) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      
      if (!examSnap.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      if (examSnap.data().creatorId !== user.uid) {
        throw new Error("ليس لديك صلاحية تعديل هذا الامتحان");
      }
      
      await updateDoc(examRef, updates);
    } catch (error) {
      console.error("Error updating exam:", error);
      throw error;
    }
  },

  deleteExam: async (examId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      
      if (!examSnap.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      if (examSnap.data().creatorId !== user.uid) {
        throw new Error("ليس لديك صلاحية حذف هذا الامتحان");
      }
      
      const batch = writeBatch(db);
      
      const resultsQuery = query(
        collection(db, "examResults"), 
        where("examId", "==", examId)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      resultsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      batch.delete(examRef);
      await batch.commit();
    } catch (error) {
      console.error("Error deleting exam:", error);
      throw error;
    }
  },

  getExamResults: async (examId) => {
    try {
      const q = query(collection(db, "examResults"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching exam results:", error);
      return [];
    }
  },

  submitExamResults: async (results) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const resultData = {
        ...results,
        userId: user.uid,
        studentName: user.displayName || `User_${user.uid.slice(0, 5)}`,
        submittedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, "examResults"), resultData);
      return docRef.id;
    } catch (error) {
      console.error("Error submitting exam results:", error);
      throw error;
    }
  }
};

function Timer({ user, onBack, groupId }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('ar');
  const [notification, setNotification] = useState(null);
  const [studySessions, setStudySessions] = useState([]);
  const [activeTab, setActiveTab] = useState('timer');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [activeEffects, setActiveEffects] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredAvatar, setHoveredAvatar] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeExamTab, setActiveExamTab] = useState('list');
  const [examLoading, setExamLoading] = useState(false);
  const [shopItems, setShopItems] = useState([
    { 
      id: "boost", 
      name: "دفعة النجاح", 
      description: "يحقق ضعف النقاط لمدة 30 دقيقة",
      price: 400, 
      icon: "⚡", 
      effect: "double_points",
      duration: 30 * 60 * 1000,
      color: "#F59E0B",
      bgColor: "rgba(245, 158, 11, 0.1)"
    },
    { 
      id: "focus", 
      name: "معزز التركيز", 
      description: "يزيد سرعة تحصيل النقاط بنسبة 50% لمدة ساعة",
      price: 300, 
      icon: "🧠", 
      effect: "speed_boost",
      duration: 60 * 60 * 1000,
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.1)"
    },
    { 
      id: "crown", 
      name: "التاج الذهبي", 
      description: "يظهر تاج ذهبي بجانب اسمك في لوحة المتصدرين لمدة 24 ساعة",
      price: 600, 
      icon: "👑", 
      effect: "golden_crown",
      duration: 24 * 60 * 60 * 1000,
      color: "#F97316",
      bgColor: "rgba(249, 115, 22, 0.1)"
    },
    { 
      id: "shield", 
      name: "حافظة النقاط", 
      description: "يحمي نقاطك من الخسارة لمدة 24 ساعة",
      price: 350, 
      icon: "🛡️", 
      effect: "points_shield",
      duration: 24 * 60 * 60 * 1000,
      color: "#10B981",
      bgColor: "rgba(16, 185, 129, 0.1)"
    }
  ]);

  const intervalRef = useRef(null);

  const calculateLevel = (points) => {
    const basePoints = 100;
    const growthFactor = 1.2;
    
    if (points < basePoints) {
      return {
        currentLevel: 1,
        nextLevelPoints: basePoints,
        progress: (points / basePoints) * 100,
        pointsToNextLevel: basePoints - points
      };
    }

    let level = 2;
    let requiredPoints = Math.floor(basePoints * growthFactor);
    let totalPointsNeeded = basePoints + requiredPoints;
    
    while (points >= totalPointsNeeded) {
      level++;
      requiredPoints = Math.floor(requiredPoints * growthFactor);
      totalPointsNeeded += requiredPoints;
    }
    
    const pointsForCurrentLevel = points - (totalPointsNeeded - requiredPoints);
    
    return {
      currentLevel: level,
      nextLevelPoints: requiredPoints,
      progress: (pointsForCurrentLevel / requiredPoints) * 100,
      pointsToNextLevel: requiredPoints - pointsForCurrentLevel
    };
  };

  const getBadge = (level) => {
    const badges = {
      1: { name: "المبتدئ", icon: "🌱", color: "#10B981", bgColor: "rgba(16, 185, 129, 0.1)" },
      5: { name: "المتعلم", icon: "📚", color: "#3B82F6", bgColor: "rgba(59, 130, 246, 0.1)" },
      10: { name: "المجتهد", icon: "🎓", color: "#F59E0B", bgColor: "rgba(245, 158, 11, 0.1)" },
      15: { name: "الخبير", icon: "🔍", color: "#8B5CF6", bgColor: "rgba(139, 92, 246, 0.1)" },
      20: { name: "المحترف", icon: "🏅", color: "#EC4899", bgColor: "rgba(236, 72, 153, 0.1)" },
      25: { name: "الأسطورة", icon: "🏆", color: "#F97316", bgColor: "rgba(249, 115, 22, 0.1)" },
      30: { name: "رائد المعرفة", icon: "🚀", color: "#06B6D4", bgColor: "rgba(6, 182, 212, 0.1)" }
    };
    
    const eligibleLevels = Object.keys(badges)
      .map(Number)
      .filter(lvl => level >= lvl)
      .sort((a, b) => b - a);
    
    return badges[eligibleLevels[0]] || badges[1];
  };

  const { currentLevel, progress, pointsToNextLevel } = calculateLevel(points);
  const currentBadge = getBadge(currentLevel);

  useEffect(() => {
    const loadStudyTime = async () => {
      try {
        const studyData = await groupService.getUserStudyTime(groupId, user.uid);
        setTotalStudyTime(studyData.totalTime || 0);
        
        if (studyData.lastSession) {
          const lastSessionDate = studyData.lastSession;
          const now = new Date();
          const diffInSeconds = Math.floor((now - lastSessionDate) / 1000);
          
          if (diffInSeconds < 300) {
            setElapsedTime(diffInSeconds);
            setSessionStartTime(lastSessionDate);
            setIsRunning(true);
            startTimerInterval(lastSessionDate);
          }
        }
      } catch (error) {
        console.error("Error loading study time:", error);
      }
    };

    const loadInventory = async () => {
      try {
        const inventoryData = await shopService.getUserInventory(user.uid);
        setInventory(inventoryData.items);
        
        const activeItems = inventoryData.items.filter(item => 
          item.active && item.expiresAt?.toDate() > new Date()
        );
        
        setActiveEffects(activeItems.map(item => ({
          type: item.id,
          expires: item.expiresAt?.toDate().getTime() || Date.now() + 24 * 60 * 60 * 1000,
          itemId: item.id
        })));
      } catch (error) {
        console.error("Error loading inventory:", error);
      }
    };

    loadStudyTime();
    loadInventory();

    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedMode ? 'dark' : 'light');
    }

    const savedLang = localStorage.getItem('language') || 'ar';
    setLanguage(savedLang);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [groupId, user.uid]);

  const startTimerInterval = (startTime) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(async () => {
      const now = new Date();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedTime(elapsed);
      
      if (elapsed % 30 === 0) {
        await groupService.saveStudyTime(groupId, user.uid, 30);
        setTotalStudyTime(prev => prev + 30);
        
        const pointsEarned = activeEffects.some(e => e.type === 'double_points') ? 2 : 1;
        const speedBoost = activeEffects.some(e => e.type === 'speed_boost') ? 1.5 : 1;
        const finalPoints = Math.floor(pointsEarned * speedBoost);
        
        await updatePoints(points + finalPoints);
        setLastUpdateTime(elapsed);
      }
    }, 1000);
  };

  const saveStudyTime = async (timeToSave) => {
    try {
      await groupService.saveStudyTime(groupId, user.uid, timeToSave);
    } catch (error) {
      console.error("Error saving study time:", error);
    }
  };

  const startTimer = async () => {
    if (isRunning || bannedMembers.includes(user.uid)) return;
    
    const startTime = sessionStartTime || new Date();
    setSessionStartTime(startTime);
    setIsRunning(true);
    
    if (!sessionStartTime) {
      setElapsedTime(0);
    }
    
    startTimerInterval(startTime);
  };

  const stopTimer = async () => {
    if (!isRunning) return;
    
    clearInterval(intervalRef.current);
    setIsRunning(false);
    
    if (elapsedTime > 0) {
      await saveStudyTime(elapsedTime);
      setTotalStudyTime(prev => prev + elapsedTime);
      
      const pointsEarned = Math.floor(elapsedTime / 30) * 
        (activeEffects.some(e => e.type === 'double_points') ? 2 : 1);
      
      if (pointsEarned > 0) {
        await updatePoints(points + pointsEarned);
      }
    }
    
    setSessionStartTime(null);
  };

  const resetTimer = async () => {
    if (isRunning) {
      clearInterval(intervalRef.current);
      setIsRunning(false);
    }
    
    if (elapsedTime > 0) {
      await saveStudyTime(elapsedTime);
    }
    
    setSessionStartTime(null);
    setElapsedTime(0);
    showNotification("⏱ تم إعادة ضبط المؤقت");
  };

  const updatePoints = async (newPoints) => {
    try {
      const userRef = doc(db, "users", user.uid);
      const groupRef = doc(db, "studyGroups", groupId);
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists()) {
          transaction.update(userRef, {
            points: newPoints,
            lastActive: new Date()
          });
        }
        
        const groupDoc = await transaction.get(groupRef);
        if (groupDoc.exists()) {
          transaction.update(groupRef, {
            [`userPoints.${user.uid}`]: newPoints,
            lastUpdated: new Date()
          });
        }
      });
      
      setPoints(newPoints);
      
      const newLevelData = calculateLevel(newPoints);
      if (newLevelData.currentLevel > currentLevel) {
        showNotification(`🎉 تقدمت للمستوى ${newLevelData.currentLevel}!`);
      }
    } catch (error) {
      console.error("Error updating points:", error);
    }
  };

  const purchaseItem = async (item) => {
    try {
      const result = await shopService.purchaseItem(user.uid, item, points);
      
      if (result.success) {
        setPoints(result.newPoints);
        setInventory(prev => [...prev, result.item]);
        
        const effect = {
          type: item.id,
          expires: Date.now() + item.duration,
          itemId: item.id
        };
        
        setActiveEffects(prev => [...prev, effect]);
        showNotification(`🎉 تم شراء ${item.name} بنجاح!`);
      }
    } catch (error) {
      console.error("Purchase error:", error);
      showNotification(`❌ ${error.message}`);
    }
  };

  const formatDigitalTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDetailedTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs} ساعة ${mins} دقيقة ${secs} ثانية`;
    } else if (mins > 0) {
      return `${mins} دقيقة ${secs} ثانية`;
    } else {
      return `${secs} ثانية`;
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    showNotification(newMode ? '🌙 تم تفعيل الوضع المظلم' : '☀️ تم تفعيل الوضع الفاتح');
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    showNotification(lang === 'ar' ? '🇸🇦 تم تغيير اللغة إلى العربية' : '🇬🇧 Language changed to English');
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const addStudySession = (duration, pointsEarned) => {
    const newSession = {
      date: new Date(),
      duration,
      pointsEarned
    };
    setStudySessions(prev => [newSession, ...prev].slice(0, 10));
  };

  const fetchGroupData = async () => {
    try {
      setLoadingMembers(true);
      const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        setIsCreator(groupData.creator === user.uid);
        setBannedMembers(groupData.bannedMembers || []);
        
        const userPoints = groupData.userPoints?.[user.uid] || 0;
        setPoints(userPoints);
        
        if (groupData.members) {
          const membersPromises = groupData.members.map(async (uid) => {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                uid,
                name: userData.displayName,
                photoURL: userData.photoURL,
                points: groupData.userPoints?.[uid] || 0,
                hasCrown: userData.hasCrown || false,
                crownExpires: userData.crownExpires?.toDate() || null
              };
            }
            return null;
          });
          
          const membersList = (await Promise.all(membersPromises)).filter(Boolean);
          membersList.sort((a, b) => b.points - a.points);
          setMembers(membersList);
        }
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setLoadingMembers(false);
    }
  };
  
  useEffect(() => {
    fetchGroupData();
    
    const unsubscribe = onSnapshot(doc(db, "studyGroups", groupId), fetchGroupData);
    return () => unsubscribe();
  }, [groupId, user.uid]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGroupData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const removeMember = async (memberId) => {
    if (window.confirm(`هل أنت متأكد من حذف هذا العضو من المجموعة؟`)) {
      try {
        await runTransaction(db, async (transaction) => {
          const groupDoc = await transaction.get(doc(db, "studyGroups", groupId));
          if (!groupDoc.exists()) throw new Error("المجموعة غير موجودة");
          
          const groupData = groupDoc.data();
          const updatedMembers = groupData.members.filter(m => m !== memberId);
          const updatedUserPoints = {...groupData.userPoints};
          delete updatedUserPoints[memberId];
          
          transaction.update(doc(db, "studyGroups", groupId), {
            members: updatedMembers,
            userPoints: updatedUserPoints
          });
        });
        showNotification("✅ تم حذف العضو بنجاح");
      } catch (error) {
        console.error("Error removing member:", error);
        showNotification("❌ حدث خطأ أثناء حذف العضو");
      }
    }
  };

  const toggleBanMember = async (memberId) => {
    if (window.confirm(`هل أنت متأكد من ${bannedMembers.includes(memberId) ? 'إلغاء حظر' : 'حظر'} هذا العضو؟`)) {
      try {
        await runTransaction(db, async (transaction) => {
          const groupDoc = await transaction.get(doc(db, "studyGroups", groupId));
          if (!groupDoc.exists()) throw new Error("المجموعة غير موجودة");
          
          const groupData = groupDoc.data();
          const currentBanned = groupData.bannedMembers || [];
          const isBanned = currentBanned.includes(memberId);
          
          const updatedBanned = isBanned 
            ? currentBanned.filter(id => id !== memberId)
            : [...currentBanned, memberId];
          
          const updates = {
            bannedMembers: updatedBanned,
            banHistory: arrayUnion({
              memberId: memberId,
              bannedBy: user.uid,
              timestamp: new Date(),
              action: isBanned ? "unban" : "ban"
            })
          };
          
          if (!isBanned) {
            updates[`userPoints.${memberId}`] = 0;
          }
          
          transaction.update(doc(db, "studyGroups", groupId), updates);
        });
        
        showNotification(`✅ تم ${bannedMembers.includes(memberId) ? 'إلغاء حظر' : 'حظر'} العضو بنجاح`);
      } catch (error) {
        console.error("Error updating banned members:", error);
        showNotification("❌ حدث خطأ أثناء تحديث قائمة الحظر");
      }
    }
  };

  const toggleMembersSidebar = () => {
    setShowMembers(prev => !prev);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const randomOnline = members
        .filter(() => Math.random() > 0.7)
        .map(member => member.uid);
      setOnlineUsers(randomOnline);
    }, 10000);

    return () => clearInterval(interval);
  }, [members]);

  const handleActivateExam = async (exam) => {
    setExamLoading(true);
    try {
      await examService.activateExam(exam.id);
      showNotification('تم تفعيل الامتحان بنجاح');
    } catch (error) {
      console.error('Error activating exam:', error);
      showNotification(`حدث خطأ أثناء تفعيل الامتحان: ${error.message}`);
    } finally {
      setExamLoading(false);
    }
  };

  const handleDeactivateExam = async (exam) => {
    setExamLoading(true);
    try {
      await examService.deactivateExam(exam.id);
      showNotification('تم إيقاف الامتحان بنجاح');
    } catch (error) {
      console.error('Error deactivating exam:', error);
      showNotification(`حدث خطأ أثناء إيقاف الامتحان: ${error.message}`);
    } finally {
      setExamLoading(false);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الامتحان؟ سيتم حذف جميع النتائج المرتبطة به.')) {
      setExamLoading(true);
      try {
        await examService.deleteExam(examId);
        showNotification('تم حذف الامتحان بنجاح');
      } catch (error) {
        console.error('Error deleting exam:', error);
        showNotification(`حدث خطأ أثناء حذف الامتحان: ${error.message}`);
      } finally {
        setExamLoading(false);
      }
    }
  };

  const handleExamSubmitted = async (examId, answers) => {
    setExamLoading(true);
    try {
      const examDoc = await getDoc(doc(db, "exams", examId));
      if (!examDoc.exists() || examDoc.data().status !== 'active') {
        throw new Error("الامتحان غير متاح حالياً");
      }

      const score = calculateScore(answers);
      await examService.submitExamResults({
        examId,
        questions: selectedExam.questions,
        answers,
        score,
        totalQuestions: selectedExam.questions.length,
        correctAnswers: selectedExam.questions.filter((q, i) => q.correctAnswer === answers[i]).length
      });
      showNotification(`تم تسليم الامتحان بنجاح! نتيجتك: ${score} نقطة`);
      setActiveExamTab('list');
    } catch (error) {
      console.error('Error submitting exam:', error);
      showNotification(`حدث خطأ أثناء تسليم الامتحان: ${error.message}`);
    } finally {
      setExamLoading(false);
    }
  };

  const calculateScore = (answers) => {
    if (!selectedExam) return 0;
    let score = 0;
    selectedExam.questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) {
        score += q.points || 1;
      }
    });
    return score;
  };

  return (
    <div className="app-container">
      <div className="top-tabs">
        <button 
          className="menu-toggle" 
          onClick={() => setSideMenuOpen(!sideMenuOpen)}
          aria-label="قائمة"
        >
          ☰
        </button>
        
        <div className="main-tabs">
          <button 
            className={`tab-button ${activeTab === 'timer' ? 'active' : ''}`}
            onClick={() => setActiveTab('timer')}
          >
            <span className="tab-icon">⏱️</span>
            <span className="tab-label">المؤقت</span>
          </button>
          
          {isCreator && (
            <button 
              className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <span className="tab-icon">📅</span>
              <span className="tab-label">جدول الحضور</span>
            </button>
          )}
          
          <button 
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-label">الملف الشخصي</span>
          </button>
          
          <button 
            className={`tab-button ${activeTab === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveTab('shop')}
          >
            <span className="tab-icon">🛒</span>
            <span className="tab-label">المتجر</span>
          </button>

          <button 
            className={`tab-button ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('exams');
              setActiveExamTab('list');
            }}
          >
            <span className="tab-icon">📝</span>
            <span className="tab-label">الاختبارات</span>
          </button>

          <button 
            className={`tab-button ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">المخطط السهمي</span>
          </button>
        </div>
      </div>

      <div className={`side-menu ${sideMenuOpen ? 'open' : ''}`}>
        <button 
          className="close-menu" 
          onClick={() => setSideMenuOpen(false)}
          aria-label="إغلاق القائمة"
        >
          ✕
        </button>
        
        <div className="menu-section">
          <h3>مجموعاتك</h3>
          <button 
            onClick={onBack} 
            className="back-button"
          >
            ← العودة للمجموعات
          </button>
        </div>
        
        <div className="menu-section">
          <h3>إنجازاتك</h3>
          <div 
            className="badge-display" 
            style={{ 
              backgroundColor: currentBadge.bgColor,
              borderLeft: `4px solid ${currentBadge.color}`
            }}
          >
            <span 
              className="badge-icon"
              style={{ color: currentBadge.color }}
            >
              {currentBadge.icon}
            </span>
            <div className="badge-info">
              <span className="badge-name" style={{ color: currentBadge.color }}>
                {currentBadge.name}
              </span>
              <span className="badge-level" style={{ color: currentBadge.color }}>
                المستوى {currentLevel}
              </span>
            </div>
          </div>
        </div>
        
        <div className="menu-section">
          <h3>الإعدادات</h3>
          <div className="settings-option">
            <span>الوضع المظلم:</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={toggleDarkMode}
              />
              <span className="slider round"></span>
            </label>
          </div>
          
          <div className="settings-option">
            <span>اللغة:</span>
            <div className="language-buttons">
              <button 
                className={`language-button ${language === 'ar' ? 'active' : ''}`}
                onClick={() => changeLanguage('ar')}
              >
                العربية
              </button>
              <button 
                className={`language-button ${language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'timer' && (
          <div className="timer-container">
            <div className="time-display">
              <h2>وقت المذاكرة الحالي</h2>
              <div className="time digital-time">{formatDigitalTime(elapsedTime)}</div>
              <div className="time-details">
                {formatDetailedTime(elapsedTime)}
              </div>
            </div>
            
            <div className="stats-display">
              <div className="stat-box">
                <span className="stat-label">وقت الدراسة الكلي</span>
                <span className="stat-value">{formatDetailedTime(totalStudyTime)}</span>
              </div>
              
              <div className="stat-box">
                <span className="stat-label">النقاط</span>
                <span className="stat-value">{points}</span>
              </div>
              
              <div className="stat-box">
                <span className="stat-label">المستوى</span>
                <span className="stat-value">{currentLevel}</span>
              </div>
            </div>
            
            <div className="progress-container">
              <div className="progress-label">
                <span>التقدم للمستوى {currentLevel + 1}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {pointsToNextLevel} نقطة متبقية للوصول للمستوى التالي
              </div>
            </div>
            
            <div className="timer-controls">
              <button 
                onClick={isRunning ? stopTimer : startTimer}
                className={`control-button ${isRunning ? 'pause-button' : 'start-button'}`}
                disabled={bannedMembers.includes(user.uid)}
              >
                {isRunning ? '⏸ إيقاف' : '▶ بدء'}
              </button>
              
              <button 
                onClick={resetTimer}
                className="control-button reset-button"
              >
                🔄 إعادة تعيين
              </button>
              
              <button
                onClick={toggleMembersSidebar}
                className="control-button members-button"
              >
                {showMembers ? '👥 إخفاء الأعضاء' : '👥 عرض الأعضاء'}
              </button>
            </div>

            {activeEffects.length > 0 && (
              <div className="active-effects">
                <h3>التأثيرات النشطة</h3>
                <div className="effects-list">
                  {activeEffects.map((effect, index) => {
                    const item = shopItems.find(i => i.id === effect.itemId);
                    if (!item) return null;
                    
                    const remainingTime = Math.ceil((effect.expires - Date.now()) / (60 * 1000));
                    
                    return (
                      <div key={index} className="active-effect">
                        <span className="effect-icon" style={{ color: item.color }}>
                          {item.icon}
                        </span>
                        <span className="effect-name">{item.name}</span>
                        <span className="effect-time">
                          {remainingTime} دقيقة متبقية
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="profile-container">
            <div className="profile-header">
              <img 
                src={user.photoURL} 
                alt="صورة الملف الشخصي" 
                className="profile-avatar"
              />
              <div className="profile-info">
                <h2>{user.displayName}</h2>
                <div className="profile-badges">
                  {activeEffects.some(e => e.type === 'crown') && (
                    <span className="crown-badge" title="تاج ذهبي نشط">👑</span>
                  )}
                  <span className="level-badge">المستوى {currentLevel}</span>
                </div>
              </div>
            </div>
            
            <div className="profile-stats">
              <h3>إحصائيات الدراسة</h3>
              
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-details">
                  <span className="stat-label">إجمالي وقت الدراسة</span>
                  <span className="stat-value">{formatDetailedTime(totalStudyTime)}</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-details">
                  <span className="stat-label">متوسط الدراسة اليومي</span>
                  <span className="stat-value">
                    {formatDetailedTime(Math.floor(totalStudyTime / 7))}
                  </span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-details">
                  <span className="stat-label">عدد جلسات الدراسة</span>
                  <span className="stat-value">
                    {Math.floor(totalStudyTime / 1800)} جلسة
                  </span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-details">
                  <span className="stat-label">النقاط الإجمالية</span>
                  <span className="stat-value">{points} نقطة</span>
                </div>
              </div>
            </div>
            
            <div className="study-history">
              <h3>سجل الدراسة الأخير</h3>
              <div className="history-chart">
                <p>إجمالي وقت الدراسة في هذه المجموعة: <strong>{formatDetailedTime(totalStudyTime)}</strong></p>
                <p>آخر نشاط: <strong>
                  {sessionStartTime ? 
                    formatDetailedTime(elapsedTime) + ' (جلسة نشطة)' : 
                    'لا توجد جلسة نشطة'}
                </strong></p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'shop' && (
          <div className="shop-container">
            <h2>متجر النقاط</h2>
            <div className="balance-display">
              <span>رصيدك الحالي:</span>
              <span className="points-balance">{points} نقطة</span>
            </div>
            
            <div className="shop-items-grid">
              {shopItems.map(item => {
                const canAfford = points >= item.price;
                const alreadyOwned = inventory.some(i => i.id === item.id && 
                  i.expiresAt?.toDate() > new Date());
                
                return (
                  <div 
                    key={item.id} 
                    className={`shop-item ${canAfford ? 'affordable' : 'expensive'} ${alreadyOwned ? 'owned' : ''}`}
                    style={{ 
                      borderColor: item.color,
                      backgroundColor: item.bgColor
                    }}
                  >
                    <div className="item-header">
                      <div className="item-icon" style={{ color: item.color }}>
                        {item.icon}
                      </div>
                      <h3>{item.name}</h3>
                    </div>
                    
                    <p className="item-description">{item.description}</p>
                    
                    <div className="item-footer">
                      <div className="item-price" style={{ color: item.color }}>
                        {item.price} نقطة
                      </div>
                      
                      {alreadyOwned ? (
                        <button className="owned-button" disabled>
                          مملوك بالفعل
                        </button>
                      ) : (
                        <button 
                          onClick={() => purchaseItem(item)}
                          disabled={!canAfford}
                          className={canAfford ? 'buy-button' : 'disabled-button'}
                          style={{ backgroundColor: canAfford ? item.color : '#ccc' }}
                        >
                          {canAfford ? 'شراء الآن' : 'نقاط غير كافية'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {inventory.length > 0 && (
              <div className="inventory-section">
                <h3>عناصرك الحالية</h3>
                <div className="inventory-grid">
                  {inventory.map((item, index) => {
                    const shopItem = shopItems.find(si => si.id === item.id);
                    if (!shopItem) return null;
                    
                    const expiresAt = item.expiresAt?.toDate();
                    const isExpired = expiresAt < new Date();
                    
                    return (
                      <div 
                        key={index} 
                        className={`inventory-item ${isExpired ? 'expired' : 'active'}`}
                        style={{ 
                          borderColor: shopItem.color,
                          backgroundColor: shopItem.bgColor
                        }}
                      >
                        <div className="inventory-icon" style={{ color: shopItem.color }}>
                          {shopItem.icon}
                        </div>
                        <div className="inventory-info">
                          <span className="inventory-name">{shopItem.name}</span>
                          <span className="inventory-expiry">
                            {isExpired ? 'منتهي' : `ينتهي في: ${expiresAt.toLocaleString('ar-SA')}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'attendance' && isCreator && (
          <AttendanceCalendar 
            groupId={groupId} 
            userId={user.uid} 
            isCreator={isCreator} 
          />
        )}

        {activeTab === 'exams' && (
          <div className="exams-container">
            {examLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p>جاري التحميل...</p>
              </div>
            )}
            
            {activeExamTab === 'list' && (
              <ExamsList 
                exams={exams} 
                isCreator={isCreator}
                currentUserId={user?.uid}
                onActivateExam={handleActivateExam}
                onDeactivateExam={handleDeactivateExam}
                onDeleteExam={handleDeleteExam}
                onStartCreate={() => setActiveExamTab('create')}
                onViewResults={(exam) => {
                  setSelectedExam(exam);
                  setActiveExamTab('results');
                }}
                onTakeExam={(exam) => {
                  setSelectedExam(exam);
                  setActiveExamTab('take');
                }}
              />
            )}
            
            {activeExamTab === 'create' && (
              <CreateExam 
                groupId={groupId} 
                userId={user.uid} 
                onExamCreated={() => {
                  setActiveExamTab('list');
                  showNotification('تم إنشاء الامتحان بنجاح');
                }}
                onCancel={() => setActiveExamTab('list')}
              />
            )}
            
            {activeExamTab === 'results' && selectedExam && (
              <ExamResults 
                examId={selectedExam.id} 
                onBack={() => setActiveExamTab('list')}
              />
            )}
            
            {activeExamTab === 'take' && selectedExam && (
              <TakeExam 
                exam={selectedExam} 
                userId={user.uid} 
                onComplete={handleExamSubmitted}
                onBack={() => setActiveExamTab('list')}
              />
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <ArrowChartPage points={points} />
        )}
      </div>

      <div className={`members-sidebar ${showMembers ? 'show' : ''}`}>
        <div className="sidebar-header">
          <h3>ترتيب المجموعة</h3>
          <button 
            className="close-sidebar" 
            onClick={toggleMembersSidebar}
          >
            ✕
          </button>
        </div>
        
        {loadingMembers ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>جاري تحميل الأعضاء...</p>
          </div>
        ) : (
          <>
            <div className="leaderboard">
              {members
                .filter(member => !bannedMembers.includes(member.uid))
                .map((member, index) => (
                  <div 
                    key={member.uid} 
                    className={`member-item ${member.uid === user.uid ? 'current-user' : ''} ${member.hasCrown && member.crownExpires > new Date() ? 'has-crown' : ''}`}
                    onMouseEnter={() => setHoveredAvatar(member.uid)}
                    onMouseLeave={() => setHoveredAvatar(null)}
                  >
                    <span className="member-rank">{index + 1}</span>
                    
                    <div className="avatar-container">
                      <img 
                        src={member.photoURL} 
                        alt={member.name} 
                        className={`member-avatar ${hoveredAvatar === member.uid ? 'avatar-hover' : ''}`}
                      />
                      {onlineUsers.includes(member.uid) && <div className="online-status"></div>}
                      {hoveredAvatar === member.uid && <div className="avatar-tooltip">{member.name}</div>}
                      {member.hasCrown && member.crownExpires > new Date() && (
                        <div className="crown-indicator" title="تاج ذهبي">👑</div>
                      )}
                    </div>
                    
                    <div className="member-info">
                      <span className="member-name">{member.name}</span>
                      <span className="member-points">{member.points} نقطة</span>
                    </div>
                    
                    {isCreator && member.uid !== user.uid && (
                      <div className="member-actions">
                        <button 
                          onClick={() => toggleBanMember(member.uid)}
                          className="ban-button"
                          title={bannedMembers.includes(member.uid) ? "إلغاء الحظر" : "حظر العضو"}
                        >
                          {bannedMembers.includes(member.uid) ? "🚫" : "⛔"}
                        </button>
                        <button 
                          onClick={() => removeMember(member.uid)}
                          className="remove-button"
                          title="حذف العضو"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
            
            {bannedMembers.length > 0 && (
              <div className="banned-section">
                <h4>الأعضاء المحظورين</h4>
                {members
                  .filter(member => bannedMembers.includes(member.uid))
                  .map((member) => (
                    <div key={member.uid} className="member-item banned-member">
                      <div className="avatar-container">
                        <img 
                          src={member.photoURL} 
                          alt={member.name} 
                          className="member-avatar"
                        />
                      </div>
                      
                      <div className="member-info">
                        <span className="member-name">{member.name}</span>
                        <span className="banned-label">محظور</span>
                      </div>
                      
                      {isCreator && (
                        <button 
                          onClick={() => toggleBanMember(member.uid)}
                          className="unban-button"
                        >
                          إلغاء الحظر
                        </button>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </div>

      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('groups');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeAttempts, setCodeAttempts] = useState(3);
  const navigate = useNavigate();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('SW registered: ', registration.scope);
          })
          .catch(err => {
            console.log('SW registration failed: ', err);
          });
      });
    }
  }, []);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    showNotification(newMode ? '🌙 تم تفعيل الوضع المظلم' : '☀️ تم تفعيل الوضع الفاتح');
  };

  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedMode ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userData = await userService.createOrUpdateUser(currentUser);
        if (userData) {
          setUser({
            ...currentUser,
            uniqueCode: userData.uniqueCode,
            hasVerifiedCode: userData.hasVerifiedCode || false
          });
          setCodeVerified(userData.hasVerifiedCode || false);
        }
        await fetchUserGroups(currentUser.uid);
      } else {
        setUser(null);
        setGroups([]);
        setSelectedGroup(null);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const fetchUserGroups = async (userId) => {
    setLoadingGroups(true);
    try {
      const q = query(
        collection(db, "studyGroups"),
        where("members", "array-contains", userId)
      );
      
      const querySnapshot = await getDocs(q);
      const groupsArray = [];
      
      const groupsPromises = querySnapshot.docs.map(async (docSnap) => {
        const groupData = docSnap.data();
        
        if (groupData.bannedMembers?.includes(userId)) {
          return null;
        }
        
        const creatorDoc = await getDoc(doc(db, "users", groupData.creator));
        const creatorName = creatorDoc.exists() ? creatorDoc.data().displayName : "مستخدم غير معروف";
        
        return { 
          id: docSnap.id, 
          ...groupData,
          creatorName,
          code: docSnap.id.slice(0, 6).toUpperCase(),
          isCreator: groupData.creator === userId
        };
      });
      
      const groups = (await Promise.all(groupsPromises)).filter(Boolean);
      setGroups(groups);
      
      if (selectedGroup && !groups.some(g => g.id === selectedGroup)) {
        setSelectedGroup(null);
      }
    } catch (error) {
      console.error("Error fetching user groups:", error);
      showNotification("❌ حدث خطأ أثناء جلب المجموعات");
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userData = await userService.createOrUpdateUser(result.user);
      
      if (userData) {
        setUser({
          ...result.user,
          uniqueCode: userData.uniqueCode,
          hasVerifiedCode: userData.hasVerifiedCode || false
        });
        
        const codeResult = await userService.createUserCode(result.user.uid);
        console.log('User code:', codeResult.code);
        
        const isVerified = await userService.checkCodeVerification(result.user.uid);
        if (isVerified) {
          setCodeVerified(true);
        }
      }
      
      showNotification(`🎉 مرحباً ${result.user.displayName}!`);
    } catch (error) {
      console.error("Error signing in:", error);
      showNotification("❌ حدث خطأ أثناء تسجيل الدخول");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification("✅ تم تسجيل الخروج بنجاح");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const addStudyGroup = async () => {
    if (!groupName.trim()) {
      showNotification("⚠️ الرجاء إدخال اسم المجموعة");
      return;
    }
    
    try {
      const newGroup = {
        name: groupName.trim(),
        createdAt: new Date(),
        creator: user.uid,
        members: [user.uid],
        userPoints: { [user.uid]: 0 },
        bannedMembers: [],
        totalStudyTime: 0
      };
      
      await addDoc(collection(db, "studyGroups"), newGroup);
      setGroupName('');
      showNotification(`🎉 تم إنشاء مجموعة "${groupName.trim()}" بنجاح`);
      await fetchUserGroups(user.uid);
    } catch (error) {
      console.error("Error adding group:", error);
      showNotification("❌ حدث خطأ أثناء إنشاء المجموعة");
    }
  };

  const deleteGroup = async (groupId) => {
    if (window.confirm("⚠️ هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع بياناتها نهائياً")) {
      try {
        const groupItem = document.getElementById(`group-${groupId}`);
        if (groupItem) {
          groupItem.style.transform = 'scale(0.9)';
          groupItem.style.opacity = '0.5';
          groupItem.style.transition = 'all 0.3s ease';
          groupItem.style.animation = 'shake 0.5s';
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await deleteDoc(doc(db, "studyGroups", groupId));
        showNotification("✅ تم حذف المجموعة بنجاح");
        await fetchUserGroups(user.uid);
      } catch (error) {
        console.error("Error deleting group:", error);
        showNotification("❌ حدث خطأ أثناء حذف المجموعة");
      }
    }
  };

  const joinGroupByCode = async () => {
    if (!joinCode.trim()) {
      showNotification("⚠️ الرجاء إدخال كود المجموعة");
      return;
    }
    
    try {
      const allGroupsQuery = collection(db, "studyGroups");
      const allGroupsSnapshot = await getDocs(allGroupsQuery);
      
      let groupToJoin = null;
      allGroupsSnapshot.forEach(doc => {
        const groupCode = doc.id.slice(0, 6).toUpperCase();
        if (groupCode === joinCode.toUpperCase().trim()) {
          groupToJoin = { 
            id: doc.id, 
            ...doc.data(),
            code: groupCode
          };
        }
      });
      
      if (groupToJoin) {
        if (groupToJoin.bannedMembers?.includes(user.uid)) {
          showNotification(`🚫 أنت محظور من هذه المجموعة (${groupToJoin.name})`);
          return;
        }
        
        if (groupToJoin.members && groupToJoin.members.includes(user.uid)) {
          setSelectedGroup(groupToJoin.id);
          setShowJoinModal(false);
          setJoinCode('');
          return;
        }
        
        await updateDoc(doc(db, "studyGroups", groupToJoin.id), {
          [`userPoints.${user.uid}`]: 0,
          members: [...(groupToJoin.members || []), user.uid]
        });
        
        setSelectedGroup(groupToJoin.id);
        setShowJoinModal(false);
        setJoinCode('');
        showNotification(`تم الانضمام إلى مجموعة "${groupToJoin.name}"`);
        await fetchUserGroups(user.uid);
      } else {
        showNotification("لا توجد مجموعة بهذا الكود");
      }
    } catch (error) {
      console.error("Error joining group:", error);
      showNotification("حدث خطأ أثناء الانضمام للمجموعة");
    }
  };

  const handleJoinGroup = (groupId) => {
    setSelectedGroup(groupId);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
  };

  const handleAddGroupClick = () => {
    if (!codeVerified) {
      setShowCodeModal(true);
    } else {
      document.querySelector('.group-creation input').focus();
    }
  };

  const verifyCode = async () => {
    try {
      const verified = await userService.verifyUserCode(user.uid, joinCode);
      if (verified.success) {
        setCodeVerified(true);
        setShowCodeModal(false);
        setJoinCode('');
        showNotification('تم التحقق بنجاح!');
        
        const codeInfo = await userService.getCodeInfo(user.uid);
        console.log('Code info:', codeInfo);
      } else {
        handleCodeError();
        showNotification(verified.message || 'الكود غير صحيح');
      }
    } catch (error) {
      console.error('Verification error:', error);
      showNotification('حدث خطأ أثناء التحقق');
    }
  };

  const handleCodeError = () => {
    const remainingAttempts = codeAttempts - 1;
    setCodeAttempts(remainingAttempts);
    
    if (remainingAttempts <= 0) {
      setShowCodeModal(false);
      showNotification('لقد استنفذت جميع محاولات التحقق. يرجى المحاولة لاحقاً');
      setCodeAttempts(3);
    }
  };

  if (selectedGroup && user) {
    return (
      <div className="App">
        <Timer 
          user={user} 
          onBack={handleBackToGroups}
          groupId={selectedGroup}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <button 
        onClick={toggleDarkMode} 
        className="theme-toggle"
        aria-label={darkMode ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الغامق'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
      
      <Routes>
        <Route path="/" element={
          <>
            <header className="App-header">
              <div className="login-container">
                {!user ? (
                  <div className="welcome-screen">
                    <h1>مجموعات الدراسة التعاونية</h1>
                    <p>انضم إلى مجتمع المذاكرة مع الأصدقاء وحقق أهدافك التعليمية</p>
                    <button className="login-button" onClick={handleLogin}>
                      <span>تسجيل الدخول باستخدام Google</span>
                    </button>
                  </div>
                ) : (
                  <div className="user-welcome">
                    <div className="user-info">
                      <img src={user.photoURL} alt="صورة المستخدم" className="user-avatar" />
                      <div className="user-details">
                        <h2>مرحباً {user.displayName}!</h2>
                        <div className="user-actions">
                          <button 
                            className={`profile-button ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => {
                              setActiveTab('profile');
                              navigate('/profile');
                            }}
                          >
                            الملف الشخصي
                          </button>
                          <button className="logout-button" onClick={handleLogout}>
                            تسجيل الخروج
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {user && activeTab === 'groups' && (
                <>
                  <div className="group-management">
                    <div className="group-creation">
                      <h2>إنشاء مجموعة جديدة</h2>
                      <div className="input-group">
                        <input
                          type="text"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="أدخل اسم المجموعة"
                          onKeyPress={(e) => e.key === 'Enter' && codeVerified && addStudyGroup()}
                          disabled={!codeVerified}
                        />
                        <button 
                          className="create-button" 
                          onClick={codeVerified ? addStudyGroup : handleAddGroupClick}
                        >
                          {codeVerified ? 'إنشاء' : 'التحقق لإنشاء مجموعة'}
                        </button>
                      </div>
                      {!codeVerified && (
                        <p className="code-notice">
                          يجب التحقق من الكود المميز الخاص بك قبل إنشاء مجموعات جديدة
                        </p>
                      )}
                    </div>
                    
                    <div className="join-group">
                      <h2>الانضمام إلى مجموعة</h2>
                      <button 
                        className="join-button"
                        onClick={() => setShowJoinModal(true)}
                      >
                        الانضمام بمجموعة موجودة
                      </button>
                    </div>
                  </div>

                  <div className="study-groups">
                    <h2>مجموعاتك الدراسية</h2>
                    
                    {loadingGroups ? (
                      <div className="loading-container">
                        <div className="spinner"></div>
                        <p>جاري تحميل المجموعات...</p>
                      </div>
                    ) : groups.length === 0 ? (
                      <div className="empty-state">
                        <img src="/empty-groups.svg" alt="لا توجد مجموعات" className="empty-image" />
                        <p>لا توجد مجموعات متاحة حالياً</p>
                        <button 
                          className="create-button"
                          onClick={handleAddGroupClick}
                        >
                          إنشاء مجموعة جديدة
                        </button>
                      </div>
                    ) : (
                      <div className="groups-grid">
                        {groups.map((group) => (
                          <div key={group.id} id={`group-${group.id}`} className="group-card">
                            <div className="group-content">
                              <h3 className="group-name">{group.name}</h3>
                              <p className="group-meta">
                                <span className="group-creator">المنشئ: {group.creatorName}</span>
                                <span className="group-code">كود: {group.code}</span>
                              </p>
                              {group.isCreator && <span className="creator-badge">أنت المنشئ</span>}
                            </div>
                            
                            <div className="group-actions">
                              <button 
                                onClick={() => handleJoinGroup(group.id)} 
                                className="join-button"
                              >
                                دخول المجموعة
                              </button>
                              
                              {group.isCreator && (
                                <button 
                                  onClick={() => deleteGroup(group.id)} 
                                  className="delete-button"
                                >
                                  حذف المجموعة
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {showJoinModal && (
                <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="close-button" onClick={() => setShowJoinModal(false)}>
                      &times;
                    </button>
                    
                    <h2>الانضمام إلى مجموعة</h2>
                    <p>أدخل كود المجموعة المكون من 6 أحرف</p>
                    
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="أدخل كود المجموعة"
                      maxLength={6}
                      className="join-input"
                    />
                    
                    <div className="modal-actions">
                      <button onClick={joinGroupByCode} className="confirm-button">
                        تأكيد الانضمام
                      </button>
                      <button 
                        onClick={() => setShowJoinModal(false)} 
                        className="cancel-button"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showCodeModal && (
                <div className="modal-overlay" onClick={() => setShowCodeModal(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="close-button" onClick={() => setShowCodeModal(false)}>
                      &times;
                    </button>
                    
                    <h2>التحقق من الكود المميز</h2>
                    <p>لإنشاء مجموعات جديدة، يرجى إدخال الكود المكون من 16 حرف المرفق مع حسابك</p>
                    
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="أدخل الكود المميز"
                      maxLength={16}
                      className="join-input"
                    />
                    
                    {codeAttempts < 3 && (
                      <p className="attempts-left">المحاولات المتبقية: {codeAttempts}</p>
                    )}
                    
                    <div className="modal-actions">
                      <button 
                        onClick={verifyCode} 
                        className="confirm-button"
                        disabled={!joinCode.trim()}
                      >
                        تأكيد
                      </button>
                      <button 
                        onClick={() => setShowCodeModal(false)} 
                        className="cancel-button"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {notification && (
                <div className="notification">
                  {notification}
                </div>
              )}

              <footer className="app-footer">
                <p>تم تطويره بواسطة محمد أبو طبيخ © {new Date().getFullYear()}</p>
              </footer>
            </header>
          </>
        } />
        <Route path="/profile" element={<Profile user={user} showNotification={showNotification} />} />
      </Routes>
    </div>
  );
}

export default App;
