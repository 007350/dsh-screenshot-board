var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// src/core/board.js
function record(value, label) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) fail(label + "\u683C\u5F0F\u4E0D\u6B63\u786E");
  return value;
}
function projectContext(value) {
  const input = record(value, "\u9879\u76EE\u80CC\u666F");
  return Object.fromEntries(Object.keys(CONTEXT_FIELDS).map((key) => [key, text(input[key], 6e3)]));
}
function reproduction(value) {
  const input = record(value, "\u590D\u73B0\u4FE1\u606F");
  return Object.fromEntries(["steps", "actual", "expected", "environment"].map((key) => [key, text(input[key], 6e3)]));
}
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function uid() {
  return crypto.randomUUID();
}
function validId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value);
}
function text(value, max, fallback = "") {
  if (value == null) return fallback;
  if (typeof value !== "string" || value.length > max) fail("\u6587\u672C\u957F\u5EA6\u6216\u683C\u5F0F\u4E0D\u6B63\u786E");
  return value;
}
function date(value) {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) fail("\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E");
  return value;
}
function id(value) {
  if (!validId(value)) fail("\u6807\u8BC6\u65E0\u6548");
  return value;
}
function createBoard(values = {}) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return { schemaVersion: 1, id: uid(), title: values.title || "\u672A\u547D\u540D\u4EFB\u52A1\u677F", projectPath: values.projectPath || "", description: "", context: projectContext(), revision: 0, createdAt: now, updatedAt: now, screenshots: [] };
}
function validateAsset(value) {
  if (!value || !/^[a-f0-9]{64}\.(png|jpg)$/.test(value.id)) fail("\u56FE\u7247\u6807\u8BC6\u65E0\u6548");
  const mime = value.id.endsWith(".png") ? "image/png" : "image/jpeg";
  if (value.mime !== mime) fail("\u56FE\u7247\u7C7B\u578B\u4E0D\u4E00\u81F4");
  for (const key of ["width", "height", "size"]) if (!Number.isSafeInteger(value[key]) || value[key] < 1) fail("\u56FE\u7247\u5C3A\u5BF8\u65E0\u6548");
  if (value.width > 16e3 || value.height > 16e3 || value.width * value.height > 64e6 || value.size > MAX_IMAGE_BYTES) fail("\u56FE\u7247\u8FC7\u5927");
  return { id: value.id, name: text(value.name, 240, "screenshot"), mime, width: value.width, height: value.height, size: value.size };
}
function validateBoard(value) {
  if (!value || value.schemaVersion !== 1) fail("\u4E0D\u652F\u6301\u7684\u4EFB\u52A1\u677F\u7248\u672C");
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) fail("\u4FEE\u8BA2\u53F7\u65E0\u6548");
  if (!Array.isArray(value.screenshots) || value.screenshots.length > 12) fail("\u6BCF\u4E2A\u4EFB\u52A1\u677F\u6700\u591A 12 \u5F20\u622A\u56FE");
  const ids = /* @__PURE__ */ new Set();
  const unique = (value2) => {
    const result = id(value2);
    if (ids.has(result)) fail("\u6807\u8BC6\u91CD\u590D");
    ids.add(result);
    return result;
  };
  let count = 0;
  const screenshots = value.screenshots.map((shot) => {
    if (!shot || !Array.isArray(shot.tasks)) fail("\u622A\u56FE\u4EFB\u52A1\u683C\u5F0F\u4E0D\u6B63\u786E");
    count += shot.tasks.length;
    if (count > 300) fail("\u4EFB\u52A1\u6570\u91CF\u8D85\u8FC7 300 \u6761");
    return {
      id: unique(shot.id),
      title: text(shot.title, 120, "\u622A\u56FE"),
      original: validateAsset(shot.original),
      after: shot.after ? validateAsset(shot.after) : null,
      tasks: shot.tasks.map((task) => {
        if (!task || !Object.hasOwn(STATUSES, task.status)) fail("\u4EFB\u52A1\u72B6\u6001\u65E0\u6548");
        if (!Object.hasOwn(PRIORITIES, task.priority)) fail("\u4EFB\u52A1\u4F18\u5148\u7EA7\u65E0\u6548");
        const kind = task.kind ?? "visual", clarity = task.clarity ?? "draft";
        if (!["visual", "interaction"].includes(kind)) fail("\u95EE\u9898\u7C7B\u578B\u65E0\u6548");
        if (!["draft", "confirmed"].includes(clarity)) fail("\u9700\u6C42\u786E\u8BA4\u72B6\u6001\u65E0\u6548");
        const r = task.rect;
        if (!r || !["x", "y", "w", "h"].every((k) => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1) || r.w < 1e-4 || r.h < 1e-4 || r.x + r.w > 1.00000001 || r.y + r.h > 1.00000001) fail("\u6279\u6CE8\u533A\u57DF\u65E0\u6548");
        if (!Array.isArray(task.history) || task.history.length > 100) fail("\u5386\u53F2\u8BB0\u5F55\u683C\u5F0F\u4E0D\u6B63\u786E");
        return {
          id: unique(task.id),
          title: text(task.title, 160, "\u4FEE\u6539\u70B9"),
          note: text(task.note, 8e3),
          requirement: text(task.requirement, 1e4),
          acceptance: text(task.acceptance, 6e3),
          kind,
          clarity,
          clarification: text(task.clarification, 6e3),
          reproduction: reproduction(task.reproduction),
          status: task.status,
          priority: task.priority,
          rect: { x: r.x, y: r.y, w: r.w, h: r.h },
          history: task.history.map((h) => ({ id: id(h.id), text: text(h.text, 2e3), createdAt: date(h.createdAt) }))
        };
      })
    };
  });
  return {
    schemaVersion: 1,
    id: id(value.id),
    title: text(value.title, 120, "\u672A\u547D\u540D\u4EFB\u52A1\u677F"),
    projectPath: text(value.projectPath, 1e3),
    description: text(value.description, 8e3),
    context: projectContext(value.context),
    revision: value.revision,
    createdAt: date(value.createdAt),
    updatedAt: date(value.updatedAt),
    screenshots
  };
}
function shotFiles(shot, index) {
  const prefix = "images/" + String(index + 1).padStart(2, "0");
  return {
    original: prefix + "-original." + (shot.original.mime === "image/png" ? "png" : "jpg"),
    annotated: prefix + "-annotated.png",
    after: shot.after ? prefix + "-after." + (shot.after.mime === "image/png" ? "png" : "jpg") : null
  };
}
var FORMAT, STATUSES, PRIORITIES, CONTEXT_FIELDS, MAX_IMAGE_BYTES, MAX_EXPORT_BYTES;
var init_board = __esm({
  "src/core/board.js"() {
    FORMAT = "dsh-screenshot-board";
    STATUSES = { todo: "\u5F85\u5904\u7406", doing: "\u5904\u7406\u4E2D", review: "\u5F85\u9A8C\u6536", accepted: "\u5DF2\u901A\u8FC7", returned: "\u9700\u4FEE\u6539" };
    PRIORITIES = { low: "\u4F4E", normal: "\u4E2D", high: "\u9AD8" };
    CONTEXT_FIELDS = { startup: "\u542F\u52A8\u65B9\u5F0F", url: "\u8BBF\u95EE\u5730\u5740", entry: "\u9875\u9762\u5165\u53E3", conditions: "\u5FC5\u8981\u64CD\u4F5C\u6761\u4EF6", files: "\u76F8\u5173\u6587\u4EF6\u7EBF\u7D22", scope: "\u5141\u8BB8\u4FEE\u6539\u7684\u8303\u56F4", unknowns: "\u672A\u77E5\u4E0E\u5F85\u786E\u8BA4\u4FE1\u606F" };
    MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    MAX_EXPORT_BYTES = 48 * 1024 * 1024;
  }
});

