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
  status:
    | "CORRECT_INTERMEDIATE"
    | "CORRECT_FINAL"
    | "ERROR_DETECTED"
    | "WORKED_EXAMPLE";
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

export interface SavedProblemWorkspace {
  problem: MathProblem;
  fsmState: FSMState;
  notebookSteps: NotebookStepRecord[];
  chatMessages: ChatMessageRecord[];
  traces: HarnessTrace[];
  status: "NOT_STARTED" | "IN_PROGRESS" | "SOLVED" | "ASSISTED";
  hintsGivenCount: number;
  mistakesCount: number;
  updatedAt: string;
}

export interface ExerciseHistorySummary {
  problemId: string;
  equation: string;
  latex: string;
  topicId: string;
  topicTitle: string;
  isReinforcement?: boolean;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SOLVED" | "ASSISTED";
  stepsCount: number;
  hintsGivenCount: number;
  mistakesCount: number;
  updatedAt: string;
  notebookSteps: NotebookStepRecord[];
  tutorHints: Array<{
    id: string;
    hintLevel: number;
    errorTag?: ErrorCategory;
    content: string;
    timestamp: string;
  }>;
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
  problemWorkspaces: Record<string, Record<string, SavedProblemWorkspace>>;
  mistakes: Record<string, MistakeLogRecord[]>;
  skillMastery: Record<string, SkillMasteryRecord[]>;
  customProblems: Record<string, MathProblem[]>;
}

function createDefaultSkillMastery(
  isPreseededStudent = false
): SkillMasteryRecord[] {
  return CURRICULUM_RULES.map((rule, idx) => ({
    topicId: rule.id,
    topicTitle: rule.titleEn,
    errorCategory: rule.errorCategory,
    formulaLatex: rule.formulaLatex,
    masteryPercent: isPreseededStudent
      ? [78, 65, 85, 90][idx % 4]
      : [60, 75, 80, 85][idx % 4],
    solvedCount: isPreseededStudent
      ? [4, 3, 5, 6][idx % 4]
      : [1, 2, 2, 3][idx % 4],
    mistakesCount: isPreseededStudent
      ? [2, 2, 1, 0][idx % 4]
      : [0, 0, 0, 0][idx % 4],
    verifiedFollowUpsCount: isPreseededStudent
      ? [1, 1, 1, 0][idx % 4]
      : [0, 0, 0, 0][idx % 4],
  }));
}

export function createInitialChatForProblem(
  profileId: string,
  problem: MathProblem,
  fsmState: FSMState
): ChatMessageRecord[] {
  return [
    {
      id: `msg-init-${profileId}-${problem.id}-${Date.now()}`,
      role: "tutor",
      content: `Let's solve the linear equation **$${problem.equation}$**.\n\nWrite out your first algebraic step (or ask for a hint if you'd like guidance on how to start).`,
      timestamp: new Date().toISOString(),
      phaseBadge: fsmState.phase,
      hintLevel: 0,
    },
  ];
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
    chatMessages: createInitialChatForProblem(profileId, problem, fsmState),
    traces: [],
    completedProblemIds: [],
    assistedProblemIds: [],
  };
}

