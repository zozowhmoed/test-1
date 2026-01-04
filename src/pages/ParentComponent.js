import React, { useState, useEffect } from 'react';
import { deleteExam } from '../services/examService';
import ExamsList from './ExamsList';

const ParentComponent = () => {
  const [exams, setExams] = useState([]);

  // دالة الحذف المعدلة
  const handleDeleteExam = async (examId) => {
    try {
      await deleteExam(examId);
      setExams(exams.filter(exam => exam.id !== examId));
      alert('تم الحذف بنجاح');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <ExamsList
      exams={exams}
      onDeleteExam={handleDeleteExam}
      isCreator={true}
    />
  );
};

export default ParentComponent;