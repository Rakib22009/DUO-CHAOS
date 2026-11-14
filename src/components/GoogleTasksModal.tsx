import React, { useEffect, useState } from 'react';
import { CheckSquare, Plus, RefreshCw, Square, Trash2, X } from 'lucide-react';
import {
  createTask,
  deleteTask,
  ensureDuoChaosTaskList,
  fetchTasks,
  GoogleTaskItem,
  setTaskCompleted,
} from '../lib/tasksApi';
import { getAccessToken } from '../lib/firebase';
import { soundEngine } from '../audio/soundEngine';

interface GoogleTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconnectGoogle: () => Promise<void>;
}

type PendingMutation =
  | { kind: 'create'; title: string; notes: string }
  | { kind: 'toggle'; task: GoogleTaskItem }
  | { kind: 'delete'; task: GoogleTaskItem };

const PRESET_MISSIONS = [
  'Deliver the Bird Nest with all 3 eggs intact',
  'Finish Sunlit Forest Valley with 60%+ Water Glass remaining',
  'Carry the 3-Tier Wedding Cake past Checkpoint 3 without falling',
];

export const GoogleTasksModal: React.FC<GoogleTasksModalProps> = ({
  isOpen,
  onClose,
  onReconnectGoogle,
}) => {
  const [listId, setListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingMutation | null>(null);

  const token = getAccessToken();

  const loadMissions = async () => {
    const t = getAccessToken();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const list = await ensureDuoChaosTaskList(t);
      setListId(list.id);
      const items = await fetchTasks(t, list.id);
      setTasks(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Google Tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && getAccessToken()) {
      loadMissions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmMutation = async () => {
    const t = getAccessToken();
    if (!t || !listId || !pendingAction) return;
    soundEngine.click();
    setLoading(true);
    setError(null);
    try {
      if (pendingAction.kind === 'create') {
        await createTask(t, listId, pendingAction.title, pendingAction.notes);
        setNewTitle('');
      } else if (pendingAction.kind === 'toggle') {
        const nextDone = pendingAction.task.status !== 'completed';
        await setTaskCompleted(t, listId, pendingAction.task.id, nextDone);
      } else if (pendingAction.kind === 'delete') {
        await deleteTask(t, listId, pendingAction.task.id);
      }
      setPendingAction(null);
      const updated = await fetchTasks(t, listId);
      setTasks(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Tasks update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl bg-[#f8fafc] text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900">
              Duo Chaos Missions (Google Tasks)
            </h2>
            <p className="text-xs text-slate-600">
              Sync cooperative goals directly with your Google Tasks checklist
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Close Google Tasks"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!token ? (
            <div className="p-5 rounded-xl bg-sky-50 border border-sky-200 space-y-3">
              <p className="text-sm text-sky-950">
                Reconnect your Google account to grant in-session permission for viewing and updating your &ldquo;Duo Chaos Missions&rdquo; list in Google Tasks.
              </p>
              <button
                type="button"
                onClick={async () => {
                  soundEngine.click();
                  await onReconnectGoogle();
                  await loadMissions();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-semibold text-sm"
              >
                Connect Google Tasks
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {error}
                </div>
              )}

              {/* Create custom mission */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add co-op mission to Google Tasks..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  disabled={!newTitle.trim() || loading}
                  onClick={() => {
                    soundEngine.click();
                    setPendingAction({
                      kind: 'create',
                      title: newTitle.trim(),
                      notes: 'Co-op goal from TWO TOGETHER: DUO CHAOS',
                    });
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
                <button
                  type="button"
                  onClick={loadMissions}
                  disabled={loading}
                  className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700"
                  aria-label="Refresh Tasks"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Quick Challenge Presets */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600">
                  Quick Co-op Challenge Templates
                </div>
                <div className="grid gap-2">
                  {PRESET_MISSIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        soundEngine.click();
                        setPendingAction({
                          kind: 'create',
                          title: preset,
                          notes: 'TWO TOGETHER: DUO CHAOS Challenge',
                        });
                      }}
                      className="text-left px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 text-xs font-medium text-slate-800 flex items-center justify-between gap-2"
                    >
                      <span>{preset}</span>
                      <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing Tasks */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600">
                  Your Google Tasks ({tasks.length})
                </div>
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No tasks yet in &ldquo;Duo Chaos Missions&rdquo;. Add one above!
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {tasks.map((task) => {
                      const done = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.click();
                              setPendingAction({ kind: 'toggle', task });
                            }}
                            className="flex items-center gap-3 text-left flex-1 min-h-[36px]"
                          >
                            {done ? (
                              <CheckSquare className="w-5 h-5 text-emerald-700 shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`text-sm ${
                                done ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                              }`}
                            >
                              {task.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.click();
                              setPendingAction({ kind: 'delete', task });
                            }}
                            className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            aria-label={`Delete ${task.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mandatory Explicit User Confirmation Dialog */}
        {pendingAction && (
          <div className="p-5 border-t border-amber-200 bg-amber-50 space-y-3">
            <div className="text-sm font-bold text-amber-950">
              Confirm Google Tasks Change
            </div>
            <p className="text-xs text-amber-900">
              {pendingAction.kind === 'create' &&
                `Create new task "${pendingAction.title}" in your "Duo Chaos Missions" Google Tasks list?`}
              {pendingAction.kind === 'toggle' &&
                `Mark "${pendingAction.task.title}" as ${
                  pendingAction.task.status === 'completed' ? 'incomplete' : 'completed'
                } in Google Tasks?`}
              {pendingAction.kind === 'delete' &&
                `Permanently delete "${pendingAction.task.title}" from your Google Tasks list?`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmMutation}
                className={`min-h-[40px] px-4 py-2 rounded-lg text-white text-xs font-semibold ${
                  pendingAction.kind === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-700 hover:bg-emerald-600'
                }`}
              >
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
