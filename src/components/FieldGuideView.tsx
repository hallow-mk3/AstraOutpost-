import React, { useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Search, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { CLASSROOM_PROMPTS, GLOSSARY_TERMS } from '../data/nasaDatasets';
import { soundFx } from '../utils/soundFx';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Why do NASA engineers store drinking water in walls around crew sleeping quarters?',
    options: [
      'It keeps the outer walls shiny',
      'Hydrogen atoms in water are great at blocking solar flare radiation',
      'It makes the habitat lighter to launch',
    ],
    correctIndex: 1,
    explanation:
      'Correct! Water is packed with hydrogen atoms, which absorb energetic protons from solar flares better than thin metal alone.',
  },
  {
    id: 'q2',
    question: 'If a Martian dust storm suddenly cuts solar power in half, why can you NOT ask Earth Control for instant help?',
    options: [
      'Radio waves take 8 to 40 minutes round-trip between Mars and Earth',
      'Mars has no radio receivers',
      'Sound does not travel through Martian air',
    ],
    correctIndex: 0,
    explanation:
      'Exactly right! Even at the speed of light (300,000 km/s), Mars is so far away that round-trip radio messages take many minutes.',
  },
  {
    id: 'q3',
    question: 'How does powering a Hydroponic Greenhouse help Life Support at the same time?',
    options: [
      'Plants absorb exhaled CO₂ and release fresh oxygen',
      'Plants create electrical battery power',
      'Plants block cosmic rays from space',
    ],
    correctIndex: 0,
    explanation:
      'Nice job! Just like NASA OSDR studies show, crops turn crew-exhaled CO₂ and water into edible food plus oxygen.',
  },
];

export const FieldGuideView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.plainDefinition.toLowerCase().includes(q) ||
        t.realNasaExample.toLowerCase().includes(q)
    );
  }, [query]);

  const answeredCount = Object.keys(answers).length;
  const correctCount = QUIZ_QUESTIONS.filter((q) => answers[q.id] === q.correctIndex).length;

  const handlePick = (qid: string, idx: number, correctIdx: number) => {
    if (idx === correctIdx) {
      soundFx.playTelemetryPing();
    } else {
      soundFx.playAlert();
    }
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  };

  return (
    <section className="space-y-8">
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 md:p-8">
        <p className="text-xs font-semibold text-[#2563EB]">
          Plain-Language Space Dictionary &amp; Classroom Guide
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">
          Junior Astronaut Field Guide
        </h1>
        <p className="text-sm text-[#334155] mt-2 max-w-2xl leading-relaxed">
          Look up space terms in plain language, test your mission readiness with a quick 3-question
          check, or explore classroom discussion prompts with family and teachers.
        </p>
      </div>

      {/* Glossary Cards with Search */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#2563EB]" aria-hidden="true" />
            Space Engineering Terms Explained
          </h2>

          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms (Sol, mSv, CME...)"
              aria-label="Search glossary terms"
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCE3EE] rounded-lg text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTerms.length === 0 ? (
            <div className="md:col-span-2 bg-white border border-[#DCE3EE] rounded-xl p-6 text-center text-xs text-[#64748B]">
              No matching terms found for "{query}". Try searching "Sol", "mSv", or "Radio".
            </div>
          ) : (
            filteredTerms.map((item) => (
              <div key={item.term} className="bg-white border border-[#DCE3EE] rounded-xl p-5 space-y-2.5">
                <h3 className="text-base font-bold text-[#0F172A]">{item.term}</h3>
                <p className="text-sm text-[#334155] leading-relaxed">{item.plainDefinition}</p>
                <div className="pt-2 border-t border-[#F1F5F9] space-y-1.5 text-xs">
                  <p className="text-[#0F172A]">
                    <span className="font-semibold text-[#2563EB]">Why It Matters:</span>{' '}
                    {item.whyItMatters}
                  </p>
                  <p className="text-[#475569]">
                    <span className="font-semibold text-[#059669]">Real NASA Mission Example:</span>{' '}
                    {item.realNasaExample}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Interactive 3-Question Readiness Check */}
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              Junior Commander Readiness Check
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Answered {answeredCount} of {QUIZ_QUESTIONS.length} · Score:{' '}
              <span className="font-mono font-semibold text-[#0F172A]">
                {correctCount}/{QUIZ_QUESTIONS.length}
              </span>
            </p>
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset Quiz
            </button>
          )}
        </div>

        <div className="space-y-4">
          {QUIZ_QUESTIONS.map((q, qIdx) => {
            const picked = answers[q.id];
            const hasPicked = picked !== undefined;
            const isCorrect = picked === q.correctIndex;
            return (
              <div key={q.id} className="p-4 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg space-y-3">
                <p className="text-sm font-bold text-[#0F172A]">
                  {qIdx + 1}. {q.question}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {q.options.map((opt, oIdx) => {
                    const selected = picked === oIdx;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handlePick(q.id, oIdx, q.correctIndex)}
                        className={`text-left p-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? oIdx === q.correctIndex
                              ? 'bg-[#ECFDF5] border-[#059669] text-[#065F46]'
                              : 'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B]'
                            : 'bg-white border-[#DCE3EE] text-[#334155] hover:bg-[#EFF6FF]'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {hasPicked && (
                  <p
                    className={`text-xs flex items-start gap-2 pt-1 ${
                      isCorrect ? 'text-[#059669]' : 'text-[#DC2626]'
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <span>
                      {isCorrect
                        ? q.explanation
                        : 'Not quite! Look closely at the Field Guide terms above and try another answer.'}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Classroom & Family Discussion Guide */}
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-6 h-6 text-[#2563EB] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              Teacher &amp; Family Discussion Prompts
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Use these questions after playing an 8-Sol mission together in a classroom or at home.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {CLASSROOM_PROMPTS.map((prompt) => (
            <div key={prompt.title} className="p-4 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-[#2563EB]">{prompt.concept}</p>
              <h3 className="text-sm font-bold text-[#0F172A]">{prompt.title}</h3>
              <p className="text-xs text-[#334155] leading-relaxed">{prompt.question}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
