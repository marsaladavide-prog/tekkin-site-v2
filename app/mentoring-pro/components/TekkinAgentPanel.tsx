"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";

type AgentTask = {
  task_id: string;
  label: string;
  project: string;
  status: "todo" | "doing" | "done";
  due_date?: string;
  priority?: "low" | "medium" | "high";
};

type AgentSection = {
  title: string;
  tasks: AgentTask[];
};

type AgentGanttItem = {
  project: string;
  task: string;
  status: "todo" | "doing" | "done";
  start: string; // "2025-11-21"
  end: string; // "2025-11-24"
};

type AgentFinanceEntry = {
  type: "income" | "expense";
  label: string;
  amount: number;
  category?: string;
};

type AgentFinance = {
  summary: string;
  entries: AgentFinanceEntry[];
};

type AgentOperation = {
  type: "update_task" | "create_task" | "update_project";
  match_by?: Record<string, string>;
  new_status?: "todo" | "doing" | "done";
  add_actual_hours?: number;
  comment?: string;
};

type AgentResponse = {
  summary: {
    headline: string;
    bullets: string[];
  };
  sections: AgentSection[];
  gantt: AgentGanttItem[];
  finance: AgentFinance;
  operations: AgentOperation[];
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
};

type Project = {
  id: string;
  name: string;
  type: "artist" | "client";
  status: string;
  priority: number;
};

type TaskSummary = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  actual_hours: number | null;
  priority: number | null;
};

const LOCAL_PROJECTS_KEY = "tekkin_projects_v1";
const LOCAL_TASKS_KEY = "tekkin_tasks_v1";
const LOCAL_UNSYNCED_KEY = "tekkin_tasks_unsynced_v1";

const quickPrompts = [
  "Riepiloga le priorita della settimana in 3 bullet",
  "Dammi il focus di domani su Tekkin Mentoring",
  "Controlla se sto trascurando attivita alte priorita",
  "Scrivi un follow up conciso per il cliente",
];

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function loadLocalProjects() {
  return readLocal<Project[]>(LOCAL_PROJECTS_KEY, []);
}

function persistProjects(list: Project[]) {
  saveLocal(LOCAL_PROJECTS_KEY, list);
}

function loadAllLocalTasks() {
  return readLocal<Record<string, TaskSummary[]>>(LOCAL_TASKS_KEY, {});
}

function loadLocalTasks(projectId: string) {
  const all = loadAllLocalTasks();
  return all[projectId] || [];
}

function persistTasks(projectId: string, tasks: TaskSummary[]) {
  const all = loadAllLocalTasks();
  all[projectId] = tasks;
  saveLocal(LOCAL_TASKS_KEY, all);
}

function removeLocalTasks(projectId: string) {
  const all = loadAllLocalTasks();
  if (all[projectId]) {
    delete all[projectId];
    saveLocal(LOCAL_TASKS_KEY, all);
  }
}

function loadUnsyncedProjects() {
  return readLocal<Record<string, boolean>>(LOCAL_UNSYNCED_KEY, {});
}

function markUnsynced(projectId: string, value: boolean) {
  const all = loadUnsyncedProjects();
  if (value) {
    all[projectId] = true;
  } else {
    delete all[projectId];
  }
  saveLocal(LOCAL_UNSYNCED_KEY, all);
}

// layout semplificato per il Gantt
function buildGanttLayout(items: AgentGanttItem[]) {
  if (!items.length) return [];

  const toDate = (d: string) => new Date(d + "T00:00:00");

  const starts = items.map((i) => toDate(i.start).getTime());
  const ends = items.map((i) => toDate(i.end).getTime());

  const minStart = Math.min(...starts);
  const maxEnd = Math.max(...ends);
  const totalSpan = Math.max(maxEnd - minStart, 1);

  return items.map((i) => {
    const start = toDate(i.start).getTime();
    const end = toDate(i.end).getTime();
    const duration = Math.max(end - start, 1);

    const offsetPct = ((start - minStart) / totalSpan) * 100;
    const widthPct = (duration / totalSpan) * 100;

    return {
      ...i,
      offsetPct,
      widthPct,
    };
  });
}

// utility per rendere leggibili le date su card e tabelle
function formatDateShort(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
  });
}

type PanelView = "chat" | "planner" | "calendar";

