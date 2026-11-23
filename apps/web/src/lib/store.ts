import fs from "node:fs";
import path from "node:path";
import {
  CURRICULUM_RULES,
  DEFAULT_PROBLEMS,
  createInitialFSMState,
  getTestScenarioProblem,
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
  operationSummary?: string;
  tutorComment?: string;
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
  totalCount: number;
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
  pendingFollowUpProblem?: MathProblem | null;
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

export function createZeroSkillMastery(): SkillMasteryRecord[] {
  return CURRICULUM_RULES.map((rule) => {
    const defaultTotal = DEFAULT_PROBLEMS.filter(
      (p) => p.topicId === rule.id
    ).length;
    return {
      topicId: rule.id,
      topicTitle: rule.titleEn,
      errorCategory: rule.errorCategory,
      formulaLatex: rule.formulaLatex,
      masteryPercent: 0,
      solvedCount: 0,
      totalCount: defaultTotal || 4,
      mistakesCount: 0,
      verifiedFollowUpsCount: 0,
    };
  });
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
    pendingFollowUpProblem: null,
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
    (m) =>
      m.role === "tutor" &&
      ((m.hintLevel && m.hintLevel > 0) || m.phaseBadge === "WORKED_EXAMPLE")
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

/**
 * Deterministically recomputes SkillMastery records from the actual workspace history and mistakes log,
 * guaranteeing that progress is 0% when nothing has been solved and updates accurately on Reset.
 */
export function recomputeProfileSkillMastery(
  db: DatabaseSchema,
  profileId: string
): SkillMasteryRecord[] {
  const workspaces = Object.values(db.problemWorkspaces[profileId] ?? {});
  const mistakes = db.mistakes[profileId] ?? [];
  const allProblems = [
    ...DEFAULT_PROBLEMS,
    ...(db.customProblems[profileId] ?? []),
  ];

  const records = CURRICULUM_RULES.map((rule) => {
    const topicProblems = allProblems.filter((p) => p.topicId === rule.id);
    const totalCount = Math.max(1, topicProblems.length);

    const matchingSolved = workspaces.filter(
      (ws) => ws.status === "SOLVED" && ws.problem.topicId === rule.id
    );
    const solvedCount = matchingSolved.length;
    const verifiedFollowUpsCount = matchingSolved.filter(
      (ws) => ws.problem.isReinforcement
    ).length;
    const mistakesCount = mistakes.filter(
      (m) => m.errorCategory === rule.errorCategory
    ).length;

    // Exact proportion of solved exercises out of all available exercises in this topic (e.g. 2/12 = 17%)
    const masteryPercent =
      solvedCount === 0
        ? 0
        : Math.min(100, Math.round((solvedCount / totalCount) * 100));

    return {
      topicId: rule.id,
      topicTitle: rule.titleEn,
      errorCategory: rule.errorCategory,
      formulaLatex: rule.formulaLatex,
      masteryPercent,
      solvedCount,
      totalCount,
      mistakesCount,
      verifiedFollowUpsCount,
    };
  });

  db.skillMastery[profileId] = records;
  return records;
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

  const db: DatabaseSchema = {
    profiles: [reviewerProfile, studentProfile],
    sessions: {
      [reviewerProfile.id]: reviewerSession,
      [studentProfile.id]: studentSession,
    },
    problemWorkspaces: {
      [reviewerProfile.id]: {},
      [studentProfile.id]: {},
    },
    mistakes: {
      [reviewerProfile.id]: [],
      [studentProfile.id]: [],
    },
    skillMastery: {
      [reviewerProfile.id]: createZeroSkillMastery(),
      [studentProfile.id]: createZeroSkillMastery(),
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
    return path.join(localDataDir, "tutor-store-v6.json");
  } catch {
    return path.join("/tmp", "ai-math-tutor-store-v6.json");
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
  if (!db.customProblems[pid]) {
    db.customProblems[pid] = [];
  }

  syncActiveSessionToWorkspaceHistory(db, pid);
  const skillMastery = recomputeProfileSkillMastery(db, pid);

  const session = db.sessions[pid];
  const mistakes = db.mistakes[pid];
  const availableProblems = [
    ...DEFAULT_PROBLEMS,
    ...(db.customProblems[pid] ?? []),
  ];

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
        ws.chatMessages.some((m) => m.role === "student")
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
  const totalProblemsCount = availableProblems.length;
  const assistedProblemsCount = session.assistedProblemIds.length;
  const totalMistakesCount = mistakes.length;
  const resolvedMistakesCount = mistakes.filter(
    (m) => m.status === "CORRECTED" || m.status === "VERIFIED_BY_FOLLOWUP"
  ).length;
  const verifiedMistakesCount = mistakes.filter(
    (m) => m.status === "VERIFIED_BY_FOLLOWUP"
  ).length;

  const overallMasteryPercent =
    completedProblemsCount === 0 || totalProblemsCount === 0
      ? 0
      : Math.min(
          100,
          Math.round((completedProblemsCount / totalProblemsCount) * 100)
        );

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
      totalProblemsCount,
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

export function switchOrRestoreProblem(
  profileId: string,
  problem: MathProblem
) {
  const { db, profile } = getOrInitProfileState(profileId);
  syncActiveSessionToWorkspaceHistory(db, profile.id);

  const existingSession = db.sessions[profile.id];
  const savedWs = db.problemWorkspaces[profile.id]?.[problem.id];

  if (
    savedWs &&
    (savedWs.notebookSteps.length > 0 ||
      savedWs.chatMessages.some((m) => m.role === "student"))
  ) {
    db.sessions[profile.id] = {
      profileId: profile.id,
      currentProblem: savedWs.problem,
      pendingFollowUpProblem: null,
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
  recomputeProfileSkillMastery(db, profile.id);
  saveDatabase(db);
  return getOrInitProfileState(profile.id);
}

/**
 * Forces a clean reset of the specified problem, clearing its solved/assisted status and steps.
 */
export function resetSessionProblem(
  profileId: string,
  problem: MathProblem = getTestScenarioProblem()
) {
  const { db, profile } = getOrInitProfileState(profileId);
  const existingSession = db.sessions[profile.id];
  const freshSession = createInitialSessionForProfile(profile.id, problem);

  if (existingSession) {
    // Remove this problem from completed and assisted lists so its badge resets to NOT_STARTED
    freshSession.completedProblemIds =
      existingSession.completedProblemIds.filter((id) => id !== problem.id);
    freshSession.assistedProblemIds =
      existingSession.assistedProblemIds.filter((id) => id !== problem.id);
  }

  // Also clear mistakes recorded for this specific problem on reset
  if (db.mistakes[profile.id]) {
    db.mistakes[profile.id] = db.mistakes[profile.id].filter(
      (m) => m.problemId !== problem.id
    );
  }

  db.sessions[profile.id] = freshSession;
  syncActiveSessionToWorkspaceHistory(db, profile.id);
  recomputeProfileSkillMastery(db, profile.id);
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
  db.skillMastery[id] = createZeroSkillMastery();
  db.customProblems[id] = [];
  syncActiveSessionToWorkspaceHistory(db, id);
  saveDatabase(db);
  return newProfile;
}
