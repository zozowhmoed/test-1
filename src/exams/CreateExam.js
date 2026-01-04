import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ExamService from '../services/ExamService';
import '../styles/exam-styles.css';

const CreateExam = ({ groupId, userId, onExamCreated, onCancel }) => {
  const [step, setStep] = useState('details');
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    duration: 30,
    questionCount: 5,
    passingGrade: 60,
    allowRetake: false,
    unlimitedAttempts: false,
    maxAttempts: 1,
    isOpen: false,
    startTime: '',
    endTime: '',
    groupId: groupId,
    creatorId: userId
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    points: 1,
    image: ''
  });
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDetailsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setExamData({
      ...examData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleQuestionChange = (e) => {
    const { name, value } = e.target;
    setCurrentQuestion({
      ...currentQuestion,
      [name]: value
    });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({
      ...currentQuestion,
      options: newOptions
    });
  };

  const handleCorrectAnswerChange = (index) => {
    setCurrentQuestion({
      ...currentQuestion,
      correctAnswer: index
    });
  };

  const validateDetails = () => {
    if (!examData.title.trim()) {
      setError('يجب إدخال عنوان للامتحان');
      return false;
    }
    if (examData.duration < 5) {
      setError('يجب أن تكون مدة الامتحان 5 دقائق على الأقل');
      return false;
    }
    if (examData.questionCount < 1) {
      setError('يجب أن يحتوي الامتحان على سؤال واحد على الأقل');
      return false;
    }
    return true;
  };

  const validateQuestion = () => {
    if (!currentQuestion.text.trim()) {
      setError('يجب إدخال نص السؤال');
      return false;
    }
    if (currentQuestion.options.some(opt => !opt.trim())) {
      setError('يجب إدخال جميع خيارات الإجابة');
      return false;
    }
    return true;
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (validateDetails()) {
      setStep('questions');
    }
  };

  const handleAddQuestion = () => {
    setError('');
    if (validateQuestion()) {
      const newQuestion = {
        id: `q${questions.length + 1}`,
        questionText: currentQuestion.text,
        options: [...currentQuestion.options],
        correctAnswer: currentQuestion.correctAnswer,
        points: parseInt(currentQuestion.points) || 1,
        image: currentQuestion.image
      };

      setQuestions([...questions, newQuestion]);
      setCurrentQuestion({
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        points: 1,
        image: ''
      });

      if (questions.length + 1 >= examData.questionCount) {
        handleFinalSubmit();
      }
    }
  };

  const handleFinalSubmit = async () => {
    try {
      const finalExamData = {
        ...examData,
        questions,
        status: examData.isOpen ? 'active' : 'draft',
        createdAt: new Date(),
        activatedAt: examData.isOpen ? new Date() : null
      };

      const examId = await ExamService.createExam(finalExamData);
      setSuccess(`تم إنشاء الامتحان "${examData.title}" بنجاح!`);
      setTimeout(() => {
        onExamCreated(examId);
      }, 2000);
    } catch (err) {
      console.error('Error creating exam:', err);
      setError('حدث خطأ أثناء حفظ الامتحان');
    }
  };

  const renderDetailsStep = () => (
    <form onSubmit={handleDetailsSubmit} className="exam-form">
      <h2>تفاصيل الامتحان</h2>
      
      <div className="form-group">
        <label>عنوان الامتحان *</label>
        <input
          type="text"
          name="title"
          value={examData.title}
          onChange={handleDetailsChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label>وصف الامتحان</label>
        <textarea
          name="description"
          value={examData.description}
          onChange={handleDetailsChange}
          rows="3"
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>عدد الأسئلة *</label>
          <input
            type="number"
            name="questionCount"
            min="1"
            value={examData.questionCount}
            onChange={handleDetailsChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>مدة الامتحان (دقائق) *</label>
          <input
            type="number"
            name="duration"
            min="5"
            value={examData.duration}
            onChange={handleDetailsChange}
            required
          />
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>درجة النجاح (%)</label>
          <input
            type="number"
            name="passingGrade"
            min="1"
            max="100"
            value={examData.passingGrade}
            onChange={handleDetailsChange}
          />
        </div>
      </div>
      
      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="allowRetake"
            checked={examData.allowRetake}
            onChange={handleDetailsChange}
          />
          السماح بإعادة الامتحان
        </label>
      </div>
      
      {examData.allowRetake && (
        <div className="form-row">
          <div className="form-group">
            <label>عدد المحاولات المسموحة</label>
            <input
              type="number"
              name="maxAttempts"
              min="1"
              value={examData.maxAttempts}
              onChange={handleDetailsChange}
              disabled={examData.unlimitedAttempts}
            />
          </div>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="unlimitedAttempts"
                checked={examData.unlimitedAttempts}
                onChange={handleDetailsChange}
              />
              عدد غير محدود من المحاولات
            </label>
          </div>
        </div>
      )}
      
      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="isOpen"
            checked={examData.isOpen}
            onChange={handleDetailsChange}
          />
          فتح الامتحان مباشرة بعد الإنشاء
        </label>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="cancel-btn">
          إلغاء
        </button>
        <button type="submit" className="submit-btn">
          التالي
        </button>
      </div>
    </form>
  );

  const renderQuestionsStep = () => (
    <div className="exam-form">
      <h2>إضافة الأسئلة ({questions.length + 1}/{examData.questionCount})</h2>
      
      <div className="form-group">
        <label>نص السؤال *</label>
        <textarea
          name="text"
          value={currentQuestion.text}
          onChange={handleQuestionChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label>صورة السؤال (اختياري)</label>
        <input
          type="text"
          name="image"
          value={currentQuestion.image}
          onChange={handleQuestionChange}
          placeholder="رابط الصورة"
        />
      </div>
      
      <div className="form-group">
        <label>درجة السؤال</label>
        <input
          type="number"
          name="points"
          min="1"
          value={currentQuestion.points}
          onChange={handleQuestionChange}
        />
      </div>
      
      <div className="form-group">
        <label>خيارات الإجابة *</label>
        {currentQuestion.options.map((option, index) => (
          <div key={index} className="option-input">
            <input
              type="radio"
              name="correctAnswer"
              checked={currentQuestion.correctAnswer === index}
              onChange={() => handleCorrectAnswerChange(index)}
            />
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`الإجابة ${index + 1}`}
              required
            />
          </div>
        ))}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="form-actions">
        <button 
          type="button" 
          onClick={() => setStep('details')} 
          className="back-btn"
        >
          رجوع
        </button>
        
        {questions.length + 1 < examData.questionCount ? (
          <button
            type="button"
            onClick={handleAddQuestion}
            className="submit-btn"
          >
            حفظ وإضافة السؤال التالي
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAddQuestion}
            className="submit-btn"
          >
            إنهاء وحفظ الامتحان
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="exam-creator-container">
      {step === 'details' ? renderDetailsStep() : renderQuestionsStep()}
    </div>
  );
};

CreateExam.propTypes = {
  groupId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  onExamCreated: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default CreateExam;