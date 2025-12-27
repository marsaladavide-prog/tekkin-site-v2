"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DateInput from "@/components/ui/DateInput";

type AgentDmProject = {
  id: string;
  user_id?: string;
  name: string;
  category?: string | null;
  status: string;
  priority: number;
  created_at: string;
  updated_at?: string;
};

type AgentDmTask = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  start_date?: string | null;
  due_date?: string | null;
  actual_hours?: number | null;
  priority?: number | null;
  created_at: string;
};

type Goal = {
  id: string;
  label: string;
  progress: number;
  due_date?: string | null;
  created_at: string;
};

type AgentDmAdvice = {
  summary: string;
  today_focus: string[];
  tasks_today: { title: string; reason: string }[];
  notes: string[];
};

export default function AgentDmPage() {
  const [projects, setProjects] = useState<AgentDmProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AgentDmTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);

  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState("tekkin");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<"todo" | "doing" | "done">("todo");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  const [newGoalLabel, setNewGoalLabel] = useState("");
  const [newGoalDue, setNewGoalDue] = useState("");

  const [advice, setAdvice] = useState<AgentDmAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);
  const toIsoDate = (value?: string | null) => (value ? value.split("T")[0] : "");
  const formatShortDate = (value?: string | null) => {
    const iso = toIsoDate(value);
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  };

  type DateState = "none" | "past" | "today" | "future";
  const getDateState = (value?: string | null): DateState => {
    const iso = toIsoDate(value);
    if (!iso) return "none";
    if (iso < todayIso) return "past";
    if (iso === todayIso) return "today";
    return "future";
  };
  const badgeClass = (state: DateState, type: "start" | "due") => {
    const base = "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight";
    if (type === "due") {
      if (state === "past") return `${base} bg-red-500/20 text-red-300`;
      if (state === "today") return `${base} bg-yellow-500/20 text-yellow-300`;
      return `${base} bg-white/5 text-[var(--text-muted)]`;
    }
    return state === "today"
      ? `${base} bg-[var(--accent)]/20 text-[var(--accent)]`
      : `${base} bg-white/5 text-[var(--text-muted)]`;
  };
  const overdueCount = useMemo(
    () =>
      tasks.filter(task => {
        const due = toIsoDate(task.due_date);
        return Boolean(due && due < todayIso);
      }).length,
    [tasks, todayIso]
  );
  const startTodayCount = useMemo(
    () =>
      tasks.filter(task => {
        const start = toIsoDate(task.start_date);
        return Boolean(start && start === todayIso);
      }).length,
    [tasks, todayIso]
  );

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const categorizedProjects = useMemo(() => {
    const byCategory: Record<string, AgentDmProject[]> = {};
    for (const p of projects) {
      const cat = p.category || "personal";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    }
    return byCategory;
  }, [projects]);

  const loadProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch("/api/agent-dm/projects");
      if (!res.ok) {
        console.error("Error loading projects");
        return;
      }
      const json = await res.json();
      setProjects(json.projects ?? []);
      setSelectedProjectId(prev => prev ?? json.projects?.[0]?.id ?? null);
    } catch (err) {
      console.error("loadProjects error", err);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const loadTasks = useCallback(async (projectId: string) => {
    try {
      setLoadingTasks(true);
      const res = await fetch(`/api/agent-dm/tasks?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        console.error("Error loading tasks");
        return;
      }
      const json = await res.json();
      setTasks(json.tasks ?? []);
    } catch (err) {
      console.error("loadTasks error", err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const loadGoals = useCallback(async () => {
    try {
      setLoadingGoals(true);
      const res = await fetch("/api/agent-dm/goals");
      if (!res.ok) {
        console.error("Error loading goals");
        return;
      }
      const json = await res.json();
      setGoals(json.goals ?? []);
    } catch (err) {
      console.error("loadGoals error", err);
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  // load iniziale
  useEffect(() => {
    loadProjects();
    loadGoals();
  }, [loadProjects, loadGoals]);

  // carica task quando cambia progetto
  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
      setAdvice(null); // quando cambi progetto resetti i consigli
    } else {
      setTasks([]);
      setAdvice(null);
    }
  }, [selectedProjectId, loadTasks]);

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    try {
      setCreatingProject(true);
      const res = await fetch("/api/agent-dm/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newProjectName.trim(),
          category: newProjectCategory,
          priority: 1,
        }),
      });
      if (!res.ok) {
        console.error("Error creating project");
        return;
      }
      const json = await res.json();
      const created: AgentDmProject | undefined = json.project;
      if (created) {
        setProjects(prev => [created, ...prev]);
        setSelectedProjectId(created.id);
      }
      setNewProjectName("");
      setCreatingProject(false);
    } catch (err) {
      console.error("handleCreateProject error", err);
      setCreatingProject(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Eliminare questo progetto e tutti i suoi task")) return;
    try {
      const res = await fetch(`/api/agent-dm/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Error deleting project");
        return;
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
      }
    } catch (err) {
      console.error("handleDeleteProject error", err);
    }
  }

  async function handleCreateTask() {
    if (!selectedProjectId || !newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/agent-dm/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: newTaskTitle.trim(),
          status: newTaskStatus,
          start_date: newTaskStart || null,
          due_date: newTaskDue || null,
        }),
      });
      if (!res.ok) {
        console.error("Error creating task");
        return;
      }
      const json = await res.json();
      const created: AgentDmTask | undefined = json.task;
      if (created) {
        setTasks(prev => [created, ...prev]);
      }
      setNewTaskTitle("");
      setNewTaskStatus("todo");
      setNewTaskStart("");
      setNewTaskDue("");
    } catch (err) {
      console.error("handleCreateTask error", err);
    }
  }

  async function handleUpdateTaskStatus(task: AgentDmTask, status: string) {
    try {
      const res = await fetch("/api/agent-dm/tasks", {
        method: "PATCH",
        body: JSON.stringify({
          id: task.id,
          status,
        }),
      });
      if (!res.ok) {
        console.error("Error updating task");
        return;
      }
      const json = await res.json();
      const updated: AgentDmTask | undefined = json.task;
      if (updated) {
        setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      }
    } catch (err) {
      console.error("handleUpdateTaskStatus error", err);
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      const res = await fetch(`/api/agent-dm/tasks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Error deleting task");
        return;
      }
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("handleDeleteTask error", err);
    }
  }

  async function handleCreateGoal() {
    if (!newGoalLabel.trim()) return;
    try {
      const res = await fetch("/api/agent-dm/goals", {
        method: "POST",
        body: JSON.stringify({
          label: newGoalLabel.trim(),
          due_date: newGoalDue || null,
        }),
      });
      if (!res.ok) {
        console.error("Error creating goal");
        return;
      }
      const json = await res.json();
      const created: Goal | undefined = json.goal;
      if (created) {
        setGoals(prev => [created, ...prev]);
      }
      setNewGoalLabel("");
      setNewGoalDue("");
    } catch (err) {
      console.error("handleCreateGoal error", err);
    }
  }

  async function handleDeleteGoal(id: string) {
    try {
      const res = await fetch(`/api/agent-dm/goals?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Error deleting goal");
        return;
      }
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error("handleDeleteGoal error", err);
    }
  }

  async function callAdvisor() {
    if (!selectedProjectId) return;
    try {
      setLoadingAdvice(true);
      const res = await fetch("/api/agent-dm/advise", {
        method: "POST",
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (!res.ok) {
        console.error("AI error");
        setLoadingAdvice(false);
        return;
      }
      const json = await res.json();
      setAdvice(json.advice as AgentDmAdvice);
    } catch (err) {
      console.error("callAdvisor error", err);
    } finally {
      setLoadingAdvice(false);
    }
  }

  const tasksByStatus = useMemo(() => {
    const groups: Record<string, AgentDmTask[]> = {
      todo: [],
      doing: [],
      done: [],
    };
    for (const t of tasks) {
      const key = t.status as "todo" | "doing" | "done";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [tasks]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <div className="mx-auto flex h-screen max-w-6xl flex-col px-4 py-6">
        {/* header */}
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Agent DM</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Hub personale per Tekkin, artist e vita. Un solo posto per tenere il cervello in ordine.
            </p>
          </div>
        </header>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* sidebar progetti */}
          <aside className="flex w-64 flex-col rounded-2xl border border-white/5 bg-white/5/10 p-3 backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Progetti
              </span>
            </div>

            <div className="mb-3 space-y-2 rounded-xl border border-white/5 bg-black/20 p-2">
              <input
                type="text"
                className="w-full rounded-full bg-black/40 px-3 py-1.5 text-xs outline-none ring-0 placeholder:text-[var(--text-muted)]"
                placeholder="Nuovo progetto"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleCreateProject();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  className="flex-1 rounded-full bg-black/40 px-2 py-1 text-[10px]"
                  value={newProjectCategory}
                  onChange={e => setNewProjectCategory(e.target.value)}
                >
                  <option value="tekkin">Tekkin</option>
                  <option value="artist">Artist</option>
                  <option value="health">Health</option>
                  <option value="money">Money</option>
                  <option value="life">Life</option>
                  <option value="personal">Personal</option>
                </select>
                <button
                  onClick={handleCreateProject}
                  disabled={creatingProject || !newProjectName.trim()}
                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-medium text-black disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {loadingProjects && (
                <div className="text-[10px] text-[var(--text-muted)]">Caricamento progetti...</div>
              )}

              {!loadingProjects && projects.length === 0 && (
                <div className="text-[10px] text-[var(--text-muted)]">
                  Nessun progetto ancora. Crea il primo Tekkin, Artist o vita.
                </div>
              )}

              {Object.entries(categorizedProjects).map(([cat, list]) => (
                <div key={cat} className="space-y-1">
                  <div className="px-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                    {cat}
                  </div>
                  <div className="space-y-1">
                    {list.map(p => {
                      const isActive = p.id === selectedProjectId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProjectId(p.id)}
                          className={[
                            "group flex w-full cursor-pointer items-center justify-between rounded-xl px-2 py-2 text-left text-xs transition",
                            isActive
                              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "bg-black/20 text-[var(--text-primary)] hover:bg-white/5",
                          ].join(" ")}
                        >
                          <span className="line-clamp-1">{p.name}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteProject(p.id);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                handleDeleteProject(p.id);
                              }
                            }}
                            className="ml-2 text-[10px] text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100"
                          >
                            x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* colonna centrale - task board + AI */}
          <main className="flex flex-1 flex-col rounded-2xl border border-white/5 bg-black/30 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {selectedProject ? selectedProject.name : "Nessun progetto selezionato"}
                  </h2>
                  {selectedProject?.category && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-tight text-[var(--text-muted)]">
                      {selectedProject.category}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Task divisi per stato. Tieni qui il flusso giornaliero.
                </p>
              </div>

              <button
                onClick={callAdvisor}
                disabled={loadingAdvice || !selectedProjectId}
                className="rounded-full bg-[var(--accent)]/20 px-3 py-1.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/30 disabled:opacity-50"
              >
                {loadingAdvice ? "Pensando..." : "AI Advisor"}
              </button>
            </div>

            {(overdueCount > 0 || startTodayCount > 0) && (
              <div className="mb-2 text-[10px] text-[var(--text-muted)]">
                {overdueCount > 0 && `⚠️ ${overdueCount} task in ritardo`}
                {overdueCount > 0 && startTodayCount > 0 && " · "}
                {startTodayCount > 0 && `${startTodayCount} iniziano oggi`}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <input
                type="text"
                className="flex-1 rounded-full bg-black/60 px-3 py-1.5 text-xs outline-none"
                placeholder={
                  selectedProject ? "Nuovo task per questo progetto" : "Seleziona un progetto per aggiungere task"
                }
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleCreateTask();
                  }
                }}
                disabled={!selectedProject}
              />
              <div className="flex items-center gap-2">
                <DateInput
                  value={newTaskStart}
                  onChange={setNewTaskStart}
                  inline
                  className="w-24"
                  aria-label="Data di inizio task"
                  max={newTaskDue || undefined}
                />
                <DateInput
                  value={newTaskDue}
                  onChange={setNewTaskDue}
                  inline
                  className="w-24"
                  aria-label="Data di scadenza task"
                  min={newTaskStart || undefined}
                />
              </div>
              <select
                className="rounded-full bg-black/60 px-2 py-1 text-[10px]"
                value={newTaskStatus}
                onChange={e => setNewTaskStatus(e.target.value as "todo" | "doing" | "done")}
              >
                <option value="todo">To do</option>
                <option value="doing">Doing</option>
                <option value="done">Done</option>
              </select>
              <button
                onClick={handleCreateTask}
                disabled={!selectedProject || !newTaskTitle.trim()}
                className="rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-medium text-black disabled:opacity-50"
              >
                Add task
              </button>
            </div>

            <div className="flex flex-1 gap-3 overflow-hidden">
              {["todo", "doing", "done"].map(columnStatus => {
                const columnTasks = tasksByStatus[columnStatus] ?? [];
                const label =
                  columnStatus === "todo" ? "To do" : columnStatus === "doing" ? "Doing" : "Done";
                return (
                  <section
                    key={columnStatus}
                    className="flex-1 rounded-xl bg-white/5/30 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">
                        {label}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {columnTasks.length}
                      </span>
                    </div>
                    <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-1">
                      {loadingTasks && selectedProject && columnStatus === "todo" && (
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Caricamento task...
                        </div>
                      )}

                      {columnTasks.map(task => {
                        const startState = getDateState(task.start_date);
                        const dueState = getDateState(task.due_date);
                        return (
                          <article
                            key={task.id}
                            className="group rounded-lg border border-white/5 bg-black/40 px-2 py-2 text-[11px]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="line-clamp-2 font-medium">
                                  {task.title}
                                </div>
                              <div className="flex flex-wrap gap-2">
                                {task.start_date && (
                                  <span
                                    className={badgeClass(startState, "start")}
                                    title={`Inizio ${formatShortDate(task.start_date)}`}
                                  >
                                    Inizio {formatShortDate(task.start_date)}
                                  </span>
                                )}
                                {task.due_date && (
                                  <span
                                    className={badgeClass(dueState, "due")}
                                    title={`Scadenza ${formatShortDate(task.due_date)}`}
                                  >
                                    Scadenza {formatShortDate(task.due_date)}
                                  </span>
                                )}
                                {task.actual_hours != null && (
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {task.actual_hours} h
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-[10px] text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100"
                            >
                              x
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex gap-1">
                              {columnStatus !== "todo" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTaskStatus(task, "todo")}
                                  className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-muted)] hover:bg-white/10"
                                >
                                  To do
                                </button>
                              )}
                              {columnStatus !== "doing" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTaskStatus(task, "doing")}
                                  className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-muted)] hover:bg-white/10"
                                >
                                  Doing
                                </button>
                              )}
                              {columnStatus !== "done" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTaskStatus(task, "done")}
                                  className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[var(--text-muted)] hover:bg-white/10"
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}

                      {!loadingTasks && columnTasks.length === 0 && (
                        <div className="rounded-lg border border-dashed border-white/5 bg-black/20 px-2 py-3 text-center text-[10px] text-[var(--text-muted)]">
                          Nessun task in questa colonna.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            {advice && (
              <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4 text-sm">
                <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
                  Piano del giorno (AI)
                </h3>

                <p className="mb-3 text-[11px] text-[var(--text-primary)]">
                  {advice.summary}
                </p>

                <div className="mb-3">
                  <div className="text-[10px] text-[var(--text-muted)]">Focus di oggi:</div>
                  <ul className="mt-1 list-disc pl-4 text-[11px]">
                    {advice.today_focus?.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div className="mb-3">
                  <div className="text-[10px] text-[var(--text-muted)]">Task consigliati:</div>
                  <ul className="mt-1 space-y-2 pl-1">
                    {advice.tasks_today?.map((t, idx) => (
                      <li
                        key={idx}
                        className="rounded-lg border border-white/5 bg-black/30 p-2 text-[11px]"
                      >
                        <div className="font-medium">{t.title}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {t.reason}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {advice.notes?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Note:</div>
                    <ul className="mt-1 list-disc pl-4 text-[11px]">
                      {advice.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* colonna destra - goals */}
          <aside className="flex w-72 flex-col rounded-2xl border border-white/5 bg-black/40 p-3">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Goals
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                Metti gli obiettivi chiave del mese. Pochi, chiari, misurabili.
              </p>
            </div>

            <div className="mb-3 space-y-2 rounded-xl bg-white/5 px-2 py-2">
              <input
                type="text"
                className="w-full rounded-full bg-black/60 px-3 py-1.5 text-xs outline-none"
                placeholder="Nuovo goal"
                value={newGoalLabel}
                onChange={e => setNewGoalLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleCreateGoal();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <DateInput
                  value={newGoalDue}
                  onChange={setNewGoalDue}
                  inline
                  className="flex-1"
                  aria-label="Data di scadenza del goal"
                  min={todayIso}
                />
                <button
                  onClick={handleCreateGoal}
                  disabled={!newGoalLabel.trim()}
                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-medium text-black disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {loadingGoals && (
                <div className="text-[10px] text-[var(--text-muted)]">Caricamento goals...</div>
              )}
              {!loadingGoals && goals.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/5 bg-black/20 px-3 py-4 text-center text-[10px] text-[var(--text-muted)]">
                  Nessun goal ancora. Parti con 3 obiettivi chiave per questo mese.
                </div>
              )}

              {goals.map(goal => (
                <div
                  key={goal.id}
                  className="group rounded-xl border border-white/5 bg-black/50 px-3 py-2 text-[11px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="line-clamp-2 font-medium">{goal.label}</div>
                      <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {goal.due_date
                          ? `Entro ${new Date(goal.due_date).toLocaleDateString("it-IT", {
                              day: "2-digit",
                              month: "2-digit",
                            })}`
                          : "Senza data"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-[10px] text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100"
                    >
                      x
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
                    <div
                      className="h-1.5 rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.min(Math.max(goal.progress ?? 0, 0), 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
