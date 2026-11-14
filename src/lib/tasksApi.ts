export interface GoogleTaskList {
  id: string;
  title: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
}

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';

async function tasksFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Tasks API (${res.status}): ${text}`);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export async function ensureDuoChaosTaskList(token: string): Promise<GoogleTaskList> {
  const lists = await tasksFetch<{ items?: GoogleTaskList[] }>(
    `${TASKS_BASE}/users/@me/lists`,
    token,
  );
  const existing = lists.items?.find((l) => l.title === 'Duo Chaos Missions');
  if (existing) return existing;

  return tasksFetch<GoogleTaskList>(`${TASKS_BASE}/users/@me/lists`, token, {
    method: 'POST',
    body: JSON.stringify({ title: 'Duo Chaos Missions' }),
  });
}

export async function fetchTasks(token: string, listId: string): Promise<GoogleTaskItem[]> {
  const data = await tasksFetch<{ items?: GoogleTaskItem[] }>(
    `${TASKS_BASE}/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=true`,
    token,
  );
  return data.items || [];
}

export async function createTask(
  token: string,
  listId: string,
  title: string,
  notes?: string,
): Promise<GoogleTaskItem> {
  return tasksFetch<GoogleTaskItem>(
    `${TASKS_BASE}/lists/${encodeURIComponent(listId)}/tasks`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title,
        notes: notes || 'Created from TWO TOGETHER: DUO CHAOS',
      }),
    },
  );
}

export async function setTaskCompleted(
  token: string,
  listId: string,
  taskId: string,
  completed: boolean,
): Promise<GoogleTaskItem> {
  return tasksFetch<GoogleTaskItem>(
    `${TASKS_BASE}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: completed ? 'completed' : 'needsAction',
        completed: completed ? new Date().toISOString() : null,
      }),
    },
  );
}

export async function deleteTask(token: string, listId: string, taskId: string): Promise<void> {
  await tasksFetch<void>(
    `${TASKS_BASE}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    { method: 'DELETE' },
  );
}
