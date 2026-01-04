import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './AttendanceCalendar.css';

const months = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

const AttendanceCalendar = ({ groupId, userId, isCreator }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberDetails, setMemberDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0
  });

  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
    }
  }, []);

  const calculateStats = (data) => {
    let present = 0;
    let absent = 0;
    
    Object.values(data).forEach(status => {
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
    });
    
    return { present, absent };
  };

  useEffect(() => {
    const fetchMembers = async () => {
      const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const membersList = groupData.members || [];
        
        const membersWithDetails = await Promise.all(
          membersList.map(async (memberId) => {
            const userDoc = await getDoc(doc(db, "users", memberId));
            const userData = userDoc.data() || {};
            return {
              id: memberId,
              firstName: userData.firstName || 'غير معروف',
              fatherName: userData.fatherName || '',
              lastName: userData.lastName || '',
              photoURL: userData.photoURL || null
            };
          })
        );
        
        setMemberDetails(membersWithDetails);
        
        if (selectedMember) {
          const attendanceDoc = await getDoc(doc(db, "attendance", `${groupId}_${selectedMember}`));
          if (attendanceDoc.exists()) {
            const records = attendanceDoc.data().records || {};
            setAttendanceData(records);
            setAttendanceStats(calculateStats(records));
          } else {
            setAttendanceData({});
            setAttendanceStats({ present: 0, absent: 0 });
          }
        }
      }
      setLoading(false);
    };

    fetchMembers();
  }, [groupId, selectedMember]);

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
    setSelectedDay(null);
  };

  const selectDay = (day) => {
    setSelectedDay(day);
  };

  const updateAttendance = async (status) => {
    if (!selectedDay || !selectedMember) return;
    
    const dateKey = `${currentYear}-${currentMonth}-${selectedDay}`;
    const currentStatus = attendanceData[dateKey];
    
    if (currentStatus && status !== currentStatus) {
      if (!window.confirm(`هل تريد تغيير حالة اليوم ${selectedDay} من ${currentStatus === 'present' ? 'حضور' : 'غياب'} إلى ${status === 'present' ? 'حضور' : 'غياب'}؟`)) {
        return;
      }
    }
    
    const newData = {
      ...attendanceData,
      [dateKey]: status
    };
    
    setAttendanceData(newData);
    setAttendanceStats(calculateStats(newData));
    setSelectedDay(null);
  };

  const deleteAttendance = async () => {
    if (!selectedDay || !selectedMember) return;
    
    if (window.confirm('هل أنت متأكد من حذف حضور هذا اليوم؟')) {
      const dateKey = `${currentYear}-${currentMonth}-${selectedDay}`;
      const newData = {...attendanceData};
      delete newData[dateKey];
      setAttendanceData(newData);
      setAttendanceStats(calculateStats(newData));
      setSelectedDay(null);
    }
  };

  const saveChanges = async () => {
    try {
      await setDoc(doc(db, "attendance", `${groupId}_${selectedMember}`), {
        memberId: selectedMember,
        groupId,
        records: attendanceData
      }, { merge: true });
      alert('تم حفظ التعديلات بنجاح');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('حدث خطأ أثناء حفظ التعديلات');
    }
  };

  const cancelChanges = async () => {
    if (window.confirm('هل أنت متأكد من إلغاء جميع التعديلات غير المحفوظة؟')) {
      const attendanceDoc = await getDoc(doc(db, "attendance", `${groupId}_${selectedMember}`));
      if (attendanceDoc.exists()) {
        const records = attendanceDoc.data().records || {};
        setAttendanceData(records);
        setAttendanceStats(calculateStats(records));
      } else {
        setAttendanceData({});
        setAttendanceStats({ present: 0, absent: 0 });
      }
      setSelectedDay(null);
    }
  };

  const getSelectedMember = () => {
    return memberDetails.find(m => m.id === selectedMember) || {};
  };

  return (
    <div className="attendance-container" data-theme={darkMode ? 'dark' : 'light'}>
      <h2>جدول الحضور والغياب</h2>
      
      {isCreator && (
        <div className="members-list">
          <h3>اختر عضو:</h3>
          <select 
            onChange={(e) => {
              setSelectedMember(e.target.value);
              setSelectedDay(null);
            }}
            value={selectedMember || ''}
          >
            <option value="">-- اختر عضو --</option>
            {memberDetails.map(member => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.fatherName} {member.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedMember && (
        <div className="calendar-container">
          <div className="selected-member-info">
            {getSelectedMember().photoURL && (
              <img 
                src={getSelectedMember().photoURL} 
                alt="صورة العضو" 
                className="member-avatar"
              />
            )}
            <div className="member-names">
              <h3>
                {getSelectedMember().firstName} 
                {getSelectedMember().fatherName && ` ${getSelectedMember().fatherName}`}
                {getSelectedMember().lastName && ` ${getSelectedMember().lastName}`}
              </h3>
              <div className="attendance-stats">
                <span className="stat-present">الحضور: {attendanceStats.present}</span>
                <span className="stat-absent">الغياب: {attendanceStats.absent}</span>
              </div>
            </div>
          </div>

          <div className="calendar-header">
            <button onClick={() => changeMonth('prev')}>◀</button>
            <h3>{months[currentMonth]} {currentYear}</h3>
            <button onClick={() => changeMonth('next')}>▶</button>
          </div>

          <div className="calendar-grid">
            {Array.from({ length: daysInMonth(currentMonth, currentYear) }, (_, i) => {
              const day = i + 1;
              const dateKey = `${currentYear}-${currentMonth}-${day}`;
              const status = attendanceData[dateKey] || 'unset';
              
              return (
                <div 
                  key={day} 
                  className={`calendar-day ${status} ${selectedDay === day ? 'selected' : ''}`}
                  onClick={() => selectDay(day)}
                >
                  <span className="day-number">{day}</span>
                  <div className="day-status">
                    {status === 'present' && 'حضور'}
                    {status === 'absent' && 'غياب'}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDay && (
            <div className="day-actions-panel">
              <h4>إجراءات اليوم {selectedDay}:</h4>
              <div className="action-buttons">
                <button 
                  onClick={() => updateAttendance('present')}
                  className="present-btn"
                >
                  تحديد كحضور
                </button>
                <button 
                  onClick={() => updateAttendance('absent')}
                  className="absent-btn"
                >
                  تحديد كغياب
                </button>
                {attendanceData[`${currentYear}-${currentMonth}-${selectedDay}`] && (
                  <button 
                    onClick={deleteAttendance}
                    className="delete-btn"
                  >
                    حذف الحضور
                  </button>
                )}
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="cancel-day-btn"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          <div className="calendar-actions">
            <button onClick={saveChanges} className="save-btn">حفظ التعديلات</button>
            <button onClick={cancelChanges} className="cancel-btn">إلغاء جميع التعديلات</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;