export default function TekkinAgentPanel({ view }: { view?: PanelView }) {
  const taskGridClass =
    "grid grid-cols-[minmax(230px,1.25fr)_minmax(150px,0.9fr)_minmax(110px,0.75fr)_140px_140px_80px]";
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "Ciao, sono Tekkin Agent. Dimmi su cosa hai lavorato oggi e ti preparo il piano operativo.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  // stato planner veloce
  const [projects, setProjects] = useState<Project[]>([]);
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const [showNewTaskRow, setShowNewTaskRow] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);

  const upcomingTasks = useMemo(() => {
    const withDue = tasks
      .filter((t) => !!t.due_date)
      .map((t) => ({
        ...t,
        dueNumeric: t.due_date ? new Date(t.due_date).getTime() : Infinity,
      }))
      .sort((a, b) => a.dueNumeric - b.dueNumeric)
      .slice(0, 5);
    return withDue;
  }, [tasks]);
  const [unsyncedProjects, setUnsyncedProjects] = useState<Record<string, boolean>>(
    loadUnsyncedProjects()
  );

  const showChat = !view || view === "chat";
  const showPlanner = !view || view === "planner";
  const showCalendar = !view || view === "calendar";
  const showDashboard = !view; // dashboard solo in vista completa
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "project" | "task";
    id: string;
    label: string;
  } | null>(null);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState<"artist" | "client">(
    "artist"
  );
  const [newProjectPriority, setNewProjectPriority] = useState(5);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<"todo" | "doing" | "done">(
    "todo"
  );
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState(5);
  const resetNewTaskFields = () => {
    setNewTaskTitle("");
    setNewTaskStatus("todo");
    setNewTaskDueDate("");
    setNewTaskPriority(5);
  };

  const normalizeTask = (task: any): TaskSummary => ({
    id: task?.id,
    title: task?.title,
    status: task?.status,
    start_date: task?.start_date ?? null,
    due_date: task?.due_date ?? null,
    actual_hours:
      task?.actual_hours === null || task?.actual_hours === undefined
        ? null
        : task.actual_hours,
    priority: Number.isFinite(Number(task?.priority))
      ? Number(task.priority)
      : 5,
  });

  const lastAnswer = useMemo(() => {
    if (agentData) {
      return [
        agentData.summary.headline,
        ...agentData.summary.bullets,
      ].join(" · ");
    }
    return messages.filter((m) => m.role === "agent").at(-1)?.content ?? "";
  }, [agentData, messages]);

  // carica progetti on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/agent-dm/projects");
        if (!res.ok) {
          console.warn("API progetti non disponibile, uso cache locale");
          const local = loadLocalProjects();
          setProjects(local);
          if (!selectedProjectId && local.length > 0) {
            setSelectedProjectId(local[0].id);
          }
          return;
        }
        const data = await res.json();
        const list: Project[] = data.projects || [];
        setProjects(list);
        persistProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      } catch (err) {
        const local = loadLocalProjects();
        if (local.length > 0) {
          setProjects(local);
          if (!selectedProjectId) {
            setSelectedProjectId(local[0].id);
          }
        }
        console.warn("Errore caricamento progetti (uso cache locale se presente):", err);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [selectedProjectId]);

  // carica tasks quando cambia project selezionato
  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }
    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const res = await fetch(
          `/api/agent-dm/tasks?projectId=${encodeURIComponent(selectedProjectId)}`
        );
        if (!res.ok) {
          console.warn("API tasks non disponibile, uso cache locale");
          const local = loadLocalTasks(selectedProjectId);
          setTasks(local.map(normalizeTask));
          return;
        }
        const data = await res.json();
        const list: TaskSummary[] = (data.tasks || []).map(normalizeTask);
        // se ci sono modifiche non sincronizzate, teniamo la cache locale
        const hasUnsynced = unsyncedProjects[selectedProjectId];
        if (hasUnsynced) {
          const local = loadLocalTasks(selectedProjectId).map(normalizeTask);
          setTasks(local);
          persistTasks(selectedProjectId, local);
        } else {
          setTasks(list);
          persistTasks(selectedProjectId, list);
        }
      } catch (err) {
        const local = loadLocalTasks(selectedProjectId);
        setTasks(local.map(normalizeTask));
        console.warn("Errore caricamento tasks (uso cache locale se presente):", err);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchTasks();
  }, [selectedProjectId, unsyncedProjects]);

  const send = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text) return;
    setInput("");
    setLoading(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch("/api/tekkin-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const raw = await res.text();
      let outer: any = null;
      let agentJson: any = null;
      let content: string;

      // 1) parse livello esterno
      try {
        outer = raw ? JSON.parse(raw) : null;
      } catch {
        outer = null;
      }

      // 2) caso A: la risposta è già l'oggetto dell'agente
      if (
        outer &&
        typeof outer === "object" &&
        outer.summary &&
        outer.sections &&
        outer.gantt &&
        outer.finance
      ) {
        agentJson = outer;
      }

      // 3) caso B: la risposta è tipo { content: "....json..." }
      if (!agentJson && outer && typeof outer.content === "string") {
        try {
          const inner = JSON.parse(outer.content);
          if (
            inner &&
            inner.summary &&
            inner.sections &&
            inner.gantt &&
            inner.finance
          ) {
            agentJson = inner;
          }
        } catch {
          // content non è JSON valido, lo useremo come testo semplice
        }
      }

      if (agentJson) {
        const agentResp = agentJson as AgentResponse;
        setAgentData(agentResp);
        // quello che finisce in chat è solo la headline
        content = agentResp.summary.headline;
      } else {
        // fallback: testo libero o errore
        content =
          outer?.content ||
          outer?.error ||
          (raw && res.ok && raw) ||
          (!res.ok ? `Errore API (${res.status})` : "Nessuna risposta.");
      }

      const reply: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content,
      };
      setMessages((prev) => [...prev, reply]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: "Errore nella chiamata all'agente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };


  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/agent-dm/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: newProjectType,
          priority: newProjectPriority,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn("Errore backend creazione progetto, salvo in locale:", txt);
        throw new Error("local-fallback-project");
      }

      const data = await res.json();
      const created: Project = data.project;
      setProjects((prev) => {
        const list = [...prev, created];
        persistProjects(list);
        return list;
      });
      setSelectedProjectId(created.id);
      setNewProjectName("");
    } catch (err) {
      console.warn(err);
      const fallback: Project = {
        id:
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}`),
        name,
        type: newProjectType,
        status: "active",
        priority: newProjectPriority,
      };
      setProjects((prev) => {
        const list = [...prev, fallback];
        persistProjects(list);
        return list;
      });
      setSelectedProjectId(fallback.id);
      setNewProjectName("");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateTask = async () => {
    if (!selectedProjectId) return;
    const title = newTaskTitle.trim();
    if (!title) return;

    setCreatingTask(true);
    try {
      const res = await fetch("/api/agent-dm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          title,
          status: newTaskStatus,
          due_date: newTaskDueDate || null,
          priority: newTaskPriority,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn("Errore backend creazione task, salvo in locale:", txt);
        throw new Error("local-fallback-task");
      }
      const data = await res.json();
      const created: TaskSummary = normalizeTask(data.task);
      setTasks((prev) => {
        const list = [...prev, created];
        persistTasks(selectedProjectId, list);
        return list;
      });
      resetNewTaskFields();
      setShowNewTaskRow(false);
    } catch (err) {
      console.warn("Errore creazione task:", err);
      const fallback: TaskSummary = {
        id:
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}`),
        title,
        status: newTaskStatus,
        start_date: null,
        due_date: newTaskDueDate || null,
        actual_hours: null,
        priority: newTaskPriority,
      };
      setTasks((prev) => {
        const list = [...prev, fallback];
        persistTasks(selectedProjectId, list);
        return list;
      });
      resetNewTaskFields();
      setShowNewTaskRow(false);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    updates: Partial<
      Pick<
        TaskSummary,
        "start_date" | "due_date" | "status" | "priority" | "title"
      >
    >
  ) => {
    if (!selectedProjectId) return;
    setUpdatingTaskId(taskId);
    const optimisticUpdates = (t: TaskSummary) =>
      t.id === taskId ? { ...t, ...updates } : t;
    setTasks((prev) => {
      const list = prev.map(optimisticUpdates);
      persistTasks(selectedProjectId, list);
      return list;
    });

    try {
      const payload: Record<string, any> = { id: taskId };
      if (updates.start_date !== undefined) payload.start_date = updates.start_date;
      if (updates.due_date !== undefined) payload.due_date = updates.due_date;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.title !== undefined) payload.title = updates.title;

      const res = await fetch("/api/agent-dm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Errore update task");
      }

      const data = await res.json();
      const updated: TaskSummary = normalizeTask(data.task);
      setTasks((prev) => {
        const list = prev.map((t) =>
          t.id === taskId ? { ...t, ...updated } : t
        );
        persistTasks(selectedProjectId, list);
        return list;
      });
      setUnsyncedProjects((prev) => {
        const next = { ...prev };
        if (next[selectedProjectId]) {
          delete next[selectedProjectId];
          markUnsynced(selectedProjectId, false);
        }
        return next;
      });
    } catch (err) {
      console.warn("Errore update task, resta solo cache locale:", err);
      setUnsyncedProjects((prev) => {
        const next = { ...prev, [selectedProjectId]: true };
        markUnsynced(selectedProjectId, true);
        return next;
      });
      // la UI resta sugli aggiornamenti ottimistici
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const retrySync = async () => {
    if (!selectedProjectId) return;
    setRetryingSync(true);
    try {
      const res = await fetch(
        `/api/agent-dm/tasks?projectId=${encodeURIComponent(selectedProjectId)}`
      );
      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }
      const data = await res.json();
      const list: TaskSummary[] = (data.tasks || []).map(normalizeTask);
      setTasks(list);
      persistTasks(selectedProjectId, list);
      setUnsyncedProjects((prev) => {
        const next = { ...prev };
        if (next[selectedProjectId]) {
          delete next[selectedProjectId];
          markUnsynced(selectedProjectId, false);
        }
        return next;
      });
    } catch (err) {
      console.warn("Retry sync fallita:", err);
    } finally {
      setRetryingSync(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProjectId) return;
    setConfirmDelete(null);
    setDeletingTaskId(taskId);

    setTasks((prev) => {
      const list = prev.filter((t) => t.id !== taskId);
      persistTasks(selectedProjectId, list);
      return list;
    });

    try {
      const res = await fetch("/api/agent-dm/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Errore delete task");
      }
    } catch (err) {
      console.warn("Errore delete task, resta solo cache locale:", err);
    } finally {
      setDeletingTaskId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setConfirmDelete(null);
    setDeletingProjectId(projectId);

    const remainingProjects = projects.filter((p) => p.id !== projectId);
    persistProjects(remainingProjects);
    setProjects(remainingProjects);
    removeLocalTasks(projectId);

    if (selectedProjectId === projectId) {
      const fallbackId = remainingProjects[0]?.id ?? null;
      setSelectedProjectId(fallbackId);
      setTasks(
        fallbackId ? loadLocalTasks(fallbackId).map(normalizeTask) : []
      );
    }

    try {
      const res = await fetch("/api/agent-dm/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Errore delete progetto");
      }
    } catch (err) {
      console.warn("Errore delete progetto, resta solo cache locale:", err);
    } finally {
      setDeletingProjectId(null);
    }
  };

  const confirmDeletion = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "task") {
      await handleDeleteTask(confirmDelete.id);
    } else {
      await handleDeleteProject(confirmDelete.id);
    }
  };

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || null;
  const isDeletingTarget =
    !!confirmDelete &&
    (confirmDelete.type === "task"
      ? deletingTaskId === confirmDelete.id
      : deletingProjectId === confirmDelete.id);

  return (
  <>
    <section className="w-full max-w-6xl mx-auto rounded-3xl border border-[#e4e8f0] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* HERO */}
      <div className="relative overflow-hidden border-b border-[#e8ecf3] bg-gradient-to-r from-[#0f172a] via-[#0d1c36] to-[#0f172a] px-5 py-5 text-white">
        <div className="absolute inset-0 opacity-25 [background:radial-gradient(circle_at_20%_30%,#74ffd2_0,transparent_30%),radial-gradient(circle_at_80%_20%,#4ac1ff_0,transparent_25%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/10 grid place-items-center ring-1 ring-white/15">
              <Sparkles className="h-5 w-5 text-[#74ffd2]" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/70">
                Tekkin Agent
              </div>
              <div className="text-2xl font-semibold">
                PM personale per Mentoring Pro
              </div>
              <p className="text-sm text-white/75 max-w-xl">
                Piano operativo, follow-up e controllo task/finanza in un unico pannello.
              </p>
              <div className="flex flex-wrap gap-2 text-[12px] text-white/70">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Chat operativa
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Progetti e task live
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                  Snapshot finanze
                </span>
              </div>
            </div>
          </div>
          <div className="w-full max-w-xl">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.15)]">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">
                Ultima risposta
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {lastAnswer || "Non hai ancora chiesto nulla."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="p-4 md:p-6 space-y-4">
        {(showChat || showPlanner) && (
          <div
            className={`grid gap-4 ${
              showChat && showPlanner
                ? "xl:grid-cols-[1.25fr_0.95fr] 2xl:grid-cols-[1.35fr_1fr]"
                : "grid-cols-1"
            }`}
          >
            {/* Colonna sinistra: chat + scorciatoie */}
            {showChat && (
              <div className="space-y-4" id="tekkin-chat">
                <div className="rounded-2xl border border-[#e8ecf3] bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between border-b border-[#eef1f6] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0f1a2c]">
                      <MessageSquare className="h-4 w-4 text-[#4ac1ff]" />
                      Chat operativa
                    </div>
                    {loading && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Sto generando...
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="rounded-xl border border-[#eef1f4] bg-white/80 p-3 max-h-80 overflow-auto space-y-3">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex gap-2 ${
                            m.role === "agent"
                              ? "items-start"
                              : "items-start justify-end"
                          }`}
                        >
                          {m.role === "agent" && (
                            <div className="h-8 w-8 rounded-full bg-[#0f1a2c] text-white grid place-items-center text-xs">
                              TA
                            </div>
                          )}
                          <div
                            className={`rounded-2xl px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                              m.role === "agent"
                                ? "bg-[#0f1a2c] text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.08)] border border-[#15233a]"
                                : "bg-white text-zinc-800 border border-[#eef1f4]"
                            }`}
                          >
                            {m.content}
                          </div>
                          {m.role === "user" && (
                            <div className="h-8 w-8 rounded-full bg-[#e7f4ff] text-[#0f1a2c] grid place-items-center text-xs font-semibold">
                              Tu
                            </div>
                          )}
                        </div>
                      ))}
                      {messages.length === 0 && (
                        <div className="text-sm text-zinc-500">
                          Invia un brief per iniziare la sessione.
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-[#eef1f4] bg-white p-3 space-y-2">
                      <label className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                        Brief veloce
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-[#e3e8ef] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f1a2c] focus:ring-2 focus:ring-[#7ef9c7]/50"
                        rows={3}
                        placeholder='Es: "Oggi ho rifinito il player e preparato il press kit. Cosa priorizzare domani?"'
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="text-xs text-zinc-500">
                          Tip: invia con Ctrl/Cmd + Invio
                        </div>
                        <button
                          onClick={() => send()}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7ef9c7] to-[#4ac1ff] px-4 py-2 text-sm font-semibold text-[#0f1a2c] shadow-[0_8px_24px_rgba(74,193,255,0.25)] hover:brightness-110 disabled:opacity-60"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {loading ? "Invio in corso..." : "Invia a Tekkin Agent"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#eef1f4] bg-[#f8fbff] p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0f1a2c]">
                        <ArrowUpRight className="h-4 w-4 text-[#4ac1ff]" />
                        Scorciatoie
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {quickPrompts.map((p) => (
                          <button
                            key={p}
                            onClick={() => send(p)}
                            className="rounded-full border border-[#d9e5ff] bg-white px-3 py-1.5 text-xs text-zinc-700 hover:border-[#0f1a2c] hover:text-[#0f1a2c]"
                            disabled={loading}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Colonna destra: planner */}
            {showPlanner && (
              <div className="space-y-4" id="tekkin-planner">
                <div className="rounded-2xl border border-[#e8ecf3] bg-white/95 shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Planner
                      </div>
                      <div className="text-sm font-semibold text-[#0f1a2c]">
                        Progetti e task
                      </div>
                    </div>
                    {loadingProjects && (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        className="w-full flex-1 rounded-lg border border-[#e3e8ef] bg-white px-2 py-2 text-sm text-zinc-800"
                        value={selectedProjectId ?? ""}
                        onChange={(e) =>
                          setSelectedProjectId(
                            e.target.value ? e.target.value : null
                          )
                        }
                      >
                        {projects.length === 0 && (
                          <option value="">Nessun progetto</option>
                        )}
                        {projects.length > 0 && !selectedProjectId && (
                          <option value="">Seleziona un progetto</option>
                        )}
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - {p.type} - prio {p.priority}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          selectedProject &&
                          setConfirmDelete({
                            type: "project",
                            id: selectedProject.id,
                            label: selectedProject.name,
                          })
                        }
                        disabled={
                          !selectedProjectId ||
                          deletingProjectId === selectedProjectId
                        }
                        className="inline-flex items-center justify-center rounded-lg border border-[#e3e8ef] bg-white px-2 text-zinc-700 hover:text-red-600 disabled:opacity-50"
                        title="Elimina progetto"
                      >
                        {deletingProjectId === selectedProjectId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-[#e3e8ef] bg-white px-3 py-2 text-sm"
                        placeholder="Nuovo progetto (es. TEKKIN: Site)"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-[1.1fr_0.6fr_auto] gap-2 items-center">
                      <label className="flex items-center gap-2 rounded-lg border border-[#e3e8ef] bg-white px-3 py-2 text-sm">
                        <span className="text-xs text-zinc-500">Tipo</span>
                        <select
                          className="flex-1 bg-transparent text-sm outline-none"
                          value={newProjectType}
                          onChange={(e) =>
                            setNewProjectType(
                              e.target.value as "artist" | "client"
                            )
                          }
                        >
                          <option value="artist">Artist</option>
                          <option value="client">Client</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-[#e3e8ef] bg-white px-3 py-2 text-sm">
                        <span className="text-xs text-zinc-500">Priorità</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          className="w-16 bg-transparent text-sm outline-none"
                          value={newProjectPriority}
                          onChange={(e) =>
                            setNewProjectPriority(Number(e.target.value) || 0)
                          }
                        />
                      </label>
                      <button
                        onClick={handleCreateProject}
                        disabled={creatingProject || !newProjectName.trim()}
                        className="inline-flex items-center gap-1 rounded-full bg-[#0f1a2c] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                      >
                        {creatingProject ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Progetto
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#eef1f4] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#0f1a2c]">
                        Task del progetto
                        {selectedProject ? ` ? ${selectedProject.name}` : ""}
                      </div>
                      {loadingTasks && (
                        <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                      )}
                      <button
                        onClick={() => {
                          resetNewTaskFields();
                          setShowNewTaskRow(true);
                        }}
                        disabled={creatingTask || !selectedProjectId}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e3e8ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f1a2c] hover:border-[#0f1a2c] disabled:opacity-50"
                      >
                        <Plus className="h-3 w-3" />
                        Task
                      </button>
                    </div>

                    {selectedProjectId ? (
                      <>
                        {unsyncedProjects[selectedProjectId] && (
                          <div className="flex flex-col gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <span>
                              Sync col server non riuscita: stai vedendo la cache locale.
                              Riprova piu' tardi, i dati restano salvati qui.
                            </span>
                            <button
                              onClick={retrySync}
                              disabled={retryingSync}
                              className="self-start inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                            >
                              {retryingSync && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              Riprova sync ora
                            </button>
                          </div>
                        )}
                        <div className="relative max-h-64 overflow-y-auto overflow-x-auto">
                          <div className="space-y-1 min-w-[880px]">
                          {tasks.length > 0 && (
                            <div
                              className={`${taskGridClass} items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-zinc-600 border border-[#e8ecf3]`}
                            >
                              <span>Titolo</span>
                              <span>Status</span>
                              <span>Priorità</span>
                              <span>Inizio</span>
                              <span>Scadenza</span>
                              <span>Azioni</span>
                            </div>
                          )}
                          {tasks.length === 0 && (
                            <div className="text-xs text-zinc-500">
                              Nessuna task ancora. Aggiungine una sotto.
                            </div>
                          )}
                          {showNewTaskRow && (
                            <div
                              className={`${taskGridClass} items-center gap-2 rounded-lg border border-[#eef1f4] bg-white px-2 py-1.5 text-xs min-h-[56px]`}
                            >
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-[#e3e8ef] bg-white px-2 py-1.5 text-[12px] text-[#0f1a2c] placeholder:text-zinc-400 outline-none"
                                  placeholder="Titolo task (obbligatorio)"
                                  value={newTaskTitle}
                                  onChange={(e) =>
                                    setNewTaskTitle(e.target.value)
                                  }
                                />
                                <span className="text-[11px] text-transparent">
                                  spacer
                                </span>
                              </div>
                              <select
                                className="w-full h-full rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700"
                                value={newTaskStatus}
                                onChange={(e) =>
                                  setNewTaskStatus(
                                    e.target.value as
                                      | "todo"
                                      | "doing"
                                      | "done"
                                  )
                                }
                                disabled={creatingTask}
                              >
                                <option value="todo">
                                  Todo (Da fare)
                                </option>
                                <option value="doing">
                                  Doing (In corso)
                                </option>
                                <option value="done">
                                  Done (Fatto)
                                </option>
                              </select>
                              <label className="flex h-full items-center gap-1 rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700">
                                <span className="text-[10px] text-zinc-500">
                                  Prio
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="w-full bg-transparent outline-none"
                                  value={newTaskPriority}
                                  onChange={(e) =>
                                    setNewTaskPriority(
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  disabled={creatingTask}
                                />
                              </label>
                              <input
                                type="text"
                                readOnly
                                value="Auto"
                                className="w-28 h-full rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-500 text-center"
                              />
                              <input
                                type="date"
                                className="w-28 h-full rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700"
                                value={newTaskDueDate}
                                onChange={(e) =>
                                  setNewTaskDueDate(e.target.value)
                                }
                                aria-label="Data di scadenza (opzionale)"
                                disabled={creatingTask}
                                placeholder="gg/mm/aaaa"
                              />
                              <div className="flex h-full items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    resetNewTaskFields();
                                    setShowNewTaskRow(false);
                                  }}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e8ef] bg-white text-[11px] text-zinc-700 hover:bg-slate-100"
                                  disabled={creatingTask}
                                  title="Annulla"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={handleCreateTask}
                                  disabled={
                                    creatingTask ||
                                    !newTaskTitle.trim() ||
                                    !selectedProjectId
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f1a2c] text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                                  title="Salva task"
                                >
                                  {creatingTask ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                          {tasks.map((t) => (
                            <div
                              key={t.id}
                              className={`${taskGridClass} items-center gap-2 rounded-lg border border-[#eef1f4] bg-white px-2 py-1.5 text-xs`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-[#0f1a2c]">
                                  {t.title}
                                </span>
                                <span className="text-[11px] text-zinc-500">
                                  ore {t.actual_hours ?? 0} - prio{" "}
                                  {t.priority ?? "-"}
                                </span>
                              </div>
                              <select
                                className="w-full rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700"
                                value={t.status}
                                onChange={(e) =>
                                  handleUpdateTask(t.id, {
                                    status: e.target.value as
                                      | "todo"
                                      | "doing"
                                      | "done",
                                  })
                                }
                                disabled={
                                  updatingTaskId === t.id ||
                                  deletingTaskId === t.id
                                }
                              >
                                <option value="todo">
                                  Todo (Da fare)
                                </option>
                                <option value="doing">
                                  Doing (In corso)
                                </option>
                                <option value="done">
                                  Done (Fatto)
                                </option>
                              </select>
                              <label className="flex items-center gap-1 rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700">
                                <span className="text-[10px] text-zinc-500">
                                  Prio
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="w-full bg-transparent outline-none"
                                  value={t.priority ?? 5}
                                  onChange={(e) =>
                                    handleUpdateTask(t.id, {
                                      priority: Number(e.target.value) || 0,
                                    })
                                  }
                                  disabled={
                                    updatingTaskId === t.id ||
                                    deletingTaskId === t.id
                                  }
                                />
                              </label>
                              <input
                                type="date"
                                className="w-28 rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700"
                                value={t.start_date ?? ""}
                                onChange={(e) =>
                                  handleUpdateTask(t.id, {
                                    start_date: e.target.value || null,
                                  })
                                }
                                disabled={
                                  updatingTaskId === t.id ||
                                  deletingTaskId === t.id
                                }
                              />
                              <input
                                type="date"
                                className="w-28 rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-zinc-700"
                                value={t.due_date ?? ""}
                                onChange={(e) =>
                                  handleUpdateTask(t.id, {
                                    due_date: e.target.value || null,
                                  })
                                }
                                disabled={
                                  updatingTaskId === t.id ||
                                  deletingTaskId === t.id
                                }
                              />
                              <button
                                onClick={() =>
                                  setConfirmDelete({
                                    type: "task",
                                    id: t.id,
                                    label: t.title,
                                  })
                                }
                                disabled={deletingTaskId === t.id}
                                className="inline-flex items-center justify-center rounded-lg border border-[#e3e8ef] bg-white px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingTaskId === t.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                        </div>

                        <div className="space-y-1" />
                      </>
                    ) : (
                      <div className="text-xs text-zinc-500">
                        Seleziona un progetto per vedere o aggiungere task.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showCalendar && (
          <div
            id="tekkin-calendar"
            className="rounded-2xl border border-[#e8ecf3] bg-white p-4 md:p-5 space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Calendar
                </div>
                <div className="text-sm font-semibold text-[#0f1a2c]">
                  Scadenze imminenti{" "}
                  {selectedProject ? `· ${selectedProject.name}` : ""}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {upcomingTasks.length === 0 && (
                <div className="text-sm text-zinc-500">
                  Nessuna scadenza per questo progetto. Imposta una data nelle
                  task.
                </div>
              )}
              {upcomingTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-[#eef1f4] bg-white px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#0f1a2c]">
                      {t.title}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Status: {t.status} · Prio {t.priority ?? "-"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#0f1a2c] bg-slate-100 px-2 py-1 rounded-lg">
                    {formatDateShort(t.due_date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DASHBOARD VISIVA DELL'AGENTE */}
        {showDashboard && agentData && (
          <div className="rounded-2xl border border-[#e8ecf3] bg-[#f7f9fc] p-4 md:p-5 space-y-4 shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Sintesi agente
                </div>
                <div className="text-lg font-semibold text-[#0f1a2c]">
                  {agentData.summary.headline}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[12px] text-zinc-600">
                <Sparkles className="h-4 w-4 text-[#4ac1ff]" />
                Dashboard aggiornata
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
              <div className="space-y-3">
                <div className="rounded-xl border border-[#dde3eb] bg-white/90 p-3">
                  <ul className="space-y-1 text-sm text-zinc-600">
                    {agentData.summary.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#4ac1ff]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-[#dde3eb] bg-white/90 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#0f1a2c]">
                    <span>Task consigliate</span>
                    <span className="text-[11px] text-zinc-500">
                      Oggi e prossimi giorni
                    </span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {agentData.sections.map((section) => (
                      <div key={section.title} className="space-y-1">
                        <div className="text-[11px] font-semibold text-zinc-500">
                          {section.title}
                        </div>
                        {section.tasks.length === 0 && (
                          <div className="text-[11px] text-zinc-400">
                            Nessuna task in questa finestra.
                          </div>
                        )}
                        {section.tasks.map((t) => (
                          <div
                            key={t.task_id}
                            className="rounded-lg border border-[#eef1f4] bg-white px-2 py-1.5 text-xs flex justify-between gap-2"
                          >
                            <div>
                              <div className="font-medium text-[#0f1a2c]">
                                {t.label}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {t.project}
                                {t.due_date && ` · entro ${t.due_date}`}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                  t.status === "doing"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : t.status === "done"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-slate-500/10 text-slate-500"
                                }`}
                              >
                                {t.status}
                              </span>
                              {t.priority && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                                    t.priority === "high"
                                      ? "bg-red-500/10 text-red-500"
                                      : t.priority === "medium"
                                      ? "bg-yellow-500/10 text-yellow-500"
                                      : "bg-slate-500/10 text-slate-500"
                                  }`}
                                >
                                  {t.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-[#dde3eb] bg-white/90 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#0f1a2c]">
                    <span>Timeline progetti</span>
                    <span className="text-[11px] text-zinc-500">
                      Vista tipo Gantt
                    </span>
                  </div>
                  <div className="mt-2 space-y-3">
                    {buildGanttLayout(agentData.gantt).map((g, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-medium text-[#0f1a2c]">
                            {g.project}
                          </span>
                          <span className="text-zinc-500">
                            {g.start} · {g.end}
                          </span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`absolute top-0 h-2 rounded-full ${
                              g.status === "done"
                                ? "bg-emerald-400"
                                : g.status === "doing"
                                ? "bg-[#4ac1ff]"
                                : "bg-slate-400"
                            }`}
                            style={{
                              left: `${g.offsetPct}%`,
                              width: `${g.widthPct}%`,
                            }}
                          />
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {g.task} · {g.status}
                        </div>
                      </div>
                    ))}
                    {agentData.gantt.length === 0 && (
                      <div className="text-xs text-zinc-500">
                        Nessuna timeline disponibile.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#dde3eb] bg-white/90 p-3">
                  <div className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                    Money snapshot
                  </div>
                  <div className="mt-1 text-sm text-[#0f1a2c]">
                    {agentData.finance.summary}
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {agentData.finance.entries.map((e, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5"
                      >
                        <div>
                          <div className="font-medium text-[#0f1a2c]">
                            {e.label}
                          </div>
                          {e.category && (
                            <div className="text-[11px] text-zinc-500">
                              {e.category}
                            </div>
                          )}
                        </div>
                        <div
                          className={`font-semibold ${
                            e.type === "income"
                              ? "text-emerald-500"
                              : "text-red-500"
                          }`}
                        >
                          {e.type === "income" ? "+" : "-"}
                          {e.amount} €
                        </div>
                      </div>
                    ))}
                    {agentData.finance.entries.length === 0 && (
                      <div className="text-xs text-zinc-500">
                        Nessuna movimentazione recente.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>

    {confirmDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 shadow-2xl">
          <div className="text-sm font-semibold text-[#0f1a2c]">
            Confermi eliminazione?
          </div>
          <p className="text-sm text-zinc-600">
            Stai per eliminare{" "}
            {confirmDelete.type === "project" ? "il progetto" : "la task"} "
            {confirmDelete.label}".
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="rounded-lg border border-[#e3e8ef] bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-slate-50"
            >
              Annulla
            </button>
            <button
              onClick={confirmDeletion}
              disabled={isDeletingTarget}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {isDeletingTarget && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Elimina
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}
