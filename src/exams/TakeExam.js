import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ExamService from '../services/ExamService';
import '../styles/exam-styles.css';

const TakeExam = ({ exam, userId, onComplete, onBack }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(exam.questions.length).fill(null));
  const [timeLeft, setTimeLeft] = useState(exam.duration * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attemptInfo, setAttemptInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [resultData, setResultData] = useState(null);

  useEffect(() => {
    const checkAttempts = async () => {
      try {
        const attemptData = await ExamService.checkExamAttempt(exam.id, userId);
        setAttemptInfo(attemptData);
        
        if (attemptData.attempted) {
          setWarning({
            title: attemptData.canRetake ? "لديك محاولة سابقة" : "لا يمكنك إعادة الامتحان",
            message: attemptData.canRetake 
              ? `لديك محاولة سابقة بنسبة ${attemptData.lastAttempt?.percentage}%. هل تريد المتابعة؟`
              : `لقد استنفذت عدد المحاولات المسموحة (نسبتك: ${attemptData.lastAttempt?.percentage}%)`
          });
        }
      } catch (err) {
        console.error('Error checking exam attempt:', err);
        setError(err.message || 'حدث خطأ أثناء التحقق من المحاولات السابقة');
      } finally {
        setLoading(false);
      }
    };

    checkAttempts();
  }, [exam.id, userId]);

  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  const handleAutoSubmit = async () => {
    if (isSubmitted) return;
    await handleSubmit();
  };

  const handleSubmit = async () => {
    if (isSubmitted || (attemptInfo?.attempted && !attemptInfo?.canRetake)) return;
    
    try {
      setIsSubmitted(true);
      
      const correctAnswers = exam.questions.reduce((count, question, index) => {
        return count + (answers[index] === question.correctAnswer ? (question.points || 1) : 0);
      }, 0);

      const totalPoints = exam.questions.reduce((sum, q) => sum + (q.points || 1), 0);
      const percentage = Math.round((correctAnswers / totalPoints) * 100);
      const passingGrade = exam.passingGrade || Math.ceil(totalPoints * 0.6);
      const passed = correctAnswers >= passingGrade;

      const result = {
        examId: exam.id,
        userId,
        studentName: localStorage.getItem('userName') || 'طالب',
        correctAnswers,
        totalQuestions: exam.questions.length,
        totalPoints,
        percentage,
        passingGrade,
        passed,
        answers: exam.questions.map((q, index) => ({
          questionId: q.id || `q${index}`,
          questionText: q.questionText,
          selectedAnswer: answers[index],
          correctAnswer: q.correctAnswer,
          isCorrect: answers[index] === q.correctAnswer,
          points: q.points || 1
        }))
      };

      await ExamService.submitExamResult(result);
      setResultData(result);
      setShowResults(true);
      
      // إرسال النتيجة إلى الصفحة الرئيسية
      if (onComplete) {
        onComplete(exam.id, answers);
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      setError(error.message || 'حدث خطأ أثناء تسليم الاختبار');
      setIsSubmitted(false);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleAnswerChange = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="exam-loading-container">
        <div className="exam-spinner"></div>
        <p>جاري تحميل الامتحان...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-error-container">
        <h2>حدث خطأ</h2>
        <p>{error}</p>
        <button onClick={onBack} className="back-button">
          العودة للخلف
        </button>
      </div>
    );
  }

  if (attemptInfo?.attempted && !attemptInfo?.canRetake) {
    return (
      <div className="exam-attempted-container">
        <h2>لا يمكنك أداء الاختبار</h2>
        <div className="attempt-info">
          <p>لقد قمت بأداء هذا الاختبار من قبل</p>
          <p>النسبة: <strong>{attemptInfo.lastAttempt?.percentage || 0}%</strong></p>
          <p>الحالة: <strong>{attemptInfo.lastAttempt?.passed ? 'ناجح' : 'راسب'}</strong></p>
          <p>تاريخ الأداء: {attemptInfo.lastAttempt?.submittedAt?.toLocaleString('ar-EG') || '--'}</p>
        </div>
        <button onClick={onBack} className="back-button">
          العودة للخلف
        </button>
      </div>
    );
  }

  if (showResults && resultData) {
    return (
      <div className="exam-results-container">
        <h2>نتيجة الامتحان: {exam.title}</h2>
        
        <div className="result-summary">
          <div className="result-card">
            <span className="result-value">{resultData.percentage}%</span>
            <span className="result-label">النسبة المئوية</span>
          </div>
          <div className="result-card">
            <span className="result-value">
              {resultData.correctAnswers}/{resultData.totalPoints} نقطة
            </span>
            <span className="result-label">الدرجة</span>
          </div>
          <div className="result-card">
            <span className={`result-value ${resultData.passed ? 'passed' : 'failed'}`}>
              {resultData.passed ? 'ناجح' : 'راسب'}
            </span>
            <span className="result-label">الحالة</span>
          </div>
        </div>

        <div className="detailed-results">
          <h3>تفاصيل الإجابات:</h3>
          {resultData.answers.map((answer, index) => (
            <div key={index} className={`answer-detail ${answer.isCorrect ? 'correct' : 'wrong'}`}>
              <p><strong>السؤال {index + 1}:</strong> {answer.questionText}</p>
              <p>إجابتك: {answer.selectedAnswer !== null ? 
                exam.questions[index].options[answer.selectedAnswer] : 'لم تجب'}</p>
              <p>الإجابة الصحيحة: {exam.questions[index].options[answer.correctAnswer]}</p>
              <p>النقاط: {answer.isCorrect ? answer.points : 0}/{answer.points}</p>
            </div>
          ))}
        </div>

        <button onClick={onBack} className="back-button">
          العودة إلى قائمة الامتحانات
        </button>
      </div>
    );
  }

  if (warning) {
    return (
      <div className="exam-warning-container">
        <h2>{warning.title}</h2>
        <p>{warning.message}</p>
        <div className="exam-warning-actions">
          <button 
            onClick={() => setWarning(null)}
            className="exam-continue-button"
          >
            متابعة الامتحان
          </button>
          <button 
            onClick={onBack}
            className="exam-cancel-button"
          >
            العودة للخلف
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];

  return (
    <div className="exam-container">
      <div className="exam-header">
        <h1 className="exam-title">{exam.title}</h1>
        <div className="exam-timer">
          <span>الوقت المتبقي:</span>
          <span className={timeLeft <= 60 ? "time-warning" : ""}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="exam-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${((currentQuestionIndex + 1) / exam.questions.length) * 100}%` }}
          ></div>
        </div>
        <span>السؤال {currentQuestionIndex + 1} من {exam.questions.length}</span>
      </div>

      <div className="exam-question">
        <h3 className="question-text">{currentQuestion.questionText}</h3>
        {currentQuestion.image && (
          <div className="question-image">
            <img src={currentQuestion.image} alt="صورة السؤال" />
          </div>
        )}
        
        <div className="question-options">
          {currentQuestion.options.map((option, index) => (
            <div 
              key={index}
              className={`option ${answers[currentQuestionIndex] === index ? "selected" : ""}`}
              onClick={() => handleAnswerChange(index)}
            >
              <span className="option-letter">
                {String.fromCharCode(1633 + index)}
              </span>
              <span className="option-text">{option}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="exam-navigation">
        <button
          onClick={goToPreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="nav-button prev-button"
        >
          السابق
        </button>

        {currentQuestionIndex < exam.questions.length - 1 ? (
          <button
            onClick={goToNextQuestion}
            disabled={answers[currentQuestionIndex] === null}
            className="nav-button next-button"
          >
            التالي
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitted || answers[currentQuestionIndex] === null}
            className="nav-button submit-button"
          >
            {isSubmitted ? 'جاري التسليم...' : 'تسليم الامتحان'}
          </button>
        )}
      </div>

      <div className="exam-questions-overview">
        {exam.questions.map((_, index) => (
          <div
            key={index}
            className={`question-marker ${
              index === currentQuestionIndex ? "current" : 
              answers[index] !== null ? "answered" : "unanswered"
            }`}
            onClick={() => setCurrentQuestionIndex(index)}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

TakeExam.propTypes = {
  exam: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    duration: PropTypes.number.isRequired,
    questions: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        questionText: PropTypes.string.isRequired,
        options: PropTypes.arrayOf(PropTypes.string).isRequired,
        correctAnswer: PropTypes.number.isRequired,
        image: PropTypes.string,
        points: PropTypes.number
      })
    ).isRequired,
    passingGrade: PropTypes.number,
    allowRetake: PropTypes.bool,
    unlimitedAttempts: PropTypes.bool,
    maxAttempts: PropTypes.number
  }).isRequired,
  userId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default TakeExam;