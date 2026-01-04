import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import userService from '../services/userService';

function Profile({ user, showNotification, onBack }) {
  const [profile, setProfile] = useState({
    firstName: '',
    fatherName: '',
    lastName: ''
  });
  
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userData = await userService.getUserData(user.uid);

        if (userData) {
          setProfile({
            firstName: userData.firstName || '',
            fatherName: userData.fatherName || '',
            lastName: userData.lastName || ''
          });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        showNotification('حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user, showNotification]);

  const showReloadNotification = () => {
    showNotification('الرجاء إعادة تحميل الصفحة لحفظ التعديلات');
  };

  const handleSave = async () => {
    try {
      await userService.updateProfile(user.uid, {
        firstName: profile.firstName,
        fatherName: profile.fatherName,
        lastName: profile.lastName
      });
      showReloadNotification();
      if (onBack) onBack();
      else navigate('/');
    } catch (error) {
      console.error("Error updating profile:", error);
      showNotification('حدث خطأ أثناء حفظ التعديلات');
    }
  };

  const handleBack = () => {
    showReloadNotification();
    if (onBack) onBack();
    else navigate('/');
  };

  if (loading) {
    return <div className="loading">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-form">
        <h2>الملف الشخصي</h2>
        
        <div className="profile-section">
          <div className="profile-header">
            <img src={user.photoURL} alt="صورة الملف الشخصي" className="profile-avatar" />
            <h3>{user.displayName}</h3>
            <p className="user-email">{user.email}</p>
          </div>
        </div>

        <div className="form-group">
          <label>الاسم الأول:</label>
          <input 
            value={profile.firstName}
            onChange={(e) => setProfile({...profile, firstName: e.target.value})}
            placeholder="أدخل الاسم الأول"
          />
        </div>
        
        <div className="form-group">
          <label>اسم الأب:</label>
          <input 
            value={profile.fatherName}
            onChange={(e) => setProfile({...profile, fatherName: e.target.value})}
            placeholder="أدخل اسم الأب"
          />
        </div>
        
        <div className="form-group">
          <label>اسم العائلة:</label>
          <input 
            value={profile.lastName}
            onChange={(e) => setProfile({...profile, lastName: e.target.value})}
            placeholder="أدخل اسم العائلة"
          />
        </div>
        
        <div className="profile-actions">
          <button onClick={handleSave} className="save-button">
            حفظ التعديلات
          </button>
          
          <button onClick={handleBack} className="back-button">
            الرجوع
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;