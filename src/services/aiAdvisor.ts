import { GoogleGenAI } from '@google/genai';
import { Student, StudentAssessmentRecord, Submission, calculateGrade } from '../types/cbt';

export interface AiAcademicAdvice {
  executiveSummary: string;
  cgpaProjection: string;
  strengths: { subject: string; score: number; praise: string }[];
  weakAreas: { subject: string; score: number; remedy: string }[];
  dailyStudyPlan: {
    day: string;
    focusSubject: string;
    recommendedTopic: string;
    durationMinutes: number;
    activity: string;
  }[];
  examTips: string[];
  motivationalQuote: string;
  isAiGenerated: boolean;
}

export async function generateStudentAiRecommendations(
  student: Student,
  caRecords: StudentAssessmentRecord[],
  submissions: Submission[]
): Promise<AiAcademicAdvice> {
  // Aggregate subject performance metrics
  const subjectScores: Record<string, { total: number; count: number; grades: string[] }> = {};

  caRecords.forEach(r => {
    const sub = r.subjectName || 'General';
    if (!subjectScores[sub]) {
      subjectScores[sub] = { total: 0, count: 0, grades: [] };
    }
    subjectScores[sub].total += r.totalScore;
    subjectScores[sub].count += 1;
    subjectScores[sub].grades.push(r.grade);
  });

  submissions.forEach(s => {
    const sub = s.subject || 'General';
    if (!subjectScores[sub]) {
      subjectScores[sub] = { total: 0, count: 0, grades: [] };
    }
    subjectScores[sub].total += s.percentage;
    subjectScores[sub].count += 1;
    subjectScores[sub].grades.push(calculateGrade(s.percentage).grade);
  });

  const subjectAverages = Object.entries(subjectScores).map(([subject, data]) => ({
    subject,
    average: Math.round(data.total / data.count),
    evalCount: data.count
  })).sort((a, b) => b.average - a.average);

  const strongSubjects = subjectAverages.filter(s => s.average >= 60);
  const weakSubjects = subjectAverages.filter(s => s.average < 60);

  const overallAvg = subjectAverages.length > 0
    ? Math.round(subjectAverages.reduce((acc, s) => acc + s.average, 0) / subjectAverages.length)
    : 65;

  const apiKey =
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    '';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
You are an elite University Academic Dean & Senior Pedagogical Advisor for West African / Nigerian secondary & university preparatory education.
Evaluate the performance of candidate ${student.fullName} (Class: ${student.classGrade}, Admission No: ${student.admissionNumber}).

Academic Profile Data:
- Evaluated Subjects: ${JSON.stringify(subjectAverages)}
- Continuous Assessment & CBT records: ${caRecords.length} broad sheet records, ${submissions.length} exam submissions.
- Overall Average: ${overallAvg}%

Respond strictly in valid JSON with this exact schema (no markdown formatting, no code ticks):
{
  "executiveSummary": "A concise, motivating 2-3 sentence overview of the student's academic standing.",
  "cgpaProjection": "Projected honors tier based on current grades (e.g. Distinction / First Class, Upper Credit).",
  "strengths": [
    { "subject": "Subject Name", "score": 85, "praise": "Specific reason why they excel here" }
  ],
  "weakAreas": [
    { "subject": "Subject Name", "score": 45, "remedy": "Specific pedagogical remediation step" }
  ],
  "dailyStudyPlan": [
    {
      "day": "Monday",
      "focusSubject": "Subject",
      "recommendedTopic": "Topic",
      "durationMinutes": 45,
      "activity": "Step-by-step revision task"
    }
  ],
  "examTips": [
    "Practical test-taking tip 1",
    "Practical test-taking tip 2",
    "Practical test-taking tip 3"
  ],
  "motivationalQuote": "An inspiring academic quote"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim()) as AiAcademicAdvice;
        return { ...parsed, isAiGenerated: true };
      }
    } catch (err) {
      console.warn('Gemini API query fallback to smart heuristic advisor:', err);
    }
  }

  // Smart Heuristic Advisor Fallback (always reliable, immediate, zero latency)
  const defaultStrengths = strongSubjects.length > 0
    ? strongSubjects.map(s => ({
        subject: s.subject,
        score: s.average,
        praise: `Consistently high comprehension demonstrated with an average of ${s.average}%. Excellent mastery of core curriculum foundations.`
      }))
    : [{ subject: 'Curriculum Foundations', score: 65, praise: 'Maintains steady participation and consistent completion of class assessments.' }];

  const defaultWeaknesses = weakSubjects.length > 0
    ? weakSubjects.map(s => ({
        subject: s.subject,
        score: s.average,
        remedy: `Current average is ${s.average}%. Schedule targeted 30-minute daily review sessions on difficult concepts and solve past test problems.`
      }))
    : [{ subject: 'Advanced Problem Solving', score: 58, remedy: 'Challenge yourself with higher-level examination papers to push from Credit to Distinction grade.' }];

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dailyStudyPlan = weekDays.map((day, idx) => {
    const targetSubject = subjectAverages[idx % Math.max(1, subjectAverages.length)]?.subject || 'Mathematics';
    return {
      day,
      focusSubject: targetSubject,
      recommendedTopic: idx % 2 === 0 ? 'Core Term Concepts & Definitions' : 'Past Examination Objective Questions',
      durationMinutes: 45,
      activity: idx % 2 === 0
        ? `Review lecture notes and create summary flashcards for ${targetSubject}.`
        : `Solve at least 15 timed multiple-choice practice questions on ${targetSubject}.`
    };
  });

  return {
    executiveSummary: overallAvg >= 70
      ? `${student.fullName} demonstrates commendable academic dedication in ${student.classGrade}, maintaining a strong ${overallAvg}% weighted average. With targeted refinement in secondary subjects, university honors standing is well within reach.`
      : `${student.fullName} is actively building academic foundations across ${student.classGrade} with a ${overallAvg}% cumulative average. By focusing daily revision on identified lower-scoring subjects, significant grade improvements will follow.`,
    cgpaProjection: overallAvg >= 75
      ? 'First Class Standing (Projected CGPA: 4.50 - 5.00)'
      : overallAvg >= 65
      ? 'Second Class Upper / Distinction Track (Projected CGPA: 3.50 - 4.40)'
      : overallAvg >= 50
      ? 'Second Class Lower / Credit Standing (Projected CGPA: 2.50 - 3.40)'
      : 'Remedial Track (Projected CGPA: 1.50 - 2.40)',
    strengths: defaultStrengths,
    weakAreas: defaultWeaknesses,
    dailyStudyPlan,
    examTips: [
      'Read every question stem completely before looking at multiple-choice options to avoid decoy distractors.',
      'Allocate time methodically: never spend more than 1 minute on any single objective question during CBT tests.',
      'Utilize process of elimination to discard visibly incorrect alternatives before selecting your final answer.',
      'Review all your answered questions during the final 5 minutes of each examination before clicking submit.'
    ],
    motivationalQuote: '“Excellence is not an act, but a habit. The consistency of your daily preparation determines the grandeur of your final grade.”',
    isAiGenerated: false
  };
}
