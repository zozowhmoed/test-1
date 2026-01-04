import React from 'react';
import PropTypes from 'prop-types';
import { emergencyStopExam, reopenExam } from 'src/services/ExamService';
import './exam-styles.css';

const ExamsList = ({ 
  exams, 
  isCreator,
  onActivateExam,
  onDeleteExam,
  onStartCreate,
  onViewResults,
  onTakeExam 
}) => {
  const handleDelete = async (exam) => {
    if (exam.status === 'active') {
      alert('لا يمكن حذف امتحان نشط');
      return;
    }
    onDeleteExam(exam);
  };

  const handleEmergencyStop = async (exam) => {
    if (window.confirm('هل أنت متأكد من إيقاف الاختبار طارئاً؟ سيتم منع جميع الطلاب من الاستمرار.')) {
      try {
        await emergencyStopExam(exam.id);
        alert('تم إيقاف الاختبار طارئاً');
      } catch (error) {
        console.error('Error stopping exam:', error);
        alert('حدث خطأ أثناء الإيقاف');
      }
    }
  };

  const handleReopenExam = async (exam) => {
    if (window.confirm('هل تريد إعادة فتح الاختبار للطلاب؟')) {
      try {
        await reopenExam(exam.id);
        alert('تم إعادة فتح الاختبار بنجاح');
      } catch (error) {
        console.error('Error reopening exam:', error);
        alert('حدث خطأ أثناء إعادة الفتح');
      }
    }
  };

  return (
    <div className="exams-container">
      {isCreator && (
        <button onClick={onStartCreate} className="create-exam-btn">
          <span>+</span> إنشاء امتحان جديد
        </button>
      )}

      <div className="exams-grid">
        {exams.length === 0 ? (
          <div className="empty-exams">
            <img src="/empty-exam.svg" alt="لا توجد اختبارات" />
            <p>لا توجد اختبارات متاحة حالياً</p>
            {isCreator && (
              <button onClick={onStartCreate} className="create-exam-btn">
                إنشاء أول امتحان
              </button>
            )}
          </div>
        ) : (
          exams.map(exam => (
            <div key={exam.id} className={`exam-card ${exam.status}`}>
              <div className="exam-card-header">
                <h3>{exam.title}</h3>
                <span className={`exam-status ${exam.status}`}>
                  {exam.status === 'active' ? 'نشط' : 
                   exam.status === 'stopped' ? 'متوقف' : 'مسودة'}
                </span>
              </div>
              
              <p className="exam-description">
                {exam.description || 'لا يوجد وصف للامتحان'}
              </p>
              
              <div className="exam-meta">
                <div>
                  <span>الأسئلة: {exam.questions?.length || 0}</span>
                  <span>المدة: {exam.duration} دقيقة</span>
                </div>
                {exam.status === 'active' && exam.endTime && (
                  <div className="exam-time">
                    ينتهي في: {new Date(exam.endTime.seconds * 1000).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="exam-actions">
                {isCreator ? (
                  <>
                    <button 
                      onClick={() => onViewResults(exam)}
                      className="results-btn"
                    >
                      النتائج
                    </button>
                    
                    {exam.status === 'active' ? (
                      <>
                        <button 
                          onClick={() => handleEmergencyStop(exam)}
                          className="emergency-stop-btn"
                        >
                          إيقاف طارئ
                        </button>
                      </>
                    ) : exam.status === 'stopped' ? (
                      <button 
                        onClick={() => handleReopenExam(exam)}
                        className="reopen-btn"
                      >
                        إعادة فتح
                      </button>
                    ) : (
                      <button 
                        onClick={() => onActivateExam(exam)}
                        className="activate-btn"
                      >
                        تفعيل
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleDelete(exam)}
                      disabled={exam.status === 'active'}
                      className={`delete-btn ${exam.status === 'active' ? 'disabled' : ''}`}
                    >
                      حذف
                    </button>
                  </>
                ) : exam.status === 'active' ? (
                  <button 
                    onClick={() => onTakeExam(exam)}
                    className="take-exam-btn"
                  >
                    بدء الاختبار
                  </button>
                ) : (
                  <button disabled className="take-exam-btn disabled">
                    {exam.status === 'stopped' ? 'متوقف' : 'غير مفعل'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

ExamsList.propTypes = {
  exams: PropTypes.array.isRequired,
  isCreator: PropTypes.bool.isRequired,
  onActivateExam: PropTypes.func.isRequired,
  onDeleteExam: PropTypes.func.isRequired,
  onStartCreate: PropTypes.func.isRequired,
  onViewResults: PropTypes.func.isRequired,
  onTakeExam: PropTypes.func.isRequired
};

export default ExamsList;