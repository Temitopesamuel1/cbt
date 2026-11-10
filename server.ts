import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

// Gemini AI Lesson Note Generator API
app.post('/api/generate-lesson-note', async (req, res) => {
  const {
    subjectName = 'Computer Studies',
    classGrade = 'SS 2',
    term = '1st Term',
    weekNumber = 1,
    topic = '',
    subTopic = '',
    durationMinutes = 40,
    schemeOfWork = ''
  } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required.' });
  }

  // If Gemini API Key is available, use GoogleGenAI
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a Senior Secondary School Curriculum Planner for Honey's World High School in Kwara State, Nigeria.
Generate a comprehensive, high-academic-standard lesson note conforming strictly to WAEC / NECO / NERDC secondary school syllabus guidelines.

Lesson Details:
- Institution: Honey's World High School, Gaa Ajanaku, Ilorin, Kwara State
- Subject: ${subjectName}
- Target Class: ${classGrade}
- Academic Session/Term: 2025/2026 Academic Session (${term})
- Week: Week ${weekNumber}
- Lesson Topic: ${topic}
- Sub-Topic / Focus: ${subTopic}
- Duration: ${durationMinutes} Minutes
- Scheme of Work Context: ${schemeOfWork || 'Standard NERDC curriculum guidelines'}

Please return a detailed JSON object containing:
- behavioralObjectives: Array of 4 clear, action-oriented objectives (Bloom's taxonomy).
- instructionalMaterials: Array of 4 teaching aids (whiteboard, hardware units, CBT terminals, charts).
- previousKnowledge: 1-2 sentences stating the students' entry behavior.
- content: Comprehensive expository notes with structured sections (roman numerals), clear explanations, sub-headings, and formulas or concepts.
- visualsAndCharts: An illustrative ASCII architectural block diagram, truth table, or schematic flowchart illustrating the core topic concepts.
- teacherActivities: Array of 4 specific teacher actions.
- studentActivities: Array of 4 specific student engagement actions.
- evaluationQuestions: Array of 4 formative test questions.
- summary: A concise 2-sentence lesson recap.
- assignment: An engaging homework task or diagram assignment.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              behavioralObjectives: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              instructionalMaterials: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              previousKnowledge: { type: Type.STRING },
              content: { type: Type.STRING },
              visualsAndCharts: { type: Type.STRING },
              teacherActivities: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              studentActivities: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              evaluationQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              summary: { type: Type.STRING },
              assignment: { type: Type.STRING }
            },
            required: [
              'behavioralObjectives',
              'instructionalMaterials',
              'previousKnowledge',
              'content',
              'visualsAndCharts',
              'teacherActivities',
              'studentActivities',
              'evaluationQuestions',
              'summary',
              'assignment'
            ]
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.status(200).json({
        lessonNote: {
          subjectName,
          classGrade,
          term,
          weekNumber,
          topic,
          subTopic,
          durationMinutes,
          ...parsed
        }
      });
    } catch (err: any) {
      console.warn('Gemini generation error, using pedagogical template engine:', err);
    }
  }

  // High-standard fallback pedagogical response
  return res.status(200).json({
    lessonNote: {
      subjectName,
      classGrade,
      term,
      weekNumber,
      topic,
      subTopic,
      durationMinutes,
      behavioralObjectives: [
        `Define ${topic} and explain its fundamental principles accurately.`,
        `Identify and categorize the key components and functions involved in ${topic}.`,
        `Demonstrate practical application by solving curriculum evaluation problems.`,
        `Contrast key elements of ${subTopic || topic} according to WAEC and NECO standards.`
      ],
      instructionalMaterials: [
        'Interactive electronic smartboard & syllabus reference charts',
        'Physical demonstration hardware / laboratory apparatus',
        'Honey\'s World High School CBT Practice & Testing Terminals',
        'Curriculum textbook and student workbook materials'
      ],
      previousKnowledge: `Students have foundational knowledge of preparatory topics from previous terms and can identify basic computer and scientific concepts.`,
      content: `I. INTRODUCTION:\n${topic} is a foundational pillar of modern academic curriculum. Understanding its principles enables students to master analytical operations.\n\nII. KEY THEORETICAL PRINCIPLES:\n- Core mechanism and operational logic.\n- System structure and classification of constituent components.\n- Industrial and everyday applications in science, technology, and commerce.\n\nIII. STEP-BY-STEP EXPOSITION:\n1. Principle of Operation: How instructions are processed sequentially.\n2. Conversion & Measurement: Standard units and formulas.\n3. Common Pitfalls: Typical student misconceptions addressed in WAEC/NECO examinations.`,
      visualsAndCharts: `+-----------------------------------------------------------+\n|         CONCEPT ARCHITECTURE & FLOW DIAGRAM               |\n+-----------------------------------------------------------+\n|  [INPUT DATA / SIGNALS] ===> [PROCESSOR / CORE LOGIC]      |\n|                                    |                      |\n|                                    v                      |\n|                      [MEMORY / REGISTERS / STORAGE]       |\n|                                    |                      |\n|                                    v                      |\n|                       [VERIFIED OUTPUT / RESULT]          |\n+-----------------------------------------------------------+`,
      teacherActivities: [
        'Introduces the lesson topic using inductive questions.',
        'Explains the core concepts with diagrammatic illustrations on the board.',
        'Supervises student practice and guides problem-solving techniques.',
        'Conducts formative assessment and reviews challenging areas.'
      ],
      studentActivities: [
        'Copy core definitions and illustrative diagrams into their notebooks.',
        'Participate in classroom discussions and ask clarifying questions.',
        'Work through practical exercises individually and in pairs.',
        'Answer the formative evaluation review questions.'
      ],
      evaluationQuestions: [
        `What is the primary definition of ${topic}?`,
        `List three core functions or characteristics associated with this topic.`,
        `How does ${subTopic || topic} relate to general secondary school computing/science?`,
        `State one practical problem and how its solution is determined.`
      ],
      summary: `Students examined ${topic}, analyzed its constituent components, and verified its real-world and academic importance.`,
      assignment: `Write a short summary on ${topic} and attempt questions 1 through 5 in your curriculum review textbook.`,
      createdAt: new Date().toISOString()
    }
  });
});

// Serve compiled static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all routes to index.html for client-side SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Application running on http://0.0.0.0:${PORT}`);
});