export function syncActiveSessionToWorkspaceHistory(
  db: DatabaseSchema,
  profileId: string
): void {
  const session = db.sessions[profileId];
  if (!session) return;

  if (!db.problemWorkspaces[profileId]) {
    db.problemWorkspaces[profileId] = {};
  }

  const pid = session.currentProblem.id;
  const isSolved = session.completedProblemIds.includes(pid);
  const isAssisted = session.assistedProblemIds.includes(pid);
  const hasStepsOrStudentMsgs =
    session.notebookSteps.length > 0 ||
    session.chatMessages.some((m) => m.role === "student");

  let status: SavedProblemWorkspace["status"] = "NOT_STARTED";
  if (isAssisted) {
    status = "ASSISTED";
  } else if (isSolved || session.fsmState.phase === "MASTERED") {
    status = "SOLVED";
  } else if (hasStepsOrStudentMsgs) {
    status = "IN_PROGRESS";
  }

  const hintsGivenCount = session.chatMessages.filter(
    (m) => m.role === "tutor" && ((m.hintLevel && m.hintLevel > 0) || m.phaseBadge === "WORKED_EXAMPLE")
  ).length;

  const mistakesCount = session.notebookSteps.filter(
    (s) => s.status === "ERROR_DETECTED"
  ).length;

  db.problemWorkspaces[profileId][pid] = {
    problem: session.currentProblem,
    fsmState: session.fsmState,
    notebookSteps: [...session.notebookSteps],
    chatMessages: [...session.chatMessages],
    traces: [...session.traces],
    status,
    hintsGivenCount,
    mistakesCount,
    updatedAt: new Date().toISOString(),
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

  // Pre-seed one completed exercise in student history so the History tab is rich on first view
  const seedSolvedProb = DEFAULT_PROBLEMS[2]; // 7x - 11 = 4x + 13
  const seedSolvedFsm = createInitialFSMState(seedSolvedProb);
  seedSolvedFsm.phase = "MASTERED";

  const db: DatabaseSchema = {
    profiles: [reviewerProfile, studentProfile],
    sessions: {
      [reviewerProfile.id]: reviewerSession,
      [studentProfile.id]: studentSession,
    },
    problemWorkspaces: {
      [reviewerProfile.id]: {},
      [studentProfile.id]: {
        [seedSolvedProb.id]: {
          problem: seedSolvedProb,
          fsmState: seedSolvedFsm,
          notebookSteps: [
            {
              id: "seed-step-1",
              stepNumber: 1,
              problemId: seedSolvedProb.id,
              problemEquation: seedSolvedProb.equation,
              rawInput: "3x = 24",
              expressionLatex: "3x = 24",
              status: "CORRECT_INTERMEDIATE",
              errorCategory: "NONE",
              diagnosticNote:
                'Step "3x = 24" is algebraically equivalent to the target equation (root x = 8 preserved).',
              timestamp: now,
            },
            {
              id: "seed-step-2",
              stepNumber: 2,
              problemId: seedSolvedProb.id,
              problemEquation: seedSolvedProb.equation,
              rawInput: "x = 8",
              expressionLatex: "x = 8",
              status: "CORRECT_FINAL",
              errorCategory: "NONE",
              diagnosticNote: "Student correctly found the final root: x = 8.",
              timestamp: now,
            },
          ],
          chatMessages: [
            {
              id: "seed-msg-1",
              role: "tutor",
              content: `Let's solve the linear equation **$${seedSolvedProb.equation}$**.`,
              timestamp: now,
              phaseBadge: "SOLVING",
              hintLevel: 0,
            },
            {
              id: "seed-msg-2",
              role: "student",
              content: "3x = 24",
              timestamp: now,
            },
            {
              id: "seed-msg-3",
              role: "tutor",
              content:
                "Good step! **$3x = 24$** is algebraically equivalent. What is your next step to isolate $x$?",
              timestamp: now,
              phaseBadge: "SOLVING",
              hintLevel: 0,
            },
            {
              id: "seed-msg-4",
              role: "student",
              content: "x = 8",
              timestamp: now,
            },
            {
              id: "seed-msg-5",
              role: "tutor",
              content:
                "Spot on! **$x = 8$** — a flawless solution on the first attempt! 🏆",
              timestamp: now,
              phaseBadge: "MASTERED",
              hintLevel: 0,
            },
          ],
          traces: [],
          status: "SOLVED",
          hintsGivenCount: 0,
          mistakesCount: 0,
          updatedAt: now,
        },
      },
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
          ruleTitle:
            ruleDist?.titleEn ?? "Distributive Property of Multiplication",
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

  syncActiveSessionToWorkspaceHistory(db, reviewerProfile.id);
  syncActiveSessionToWorkspaceHistory(db, studentProfile.id);
  return db;
}

let memoryDb: DatabaseSchema | null = null;

function resolveDbFilePath(): string {
  const localDataDir = path.join(process.cwd(), ".data");
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    return path.join(localDataDir, "tutor-store-v3.json");
  } catch {
    return path.join("/tmp", "ai-math-tutor-store-v3.json");
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
      if (
        parsed &&
        Array.isArray(parsed.profiles) &&
        parsed.problemWorkspaces
      ) {
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
  if (!db.problemWorkspaces) {
    db.problemWorkspaces = {};
  }
  if (!db.problemWorkspaces[pid]) {
    db.problemWorkspaces[pid] = {};
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

  syncActiveSessionToWorkspaceHistory(db, pid);

  const session = db.sessions[pid];
  const mistakes = db.mistakes[pid];
  const skillMastery = db.skillMastery[pid];
  const availableProblems = [
    ...DEFAULT_PROBLEMS,
    ...(db.customProblems[pid] ?? []),
  ];

  // Build map of problem statuses & full exerciseHistory list
  const workspacesMap = db.problemWorkspaces[pid] ?? {};
  const problemStatusMap: Record<
    string,
    "NOT_STARTED" | "IN_PROGRESS" | "SOLVED" | "ASSISTED"
  > = {};

  for (const prob of availableProblems) {
    const ws = workspacesMap[prob.id];
    problemStatusMap[prob.id] = ws ? ws.status : "NOT_STARTED";
  }

  const exerciseHistory: ExerciseHistorySummary[] = Object.values(workspacesMap)
    .filter(
      (ws) =>
        ws.status !== "NOT_STARTED" ||
        ws.notebookSteps.length > 0 ||
        ws.chatMessages.length > 1
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .map((ws) => ({
      problemId: ws.problem.id,
      equation: ws.problem.equation,
      latex: ws.problem.latex,
      topicId: ws.problem.topicId,
      topicTitle: ws.problem.topicTitle,
      isReinforcement: ws.problem.isReinforcement,
      status: ws.status,
      stepsCount: ws.notebookSteps.length,
      hintsGivenCount: ws.hintsGivenCount,
      mistakesCount: ws.mistakesCount,
      updatedAt: ws.updatedAt,
      notebookSteps: ws.notebookSteps,
      tutorHints: ws.chatMessages
        .filter(
          (m) =>
            m.role === "tutor" &&
            ((m.hintLevel && m.hintLevel > 0) ||
              m.phaseBadge === "WORKED_EXAMPLE")
        )
        .map((m) => ({
          id: m.id,
          hintLevel: m.hintLevel ?? 1,
          errorTag: m.errorTag,
          content: m.content,
          timestamp: m.timestamp,
        })),
    }));

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
    problemStatusMap,
    exerciseHistory,
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

/**
 * Switches to a problem, restoring its saved steps & chat history if the student already worked on it!
 */
export function switchOrRestoreProblem(
  profileId: string,
  problem: MathProblem
) {
  const { db, profile } = getOrInitProfileState(profileId);
  syncActiveSessionToWorkspaceHistory(db, profile.id);

  const existingSession = db.sessions[profile.id];
  const savedWs = db.problemWorkspaces[profile.id]?.[problem.id];

  if (savedWs && (savedWs.notebookSteps.length > 0 || savedWs.chatMessages.length > 1)) {
    db.sessions[profile.id] = {
      profileId: profile.id,
      currentProblem: savedWs.problem,
      fsmState: savedWs.fsmState,
      notebookSteps: [...savedWs.notebookSteps],
      chatMessages: [...savedWs.chatMessages],
      traces: [...savedWs.traces],
      completedProblemIds: existingSession?.completedProblemIds ?? [],
      assistedProblemIds: existingSession?.assistedProblemIds ?? [],
    };
  } else {
    const freshSession = createInitialSessionForProfile(profile.id, problem);
    if (existingSession) {
      freshSession.completedProblemIds = existingSession.completedProblemIds;
      freshSession.assistedProblemIds = existingSession.assistedProblemIds;
    }
    db.sessions[profile.id] = freshSession;
  }

  syncActiveSessionToWorkspaceHistory(db, profile.id);
  saveDatabase(db);
  return getOrInitProfileState(profile.id);
}

/**
 * Forces a clean reset of a specific problem from scratch.
 */
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
  syncActiveSessionToWorkspaceHistory(db, profile.id);
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
  db.problemWorkspaces[id] = {};
  db.mistakes[id] = [];
  db.skillMastery[id] = createDefaultSkillMastery(false);
  db.customProblems[id] = [];
  syncActiveSessionToWorkspaceHistory(db, id);
  saveDatabase(db);
  return newProfile;
}
