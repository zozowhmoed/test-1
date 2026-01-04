import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../../styles/exam-styles.css';

const ExamsList = ({ 
  exams, 
  isCreator, 
  currentUserId,
  onActivateExam,
  onDeactivateExam,
  onDeleteExam,
  onStartCreate,
  onViewResults,
  onTakeExam
}) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const filteredExams = exams.filter(exam => {
    const filterMatch = 
      filter === 'all' || 
      (filter === 'active' && exam.status === 'active') ||
      (filter === 'draft' && exam.status === 'draft') ||
      (filter === 'mine' && exam.creatorId === currentUserId);
    
    const searchMatch = 
      searchTerm === '' ||
      exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.description && exam.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return filterMatch && searchMatch;
  });

  const formatDate = (date) => {
    if (!date) return '--';
    
    try {
      if (date.toDate) {
        return date.toDate().toLocaleDateString('ar-EG');
      }
      if (date instanceof Date) {
        return date.toLocaleDateString('ar-EG');
      }
      if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('ar-EG');
      }
      if (typeof date === 'number') {
        return new Date(date).toLocaleDateString('ar-EG');
      }
      return '--';
    } catch (error) {
      console.error('Error formatting date:', error);
      return '--';
    }
  };

  const handleToggleStatus = async (exam) => {
    try {
      setLoading(true);
      if (exam.status === 'active') {
        await onDeactivateExam(exam);
      } else {
        await onActivateExam(exam);
      }
    } catch (err) {
      console.error('Error toggling exam status:', err);
      setError('حدث خطأ أثناء تغيير حالة الامتحان: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (examId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الامتحان؟ سيتم حذف جميع النتائج المرتبطة به.')) {
      try {
        setLoading(true);
        await onDeleteExam(examId);
      } catch (err) {
        console.error('Error deleting exam:', err);
        setError('حدث خطأ أثناء حذف الامتحان: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="exams-list-container">
      <div className="exams-header">
        <h2>قائمة الامتحانات</h2>
        
        <div className="exams-controls">
          <div className="search-control">
            <input
              type="text"
              placeholder="ابحث عن امتحان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-control">
            <label>تصفية:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value="active">نشطة</option>
              <option value="draft">مسودة</option>
              {isCreator && <option value="mine">التي أنشأتها</option>}
            </select>
          </div>
          
          {isCreator && (
            <button onClick={onStartCreate} className="create-exam-btn">
              إنشاء امتحان جديد
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      {filteredExams.length === 0 ? (
        <div className="no-exams">
          <img src="/no-exams.svg" alt="لا توجد امتحانات" />
          <p>لا توجد امتحانات متاحة</p>
          {isCreator && (
            <button onClick={onStartCreate} className="create-exam-btn">
              إنشاء أول امتحان
            </button>
          )}
        </div>
      ) : (
        <div className="exams-grid">
          {filteredExams.map(exam => (
            <div key={exam.id} className={`exam-card ${exam.status}`}>
              <div className="exam-header">
                <h3>{exam.title}</h3>
                <span className={`exam-status ${exam.status}`}>
                  {exam.status === 'active' ? 'نشط' : 'مسودة'}
                </span>
              </div>
              
              <div className="exam-meta">
                <p><strong>عدد الأسئلة:</strong> {exam.questions?.length || 0}</p>
                <p><strong>المدة:</strong> {exam.duration} دقيقة</p>
                <p><strong>درجة النجاح:</strong> {exam.passingGrade || 60}%</p>
                <p><strong>تاريخ الإنشاء:</strong> {formatDate(exam.createdAt)}</p>
              </div>
              
              <div className="exam-actions">
                {exam.status === 'active' ? (
                  <>
                    <button 
                      onClick={() => onTakeExam(exam)} 
                      className="take-exam-btn"
                    >
                      أداء الامتحان
                    </button>
                    
                    {isCreator && (
                      <>
                        <button 
                          onClick={() => handleToggleStatus(exam)} 
                          className="deactivate-exam-btn"
                        >
                          إيقاف
                        </button>
                        <button 
                          onClick={() => onViewResults(exam)} 
                          className="view-results-btn"
                        >
                          عرض النتائج
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {isCreator && exam.creatorId === currentUserId && (
                      <>
                        <button 
                          onClick={() => handleToggleStatus(exam)} 
                          className="activate-exam-btn"
                        >
                          تفعيل
                        </button>
                        <button 
                          onClick={() => handleDelete(exam.id)} 
                          className="delete-exam-btn"
                        >
                          حذف الامتحان
                        </button>
                      </>
                    )}
                    {!isCreator && (
                      <p className="not-available">غير متاح حالياً</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

ExamsList.propTypes = {
  exams: PropTypes.array.isRequired,
  isCreator: PropTypes.bool.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onActivateExam: PropTypes.func.isRequired,
  onDeactivateExam: PropTypes.func.isRequired,
  onDeleteExam: PropTypes.func.isRequired,
  onStartCreate: PropTypes.func.isRequired,
  onViewResults: PropTypes.func.isRequired,
  onTakeExam: PropTypes.func.isRequired
};

export default ExamsList;