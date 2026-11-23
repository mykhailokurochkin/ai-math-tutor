import fs from "node:fs";
import path from "node:path";
import {
  CURRICULUM_RULES,
  DEFAULT_PROBLEMS,
  createInitialFSMState,
  getTestScenarioProblem,
  lookupCurriculumRule,
  type ErrorCategory,
  type FSMState,
  type HarnessTrace,
  type MathProblem,
} from "@ai-math-tutor/tutor-harness";

export type UserRole = "reviewer" | "student";

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  grade: string;
  avatarBadge: string;
  createdAt: string;
}

export interface NotebookStepRecord {
  id: string;
  stepNumber: number;
  problemId: string;
  problemEquation: string;
  rawInput: string;
  expressionLatex: string;
  status: "CORRECT_INTERMEDIATE" | "CORRECT_FINAL" | "ERROR_DETECTED" | "WORKED_EXAMPLE";
  errorCategory: ErrorCategory;
  diagnosticNote: string;
  timestamp: string;
}

export interface ChatMessageRecord {
  id: string;
  role: "student" | "tutor" | "system";
  content: string;
  timestamp: string;
  phaseBadge?: string;
  hintLevel?: number;
  errorTag?: ErrorCategory;
}

export interface MistakeLogRecord {
  id: string;
  profileId: string;
  problemId: string;
  problemEquation: string;
  studentWrongStep: string;
  errorCategory: ErrorCategory;
  ruleTitle: string;
  diagnosticSummary: string;
  status: "OPEN" | "CORRECTED" | "VERIFIED_BY_FOLLOWUP";
  timestamp: string;
}

export interface SkillMasteryRecord {
  topicId: string;
  topicTitle: string;
  errorCategory: ErrorCategory;
  formulaLatex: string;
  masteryPercent: number;
  solvedCount: number;
  mistakesCount: number;
  verifiedFollowUpsCount: number;
}

export interface ActiveSessionRecord {
  profileId: string;
  currentProblem: MathProblem;
  fsmState: FSMState;
  notebookSteps: NotebookStepRecord[];
  chatMessages: ChatMessageRecord[];
  traces: HarnessTrace[];
  completedProblemIds: string[];
  assistedProblemIds: string[];
}

export interface DatabaseSchema {
  profiles: UserProfile[];
  sessions: Record<string, ActiveSessionRecord>;
  mistakes: Record<string, MistakeLogRecord[]>;
  skillMastery: Record<string, SkillMasteryRecord[]>;
  customProblems: Record<string, MathProblem[]>;
}

function createDefaultSkillMastery(isPreseededStudent = false): SkillMasteryRecord[] {
  return CURRICULUM_RULES.map((rule, idx) => ({
    topicId: rule.id,
    topicTitle: rule.titleEn,
    errorCategory: rule.errorCategory,
    formulaLatex: rule.formulaLatex,
    masteryPercent: isPreseededStudent ? [78, 65, 85, 90][idx % 4] : [60, 75, 80, 85][idx % 4],
    solvedCount: isPreseededStudent ? [4, 3, 5, 6][idx % 4] : [1, 2, 2, 3][idx % 4],
    mistakesCount: isPreseededStudent ? [2, 2, 1, 0][idx % 4] : [0, 0, 0, 0][idx % 4],
    verifiedFollowUpsCount: isPreseededStudent ? [1, 1, 1, 0][idx % 4] : [0, 0, 0, 0][idx % 4],
  }));
}

function createInitialSessionForProfile(
  profileId: string,
  problem: MathProblem = getTestScenarioProblem()
): ActiveSessionRecord {
  const fsmState = createInitialFSMState(problem);
  return {
    profileId,
    currentProblem: problem,
    fsmState,
    notebookSteps: [],
    chatMessages: [
      {
        id: `msg-init-${profileId}-${Date.now()}`,
        role: "tutor",
        content: `Let's solve the linear equation **$${problem.equation}$**.\n\nLook at the left side of the equation: what is your first step to expand the parentheses? Write out your next equation step.`,
        timestamp: new Date().toISOString(),
        phaseBadge: fsmState.phase,
        hintLevel: 0,
      },
    ],
    traces: [],
    completedProblemIds: [],
    assistedProblemIds: [],
  };
}

function buildSeedDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  const reviewerProfile: UserProfile = {
    id: "reviewer",
    name: "Reviewer",
    role: "reviewer",
    grade: "Evaluator Mode",
    avatarBadge: "R",
    createdAt: now,
  };

  const studentProfile: UserProfile = {
    id: "student-default",
    name: "Student",
    role: "student",
    grade: "Algebra Curriculum",
    avatarBadge: "S",
    createdAt: now,
  };

  const reviewerSession = createInitialSessionForProfile(
    reviewerProfile.id,
    getTestScenarioProblem()
  );

  const studentSession = createInitialSessionForProfile(
    studentProfile.id,
    getTestScenarioProblem()
  );
  studentSession.completedProblemIds = ["prob-transposition-1"];

  const ruleDist = lookupCurriculumRule("DISTRIBUTIVE_PROPERTY");

  return {
    profiles: [reviewerProfile, studentProfile],
    sessions: {
      [reviewerProfile.id]: reviewerSession,
      [studentProfile.id]: studentSession,
    },
    mistakes: {
      [reviewerProfile.id]: [],
      [studentProfile.id]: [
        {
          id: "mistake-seed-1",
          profileId: studentProfile.id,
          problemId: "prob-brackets-2",
          problemEquation: "5(x - 2) = 3x + 4",
          studentWrongStep: "5x - 2 = 3x + 4",
          errorCategory: "DISTRIBUTIVE_PROPERTY",
          ruleTitle: ruleDist?.titleEn ?? "Distributive Property of Multiplication",
          diagnosticSummary:
            "Multiplier 5 was not applied to the second term (-2) when expanding parentheses.",
          status: "VERIFIED_BY_FOLLOWUP",
          timestamp: now,
        },
      ],
    },
    skillMastery: {
      [reviewerProfile.id]: createDefaultSkillMastery(false),
      [studentProfile.id]: createDefaultSkillMastery(true),
    },
    customProblems: {
      [reviewerProfile.id]: [],
      [studentProfile.id]: [],
    },
  };
}

let memoryDb: DatabaseSchema | null = null;

function resolveDbFilePath(): string {
  const localDataDir = path.join(process.cwd(), ".data");
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    return path.join(localDataDir, "tutor-store-v2.json");
  } catch {
    return path.join("/tmp", "ai-math-tutor-store-v2.json");
  }
}

export function loadDatabase(): DatabaseSchema {
  if (memoryDb) {
    return memoryDb;
  }

  const filePath = resolveDbFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.profiles)) {
        memoryDb = parsed;
        return memoryDb;
      }
    }
  } catch {
    // Fallback to seed DB
  }

  memoryDb = buildSeedDatabase();
  saveDatabase(memoryDb);
  return memoryDb;
}

export function saveDatabase(db: DatabaseSchema): void {
  memoryDb = db;
  const filePath = resolveDbFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // Ignore on read-only serverless environment
  }
}

export function getOrInitProfileState(profileId: string) {
  const db = loadDatabase();
  let profile = db.profiles.find((p) => p.id === profileId);
  if (!profile) {
    profile = db.profiles[0];
  }

  const pid = profile.id;
  if (!db.sessions[pid]) {
    db.sessions[pid] = createInitialSessionForProfile(pid);
  }
  if (!db.mistakes[pid]) {
    db.mistakes[pid] = [];
  }
  if (!db.skillMastery[pid]) {
    db.skillMastery[pid] = createDefaultSkillMastery(false);
  }
  if (!db.customProblems[pid]) {
    db.customProblems[pid] = [];
  }

  const session = db.sessions[pid];
  const mistakes = db.mistakes[pid];
  const skillMastery = db.skillMastery[pid];
  const availableProblems = [
    ...(db.customProblems[pid] ?? []),
    ...DEFAULT_PROBLEMS,
  ];

  const completedProblemsCount = session.completedProblemIds.length;
  const assistedProblemsCount = session.assistedProblemIds.length;
  const totalMistakesCount = mistakes.length;
  const resolvedMistakesCount = mistakes.filter(
    (m) => m.status === "CORRECTED" || m.status === "VERIFIED_BY_FOLLOWUP"
  ).length;
  const verifiedMistakesCount = mistakes.filter(
    (m) => m.status === "VERIFIED_BY_FOLLOWUP"
  ).length;

  const overallMasteryPercent =
    skillMastery.length > 0
      ? Math.round(
          skillMastery.reduce((acc, s) => acc + s.masteryPercent, 0) /
            skillMastery.length
        )
      : 0;

  return {
    db,
    profile,
    profiles: db.profiles,
    session,
    availableProblems,
    progress: {
      completedProblemsCount,
      assistedProblemsCount,
      totalMistakesCount,
      resolvedMistakesCount,
      verifiedMistakesCount,
      overallMasteryPercent,
      mistakesLog: mistakes,
      skillMastery,
    },
  };
}

export function resetSessionProblem(
  profileId: string,
  problem: MathProblem = getTestScenarioProblem()
) {
  const { db, profile } = getOrInitProfileState(profileId);
  const existingSession = db.sessions[profile.id];
  const freshSession = createInitialSessionForProfile(profile.id, problem);
  if (existingSession) {
    freshSession.completedProblemIds = existingSession.completedProblemIds;
    freshSession.assistedProblemIds = existingSession.assistedProblemIds;
  }
  db.sessions[profile.id] = freshSession;
  saveDatabase(db);
  return getOrInitProfileState(profile.id);
}

export function createNewProfile(
  name: string,
  grade = "Grade 7 Algebra · Classical USSR Curriculum",
  role: UserRole = "student"
): UserProfile {
  const db = loadDatabase();
  const id = `student-${Date.now().toString(36)}`;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "ST";

  const newProfile: UserProfile = {
    id,
    name: name.trim() || "New Student",
    role,
    grade,
    avatarBadge: initials,
    createdAt: new Date().toISOString(),
  };

  db.profiles.push(newProfile);
  db.sessions[id] = createInitialSessionForProfile(id);
  db.mistakes[id] = [];
  db.skillMastery[id] = createDefaultSkillMastery(false);
  db.customProblems[id] = [];
  saveDatabase(db);
  return newProfile;
}
