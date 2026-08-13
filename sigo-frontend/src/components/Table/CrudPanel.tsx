"use client";

import { useMemo, useState } from "react";
import type { ApiResult } from "@/lib/api";
import { fetchJson } from "@/lib/api";
import { ResultPanel } from "@/components/Table/ResultPanel";

export type ListFieldConfig = {
  key: string;
  label: string;
  itemTemplate: Record<string, unknown>;
};

export type SearchConfig = {
  label: string;
  placeholder: string;
  path: (value: string) => string;
};

export type ActionConfig = {
  label: string;
  path: string;
  method?: "GET" | "POST";
};

export type CrudConfig = {
  key: string;
  label: string;
  description?: string;
  listPath?: string;
  getByIdPath?: (id: string) => string;
  createPath: string;
  updatePath?: (id: string) => string;
  deletePath?: (id: string) => string;
  template: Record<string, unknown>;
  createTemplate?: Record<string, unknown>;
  listFields?: ListFieldConfig[];
  searches?: SearchConfig[];
  actions?: ActionConfig[];
};

type CrudPanelProps = {
  config: CrudConfig;
  baseUrl: string;
  token: string;
};

const toJson = (value: unknown) => JSON.stringify(value, null, 2);

const parseJson = (input: string) => {
  if (!input.trim()) return null;
  return JSON.parse(input);
};

