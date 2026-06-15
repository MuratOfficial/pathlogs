/**
 * Минимальный клиент Trello REST API.
 * Аутентификация — пара key + token (пользователь берёт их на https://trello.com/app-key),
 * передаётся в каждом запросе query-параметрами. Нигде не сохраняется.
 */

const API = "https://api.trello.com/1";

export type TrelloAuth = { key: string; token: string };

export type TrelloBoard = { id: string; name: string; closed: boolean };
export type TrelloList = { id: string; name: string; pos: number; closed: boolean };
export type TrelloCheckItem = { name: string; state: string; pos: number };
export type TrelloChecklist = { checkItems?: TrelloCheckItem[] };
export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  pos: number;
  closed: boolean;
  checklists?: TrelloChecklist[];
};

async function trelloFetch<T>(
  path: string,
  auth: TrelloAuth,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${API}${path}`);
  url.searchParams.set("key", auth.key);
  url.searchParams.set("token", auth.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Не удалось связаться с Trello. Проверьте соединение.");
  }
  if (res.status === 401) throw new Error("Неверный ключ или токен Trello");
  if (res.status === 404) throw new Error("Доска не найдена или нет доступа");
  if (!res.ok) throw new Error(`Trello API вернул ошибку ${res.status}`);
  return res.json() as Promise<T>;
}

/** Открытые доски пользователя. */
export async function fetchTrelloBoards(auth: TrelloAuth): Promise<TrelloBoard[]> {
  return trelloFetch<TrelloBoard[]>("/members/me/boards", auth, {
    fields: "name,closed",
    filter: "open",
  });
}

/** Списки (колонки) доски. */
export async function fetchTrelloLists(
  boardId: string,
  auth: TrelloAuth
): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists`, auth, {
    fields: "name,pos,closed",
    filter: "open",
  });
}

/** Карточки доски вместе с вложенными чек-листами. */
export async function fetchTrelloCards(
  boardId: string,
  auth: TrelloAuth
): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/boards/${boardId}/cards`, auth, {
    fields: "name,desc,due,idList,pos,closed",
    checklists: "all",
    checklist_fields: "name",
    filter: "open",
  });
}