// src/core/handoff.js
var handoff_exports = {};
__export(handoff_exports, {
  handoffForBoard: () => handoffForBoard,
  markdownForHandoff: () => markdownForHandoff,
  taskIssues: () => taskIssues
});
function taskIssues(task) {
  const missing = [];
  if (task.clarity !== "confirmed") missing.push("\u9700\u6C42\u5C1A\u672A\u7531\u7528\u6237\u786E\u8BA4");
  if (!task.requirement?.trim()) missing.push("\u7F3A\u5C11\u671F\u671B\u4FEE\u6539");
  if (!task.acceptance?.trim()) missing.push("\u7F3A\u5C11\u9A8C\u6536\u6761\u4EF6");
  if (task.clarification?.trim()) missing.push("\u4ECD\u6709\u5F85\u6F84\u6E05\u95EE\u9898");
  if (task.kind === "interaction") {
    for (const [key, label] of [["steps", "\u590D\u73B0\u6B65\u9AA4"], ["actual", "\u5B9E\u9645\u7ED3\u679C"], ["expected", "\u9884\u671F\u7ED3\u679C"]]) {
      if (!task.reproduction?.[key]?.trim()) missing.push("\u7F3A\u5C11" + label);
    }
  }
  return missing;
}
function handoffForBoard(input, selection, exportedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const b = validateBoard(input);
  const tasks = b.screenshots.flatMap((s, i) => s.tasks.map((t, n) => ({ ...t, shotId: s.id, number: `${i + 1}.${n + 1}` })));
  const known = new Map(tasks.map((t) => [t.id, t])), used = /* @__PURE__ */ new Set();
  if (!Number.isFinite(Date.parse(exportedAt)) || exportedAt.length > 40) fail("\u5BFC\u51FA\u65F6\u95F4\u65E0\u6548");
  if (selection != null && (typeof selection !== "object" || Array.isArray(selection))) fail("\u4EA4\u63A5\u8303\u56F4\u683C\u5F0F\u4E0D\u6B63\u786E");
  const plan = { format: "dsh-screenshot-handoff", version: 1, boardId: b.id, revision: b.revision, boardUpdatedAt: b.updatedAt, exportedAt };
  for (const key of ["executionTaskIds", "referenceTaskIds", "clarificationTaskIds"]) {
    const defaults = tasks.filter((t) => {
      const reference = ["accepted", "review"].includes(t.status);
      return key === "referenceTaskIds" ? reference : !reference && (key === "executionTaskIds" ? !taskIssues(t).length : !!taskIssues(t).length);
    }).map((t) => t.id);
    const ids = selection == null ? defaults : selection[key] ?? [];
    if (!Array.isArray(ids) || ids.length > 300) fail("\u4EA4\u63A5\u8303\u56F4\u683C\u5F0F\u4E0D\u6B63\u786E");
    for (const id2 of ids) {
      if (!known.has(id2)) fail("\u4EA4\u63A5\u8303\u56F4\u542B\u5DF2\u5220\u9664\u6216\u672A\u77E5\u4EFB\u52A1");
      if (used.has(id2)) fail("\u4EA4\u63A5\u8303\u56F4\u4EFB\u52A1\u91CD\u590D");
      used.add(id2);
      if (key === "executionTaskIds" && taskIssues(known.get(id2)).length) fail("\u6267\u884C\u4EFB\u52A1\u9700\u8981\u5148\u8865\u9F50\u5E76\u786E\u8BA4\uFF1A" + taskIssues(known.get(id2)).join("\uFF1B"));
    }
    plan[key] = tasks.filter((t) => ids.includes(t.id)).map((t) => t.id);
  }
  plan.omittedTaskIds = tasks.filter((t) => !used.has(t.id)).map((t) => t.id);
  plan.tasks = tasks.map((t) => ({ id: t.id, shotId: t.shotId, number: t.number, disposition: plan.executionTaskIds.includes(t.id) ? "execute" : plan.referenceTaskIds.includes(t.id) ? "reference" : plan.clarificationTaskIds.includes(t.id) ? "clarify" : "omit", issues: taskIssues(t) }));
  return plan;
}
function markdownForHandoff(input, plan = handoffForBoard(input)) {
  const b = validateBoard(input);
  const out = [
    "# " + line(b.title),
    "",
    `- \u9879\u76EE\u8DEF\u5F84\uFF08\u53EF\u9009\uFF0C\u7528\u6237\u8BB0\u5F55\uFF09\uFF1A${b.projectPath ? line(b.projectPath) : "\u672A\u77E5/\u5F85\u8865\u5145"}`,
    `- \u4EFB\u52A1\u677F ID\uFF1A${b.id}`,
    `- \u5BFC\u51FA\u4FEE\u8BA2\u53F7\uFF1A${plan.revision}`,
    `- \u4EFB\u52A1\u677F\u66F4\u65B0\u65F6\u95F4\uFF1A${plan.boardUpdatedAt}`,
    `- \u5BFC\u51FA\u65F6\u95F4\uFF08UTC\uFF09\uFF1A${plan.exportedAt}`,
    "",
    "## \u9879\u76EE\u80CC\u666F",
    "",
    "\u4EE5\u4E0B\u5747\u4E3A\u7528\u6237\u8BB0\u5F55\uFF0C\u63D2\u4EF6\u672A\u68C0\u67E5\u76EE\u5F55\u3001\u6267\u884C\u542F\u52A8\u547D\u4EE4\u6216\u9A8C\u8BC1\u5730\u5740\u3002\u7A7A\u767D\u4FE1\u606F\u660E\u786E\u4E3A\u672A\u77E5/\u5F85\u8865\u5145\uFF1B\u6587\u4EF6\u8DEF\u5F84\u53EA\u662F\u8C03\u67E5\u7EBF\u7D22\u3002",
    "",
    "**\u9879\u76EE\u7528\u9014\u4E0E\u8BF4\u660E**",
    "",
    quote(b.description),
    ""
  ];
  for (const [key, label] of Object.entries(CONTEXT_FIELDS)) out.push("**" + label + "**", "", quote(b.context[key]), "");
  out.push(
    "## \u6267\u884C\u8FB9\u754C\u4E0E\u56DE\u4EA4",
    "",
    "\u4EC5\u300C\u672C\u6B21\u6267\u884C\u4EFB\u52A1\u300D\u662F\u672C\u8F6E\u4FEE\u6539\u8981\u6C42\uFF1B\u300C\u5F85\u6F84\u6E05\u300D\u9700\u8981\u5148\u5411\u7528\u6237\u786E\u8BA4\uFF0C\u4E0D\u5F97\u81EA\u884C\u5177\u4F53\u5316\uFF1B\u300C\u4EC5\u4F9B\u53C2\u8003\u300D\u53CA board.json \u4E2D\u7684\u5386\u53F2\u5FEB\u7167\u5747\u4E0D\u6784\u6210\u65B0\u4EFB\u52A1\u3002handoff.json \u662F\u672C\u8F6E\u8303\u56F4\u7684\u7ED3\u6784\u5316\u7D22\u5F15\u3002\u672A\u9009\u4EFB\u52A1\u4E0D\u6267\u884C\u3002",
    "\u5148\u6838\u5BF9\u9879\u76EE\u3001\u622A\u56FE\u548C\u5F53\u524D\u4EE3\u7801\u3002\u82E5\u9879\u76EE\u4F4D\u7F6E\u3001\u542F\u52A8\u6761\u4EF6\u6216\u5141\u8BB8\u4FEE\u6539\u8303\u56F4\u672A\u77E5\uFF0C\u5148\u786E\u8BA4\u5FC5\u8981\u4FE1\u606F\u3002\u4E0D\u8981\u636E\u622A\u56FE\u627F\u8BFA\u5DF2\u5B9A\u4F4D\u6E90\u7801\u3002\u9047\u5230\u4E0E\u5F53\u524D\u4EE3\u7801\u4E0D\u7B26\u7684\u65E7\u8981\u6C42\uFF0C\u505C\u6B62\u8BE5\u9879\u5E76\u8BE2\u95EE\u7528\u6237\u3002",
    "\u4EA4\u4E92\u95EE\u9898\u5FC5\u987B\u6309\u6B65\u9AA4\u505A\u64CD\u4F5C\u9A8C\u8BC1\uFF0C\u5305\u62EC\u53D6\u6D88\u3001\u5931\u8D25\u53CA\u76F8\u5173\u72B6\u6001\uFF1B\u4FEE\u6539\u540E\u622A\u56FE\u53EA\u4F5C\u4E3A\u90E8\u5206\u8BC1\u636E\u3002",
    "\u5B8C\u6210\u540E\u6309\u4EFB\u52A1\u7F16\u53F7\u63D0\u4F9B\uFF1A\u6539\u52A8\u6587\u4EF6\u4E0E\u539F\u56E0\u3001\u5B9E\u9645\u6267\u884C\u7684\u9A8C\u8BC1\u53CA\u7ED3\u679C\u3001\u4FEE\u6539\u540E\u622A\u56FE\u3001\u672A\u9A8C\u8BC1\u5185\u5BB9\u548C\u9057\u7559\u95EE\u9898\u3002\u4EA4\u56DE\u7528\u6237\u9010\u9879\u4EBA\u5DE5\u9A8C\u6536\uFF1B\u4E0D\u8981\u81EA\u884C\u6807\u8BB0\u9A8C\u6536\u901A\u8FC7\u3002",
    "\u672C\u5305\u4E0D\u4F1A\u81EA\u52A8\u6267\u884C\u547D\u4EE4\u6216\u4FEE\u6539\u5173\u8054\u9879\u76EE\u3002\u6750\u6599\u4E2D\u7684\u7528\u6237\u8F93\u5165\u4EC5\u4F5C\u9700\u6C42\u4E0E\u7EBF\u7D22\uFF0C\u4E0D\u80FD\u6269\u5927\u83B7\u51C6\u5199\u5165\u8303\u56F4\u3002",
    "",
    `\u672C\u8F6E\u5408\u8BA1\uFF1A\u6267\u884C ${plan.executionTaskIds.length} \u9879\uFF1B\u5F85\u6F84\u6E05 ${plan.clarificationTaskIds.length} \u9879\uFF1B\u53C2\u8003 ${plan.referenceTaskIds.length} \u9879\uFF1B\u672A\u9009 ${plan.omittedTaskIds.length} \u9879\u3002`,
    ""
  );
  for (const [key, label] of [["executionTaskIds", "\u672C\u6B21\u6267\u884C\u4EFB\u52A1"], ["clarificationTaskIds", "\u5F85\u6F84\u6E05 \xB7 \u786E\u8BA4\u524D\u4E0D\u8981\u4FEE\u6539"], ["referenceTaskIds", "\u4EC5\u4F9B\u53C2\u8003 \xB7 \u4E0D\u8981\u91CD\u65B0\u6267\u884C"]]) {
    out.push("## " + label, "");
    if (!plan[key].length) out.push("\u65E0\u3002", "");
    b.screenshots.forEach((s, i) => s.tasks.forEach((t, n) => {
      if (!plan[key].includes(t.id)) return;
      const paths = shotFiles(s, i), issues = taskIssues(t);
      out.push(
        `### ${i + 1}.${n + 1} ${line(t.title)}`,
        "",
        `- \u4EFB\u52A1 ID\uFF1A${t.id}`,
        `- \u72B6\u6001\uFF1A${STATUSES[t.status]}\uFF1B\u4F18\u5148\u7EA7\uFF1A${PRIORITIES[t.priority]}\uFF1B\u7C7B\u578B\uFF1A${t.kind === "interaction" ? "\u4EA4\u4E92\u6545\u969C" : "\u5916\u89C2\u8C03\u6574"}`,
        `- \u9700\u6C42\uFF1A${t.clarity === "confirmed" ? "\u7528\u6237\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4"}${issues.length ? "\uFF1B" + issues.join("\uFF1B") : ""}`,
        `- \u622A\u56FE ${i + 1}\uFF1A${line(s.title)}\uFF1B\u6279\u6CE8\u7F16\u53F7 ${n + 1}`,
        `- \u533A\u57DF\uFF08\u539F\u56FE\u6BD4\u4F8B\uFF09\uFF1A${["x", "y", "w", "h"].map((k) => k + "=" + t.rect[k].toFixed(4)).join(", ")}`,
        "",
        `[\u539F\u56FE](${paths.original}) \xB7 [\u7F16\u53F7\u6279\u6CE8\u56FE](${paths.annotated})${paths.after ? " \xB7 [\u4FEE\u6539\u540E\u53C2\u8003](" + paths.after + ")" : ""}`,
        ""
      );
      for (const [title, value] of [["\u539F\u59CB\u6279\u6CE8", t.note], ["\u671F\u671B\u4FEE\u6539", t.requirement], ["\u9A8C\u6536\u6761\u4EF6", t.acceptance]]) out.push("**" + title + "**", "", quote(value), "");
      if (t.clarification) out.push("**\u5F85\u6F84\u6E05\u95EE\u9898**", "", quote(t.clarification), "");
      if (t.kind === "interaction") for (const [key2, title] of [["steps", "\u590D\u73B0\u6B65\u9AA4"], ["actual", "\u5B9E\u9645\u7ED3\u679C"], ["expected", "\u9884\u671F\u7ED3\u679C"], ["environment", "\u73AF\u5883\u4E0E\u64CD\u4F5C\u6761\u4EF6"]]) out.push("**" + title + "**", "", quote(t.reproduction[key2]), "");
      if (t.history.length) out.push("**\u5386\u53F2\u8BB0\u5F55 \xB7 \u4EC5\u4F9B\u53C2\u8003**", "", ...t.history.flatMap((h) => ["- " + h.createdAt, quote(h.text), ""]));
    }));
  }
  return out.join("\n");
}
var line, quote;
var init_handoff = __esm({
  "src/core/handoff.js"() {
    init_board();
    line = (s) => String(s || "").replace(/[\r\n]+/g, " ").replace(/[\\\x60*_{}\[\]<>#|]/g, "\\$&");
    quote = (s) => String(s?.trim() || "\u672A\u77E5/\u5F85\u8865\u5145").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).split(/\r?\n/).map((x) => "> " + x).join("\n");
  }
});

// src/host/index.js
import { join as join2 } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

// src/host/storage.js
init_board();
import { mkdir, readFile, writeFile, rename, readdir, unlink } from "node:fs/promises";
import { join, basename } from "node:path";
import { createHash, randomUUID } from "node:crypto";
function imageInfo(bytes) {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(png) && bytes.toString("ascii", 12, 16) === "IHDR" && bytes.readUInt32BE(8) === 13 && bytes.subarray(-8, -4).toString() === "IEND") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), mime: "image/png", ext: "png" };
  }
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) {
    let pos = 2;
    while (pos + 4 < bytes.length) {
      if (bytes[pos++] !== 255) break;
      while (bytes[pos] === 255) pos++;
      const marker = bytes[pos++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      const len = bytes.readUInt16BE(pos);
      if (len < 2 || pos + len > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && len >= 8) {
        return { width: bytes.readUInt16BE(pos + 5), height: bytes.readUInt16BE(pos + 3), mime: "image/jpeg", ext: "jpg" };
      }
      pos += len;
    }
  }
  fail("\u4EC5\u652F\u6301\u6709\u6548\u7684 PNG \u6216 JPEG \u56FE\u7247");
}
function decodeImage(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_IMAGE_BYTES * 1.4 + 100) fail("\u56FE\u7247\u8D85\u8FC7 8 MB \u9650\u5236", 413);
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m || m[2].length % 4 !== 0) fail("\u56FE\u7247\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) fail("\u56FE\u7247\u8D85\u8FC7 8 MB \u9650\u5236", 413);
  const info = imageInfo(bytes);
  if (info.mime !== m[1]) fail("\u56FE\u7247\u5185\u5BB9\u4E0E\u7C7B\u578B\u4E0D\u4E00\u81F4");
  validateAsset({ ...info, id: "a".repeat(64) + "." + info.ext, name: "", size: bytes.length });
  return { bytes, ...info };
}
var BoardStore = class {
  constructor(root) {
    this.root = root;
    this.queues = /* @__PURE__ */ new Map();
  }
  async init() {
    await mkdir(join(this.root, "boards"), { recursive: true });
    await mkdir(join(this.root, "assets"), { recursive: true });
  }
  async locked(key, fn) {
    const prior = this.queues.get(key) || Promise.resolve();
    const next = prior.catch(() => {
    }).then(fn);
    this.queues.set(key, next);
    try {
      return await next;
    } finally {
      if (this.queues.get(key) === next) this.queues.delete(key);
    }
  }
  boardPath(id2) {
    if (!validId(id2)) fail("\u4EFB\u52A1\u677F\u6807\u8BC6\u65E0\u6548");
    return join(this.root, "boards", id2 + ".json");
  }
  async get(id2) {
    try {
      return validateBoard(JSON.parse(await readFile(this.boardPath(id2), "utf8")));
    } catch (e) {
      if (e.code === "ENOENT") fail("\u4EFB\u52A1\u677F\u4E0D\u5B58\u5728", 404);
      throw e;
    }
  }
  async list() {
    await this.init();
    const files = (await readdir(join(this.root, "boards"))).filter((f) => /^[a-zA-Z0-9_-]+\.json$/.test(f));
    const result = [];
    for (const file of files) {
      try {
        const b = await this.get(file.slice(0, -5));
        const tasks = b.screenshots.flatMap((s) => s.tasks);
        result.push({
          id: b.id,
          title: b.title,
          projectPath: b.projectPath,
          updatedAt: b.updatedAt,
          screenshots: b.screenshots.length,
          tasks: tasks.length,
          accepted: tasks.filter((t) => t.status === "accepted").length
        });
      } catch (e) {
        console.warn("[dsh-screenshot-board] \u65E0\u6CD5\u8BFB\u53D6\u4EFB\u52A1\u677F " + file + ": " + e.message);
      }
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async write(board) {
    await this.init();
    const target = this.boardPath(board.id), temp = target + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temp, JSON.stringify(board, null, 2), { encoding: "utf8", flag: "wx" });
      await rename(temp, target);
    } finally {
      await unlink(temp).catch((e) => {
        if (e.code !== "ENOENT") console.warn(e.message);
      });
    }
    return board;
  }
  async create(values = {}) {
    return this.write(validateBoard(createBoard(values)));
  }
  async save(input) {
    const board = validateBoard(input);
    return this.locked(board.id, async () => {
      const current = await this.get(board.id);
      if (board.revision !== current.revision) fail("\u4EFB\u52A1\u677F\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\u3002\u8BF7\u5148\u5907\u4EFD\u5F53\u524D\u7F16\u8F91\uFF0C\u518D\u91CD\u65B0\u8F7D\u5165\u3002", 409);
      let total = 0;
      for (const shot of board.screenshots) for (const asset of [shot.original, shot.after].filter(Boolean)) {
        const actual = await this.asset(asset.id);
        const info = imageInfo(actual);
        if (info.width !== asset.width || info.height !== asset.height || actual.length !== asset.size) fail("\u56FE\u7247\u4FE1\u606F\u4E0D\u5339\u914D");
        total += actual.length;
      }
      if (total > MAX_EXPORT_BYTES) fail("\u4E00\u4E2A\u4EFB\u52A1\u677F\u7684\u56FE\u7247\u603B\u91CF\u4E0D\u80FD\u8D85\u8FC7 48 MB", 413);
      board.createdAt = current.createdAt;
      board.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      board.revision = current.revision + 1;
      return this.write(board);
    });
  }
  async remove(id2, revision) {
    return this.locked(id2, async () => {
      const current = await this.get(id2);
      if (current.revision !== revision) fail("\u4EFB\u52A1\u677F\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u540E\u518D\u5220\u9664", 409);
      await unlink(this.boardPath(id2));
    });
  }
  async addAsset({ dataUrl, name: name2 }) {
    await this.init();
    const image = decodeImage(dataUrl);
    const id2 = createHash("sha256").update(image.bytes).digest("hex") + "." + image.ext;
    const target = join(this.root, "assets", id2);
    try {
      await writeFile(target, image.bytes, { flag: "wx" });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    return { id: id2, name: basename(String(name2 || "screenshot").replaceAll("\\", "/")).slice(0, 240), mime: image.mime, width: image.width, height: image.height, size: image.bytes.length };
  }
  async asset(id2) {
    if (typeof id2 !== "string" || !/^[a-f0-9]{64}\.(png|jpg)$/.test(id2)) fail("\u56FE\u7247\u6807\u8BC6\u65E0\u6548");
    try {
      return await readFile(join(this.root, "assets", id2));
    } catch (e) {
      if (e.code === "ENOENT") fail("\u56FE\u7247\u4E0D\u5B58\u5728", 404);
      throw e;
    }
  }
  async portable(input) {
    const board = validateBoard(input), assets = {};
    for (const s of board.screenshots) for (const a of [s.original, s.after].filter(Boolean)) {
      if (!assets[a.id]) assets[a.id] = "data:" + a.mime + ";base64," + (await this.asset(a.id)).toString("base64");
    }
    return { format: FORMAT, version: 1, board, assets };
  }
  async importPortable(input) {
    if (!input || input.format !== FORMAT || input.version !== 1 || !input.assets || typeof input.assets !== "object" || Array.isArray(input.assets)) fail("\u8BF7\u9009\u62E9\u672C\u63D2\u4EF6\u5BFC\u51FA\u7684\u5907\u4EFD JSON");
    const board = validateBoard(input.board);
    let total = 0;
    const checked = /* @__PURE__ */ new Map();
    for (const s of board.screenshots) for (const a of [s.original, s.after].filter(Boolean)) if (!checked.has(a.id)) {
      const dataUrl = input.assets[a.id];
      const image = decodeImage(dataUrl);
      const hash = createHash("sha256").update(image.bytes).digest("hex") + "." + image.ext;
      if (hash !== a.id || image.width !== a.width || image.height !== a.height || image.bytes.length !== a.size) fail("\u5907\u4EFD\u56FE\u7247\u6821\u9A8C\u5931\u8D25");
      total += image.bytes.length;
      if (total > MAX_EXPORT_BYTES) fail("\u5907\u4EFD\u56FE\u7247\u603B\u91CF\u8D85\u8FC7 48 MB", 413);
      checked.set(a.id, { dataUrl, name: a.name });
    }
    for (const a of checked.values()) await this.addAsset(a);
    board.id = randomUUID();
    board.title = board.title.slice(0, 110) + " \xB7 \u5BFC\u5165";
    board.revision = 0;
    board.createdAt = board.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return this.write(board);
  }
};

// src/host/router.js
init_board();
import { randomBytes, timingSafeEqual } from "node:crypto";

// src/core/zip.js
var table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  table[n] = c >>> 0;
}
function crc32(bytes) {
  let c = 4294967295;
  for (const x of bytes) c = table[(c ^ x) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function createZip(entries) {
  if (entries.length > 65535) throw new Error("Too many ZIP entries");
  const parts = [], directory = [], names = /* @__PURE__ */ new Set();
  let offset = 0;
  for (const { name: name2, data } of entries) {
    if (!name2 || /(^\/|\\|(^|\/)\.\.(\/|$)|^[a-z]:|\0)/i.test(name2) || names.has(name2)) throw new Error("Unsafe or duplicate ZIP entry");
    names.add(name2);
    const path = Buffer.from(name2, "utf8"), body = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    if (path.length > 65535 || body.length > 4294967295) throw new Error("ZIP entry too large");
    const crc = crc32(body), local = Buffer.alloc(30);
    local.writeUInt32LE(67324752);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(2048, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(path.length, 26);
    parts.push(local, path, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(33639248);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(2048, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(path.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, path);
    offset += local.length + path.length + body.length;
    if (offset > 4294967295) throw new Error("ZIP archive too large");
  }
  const centralSize = directory.reduce((sum, x) => sum + x.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(101010256);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}

// src/host/export.js
init_board();
init_handoff();
async function exportBoard(store, board, rendered = {}, selection) {
  if (!rendered || typeof rendered !== "object" || Array.isArray(rendered)) fail("\u6279\u6CE8\u56FE\u683C\u5F0F\u4E0D\u6B63\u786E");
  const handoff = handoffForBoard(board, selection);
  const entries = [], index = [];
  let total = 0;
  async function add(name2, bytes) {
    total += bytes.length;
    if (total > MAX_EXPORT_BYTES * 2) fail("\u4EA4\u63A5\u5305\u56FE\u7247\u8D85\u8FC7 96 MB", 413);
    entries.push({ name: name2, data: bytes });
  }
  for (let i = 0; i < board.screenshots.length; i++) {
    const shot = board.screenshots[i], paths = shotFiles(shot, i);
    const original = await store.asset(shot.original.id);
    await add(paths.original, original);
    if (Object.hasOwn(rendered, shot.id) && rendered[shot.id]) {
      const annotation = decodeImage(rendered[shot.id]);
      if (annotation.mime !== "image/png" || annotation.width !== shot.original.width || annotation.height !== shot.original.height) fail("\u6279\u6CE8\u56FE\u5C3A\u5BF8\u4E0E\u539F\u56FE\u4E0D\u4E00\u81F4");
      await add(paths.annotated, annotation.bytes);
    } else {
      if (shot.tasks.length || shot.original.mime !== "image/png") fail("\u8BF7\u901A\u8FC7\u4EFB\u52A1\u677F\u5BFC\u51FA\uFF0C\u4EE5\u751F\u6210\u5B8C\u6574\u6279\u6CE8\u56FE");
      await add(paths.annotated, original);
    }
    if (shot.after) await add(paths.after, await store.asset(shot.after.id));
    index.push({ id: shot.id, files: paths });
  }
  entries.push({ name: "tasks.md", data: markdownForHandoff(board, handoff) });
  entries.push({ name: "handoff.json", data: JSON.stringify(handoff, null, 2) });
  entries.push({ name: "board.json", data: JSON.stringify({ ...board, snapshotPurpose: "\u5B8C\u6574\u80CC\u666F\u5FEB\u7167\uFF1B\u6267\u884C\u8303\u56F4\u4EE5 handoff.json \u4E3A\u51C6\uFF0C\u672A\u9009\u4EFB\u52A1\u4E0D\u6267\u884C", handoff, exportedFiles: index }, null, 2) });
  entries.push({ name: "README.txt", data: "\u622A\u56FE\u4EFB\u52A1\u4EA4\u63A5\u5305\n\n\u5148\u9605\u8BFB tasks.md\u3002\u53EA\u6267\u884C\u300C\u672C\u6B21\u6267\u884C\u4EFB\u52A1\u300D\uFF1B\u5F85\u6F84\u6E05\u4EFB\u52A1\u9700\u5148\u8BE2\u95EE\u7528\u6237\uFF1B\u53C2\u8003\u4E0E\u672A\u9009\u4EFB\u52A1\u4E0D\u8981\u91CD\u65B0\u4FEE\u6539\u3002\nhandoff.json \u662F\u5BFC\u51FA\u65F6\u7684\u4EFB\u52A1\u8303\u56F4\u3001\u677F\u4FEE\u8BA2\u53F7\u548C UTC \u65F6\u95F4\u5FEB\u7167\u3002board.json \u53CA\u5168\u90E8\u56FE\u7247\u662F\u5B8C\u6574\u80CC\u666F\uFF0C\u4E0D\u662F\u989D\u5916\u6267\u884C\u6E05\u5355\u3002\u7F16\u53F7\u91C7\u7528\u622A\u56FE\u53F7.\u6279\u6CE8\u53F7\uFF0C\u4E0E\u7F16\u53F7\u56FE\u4E00\u81F4\u3002\n\u4EA4\u4E92\u95EE\u9898\u9700\u8981\u64CD\u4F5C\u9A8C\u8BC1\uFF0C\u4FEE\u6539\u540E\u622A\u56FE\u4EC5\u4E3A\u90E8\u5206\u8BC1\u636E\u3002\u6309\u4EFB\u52A1\u53F7\u56DE\u4EA4\u6539\u52A8\u3001\u9A8C\u8BC1\u7ED3\u679C\u53CA\u9057\u7559\u95EE\u9898\uFF0C\u7531\u7528\u6237\u4EBA\u5DE5\u9A8C\u6536\u3002\n\u6B64 ZIP \u7528\u4E8E\u4EA4\u63A5\uFF1B\u6062\u590D\u63D2\u4EF6\u4F7F\u7528\u300C\u5907\u4EFD JSON\u300D\u3002\u672C\u5305\u4E0D\u4F1A\u81EA\u52A8\u6267\u884C\u4EE3\u7801\u3002\n" });
  return createZip(entries);
}

// src/host/router.js
var ROUTE_PREFIX = "/dsh-screenshot-board";
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
async function readJson(req, limit) {
  if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) fail("\u8BF7\u6C42\u9700\u8981 JSON \u683C\u5F0F", 415);
  if (Number(req.headers["content-length"] || 0) > limit) fail("\u8BF7\u6C42\u8D85\u8FC7\u5927\u5C0F\u9650\u5236", 413);
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) fail("\u8BF7\u6C42\u8D85\u8FC7\u5927\u5C0F\u9650\u5236", 413);
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail("JSON \u6570\u636E\u4E0D\u5B8C\u6574\u6216\u683C\u5F0F\u4E0D\u6B63\u786E");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("\u8BF7\u6C42\u9700\u8981 JSON \u5BF9\u8C61");
  return value;
}
function createHandler({ store, log = console }) {
  const token = randomBytes(32).toString("hex");
  return async (req, res) => {
    try {
      let path = new URL(req.url || "/", "http://localhost").pathname;
      if (path.startsWith(ROUTE_PREFIX + "/")) path = path.slice(ROUTE_PREFIX.length);
      const method = req.method || "GET";
      if (path === "/api/session" && method === "GET") return json(res, 200, { token, version: "0.2.0" });
      if (!["GET", "POST", "PUT", "DELETE"].includes(method)) fail("\u4E0D\u652F\u6301\u7684\u8BF7\u6C42\u65B9\u5F0F", 405);
      if (method !== "GET") {
        const received = req.headers["x-screenshot-board-token"];
        if (typeof received !== "string" || Buffer.byteLength(received) !== token.length || !timingSafeEqual(Buffer.from(received), Buffer.from(token))) fail("\u64CD\u4F5C\u9A8C\u8BC1\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u4EFB\u52A1\u677F", 403);
      }
      if (path === "/api/boards" && method === "GET") return json(res, 200, await store.list());
      if (path === "/api/boards" && method === "POST") return json(res, 201, await store.create(await readJson(req, 32e3)));
      if (path === "/api/assets" && method === "POST") return json(res, 201, await store.addAsset(await readJson(req, 12 * 1024 * 1024)));
      if (path === "/api/import" && method === "POST") return json(res, 201, await store.importPortable(await readJson(req, 72 * 1024 * 1024)));
      const assetMatch = /^\/api\/assets\/([a-f0-9]{64}\.(?:png|jpg))$/.exec(path);
      if (assetMatch && method === "GET") {
        const data = await store.asset(assetMatch[1]);
        res.writeHead(200, { "content-type": assetMatch[1].endsWith(".png") ? "image/png" : "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" });
        return res.end(data);
      }
      const match = /^\/api\/boards\/([a-zA-Z0-9_-]+)(?:\/(export|portable|markdown))?$/.exec(path);
      if (match) {
        const [, id2, action] = match;
        if (!action && method === "GET") return json(res, 200, await store.get(id2));
        if (!action && method === "PUT") {
          const input = await readJson(req, 4 * 1024 * 1024);
          if (input.id !== id2) fail("\u4EFB\u52A1\u677F\u6807\u8BC6\u4E0D\u4E00\u81F4");
          return json(res, 200, await store.save(input));
        }
        if (!action && method === "DELETE") {
          const input = await readJson(req, 1e3);
          await store.remove(id2, input.revision);
          return json(res, 200, { ok: true });
        }
        const board = await store.get(id2);
        if (action === "portable" && method === "GET") return json(res, 200, await store.portable(board));
        if (action === "markdown" && method === "GET") {
          const { markdownForHandoff: markdownForHandoff2 } = await Promise.resolve().then(() => (init_handoff(), handoff_exports));
          return json(res, 200, { markdown: markdownForHandoff2(board) });
        }
        if (action === "export" && method === "POST") {
          const input = await readJson(req, 72 * 1024 * 1024);
          if (input.revision !== board.revision) fail("\u4EFB\u52A1\u677F\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u4FDD\u5B58\u540E\u91CD\u8BD5\u5BFC\u51FA", 409);
          const zip = await exportBoard(store, board, input.rendered, input.selection);
          res.writeHead(200, { "content-type": "application/zip", "content-disposition": 'attachment; filename="screenshot-handoff.zip"', "cache-control": "no-store", "x-content-type-options": "nosniff" });
          return res.end(zip);
        }
      }
      fail("\u63A5\u53E3\u4E0D\u5B58\u5728", 404);
    } catch (e) {
      if (res.destroyed || res.writableEnded) return;
      const status = Number.isInteger(e.status) ? e.status : 500;
      if (status === 500) log.error?.("[dsh-screenshot-board]", e);
      json(res, status, { error: status === 500 ? "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5BBF\u4E3B\u65E5\u5FD7\u6216\u78C1\u76D8\u7A7A\u95F4" : e.message });
    }
  };
}

// src/host/index.js
var name = "dsh-screenshot-board";
var inject = ["webServer"];
function apply(ctx, config) {
  const store = new BoardStore(join2(resolveDshHome(), "dsh-screenshot-board"));
  const handler = createHandler({ store, log: ctx.logger || console });
  ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: ROUTE_PREFIX, handler }), "dsh-screenshot-board: local board API");
}
export {
  apply,
  inject,
  name
};