const cloneTemplate = (value: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

export function CrudPanel({ config, baseUrl, token }: CrudPanelProps) {
  const [listResult, setListResult] = useState<ApiResult | null>(null);
  const [getResult, setGetResult] = useState<ApiResult | null>(null);
  const [createJson, setCreateJson] = useState(
    toJson(config.createTemplate ?? config.template)
  );
  const [updateJson, setUpdateJson] = useState(toJson(config.template));
  const [getId, setGetId] = useState("");
  const [updateId, setUpdateId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInputs, setSearchInputs] = useState<Record<string, string>>(() => {
    const entries = config.searches?.map((search) => [search.label, ""]) ?? [];
    return Object.fromEntries(entries);
  });
  const [searchResults, setSearchResults] = useState<
    Record<string, ApiResult | null>
  >({});

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [token]);

  const handleList = async () => {
    if (!config.listPath) return;
    setBusy(true);
    setError(null);
    const result = await fetchJson(baseUrl, config.listPath, {
      method: "GET",
      headers: authHeaders,
    });
    setListResult(result);
    setBusy(false);
  };

  const handleGetById = async () => {
    if (!config.getByIdPath || !getId.trim()) return;
    setBusy(true);
    setError(null);
    const result = await fetchJson(
      baseUrl,
      config.getByIdPath(getId.trim()),
      {
        method: "GET",
        headers: authHeaders,
      }
    );
    setGetResult(result);
    setBusy(false);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = parseJson(createJson);
      const result = await fetchJson(baseUrl, config.createPath, {
        method: "POST",
        headers: authHeaders,
        body: payload,
      });
      setGetResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!config.updatePath || !updateId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = parseJson(updateJson);
      const result = await fetchJson(
        baseUrl,
        config.updatePath(updateId.trim()),
        {
          method: "PUT",
          headers: authHeaders,
          body: payload,
        }
      );
      setGetResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!config.deletePath || !deleteId.trim()) return;
    setBusy(true);
    setError(null);
    const result = await fetchJson(
      baseUrl,
      config.deletePath(deleteId.trim()),
      {
        method: "DELETE",
        headers: authHeaders,
      }
    );
    setGetResult(result);
    setBusy(false);
  };

  const handleAddListItem = (
    field: ListFieldConfig,
    target: "create" | "update"
  ) => {
    const input = target === "create" ? createJson : updateJson;
    const setter = target === "create" ? setCreateJson : setUpdateJson;
    try {
      const parsed = parseJson(input) ?? {};
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Payload must be an object");
      }
      const payload = parsed as Record<string, unknown>;
      const current = payload[field.key];
      const list = Array.isArray(current) ? current : [];
      list.push(cloneTemplate(field.itemTemplate));
      payload[field.key] = list;
      setter(toJson(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const handleSearch = async (search: SearchConfig) => {
    const input = searchInputs[search.label] ?? "";
    if (!input.trim()) return;
    setBusy(true);
    const result = await fetchJson(baseUrl, search.path(input.trim()), {
      method: "GET",
      headers: authHeaders,
    });
    setSearchResults((prev) => ({ ...prev, [search.label]: result }));
    setBusy(false);
  };

  const handleAction = async (action: ActionConfig) => {
    setBusy(true);
    const result = await fetchJson(baseUrl, action.path, {
      method: action.method ?? "GET",
      headers: authHeaders,
    });
    setGetResult(result);
    setBusy(false);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {config.label}
          </h3>
          {config.description ? (
            <p className="text-xs text-slate-500">{config.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-1 text-xs"
          onClick={handleList}
          disabled={busy}
        >
          List
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-rose-600">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {config.getByIdPath ? (
              <input
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs"
                placeholder="ID"
                value={getId}
                onChange={(event) => setGetId(event.target.value)}
              />
            ) : null}
            {config.getByIdPath ? (
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-2 text-xs"
                onClick={handleGetById}
                disabled={busy}
              >
                Get
              </button>
            ) : null}
          </div>
          <ResultPanel title="List" result={listResult} />
          <ResultPanel title="Result" result={getResult} />
        </div>

        <div className="grid gap-2">
          <h4 className="text-xs font-semibold text-slate-600">Create</h4>
          <textarea
            className="h-32 w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
            value={createJson}
            onChange={(event) => setCreateJson(event.target.value)}
          />
          {config.listFields?.length ? (
            <div className="flex flex-wrap gap-2">
              {config.listFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  onClick={() => handleAddListItem(field, "create")}
                >
                  Add {field.label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-xs text-white"
            onClick={handleCreate}
            disabled={busy}
          >
            Create
          </button>
        </div>

        {config.updatePath ? (
          <div className="grid gap-2">
            <h4 className="text-xs font-semibold text-slate-600">Update</h4>
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-xs"
              placeholder="ID"
              value={updateId}
              onChange={(event) => setUpdateId(event.target.value)}
            />
            <textarea
              className="h-32 w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
              value={updateJson}
              onChange={(event) => setUpdateJson(event.target.value)}
            />
            {config.listFields?.length ? (
              <div className="flex flex-wrap gap-2">
                {config.listFields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    onClick={() => handleAddListItem(field, "update")}
                  >
                    Add {field.label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-xs text-white"
              onClick={handleUpdate}
              disabled={busy}
            >
              Update
            </button>
          </div>
        ) : null}

        {config.deletePath ? (
          <div className="grid gap-2">
            <h4 className="text-xs font-semibold text-slate-600">Delete</h4>
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-xs"
              placeholder="ID"
              value={deleteId}
              onChange={(event) => setDeleteId(event.target.value)}
            />
            <button
              type="button"
              className="rounded-md bg-rose-600 px-3 py-2 text-xs text-white"
              onClick={handleDelete}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        ) : null}

        {config.searches?.length ? (
          <div className="grid gap-2">
            <h4 className="text-xs font-semibold text-slate-600">Search</h4>
            <div className="grid gap-3">
              {config.searches.map((search) => (
                <div key={search.label} className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs"
                      placeholder={search.placeholder}
                      value={searchInputs[search.label] ?? ""}
                      onChange={(event) =>
                        setSearchInputs((prev) => ({
                          ...prev,
                          [search.label]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs"
                      onClick={() => handleSearch(search)}
                      disabled={busy}
                    >
                      Search
                    </button>
                  </div>
                  <ResultPanel
                    title={`Search: ${search.label}`}
                    result={searchResults[search.label] ?? null}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {config.actions?.length ? (
          <div className="grid gap-2">
            <h4 className="text-xs font-semibold text-slate-600">Actions</h4>
            <div className="flex flex-wrap gap-2">
              {config.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs"
                  onClick={() => handleAction(action)}
                  disabled={busy}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
