// src/core/board.js
var FORMAT = "dsh-screenshot-board";
var STATUSES = { todo: "\u5F85\u5904\u7406", doing: "\u5904\u7406\u4E2D", review: "\u5F85\u9A8C\u6536", accepted: "\u5DF2\u901A\u8FC7", returned: "\u9700\u4FEE\u6539" };
var PRIORITIES = { low: "\u4F4E", normal: "\u4E2D", high: "\u9AD8" };
var CONTEXT_FIELDS = { startup: "\u542F\u52A8\u65B9\u5F0F", url: "\u8BBF\u95EE\u5730\u5740", entry: "\u9875\u9762\u5165\u53E3", conditions: "\u5FC5\u8981\u64CD\u4F5C\u6761\u4EF6", files: "\u76F8\u5173\u6587\u4EF6\u7EBF\u7D22", scope: "\u5141\u8BB8\u4FEE\u6539\u7684\u8303\u56F4", unknowns: "\u672A\u77E5\u4E0E\u5F85\u786E\u8BA4\u4FE1\u606F" };
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
var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
var MAX_EXPORT_BYTES = 48 * 1024 * 1024;
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
function rectFromPoints(a, b) {
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const x1 = clamp(a.x), y1 = clamp(a.y), x2 = clamp(b.x), y2 = clamp(b.y);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}
function createTask(rect, number) {
  return { id: uid(), title: "\u4FEE\u6539\u70B9 " + number, note: "", requirement: "", acceptance: "", kind: "visual", clarity: "draft", clarification: "", reproduction: reproduction(), status: "todo", priority: "normal", rect, history: [] };
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

// src/core/handoff.js
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
var line = (s) => String(s || "").replace(/[\r\n]+/g, " ").replace(/[\\\x60*_{}\[\]<>#|]/g, "\\$&");
var quote = (s) => String(s?.trim() || "\u672A\u77E5/\u5F85\u8865\u5145").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).split(/\r?\n/).map((x) => "> " + x).join("\n");
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
      const paths2 = shotFiles(s, i), issues = taskIssues(t);
      out.push(
        `### ${i + 1}.${n + 1} ${line(t.title)}`,
        "",
        `- \u4EFB\u52A1 ID\uFF1A${t.id}`,
        `- \u72B6\u6001\uFF1A${STATUSES[t.status]}\uFF1B\u4F18\u5148\u7EA7\uFF1A${PRIORITIES[t.priority]}\uFF1B\u7C7B\u578B\uFF1A${t.kind === "interaction" ? "\u4EA4\u4E92\u6545\u969C" : "\u5916\u89C2\u8C03\u6574"}`,
        `- \u9700\u6C42\uFF1A${t.clarity === "confirmed" ? "\u7528\u6237\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4"}${issues.length ? "\uFF1B" + issues.join("\uFF1B") : ""}`,
        `- \u622A\u56FE ${i + 1}\uFF1A${line(s.title)}\uFF1B\u6279\u6CE8\u7F16\u53F7 ${n + 1}`,
        `- \u533A\u57DF\uFF08\u539F\u56FE\u6BD4\u4F8B\uFF09\uFF1A${["x", "y", "w", "h"].map((k) => k + "=" + t.rect[k].toFixed(4)).join(", ")}`,
        "",
        `[\u539F\u56FE](${paths2.original}) \xB7 [\u7F16\u53F7\u6279\u6CE8\u56FE](${paths2.annotated})${paths2.after ? " \xB7 [\u4FEE\u6539\u540E\u53C2\u8003](" + paths2.after + ")" : ""}`,
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

// src/client/dom.js
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "value") node.value = value;
    else if (key === "checked") node.checked = value;
    else if (key === "disabled") node.disabled = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
var paths = {
  plus: "M12 5v14M5 12h14",
  frame: "M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M7 7h10v10H7z",
  arrow: "m5 3 14 9-7 1-3 7z",
  hand: "M8 13V6a2 2 0 0 1 4 0v6-5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v7a5 5 0 0 1-5 5h-3a5 5 0 0 1-4-2L4 14a2 2 0 0 1 3-2l1 1",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  download: "M12 3v13m-5-5 5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  moon: "M21 12.5A9 9 0 0 1 11.5 3 9 9 0 1 0 21 12.5",
  sun: "M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  image: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm-1 13 5-5 5 5 3-3 5 5M8 7h.01",
  folder: "M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
  copy: "M9 9h12v12H9zM15 9V3H3v12h6",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  save: "M4 3h13l4 4v14H3V3zm3 0v6h9V3M7 21v-8h10v8",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  sparkle: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z",
  compare: "M12 3v18M8 5H3v14h5m8-14h5v14h-5",
  external: "M14 3h7v7m0-7L10 14M9 3H3v18h18v-6"
};
function icon(name, size = 18) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const p = document.createElementNS(svg.namespaceURI, "path");
  p.setAttribute("d", paths[name] || paths.frame);
  svg.append(p);
  return svg;
}
function fileData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6"));
    r.readAsDataURL(file);
  });
}
async function loadImage(src) {
  const image = new Image();
  image.decoding = "async";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("\u56FE\u7247\u65E0\u6CD5\u89E3\u7801\uFF0C\u8BF7\u91CD\u65B0\u5BFC\u51FA PNG/JPEG"));
    image.src = src;
  });
  return image;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e4);
}
function fileName(title, suffix) {
  return (title || "screenshot-board").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 80) + suffix;
}
function readPref(key) {
  try {
    return localStorage.getItem("ssb." + key);
  } catch {
    return null;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem("ssb." + key, value);
  } catch {
  }
}

// src/client/demo.js
function demoScreenshot(after = false) {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 800;
  const x = c.getContext("2d");
  const font = 'system-ui, "Microsoft YaHei", sans-serif';
  function box(a, b, w, h, color, r = 12) {
    x.fillStyle = color;
    x.beginPath();
    x.roundRect(a, b, w, h, r);
    x.fill();
  }
  function text2(t, a, b, size, color = "#222631", weight = 400) {
    x.fillStyle = color;
    x.font = weight + " " + size + "px " + font;
    x.fillText(t, a, b);
  }
  box(0, 0, 1280, 800, "#f6f7fb", 0);
  box(0, 0, 218, 800, "#fff", 0);
  box(28, 28, 30, 30, "#7660df", 8);
  text2("N", 36, 50, 20, "#fff", 700);
  text2("Northstar", 70, 50, 23, "#24243c", 700);
  text2("\u5DE5\u4F5C\u7A7A\u95F4", 28, 109, 12, "#9a9daa", 600);
  const links = ["\u603B\u89C8", "\u9879\u76EE", "\u4EFB\u52A1", "\u56E2\u961F", "\u6587\u4EF6"];
  links.forEach((t, i) => {
    if (i === 0) box(16, 130 + i * 50, 186, 40, "#f0ecff", 8);
    text2(["\u25C8", "\u25A6", "\u2611", "\u25CE", "\u25A7"][i], 31, 156 + i * 50, 18, i === 0 ? "#7758db" : "#9195a4");
    text2(t, 65, 156 + i * 50, 15, i === 0 ? "#7758db" : "#7b8090", i === 0 ? 600 : 400);
  });
  text2("\u5DE5\u4F5C\u7A7A\u95F4\u8BBE\u7F6E", 32, 750, 14, "#9195a4");
  text2("\u5DE5\u4F5C\u53F0 / \u603B\u89C8", 254, 44, 13, "#979baa");
  box(1150, 22, 94, 32, "#eeebf9", 16);
  text2("\u6F14\u793A\u754C\u9762", 1168, 43, 12, "#7969af", 600);
  text2("\u9879\u76EE\u603B\u89C8", 254, 108, 28, "#252938", 650);
  text2("\u6B22\u8FCE\u56DE\u6765\uFF0C\u4ECA\u5929\u4E5F\u6709\u503C\u5F97\u63A8\u8FDB\u7684\u4E8B\u60C5\u3002", 254, 138, 14, "#8d93a3");
  box(1080, 83, 160, 42, "#7760db", 8);
  text2("+ \u521B\u5EFA\u9879\u76EE", 1110, 110, 15, "#fff", 600);
  const metrics = [["\u8FDB\u884C\u4E2D\u7684\u9879\u76EE", "12", "+2 \u672C\u5468\u65B0\u589E"], ["\u5F85\u5B8C\u6210\u4EFB\u52A1", "38", "8 \u9879\u9700\u8981\u5173\u6CE8"], ["\u672C\u5468\u5B8C\u6210", "24", "\u6BD4\u4E0A\u5468\u591A 6 \u9879"]];
  metrics.forEach((m, i) => {
    const a = 254 + i * 335;
    box(a, 170, 315, 130, "#fff", 12);
    text2(m[0], a + 22, 200, 14, "#9499a8");
    text2(m[1], a + 22, 246, 34, "#303547", 600);
    text2(m[2], a + 22, 279, 12, "#9ca2b0");
  });
  box(254, 324, 650, 430, "#fff", 12);
  text2("\u6700\u8FD1\u9879\u76EE", 278, 359, 17, "#303547", 600);
  text2("\u67E5\u770B\u5168\u90E8 \u2192", 795, 359, 12, "#9da0ad");
  text2("\u9879\u76EE\u540D\u79F0", 279, 403, 12, "#9da3b1");
  text2("\u8FDB\u5EA6", 609, 403, 12, "#9da3b1");
  text2("\u64CD\u4F5C", 824, 403, 12, "#9da3b1");
  const projects = ["\u54C1\u724C\u5B98\u7F51\u6539\u7248", "\u79FB\u52A8\u7AEF\u4F53\u9A8C\u4F18\u5316", "\u6570\u636E\u5206\u6790\u5DE5\u4F5C\u53F0", "\u7EC4\u4EF6\u5E93 2.0"];
  projects.forEach((t, i) => {
    const b = 442 + i * (after ? 60 : 70);
    box(279, b - 12, 30, 30, ["#ede8fc", "#e5f2fb", "#e8f5ed", "#fff1e0"][i], 8);
    text2(["\u2727", "\u25B1", "\u25EB", "\u25A6"][i], 287, b + 9, 16, "#8b78c5");
    text2(t, 324, b + 1, 14, "#4c5364", 500);
    text2("\u6700\u8FD1\u66F4\u65B0\u4E8E\u4ECA\u5929", 324, b + 20, 11, "#adb0bc");
    box(609, b - 2, 128, 6, "#f0f0f6", 3);
    box(609, b - 2, [90, 48, 100, 62][i], 6, "#a793e5", 3);
    text2(after ? "\u2022\u2022\u2022" : "\u5220\u9664", 824, b + 8, after ? 18 : 12, after ? "#9297a7" : "#e6757a");
  });
  box(924, 324, 320, 430, "#fff", 12);
  text2("\u56E2\u961F\u52A8\u6001", 948, 359, 17, "#303547", 600);
  ["\u66F4\u65B0\u4E86\u7EC4\u4EF6\u89C4\u8303", "\u5B8C\u6210\u4E86\u9996\u9875\u9A8C\u6536", "\u6DFB\u52A0\u4E86\u65B0\u7684\u8BBE\u8BA1\u7A3F", "\u6574\u7406\u4E86\u4F1A\u8BAE\u8BB0\u5F55"].forEach((t, i) => {
    box(948, 394 + i * 70, 30, 30, ["#e9e3f8", "#e2f0eb", "#e4edf8", "#f6e9e2"][i], 15);
    text2(["Y", "C", "L", "M"][i], 959, 414 + i * 70, 12, "#8e82ab", 600);
    text2(t, 991, 409 + i * 70, 13, "#7b8292");
    text2(i + 1 + " \u5C0F\u65F6\u524D", 991, 430 + i * 70, 11, "#b0b4bf");
  });
  if (after) {
    text2("\u4FEE\u6539\u540E\u793A\u4F8B\uFF1A\u7D27\u51D1\u5217\u8868 \xB7 \u64CD\u4F5C\u6536\u7EB3", 254, 786, 12, "#7f72a8");
  }
  return c.toDataURL("image/png");
}

// src/client/style.css
var style_default = `/* All workspace styles are scoped; no DSH global elements are restyled. */
.ssb{--bg:#f7f8fb;--panel:#fff;--canvas:#eef0f5;--line:#e7e9f0;--text:#282d40;--muted:#9298aa;--purple:#7858db;--soft:#f0ebfc;--green:#1c9873;--shadow:0 12px 40px #20204012;font:13px/1.5 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--text);background:var(--bg);width:100%;height:100%;box-sizing:border-box;color-scheme:light;position:relative;text-align:left}
.ssb[data-theme=dark]{--bg:#16181f;--panel:#1e212b;--canvas:#13151c;--line:#303441;--text:#e5e7ef;--muted:#959daf;--purple:#a48aee;--soft:#312843;--green:#60c6a4;--shadow:0 12px 40px #0004;color-scheme:dark}
.ssb *{box-sizing:border-box}.ssb button,.ssb input,.ssb textarea,.ssb select{font:inherit}.ssb button{cursor:pointer}.ssb button:disabled{opacity:.42;cursor:not-allowed}.ssb button:focus-visible,.ssb input:focus-visible,.ssb textarea:focus-visible,.ssb select:focus-visible{outline:2px solid var(--purple);outline-offset:3px}.ssb [hidden]{display:none!important}.ssb svg{flex:none;vertical-align:middle}.ssb input,.ssb textarea,.ssb select{color:var(--text);border:1px solid var(--line);border-radius:8px;background:var(--panel);width:100%;padding:9px 11px;outline:none}.ssb input:focus,.ssb textarea:focus,.ssb select:focus{border-color:var(--purple)}.ssb textarea{resize:vertical;min-height:68px;line-height:1.65}.ssb input::placeholder,.ssb textarea::placeholder{color:var(--muted)}.ssb h1,.ssb h2,.ssb p{margin:0}.ssb-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:8px;padding:8px 12px;white-space:nowrap;transition:background .14s,border-color .14s;min-height:34px}.ssb-btn:hover{background:var(--bg);border-color:#bdb4d8}.ssb-primary{background:var(--purple);color:#fff;border-color:var(--purple)}.ssb-primary:hover{background:var(--purple);filter:brightness(1.06)}.ssb-icon-only{padding:7px;min-width:32px;min-height:32px;border-color:transparent;background:transparent}.ssb-icon-only>span{display:none}.ssb-large{padding:12px 20px}.ssb-wide{width:100%}.ssb-muted,.ssb small{color:var(--muted)}.ssb-eyebrow{font-size:10px;font-weight:650;letter-spacing:1.5px;color:var(--muted)}.ssb-app{height:100%;display:grid;grid-template-rows:74px minmax(0,1fr) 32px;min-width:720px;overflow:hidden}.ssb-header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);background:var(--panel);padding:0 24px;gap:24px}.ssb-brand{display:flex;gap:11px;align-items:center;min-width:190px}.ssb-brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--purple);color:#fff}.ssb-brand strong{font-size:15px;letter-spacing:.4px}.ssb-brand small{display:block;font-size:9px;letter-spacing:1.5px;margin-top:2px}.ssb-breadcrumb{display:flex;gap:12px;align-items:center;flex:1;min-width:0;color:var(--muted);font-size:12px}.ssb-breadcrumb strong{color:var(--text);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssb-header-actions{display:flex;gap:12px;align-items:center}.ssb-body{display:grid;grid-template-columns:216px minmax(0,1fr);min-height:0}.ssb-nav{display:flex;flex-direction:column;background:var(--panel);border-right:1px solid var(--line);padding:23px 14px 16px;min-height:0}.ssb-nav-heading{display:flex;justify-content:space-between;padding:0 10px 14px;font-size:11px;letter-spacing:.6px;color:var(--muted)}.ssb-new-board{width:100%;border-style:dashed;color:var(--muted);margin-bottom:19px;background:transparent}.ssb-board-list{display:flex;flex-direction:column;gap:6px;overflow:auto;flex:1}.ssb-board-card{justify-content:flex-start;border:0;background:transparent;padding:13px 10px;gap:10px;border-radius:8px;min-width:0;color:var(--muted)}.ssb-board-card>span{min-width:0;white-space:normal;text-align:left;font-weight:550;font-size:12px}.ssb-board-card small{display:block;font-size:10px;font-weight:400;margin-top:5px}.ssb-board-card.is-active{background:var(--soft);color:var(--purple)}.ssb-nav-bottom{display:flex;flex-direction:column;gap:5px;padding-top:20px}.ssb-nav-bottom>.ssb-btn{border:0;background:transparent;justify-content:flex-start;color:var(--muted);font-size:11px}.ssb-local-note{font-size:9px;color:var(--muted);display:flex;align-items:center;gap:6px;margin:14px 7px 0;white-space:nowrap}.ssb-dot{width:5px;height:5px;border-radius:50%;background:var(--green)}.ssb-main{min-width:0;min-height:0;display:flex;flex-direction:column}.ssb-board-meta{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:23px 28px 21px}.ssb-board-meta h1{font-size:21px;letter-spacing:-.3px;line-height:1.4;margin-top:5px;font-weight:650;max-width:650px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssb-board-meta p{font-size:11px;color:var(--muted);margin-top:6px;max-width:600px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssb-meta-actions{display:flex;gap:8px;align-items:center}.ssb-board-tag{font-size:10px;border:1px solid var(--line);border-radius:5px;padding:4px 7px;color:var(--muted);white-space:nowrap}.ssb-workspace{display:grid;grid-template-columns:minmax(0,1fr) 336px;min-height:0;flex:1;border-top:1px solid var(--line)}.ssb-canvas-area{display:flex;flex-direction:column;min-width:0;min-height:0}.ssb-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:57px;padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line)}.ssb-tool-group,.ssb-zoom,.ssb-segment{display:flex;align-items:center;gap:3px}.ssb-tool{border:0;padding:6px 8px;color:var(--muted);background:transparent;font-size:11px}.ssb-tool.is-active{background:var(--soft);color:var(--purple)}.ssb-segment{padding:3px;background:var(--bg);border:1px solid var(--line);border-radius:7px}.ssb-segment .ssb-btn{border:0;font-size:10px;padding:4px 9px;min-height:25px;background:transparent;border-radius:5px;color:var(--muted)}.ssb-segment .is-active{background:var(--panel);color:var(--text);box-shadow:0 1px 4px #0000000c}.ssb-zoom-label{font-size:10px;min-width:37px;text-align:center;color:var(--muted)}.ssb-zoom .ssb-btn{font-size:12px;min-width:25px;min-height:26px;padding:4px;color:var(--muted)}.ssb-fit{font-size:10px!important;padding:4px 6px!important;border:0;background:transparent}.ssb-stage{flex:1;min-height:0;overflow:auto;background-color:var(--canvas);background-image:radial-gradient(var(--muted) .6px,transparent .6px);background-size:18px 18px;position:relative;overscroll-behavior:contain;outline:none}.ssb-stage.is-pan{cursor:grab}.ssb-stage.is-pan:active{cursor:grabbing}.ssb-surface{display:flex;justify-content:center;align-items:center;gap:25px;padding:40px 32px;min-width:100%;min-height:100%;width:max-content;user-select:none}.ssb-image-column{display:flex;flex-direction:column;align-items:flex-start}.ssb-image-label{font-size:9px;color:var(--muted);margin-bottom:9px;letter-spacing:.5px}.ssb-image-frame{position:relative;flex:none;box-shadow:0 6px 28px #1b21431a;background:var(--panel);touch-action:none;user-select:none;cursor:crosshair}.ssb-stage.is-pan .ssb-image-frame{cursor:grab}.ssb-image-frame>img{display:block;width:100%;height:100%;pointer-events:none}.ssb-mark,.ssb-draft{position:absolute;display:block;border:2px solid #8a6bdf;background:#8a6bdf08;border-radius:3px;min-width:0;padding:0;cursor:pointer}.ssb-mark:hover{background:#8a6bdf20}.ssb-mark.is-selected{border-color:#7b50e0;box-shadow:0 0 0 3px #8a6bdf20;background:#8a6bdf15}.ssb-mark.is-accepted{border-color:#239f78;background:#239f7810}.ssb-mark-badge{position:absolute;top:-17px;left:-2px;min-width:24px;height:24px;padding:1px 5px;display:grid;place-items:center;border-radius:5px;background:#835ee0;color:#fff;font-size:11px;font-weight:650;box-shadow:0 2px 6px #39236320}.ssb-mark.is-accepted .ssb-mark-badge{background:#239f78}.ssb-draft{border-style:dashed;background:#8a6bdf20;pointer-events:none}.ssb-shot-tabs{display:flex;gap:7px;align-items:center;min-height:63px;border-top:1px solid var(--line);padding:12px 16px;background:var(--panel);overflow:auto}.ssb-shot-tab{font-size:11px;padding:7px 10px;color:var(--muted);background:var(--bg);max-width:250px}.ssb-shot-tab>span:nth-child(2){overflow:hidden;text-overflow:ellipsis}.ssb-shot-tab.is-active{border-color:var(--purple);color:var(--purple);background:var(--soft)}.ssb-shot-index{font-size:9px;opacity:.8}.ssb-tab-count{background:var(--panel);padding:0 5px;border-radius:4px;font-size:9px}.ssb-add-shot{font-size:11px;border:0;color:var(--muted);background:transparent}.ssb-inspector{background:var(--panel);border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0;overflow:auto}.ssb-inspector-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px 14px;flex:none}.ssb-inspector-head>div{display:flex;align-items:center;gap:8px}.ssb-inspector-head strong{font-size:13px;font-weight:600}.ssb-task-count{color:var(--muted);font-size:10px;background:var(--bg);padding:0 6px;border-radius:5px}.ssb-inspector-head select{font-size:10px;width:auto;padding:4px 6px;border:0;color:var(--muted);background:transparent}.ssb-progress{height:3px;background:var(--bg);margin:0 20px 13px;flex:none;border-radius:4px;overflow:hidden}.ssb-progress-fill{height:100%;background:var(--green);transition:width .2s}.ssb-task-list{max-height:230px;overflow:auto;flex:none;display:flex;flex-direction:column;gap:7px;padding:0 12px 14px}.ssb-task-card{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid transparent;border-radius:8px;text-align:left;color:var(--text);padding:11px 9px;width:100%;min-height:66px}.ssb-task-card:hover{background:var(--bg)}.ssb-task-card.is-active{border-color:#d5c7ef;background:var(--soft)}.ssb-number{display:grid;place-items:center;width:27px;height:27px;border-radius:7px;background:var(--bg);color:var(--muted);font-size:10px;font-weight:600;flex:none}.ssb-task-card.is-active .ssb-number{background:var(--purple);color:#fff}.ssb-number.is-accepted{background:#dff6eb!important;color:#198460!important}.ssb-task-card-text{min-width:0;flex:1}.ssb-task-card strong{display:block;font-size:11px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ssb-task-card small{display:flex;align-items:center;gap:5px;font-size:9px;margin-top:6px}.ssb-priority{margin-left:6px;opacity:.8}.ssb-status-dot{width:4px;height:4px;border-radius:50%;background:#b9bac7}.ssb-status-dot.status-review{background:#c99a47}.ssb-status-dot.status-doing{background:#8870d6}.ssb-status-dot.status-accepted{background:#249e79}.ssb-status-dot.status-returned{background:#d37578}.ssb-task-card>svg{color:var(--muted);transform:rotate(-90deg)}.ssb-inspector-divider{height:1px;background:var(--line);flex:none}.ssb-list-empty{padding:18px 12px;color:var(--muted);font-size:11px;line-height:1.8}.ssb-editor{padding:18px 20px 26px}.ssb-editor-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.ssb-editor-order{display:flex}.ssb-editor-order .ssb-btn{min-height:24px;min-width:25px;padding:4px;color:var(--muted)}.ssb-editor-order svg{width:14px;height:14px}.ssb-field{display:block;margin-bottom:16px}.ssb-field-label{display:block;font-size:10px;color:var(--muted);margin-bottom:7px;font-weight:550}.ssb-field input,.ssb-field select,.ssb-field textarea{font-size:11px}.ssb-field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ssb-field small{display:block;font-size:10px;margin-top:6px;line-height:1.7}.ssb-review-actions{display:flex;gap:8px;margin:2px 0 12px}.ssb-review-actions>.ssb-btn{flex:1;font-size:11px}.ssb-accept{color:var(--green);border-color:var(--green);background:transparent}.ssb-editor>.ssb-wide{font-size:10px;color:var(--muted);margin:4px 0 12px;background:transparent}.ssb-history-heading{display:flex;gap:7px;align-items:center;border-top:1px solid var(--line);padding-top:18px;margin:13px 0 12px;color:var(--muted);font-size:10px}.ssb-history-heading strong{font-weight:500}.ssb-editor>textarea{font-size:11px}.ssb-history-item{border-left:2px solid var(--line);padding:2px 0 4px 10px;margin-top:14px}.ssb-history-item small{font-size:9px}.ssb-history-item p{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:5px}.ssb-image-info,.ssb-hint{font-size:11px;color:var(--muted);line-height:1.8;margin:10px 0 16px}.ssb-text-danger{border:0;background:transparent;color:#c76a79;margin-top:12px;font-size:10px}.ssb-danger{color:#c76a79;margin-right:auto}.ssb-editor-empty{padding:40px 25px;text-align:center;color:var(--muted)}.ssb-editor-empty p{white-space:pre-line;font-size:11px;margin-top:12px;line-height:1.9}.ssb-footer{display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--panel);border-top:1px solid var(--line);color:var(--muted);font-size:9px;gap:16px}.ssb-save-status{border:0;background:transparent;color:var(--muted);font-size:9px}.ssb-save-status:before{content:'\u25CF';font-size:6px;color:var(--green);margin-right:6px}.ssb-save-status.is-dirty:before{color:#c99a47}.ssb-save-status.is-error{color:#cc6872}.ssb-save-status.is-error:before{color:#cc6872}.ssb-foot-tip{margin-left:auto}.ssb-welcome{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:40px 24px;background:radial-gradient(ellipse at 50% 30%,var(--soft),transparent 60%)}.ssb-welcome-symbol{width:88px;height:88px;display:grid;place-items:center;border-radius:25px;color:var(--purple);background:var(--panel);box-shadow:var(--shadow);transform:rotate(-6deg);margin-bottom:27px;border:1px solid var(--line)}.ssb-welcome .ssb-eyebrow{color:var(--purple);margin-bottom:15px;font-size:11px}.ssb-welcome h1{font-size:34px;font-weight:650;white-space:pre-line;line-height:1.5;letter-spacing:-1px}.ssb-welcome p{margin-top:17px;line-height:1.9;white-space:pre-line;color:var(--muted);font-size:13px}.ssb-welcome-actions{display:flex;gap:12px;margin:30px 0}.ssb-flow{display:flex;gap:24px;color:var(--muted);font-size:10px;margin:10px 0 30px}.ssb-welcome>small{font-size:10px}.ssb-canvas-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:30px;color:var(--muted);gap:15px;background:var(--canvas)}.ssb-canvas-empty h2{font-size:16px;color:var(--text);font-weight:550}.ssb-canvas-empty p{font-size:12px}.ssb-canvas-empty>.ssb-btn{margin-top:8px}.ssb-dialog-overlay{position:absolute;inset:0;background:#10132266;backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:50;padding:32px}.ssb-dialog{background:var(--panel);border:1px solid var(--line);border-radius:15px;box-shadow:0 20px 70px #0004;max-width:820px;width:100%;max-height:90%;display:flex;flex-direction:column;overflow:hidden}.ssb-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--line)}.ssb-dialog-head h2{font-size:16px;font-weight:600}.ssb-dialog-body{padding:22px 24px;overflow:auto}.ssb-dialog-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding:16px 24px}.ssb-dialog-actions .ssb-btn{font-size:11px}.ssb-markdown-preview{height:40vh;min-height:160px!important;resize:vertical;font:11px/1.8 ui-monospace,Consolas,monospace!important;white-space:pre-wrap}.ssb-toast{position:absolute;left:50%;bottom:54px;transform:translateX(-50%);padding:12px 20px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;box-shadow:var(--shadow);z-index:100;max-width:80%;font-size:12px}.ssb-toast.is-error{border-color:#dd8993;color:#cc6872}.ssb-loading{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;height:100%;grid-row:1/-1;color:var(--muted);padding:30px;text-align:center}.ssb-loading h2{font-size:18px;color:var(--text)}.ssb-drop-active:after{content:'\u677E\u5F00\u4EE5\u6DFB\u52A0\u622A\u56FE';position:absolute;inset:12px;background:#7858dbea;color:#fff;border:2px dashed #fff8;border-radius:12px;display:grid;place-items:center;font-size:24px;z-index:80;pointer-events:none}.ssb-host{position:fixed;inset:0;z-index:99999;background:#20203066;padding:20px;display:flex;align-items:center;justify-content:center}.ssb-host>.ssb{max-width:1800px;max-height:1200px;border-radius:14px;overflow:hidden;box-shadow:0 20px 80px #0005}.ssb-launcher{position:fixed;right:22px;bottom:24px;border:1px solid #ffffff30;border-radius:12px;padding:11px 14px;background:#7858db;color:#fff;box-shadow:0 4px 18px #49347d44;display:flex;align-items:center;gap:8px;font:12px system-ui;cursor:pointer}.ssb-setting-launch{display:flex;align-items:flex-start;gap:20px;padding:20px 0;font:14px system-ui}.ssb-setting-launch button{padding:10px 18px;border:0;border-radius:8px;background:#7858db;color:white;cursor:pointer}.ssb-setting-launch p{opacity:.6;font-size:12px}
@media(max-width:1250px){.ssb-body{grid-template-columns:180px minmax(0,1fr)}.ssb-workspace{grid-template-columns:minmax(0,1fr) 300px}.ssb-tools{gap:5px;padding:8px}.ssb-tool>span{display:none}.ssb-fit{display:none}.ssb-breadcrumb{display:none}.ssb-brand{min-width:0}.ssb-board-meta{padding:20px}.ssb-board-tag{display:none}}
@media(max-width:900px){.ssb-app{min-width:640px;grid-template-rows:64px minmax(0,1fr) 32px}.ssb-body{grid-template-columns:146px minmax(0,1fr)}.ssb-workspace{grid-template-columns:minmax(0,1fr) 255px}.ssb-nav{padding:17px 8px}.ssb-brand small{display:none}.ssb-header{padding:0 16px}.ssb-editor{padding:16px 14px}.ssb-inspector-head{padding:14px}.ssb-meta-actions{flex-shrink:0;gap:4px}.ssb-board-meta>div:first-child{min-width:0}.ssb-board-meta h1{font-size:17px}.ssb-board-meta p{max-width:330px}.ssb-tools{flex-wrap:wrap}.ssb-zoom{margin-left:auto}.ssb-foot-tip{display:none}.ssb-welcome h1{font-size:26px}.ssb-flow{gap:12px}.ssb-host{padding:0}.ssb-host>.ssb{border-radius:0}.ssb-main{overflow:auto}}
\r
.ssb-launcher{pointer-events:auto;z-index:20}
.ssb-preview-collapsed{position:fixed;inset:0;display:grid;place-items:center;padding:32px;text-align:center}
.ssb-host[hidden],.ssb-launcher[hidden],.ssb-preview-collapsed[hidden],#app[hidden]{display:none!important}
.ssb-writing-help{font-size:11px;line-height:1.7;color:var(--muted);margin:4px 0 16px}.ssb-writing-help summary{cursor:pointer;color:var(--accent)}.ssb-writing-help p{margin:8px 0}
.ssb-confirm{display:flex;align-items:center;gap:8px;font-size:12px;margin:8px 0}.ssb-confirm input{width:auto;accent-color:var(--accent)}
.ssb-reproduction{padding:12px;border:1px solid var(--line);border-radius:9px;margin-bottom:16px}.ssb-reproduction .ssb-field:last-child{margin-bottom:0}
.ssb-scope-summary{font-size:13px;font-weight:600;margin:16px 0}.ssb-scope-list{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:9px;margin-bottom:18px}
.ssb-scope-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px;border-bottom:1px solid var(--line)}.ssb-scope-row:last-child{border-bottom:0}.ssb-scope-row>div{min-width:0}.ssb-scope-row strong{font-size:12px}.ssb-scope-row small{display:block;color:var(--muted);font-size:11px;margin-top:5px}.ssb-scope-row select{width:120px;flex-shrink:0}.ssb-dialog-head h2{margin-right:auto}
`;

// src/client/app.js
function installStyle() {
  if (!document.querySelector("style[data-ssb-style]")) document.head.append(el("style", { "data-ssb-style": "", text: style_default }));
}
function mountBoardApp(root, options = {}) {
  installStyle();
  root.classList.add("ssb");
  const minimizeLabel = options.minimizeLabel || "\u6536\u8D77\u5230\u804A\u5929";
  root.dataset.theme = readPref("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const apiBase = new URL("dsh-screenshot-board/api/", document.baseURI);
  const state = { boards: [], board: null, shotId: null, taskId: null, mode: "rect", view: "original", zoom: null, filter: "all", changes: 0, saved: 0, saving: null, timer: null, error: "", busy: false, redrawTaskId: null, disposed: false, suspended: false, dialog: null };
  const abort = new AbortController();
  let token = "", toastTimer, saveLabel, nav, taskPane, stage, footer, tools, tabs;
  const app = el("div", { class: "ssb-app" }), notice = el("div", { class: "ssb-toast", role: "status", "aria-live": "polite", hidden: true });
  root.replaceChildren(app, notice);
  function toast(message, error = false) {
    if (state.disposed) return;
    notice.textContent = message;
    notice.classList.toggle("is-error", error);
    notice.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      notice.hidden = true;
    }, error ? 8e3 : 3500);
  }
  function button(label, symbol, action, className = "", attrs = {}) {
    const b = el("button", { type: "button", class: "ssb-btn " + className, title: label, "aria-label": label, ...attrs }, symbol ? icon(symbol) : null, el("span", { text: label }));
    if (action) b.addEventListener("click", async () => {
      if (b.disabled) return;
      b.disabled = true;
      try {
        await action();
      } catch (e) {
        if (e.name !== "AbortError") toast(e.message || "\u64CD\u4F5C\u5931\u8D25", true);
      } finally {
        if (b.isConnected) b.disabled = false;
      }
    });
    return b;
  }
  async function api(path, method = "GET", body) {
    const response = await fetch(new URL(path, apiBase), {
      method,
      credentials: "same-origin",
      signal: abort.signal,
      headers: method === "GET" ? {} : { "content-type": "application/json", "x-screenshot-board-token": token },
      ...body === void 0 ? {} : { body: JSON.stringify(body) }
    });
    if (!response.ok) {
      let msg;
      try {
        msg = (await response.json()).error;
      } catch {
      }
      throw Object.assign(new Error(msg || "\u8BF7\u6C42\u5931\u8D25\uFF1A" + response.status), { status: response.status });
    }
    return response.headers.get("content-type")?.includes("application/json") ? response.json() : response.blob();
  }
  const shot = () => state.board?.screenshots.find((s) => s.id === state.shotId);
  const task = () => shot()?.tasks.find((t) => t.id === state.taskId);
  const assetUrl = (asset) => new URL("assets/" + asset.id, apiBase).href;
  function updateSaveStatus() {
    if (!saveLabel) return;
    saveLabel.textContent = state.error ? "\u4FDD\u5B58\u5931\u8D25 \xB7 \u70B9\u51FB\u91CD\u8BD5" : state.saving ? "\u6B63\u5728\u4FDD\u5B58\u2026" : state.changes !== state.saved ? "\u7B49\u5F85\u4FDD\u5B58\u2026" : state.board ? "\u5DF2\u4FDD\u5B58\u5230\u672C\u673A" : "\u6570\u636E\u4FDD\u5B58\u5728\u672C\u673A";
    saveLabel.classList.toggle("is-error", !!state.error);
    saveLabel.classList.toggle("is-dirty", state.changes !== state.saved);
  }
  function changed() {
    state.changes++;
    state.error = "";
    updateSaveStatus();
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      flush().catch((e) => toast(e.message, true));
    }, 600);
    renderCounts();
  }
  async function flush() {
    clearTimeout(state.timer);
    if (state.saving) await state.saving;
    if (!state.board || state.saved === state.changes) return;
    const current = state.board;
    const pending = (async () => {
      while (!state.disposed && state.board === current && state.saved !== state.changes) {
        const version = state.changes, snapshot = structuredClone(current), saved = await api("boards/" + current.id, "PUT", snapshot);
        if (state.board !== current) return;
        current.revision = saved.revision;
        current.updatedAt = saved.updatedAt;
        current.createdAt = saved.createdAt;
        state.saved = version;
        state.error = "";
        const summary = { id: current.id, title: current.title, projectPath: current.projectPath, updatedAt: current.updatedAt, screenshots: current.screenshots.length, tasks: current.screenshots.reduce((n, s) => n + s.tasks.length, 0), accepted: current.screenshots.flatMap((s) => s.tasks).filter((t) => t.status === "accepted").length };
        state.boards = [summary, ...state.boards.filter((b) => b.id !== current.id)];
        renderNav();
      }
    })();
    state.saving = pending;
    updateSaveStatus();
    try {
      await pending;
    } catch (e) {
      state.error = e.message;
      throw e;
    } finally {
      if (state.saving === pending) state.saving = null;
      updateSaveStatus();
    }
  }
  async function openBoard(id2) {
    await flush();
    const board = await api("boards/" + id2);
    if (state.disposed) return;
    closeDialog();
    state.board = board;
    state.shotId = board.screenshots[0]?.id;
    state.taskId = null;
    state.redrawTaskId = null;
    state.changes = state.saved = 0;
    state.error = "";
    state.view = "original";
    state.zoom = null;
    writePref("board", id2);
    render();
  }
  async function createNew(values = {}) {
    await flush();
    const board = await api("boards", "POST", { title: values.title || "\u65B0\u4EFB\u52A1\u677F", projectPath: values.projectPath || "" });
    state.boards = await api("boards");
    await openBoard(board.id);
    return state.board;
  }
  function closeDialog() {
    state.dialog?.remove();
    state.dialog = null;
  }
  function dialog(title, content, actions = []) {
    closeDialog();
    const box = el(
      "div",
      { class: "ssb-dialog", role: "dialog", "aria-modal": "true", "aria-label": title },
      el("div", { class: "ssb-dialog-head" }, el("h2", { text: title }), el("div", { class: "ssb-header-actions" }, options.onMinimize ? button(minimizeLabel, "down", minimize) : null, button("\u5173\u95ED", "close", closeDialog, "ssb-icon-only"))),
      el("div", { class: "ssb-dialog-body" }, content),
      actions.length ? el("div", { class: "ssb-dialog-actions" }, actions) : null
    );
    const overlay = el("div", { class: "ssb-dialog-overlay" }, box);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeDialog();
    });
    root.append(overlay);
    state.dialog = overlay;
    setTimeout(() => box.querySelector("input, textarea, button")?.focus(), 0);
    return box;
  }
  function field(label, input, help) {
    return el("label", { class: "ssb-field" }, el("span", { class: "ssb-field-label", text: label }), input, help ? el("small", { text: help }) : null);
  }
  function newBoardDialog() {
    if (state.busy) return toast("\u8BF7\u7B49\u5F85\u56FE\u7247\u5904\u7406\u5B8C\u6210");
    const title = el("input", { value: "\u65B0\u7684\u754C\u9762\u4FEE\u6539", maxlength: 120, "aria-label": "\u4EFB\u52A1\u677F\u540D\u79F0" }), path = el("input", { placeholder: "\u4F8B\u5982 D:\\projects\\my-app", maxlength: 1e3, "aria-label": "\u9879\u76EE\u8DEF\u5F84" });
    dialog("\u65B0\u5EFA\u4EFB\u52A1\u677F", el("div", {}, field("\u4EFB\u52A1\u677F\u540D\u79F0", title), field("\u5173\u8054\u9879\u76EE\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09", path, "\u901A\u5E38\u586B\u5199\u771F\u5B9E\u3001\u5B8C\u6574\u7684\u9879\u76EE\u6839\u76EE\u5F55\u3002\u4EC5\u5199\u5165\u4EA4\u63A5\u6750\u6599\uFF0C\u4E0D\u68C0\u67E5\u76EE\u5F55\u6216\u8BFB\u5199\u9879\u76EE\uFF1B\u586B\u9519\u4E0D\u5F71\u54CD\u622A\u56FE\u6279\u6CE8\uFF0C\u4F46\u53EF\u80FD\u8BA9 Agent \u627E\u9519\u9879\u76EE\u3002")), [button("\u521B\u5EFA\u4EFB\u52A1\u677F", "plus", async () => {
      await createNew({ title: title.value.trim() || "\u65B0\u4EFB\u52A1\u677F", projectPath: path.value.trim() });
      closeDialog();
    }, "ssb-primary")]);
  }
  function pickFile(accept, callback, multiple = false) {
    const input = el("input", { type: "file", accept, multiple, hidden: true });
    root.append(input);
    input.addEventListener("change", async () => {
      try {
        if (input.files?.length) await callback([...input.files]);
      } catch (e) {
        toast(e.message, true);
      } finally {
        input.remove();
      }
    }, { once: true });
    input.addEventListener("cancel", () => input.remove(), { once: true });
    input.click();
  }
  async function uploadFile(file) {
    if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("\u8BF7\u9009\u62E9 PNG \u6216 JPEG \u56FE\u7247");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("\u5355\u5F20\u56FE\u7247\u4E0D\u80FD\u8D85\u8FC7 8 MB");
    let dataUrl = await fileData(file);
    const image = await loadImage(dataUrl);
    if (image.naturalWidth > 16e3 || image.naturalHeight > 16e3 || image.naturalWidth * image.naturalHeight > 64e6) throw new Error("\u56FE\u7247\u50CF\u7D20\u8FC7\u5927\uFF0C\u8BF7\u5148\u7F29\u5C0F\u5230 16000 px / 6400 \u4E07\u50CF\u7D20\u4EE5\u5185");
    if (file.type === "image/jpeg") {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      dataUrl = canvas.toDataURL("image/jpeg", 0.96);
      if (dataUrl.length > MAX_IMAGE_BYTES * 1.4) throw new Error("JPEG \u65B9\u5411\u89C4\u8303\u5316\u540E\u8D85\u8FC7 8 MB\uFF0C\u8BF7\u7F29\u5C0F\u56FE\u7247");
    }
    return api("assets", "POST", { dataUrl, name: file.name });
  }
  async function addFiles(files, after = false) {
    if (state.busy) throw new Error("\u8BF7\u7B49\u5F85\u5F53\u524D\u56FE\u7247\u5904\u7406\u5B8C\u6210");
    state.busy = true;
    try {
      if (!state.board) await createNew({ title: "\u622A\u56FE\u4FEE\u6539\u4EFB\u52A1" });
      const current = state.board;
      if (after && !shot()) throw new Error("\u8BF7\u5148\u6DFB\u52A0\u539F\u59CB\u622A\u56FE");
      if (!after && current.screenshots.length + files.length > 12) throw new Error("\u4E00\u4E2A\u4EFB\u52A1\u677F\u6700\u591A 12 \u5F20\u622A\u56FE");
      const target = shot();
      const chosen = after ? files.slice(0, 1) : files;
      for (const file of chosen) {
        if (!["image/png", "image/jpeg"].includes(file.type) || file.size > MAX_IMAGE_BYTES) throw new Error("\u8BF7\u9009\u62E9\u4E0D\u8D85\u8FC7 8 MB \u7684 PNG/JPEG \u56FE\u7247");
      }
      const uploaded = [];
      for (const file of chosen) uploaded.push({ file, asset: await uploadFile(file) });
      if (state.board !== current) throw new Error("\u4EFB\u52A1\u677F\u5DF2\u7ECF\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u6DFB\u52A0\u56FE\u7247");
      for (const { file, asset } of uploaded) {
        if (after) {
          target.after = asset;
          state.view = "compare";
          break;
        }
        const s = { id: uid(), title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "\u622A\u56FE", original: asset, after: null, tasks: [] };
        current.screenshots.push(s);
        state.shotId = s.id;
        state.taskId = null;
        state.view = "original";
      }
      state.zoom = null;
      changed();
      render();
      await flush();
      toast(after ? "\u4FEE\u6539\u540E\u622A\u56FE\u5DF2\u6DFB\u52A0\uFF0C\u53EF\u4EE5\u9010\u9879\u9A8C\u6536" : "\u622A\u56FE\u5DF2\u6DFB\u52A0\uFF0C\u5728\u56FE\u7247\u4E0A\u62D6\u52A8\u5373\u53EF\u6846\u9009");
    } finally {
      state.busy = false;
      renderNav();
    }
  }
  const pickScreenshots = () => pickFile("image/png,image/jpeg", (files) => addFiles(files), true);
  const pickAfter = () => pickFile("image/png,image/jpeg", (files) => addFiles(files, true));
  async function sample() {
    if (state.busy) return;
    state.busy = true;
    try {
      await createNew({ title: "Northstar \xB7 \u754C\u9762\u4F53\u9A8C\u4F18\u5316" });
      const current = state.board;
      current.description = "\u6F14\u793A\u4EFB\u52A1\u677F\u3002\u6240\u6709\u622A\u56FE\u548C\u4FEE\u6539\u70B9\u5747\u4E3A\u865A\u6784\u793A\u4F8B\uFF0C\u53EF\u81EA\u7531\u7F16\u8F91\u6216\u5220\u9664\u3002";
      const original = await api("assets", "POST", { dataUrl: demoScreenshot(), name: "\u793A\u4F8B-\u9879\u76EE\u603B\u89C8.png" }), after = await api("assets", "POST", { dataUrl: demoScreenshot(true), name: "\u793A\u4F8B-\u4FEE\u6539\u540E.png" });
      const a = createTask({ x: 0.637, y: 0.505, w: 0.044, h: 0.318 }, 1);
      Object.assign(a, { title: "\u6536\u7EB3\u9AD8\u98CE\u9669\u64CD\u4F5C", note: "\u5220\u9664\u6309\u94AE\u7D27\u6328\u7740\u9879\u76EE\u5217\u8868\uFF0C\u5BB9\u6613\u8BEF\u89E6\u3002", requirement: "\u628A\u5220\u9664\u64CD\u4F5C\u79FB\u5230\u6BCF\u884C\u7684\u66F4\u591A\u83DC\u5355\uFF0C\u4FDD\u7559\u4E8C\u6B21\u786E\u8BA4\u3002", acceptance: "\u9ED8\u8BA4\u5217\u8868\u4E0D\u76F4\u63A5\u663E\u793A\u5220\u9664\u6309\u94AE\uFF1B\u66F4\u591A\u83DC\u5355\u80FD\u627E\u5230\u5220\u9664\u64CD\u4F5C\uFF0C\u53D6\u6D88\u786E\u8BA4\u4E0D\u5220\u9664\u9879\u76EE\u3002", priority: "high", status: "review" });
      const b = createTask({ x: 0.211, y: 0.526, w: 0.403, h: 0.361 }, 2);
      Object.assign(b, { title: "\u8BA9\u9879\u76EE\u5217\u8868\u66F4\u7D27\u51D1", note: "\u9879\u76EE\u4E4B\u95F4\u7684\u95F4\u8DDD\u6709\u4E9B\u5927\uFF0C\u6D4F\u89C8\u65F6\u4FE1\u606F\u5BC6\u5EA6\u504F\u4F4E\u3002", requirement: "\u9002\u5F53\u7F29\u5C0F\u884C\u95F4\u8DDD\uFF0C\u4FDD\u6301\u9879\u76EE\u540D\u79F0\u548C\u6700\u8FD1\u66F4\u65B0\u65F6\u95F4\u6E05\u6670\u53EF\u8BFB\u3002", acceptance: "\u684C\u9762\u89C6\u56FE\u80FD\u540C\u65F6\u770B\u5230\u56DB\u884C\u9879\u76EE\uFF0C\u6587\u5B57\u4E0D\u91CD\u53E0\u3001\u4E0D\u622A\u65AD\u3002" });
      const c = createTask({ x: 0.731, y: 0.471, w: 0.231, h: 0.403 }, 3);
      Object.assign(c, { title: "\u63D0\u9AD8\u52A8\u6001\u6587\u5B57\u7684\u5BF9\u6BD4\u5EA6", note: "\u56E2\u961F\u52A8\u6001\u7684\u6B21\u8981\u4FE1\u606F\u6709\u70B9\u6D45\u3002", requirement: "\u63D0\u9AD8\u6B63\u6587\u548C\u65F6\u95F4\u6587\u5B57\u7684\u53EF\u8BFB\u6027\uFF0C\u4FDD\u7559\u4E24\u7EA7\u4FE1\u606F\u5C42\u6B21\u3002", acceptance: "\u6D45\u8272\u4E3B\u9898\u4E0B\u6B63\u6587\u548C\u65F6\u95F4\u5747\u53EF\u8FA8\u8BA4\u3002", priority: "low" });
      for (const t of [a, b, c]) t.clarity = "confirmed";
      current.screenshots.push({ id: uid(), title: "\u9879\u76EE\u603B\u89C8 \xB7 \u6F14\u793A\u622A\u56FE", original, after, tasks: [a, b, c] });
      state.shotId = current.screenshots[0].id;
      state.taskId = a.id;
      state.zoom = null;
      changed();
      render();
      await flush();
      toast("\u6F14\u793A\u4EFB\u52A1\u677F\u5DF2\u521B\u5EFA\uFF0C\u53EF\u8BD5\u7740\u4FEE\u6539\u6279\u6CE8");
    } finally {
      state.busy = false;
      renderNav();
    }
  }
  function renderNav() {
    if (!nav) return;
    nav.replaceChildren(
      el("div", { class: "ssb-nav-heading" }, el("span", { text: "\u6211\u7684\u4EFB\u52A1\u677F" }), el("span", { class: "ssb-muted", text: state.boards.length })),
      button("\u65B0\u5EFA\u4EFB\u52A1\u677F", "plus", newBoardDialog, "ssb-new-board"),
      el("div", { class: "ssb-board-list" }, state.boards.map((b) => {
        const card = button(b.title, "folder", () => openBoard(b.id), "ssb-board-card" + (b.id === state.board?.id ? " is-active" : ""), { disabled: state.busy });
        card.querySelector("span").append(el("small", { text: (b.screenshots || 0) + " \u5F20\u622A\u56FE \xB7 " + (b.tasks || 0) + " \u4E2A\u4EFB\u52A1" }));
        return card;
      })),
      el(
        "div",
        { class: "ssb-nav-bottom" },
        button("\u5BFC\u5165\u5907\u4EFD", "upload", () => pickFile(".json,application/json", async (files) => {
          if (state.busy) throw new Error("\u8BF7\u7B49\u5F85\u56FE\u7247\u5904\u7406\u5B8C\u6210");
          if (files[0].size > 72 * 1024 * 1024) throw new Error("\u5907\u4EFD\u6587\u4EF6\u8D85\u8FC7 72 MB");
          await flush();
          const result = await api("import", "POST", JSON.parse(await files[0].text()));
          state.boards = await api("boards");
          await openBoard(result.id);
          toast("\u4EFB\u52A1\u677F\u5DF2\u6062\u590D\u4E3A\u72EC\u7ACB\u526F\u672C");
        })),
        button("\u8BD5\u7528\u793A\u4F8B", "sparkle", sample),
        el("div", { class: "ssb-local-note" }, el("span", { class: "ssb-dot" }), "\u672C\u673A\u4FDD\u5B58 \xB7 \u9879\u76EE\u6587\u4EF6\u4FDD\u6301\u539F\u6837")
      )
    );
  }
  function renderCounts() {
    if (!footer || !state.board) return;
    const tasks = state.board.screenshots.flatMap((s) => s.tasks), accepted = tasks.filter((t) => t.status === "accepted").length;
    footer.textContent = state.board.screenshots.length + " \u5F20\u622A\u56FE  /  " + tasks.length + " \u4E2A\u4FEE\u6539\u70B9  /  " + accepted + " \u9879\u5DF2\u9A8C\u6536";
    const bar = root.querySelector(".ssb-progress-fill");
    if (bar) bar.style.width = (tasks.length ? accepted / tasks.length * 100 : 0) + "%";
  }
  function boardSettings() {
    if (state.busy) return toast("\u8BF7\u7B49\u5F85\u56FE\u7247\u5904\u7406\u5B8C\u6210");
    const board = state.board, title = el("input", { value: board.title, maxlength: 120, "aria-label": "\u4EFB\u52A1\u677F\u540D\u79F0" }), path = el("input", { value: board.projectPath, maxlength: 1e3, "aria-label": "\u9879\u76EE\u8DEF\u5F84", placeholder: "\u4F8B\u5982 D:\\projects\\my-app" }), description = el("textarea", { value: board.description, rows: 4, maxlength: 8e3, "aria-label": "\u9879\u76EE\u8BF4\u660E", placeholder: "\u9879\u76EE\u80CC\u666F\u3001\u6267\u884C\u9650\u5236\u548C\u5176\u4ED6\u4EA4\u63A5\u8BF4\u660E" });
    const contextInputs = Object.fromEntries(Object.entries(CONTEXT_FIELDS).map(([key, label]) => [key, el("textarea", { value: board.context[key], rows: key === "startup" || key === "scope" ? 3 : 2, maxlength: 6e3, "aria-label": label, placeholder: { startup: "\u4F8B\u5982 npm run dev\uFF1B\u5728\u54EA\u4E2A\u76EE\u5F55\u8FD0\u884C\uFF1F", url: "\u4F8B\u5982 http://localhost:3000", entry: "\u4F8B\u5982 \u4FA7\u680F \u2192 \u9879\u76EE \u2192 \u5217\u8868", conditions: "\u6D4B\u8BD5\u8D26\u53F7\u3001\u767B\u5F55\u72B6\u6001\u3001\u6570\u636E\u6216\u524D\u7F6E\u64CD\u4F5C\uFF1B\u4E0D\u8981\u586B\u5199\u5BC6\u7801", files: "\u4F8B\u5982 src/pages/Projects.js\uFF08\u4EC5\u662F\u5F85\u6838\u5B9E\u7684\u7EBF\u7D22\uFF09", scope: "\u5141\u8BB8\u6539\u54EA\u4E9B\u76EE\u5F55\uFF1F\u54EA\u4E9B\u884C\u4E3A\u9700\u8981\u4FDD\u7559\uFF1F", unknowns: "\u4F8B\u5982 \u5C1A\u4E0D\u77E5\u9053\u5217\u8868\u7EC4\u4EF6\u5728\u54EA\u4E2A\u6587\u4EF6" }[key] })]));
    dialog("\u4EFB\u52A1\u677F\u8BBE\u7F6E", el(
      "div",
      {},
      field("\u540D\u79F0", title),
      field("\u9879\u76EE\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09", path, "\u901A\u5E38\u586B\u5199\u771F\u5B9E\u3001\u5B8C\u6574\u7684\u9879\u76EE\u6839\u76EE\u5F55\u3002\u4EC5\u8BB0\u5F55\uFF0C\u4E0D\u68C0\u67E5\u3001\u6253\u5F00\u6216\u4FEE\u6539\u9879\u76EE\u3002\u9519\u8BEF\u8DEF\u5F84\u4E0D\u5F71\u54CD\u6279\u6CE8\uFF0C\u4F46\u4F1A\u5F71\u54CD Agent \u5B9A\u4F4D\u3002"),
      field("\u9879\u76EE\u7528\u9014\u4E0E\u8BF4\u660E", description),
      el("p", { class: "ssb-hint", text: "\u80CC\u666F\u53EF\u4EE5\u9010\u6B65\u8865\u5145\u5E76\u5728\u540E\u7EED\u4EA4\u63A5\u590D\u7528\u3002\u4EE5\u4E0B\u5747\u4E3A\u7528\u6237\u8BB0\u5F55\uFF0C\u63D2\u4EF6\u6CA1\u6709\u9A8C\u8BC1\uFF1B\u7559\u7A7A\u4F1A\u5728\u8BF4\u660E\u4E2D\u6807\u4E3A\u672A\u77E5/\u5F85\u8865\u5145\u3002" }),
      Object.entries(CONTEXT_FIELDS).map(([key, label]) => field(label, contextInputs[key]))
    ), [
      button("\u5220\u9664\u4EFB\u52A1\u677F", "trash", async () => {
        if (!confirm("\u5220\u9664\u8FD9\u4E2A\u4EFB\u52A1\u677F\u53CA\u5176\u4EFB\u52A1\u8BB0\u5F55\uFF1F\u5EFA\u8BAE\u5148\u5BFC\u51FA\u5907\u4EFD\u3002")) return;
        await flush();
        await api("boards/" + board.id, "DELETE", { revision: board.revision });
        state.board = null;
        state.boards = await api("boards");
        state.changes = state.saved = 0;
        closeDialog();
        render();
        toast("\u4EFB\u52A1\u677F\u5DF2\u5220\u9664");
      }, "ssb-danger"),
      button("\u4FDD\u5B58\u8BBE\u7F6E", "check", async () => {
        board.title = title.value.trim() || "\u672A\u547D\u540D\u4EFB\u52A1\u677F";
        board.projectPath = path.value.trim();
        board.description = description.value;
        for (const key of Object.keys(CONTEXT_FIELDS)) board.context[key] = contextInputs[key].value;
        changed();
        await flush();
        closeDialog();
        render();
      }, "ssb-primary")
    ]);
  }
  function render() {
    const b = state.board;
    app.replaceChildren();
    const header = el(
      "header",
      { class: "ssb-header" },
      el("div", { class: "ssb-brand" }, el("div", { class: "ssb-brand-mark" }, icon("frame", 22)), el("div", {}, el("strong", { text: "\u622A\u56FE\u4EFB\u52A1\u677F" }), el("small", { text: "FRAMEBOARD / DSH" }))),
      el("div", { class: "ssb-breadcrumb" }, el("span", { text: "\u5DE5\u4F5C\u7A7A\u95F4" }), el("span", { text: "/" }), el("strong", { text: b?.title || "\u5F00\u59CB\u65B0\u7684\u4FEE\u6539" })),
      el(
        "div",
        { class: "ssb-header-actions" },
        button("\u5207\u6362\u660E\u6697\u4E3B\u9898", root.dataset.theme === "dark" ? "sun" : "moon", () => {
          root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
          writePref("theme", root.dataset.theme);
        }, "ssb-icon-only"),
        b ? button("\u4EA4\u63A5\u4E0E\u5BFC\u51FA", "download", handoff, "ssb-primary") : null,
        options.onMinimize ? button(minimizeLabel, "down", minimize, "ssb-minimize", { title: "\u4EC5\u6536\u8D77\u622A\u56FE\u4EFB\u52A1\u677F\uFF0C\u4FDD\u7559\u5F53\u524D\u7F16\u8F91\uFF1B\u70B9\u51FB\u60AC\u6D6E\u5165\u53E3\u6062\u590D" }) : null,
        options.onClose ? button("\u5173\u95ED\u5DE5\u4F5C\u53F0", "close", async () => {
          await flush();
          options.onClose();
        }, "ssb-icon-only") : null
      )
    );
    nav = el("aside", { class: "ssb-nav", "aria-label": "\u4EFB\u52A1\u677F\u5217\u8868" });
    const content = el("main", { class: "ssb-main" }), bottom = el("footer", { class: "ssb-footer" });
    footer = el("span", { class: "ssb-foot-count" });
    saveLabel = el("button", { class: "ssb-save-status", type: "button", onclick: () => flush().catch((e) => toast(e.message, true)) });
    bottom.append(footer, el("span", { class: "ssb-foot-tip", text: "\u6846\u9009\u6807\u8BB0 \xB7 \u4EFB\u52A1\u4EA4\u63A5 \xB7 \u9010\u9879\u9A8C\u6536" }), saveLabel);
    app.append(header, el("div", { class: "ssb-body" }, nav, content), bottom);
    renderNav();
    updateSaveStatus();
    if (!b) {
      content.append(el(
        "div",
        { class: "ssb-welcome" },
        el("div", { class: "ssb-welcome-symbol" }, icon("frame", 44)),
        el("div", { class: "ssb-eyebrow", text: "\u4ECE\u4E00\u5F20\u622A\u56FE\u5F00\u59CB" }),
        el("h1", { text: "\u628A\u300C\u8FD9\u91CC\u6539\u4E00\u4E0B\u300D\n\u53D8\u6210\u6E05\u6670\u7684\u4FEE\u6539\u4EFB\u52A1\u3002" }),
        el("p", { text: "\u5708\u51FA\u9700\u8981\u8C03\u6574\u7684\u4F4D\u7F6E\uFF0C\u7559\u4E0B\u4F60\u7684\u60F3\u6CD5\u3002\n\u8BA9\u4E0B\u4E00\u4E2A Agent \u5E26\u7740\u5B8C\u6574\u7684\u80CC\u666F\u63A5\u624B\u3002" }),
        el("div", { class: "ssb-welcome-actions" }, button("\u6DFB\u52A0\u7B2C\u4E00\u5F20\u622A\u56FE", "upload", pickScreenshots, "ssb-primary ssb-large"), button("\u5148\u770B\u770B\u793A\u4F8B", "sparkle", sample, "ssb-large")),
        el("div", { class: "ssb-flow" }, ["01  \u6DFB\u52A0\u622A\u56FE", "02  \u6846\u9009\u6279\u6CE8", "03  \u6574\u7406\u4EFB\u52A1", "04  \u4EA4\u63A5\u9A8C\u6536"].map((t) => el("span", { text: t }))),
        el("small", { class: "ssb-muted", text: "\u652F\u6301 PNG / JPEG \xB7 \u5355\u5F20\u6700\u591A 8 MB \xB7 \u53EF\u7C98\u8D34\u6216\u62D6\u5165\u56FE\u7247" })
      ));
      footer.textContent = "\u51C6\u5907\u597D\u5F00\u59CB\u4E86\u5417\uFF1F";
      return;
    }
    const meta = el(
      "section",
      { class: "ssb-board-meta" },
      el("div", {}, el("div", { class: "ssb-eyebrow", text: "SCREENSHOT \u2192 TASK \u2192 HANDOFF" }), el("h1", { text: b.title }), el("p", { text: b.projectPath || "\u9879\u76EE\u8DEF\u5F84\u53EF\u9009\uFF1B\u53EF\u5728\u9879\u76EE\u80CC\u666F\u4E2D\u9010\u6B65\u8865\u5145" })),
      el("div", { class: "ssb-meta-actions" }, button("\u9879\u76EE\u80CC\u666F", "folder", boardSettings), button("\u4EFB\u52A1\u677F\u8BBE\u7F6E", "more", boardSettings, "ssb-icon-only"), el("span", { class: "ssb-board-tag", text: "\u672C\u5730\u4EFB\u52A1\u677F" }))
    );
    tools = el("div", { class: "ssb-tools" });
    tabs = el("div", { class: "ssb-shot-tabs" });
    stage = el("div", { class: "ssb-stage", tabindex: 0, "aria-label": "\u622A\u56FE\u753B\u5E03" });
    const workspace = el("section", { class: "ssb-canvas-area" }, tools, stage, tabs);
    taskPane = el("aside", { class: "ssb-inspector", "aria-label": "\u4FEE\u6539\u4EFB\u52A1" });
    content.append(meta, el("div", { class: "ssb-workspace" }, workspace, taskPane));
    renderTools();
    renderTabs();
    renderCanvas();
    renderInspector();
    renderCounts();
  }
  function setMode(mode) {
    state.mode = mode;
    if (mode !== "rect") state.redrawTaskId = null;
    renderTools();
    stage?.classList.toggle("is-pan", mode === "pan");
  }
  function renderTools() {
    if (!tools) return;
    const s = shot(), modes = el(
      "div",
      { class: "ssb-tool-group" },
      button("\u6846\u9009", "frame", () => setMode("rect"), "ssb-tool" + (state.mode === "rect" ? " is-active" : "")),
      button("\u9009\u62E9", "arrow", () => setMode("select"), "ssb-tool" + (state.mode === "select" ? " is-active" : "")),
      button("\u79FB\u52A8", "hand", () => setMode("pan"), "ssb-tool" + (state.mode === "pan" ? " is-active" : ""))
    );
    const views = el("div", { class: "ssb-segment" });
    for (const [value, label] of [["original", "\u4FEE\u6539\u524D"], ["after", "\u4FEE\u6539\u540E"], ["compare", "\u5BF9\u6BD4"]]) views.append(button(label, value === "compare" ? "compare" : null, () => {
      if (value !== "original" && !s?.after) return pickAfter();
      state.view = value;
      state.zoom = null;
      renderTools();
      renderCanvas();
    }, state.view === value ? "is-active" : "", { disabled: !s }));
    tools.replaceChildren(modes, views, el("div", { class: "ssb-zoom" }, button("\u7F29\u5C0F", null, () => zoomBy(-0.1), "ssb-icon-only", { text: "\u2212" }), el("span", { class: "ssb-zoom-label", text: state.zoom ? Math.round(state.zoom * 100) + "%" : "\u9002\u5E94" }), button("\u653E\u5927", "plus", () => zoomBy(0.1), "ssb-icon-only"), button("\u9002\u5E94\u753B\u5E03", null, () => {
      state.zoom = null;
      renderTools();
      renderCanvas();
    }, "ssb-fit")));
  }
  function zoomBy(delta) {
    if (!shot()) return;
    state.zoom = Math.max(0.1, Math.min(3, (state.zoom || fitScale()) + delta));
    renderTools();
    renderCanvas();
  }
  function fitScale() {
    const s = shot();
    if (!s || !stage) return 1;
    const compare = state.view === "compare" && s.after;
    const a = state.view === "after" && s.after ? s.after : s.original, width = compare ? s.original.width + s.after.width : a.width, height = compare ? Math.max(s.original.height, s.after.height) : a.height;
    return Math.max(0.05, Math.min(1, (stage.clientWidth - (compare ? 100 : 64)) / width, (stage.clientHeight - 80) / height));
  }
  function renderTabs() {
    if (!tabs) return;
    tabs.replaceChildren(...state.board.screenshots.map((s, i) => {
      const b = button(s.title, null, () => {
        state.shotId = s.id;
        state.taskId = null;
        state.redrawTaskId = null;
        state.zoom = null;
        state.view = "original";
        renderTabs();
        renderTools();
        renderCanvas();
        renderInspector();
      }, "ssb-shot-tab" + (s.id === state.shotId ? " is-active" : ""));
      b.prepend(el("span", { class: "ssb-shot-index", text: String(i + 1).padStart(2, "0") }));
      b.append(el("span", { class: "ssb-tab-count", text: s.tasks.length }));
      return b;
    }), button("\u6DFB\u52A0\u622A\u56FE", "plus", pickScreenshots, "ssb-add-shot"));
  }
  function renderCanvas() {
    if (!stage) return;
    const s = shot();
    stage.replaceChildren();
    stage.classList.toggle("is-pan", state.mode === "pan");
    if (!s) {
      stage.append(el("div", { class: "ssb-canvas-empty" }, icon("image", 44), el("h2", { text: "\u6DFB\u52A0\u9700\u8981\u4FEE\u6539\u7684\u754C\u9762\u622A\u56FE" }), el("p", { text: "\u62D6\u5165\u56FE\u7247\uFF0C\u6216\u7C98\u8D34\u526A\u8D34\u677F\u4E2D\u7684\u622A\u56FE" }), button("\u9009\u62E9\u622A\u56FE", "upload", pickScreenshots, "ssb-primary")));
      return;
    }
    const scale = state.zoom || fitScale(), surface = el("div", { class: "ssb-surface" + (state.view === "compare" ? " is-compare" : "") });
    const images = state.view === "compare" && s.after ? [[s.original, true, "\u4FEE\u6539\u524D"], [s.after, false, "\u4FEE\u6539\u540E"]] : [[state.view === "after" && s.after ? s.after : s.original, state.view !== "after", state.view === "after" ? "\u4FEE\u6539\u540E" : "\u4FEE\u6539\u524D"]];
    for (const [asset, annotate, label] of images) {
      const frame = el("div", { class: "ssb-image-frame", "data-shot-id": s.id, style: "width:" + asset.width * scale + "px;height:" + asset.height * scale + "px" }), img = el("img", { src: assetUrl(asset), alt: s.title + " \xB7 " + label, draggable: false });
      img.addEventListener("error", () => toast("\u622A\u56FE\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u56FE\u7247\u6570\u636E\u662F\u5426\u4ECD\u5728\u672C\u673A", true), { once: true });
      frame.append(img);
      if (annotate) {
        for (const [i, t] of s.tasks.entries()) {
          const r = t.rect, mark = el("button", { type: "button", class: "ssb-mark" + (t.id === state.taskId ? " is-selected" : "") + (t.status === "accepted" ? " is-accepted" : ""), style: "left:" + r.x * 100 + "%;top:" + r.y * 100 + "%;width:" + r.w * 100 + "%;height:" + r.h * 100 + "%;", "aria-label": "\u6279\u6CE8 " + (i + 1) + "\uFF1A" + t.title, "data-task-id": t.id }, el("span", { class: "ssb-mark-badge", text: i + 1 }));
          if (state.redrawTaskId) mark.style.pointerEvents = "none";
          mark.addEventListener("pointerdown", (e) => {
            if (state.mode !== "pan") e.stopPropagation();
          });
          mark.addEventListener("click", (e) => {
            if (state.mode === "pan") return;
            e.stopPropagation();
            state.taskId = t.id;
            renderCanvas();
            renderInspector();
          });
          frame.append(mark);
        }
        bindDrawing(frame);
      }
      surface.append(el("div", { class: "ssb-image-column" }, el("div", { class: "ssb-image-label", text: label + (annotate ? " \xB7 \u62D6\u52A8\u6846\u9009\u6DFB\u52A0\u4FEE\u6539\u70B9" : " \xB7 \u9A8C\u6536\u53C2\u8003") }), frame));
    }
    stage.append(surface);
    stage.onpointerdown = (e) => {
      if (!(state.mode === "pan" || e.button === 1) || e.button === 2) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
      stage.setPointerCapture(e.pointerId);
      stage.onpointermove = (event) => {
        stage.scrollLeft = start.left - (event.clientX - start.x);
        stage.scrollTop = start.top - (event.clientY - start.y);
      };
      const end = () => {
        stage.onpointermove = null;
        stage.onpointerup = null;
        stage.onpointercancel = null;
      };
      stage.onpointerup = end;
      stage.onpointercancel = end;
    };
    stage.onwheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
      }
    };
  }
  function bindDrawing(frame) {
    frame.addEventListener("pointerdown", (e) => {
      if (state.mode !== "rect" || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const bounds = frame.getBoundingClientRect(), point = (event) => ({ x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height }), start = point(e), draft = el("div", { class: "ssb-draft" });
      frame.append(draft);
      frame.setPointerCapture(e.pointerId);
      let rect = null;
      frame.onpointermove = (event) => {
        rect = rectFromPoints(start, point(event));
        draft.style.cssText = "left:" + rect.x * 100 + "%;top:" + rect.y * 100 + "%;width:" + rect.w * 100 + "%;height:" + rect.h * 100 + "%;";
      };
      const clean = () => {
        frame.onpointermove = null;
        frame.onpointerup = null;
        frame.onpointercancel = null;
        draft.remove();
      };
      frame.onpointercancel = clean;
      frame.onpointerup = (event) => {
        rect = rectFromPoints(start, point(event));
        clean();
        if (rect.w * bounds.width < 8 || rect.h * bounds.height < 8) return;
        const s = shot();
        if (s.tasks.length >= 100) {
          toast("\u5F53\u524D\u622A\u56FE\u4FEE\u6539\u70B9\u8FC7\u591A\uFF0C\u8BF7\u62C6\u5206\u4EFB\u52A1\u677F", true);
          return;
        }
        let t = s.tasks.find((t2) => t2.id === state.redrawTaskId);
        if (t) {
          t.rect = rect;
          state.redrawTaskId = null;
          toast("\u6807\u6CE8\u533A\u57DF\u5DF2\u66F4\u65B0\uFF0C\u4EFB\u52A1\u5185\u5BB9\u4FDD\u6301\u4E0D\u53D8");
        } else {
          t = createTask(rect, s.tasks.length + 1);
          s.tasks.push(t);
        }
        state.taskId = t.id;
        changed();
        renderTabs();
        renderCanvas();
        renderInspector();
        taskPane.querySelector('[aria-label="\u4EFB\u52A1\u6807\u9898"]')?.focus();
      };
    });
  }
  function renderTaskList() {
    const holder = taskPane?.querySelector(".ssb-task-list");
    if (!holder) return;
    const s = shot(), tasks = s?.tasks || [], shown = tasks.filter((t) => state.filter === "all" || t.status === state.filter);
    holder.replaceChildren(...shown.map((t) => {
      const n = tasks.indexOf(t) + 1, b = el(
        "button",
        { type: "button", class: "ssb-task-card" + (t.id === state.taskId ? " is-active" : ""), "data-card-task-id": t.id, "aria-label": "\u9009\u62E9\u4EFB\u52A1 " + n + " " + t.title },
        el("span", { class: "ssb-number" + (t.status === "accepted" ? " is-accepted" : ""), text: t.status === "accepted" ? "\u2713" : String(n).padStart(2, "0") }),
        el("div", { class: "ssb-task-card-text" }, el("strong", { text: t.title || "\u672A\u547D\u540D\u4FEE\u6539\u70B9" }), el("small", {}, el("span", { class: "ssb-status-dot status-" + t.status }), STATUSES[t.status], el("span", { class: "ssb-priority", text: taskIssues(t).length ? "\u5F85\u6F84\u6E05" : PRIORITIES[t.priority] + "\u4F18\u5148\u7EA7" }))),
        icon("down", 14)
      );
      b.addEventListener("click", () => {
        state.taskId = t.id;
        renderCanvas();
        renderInspector();
      });
      return b;
    }));
    if (!shown.length) holder.append(el("div", { class: "ssb-list-empty", text: tasks.length ? "\u8FD9\u4E2A\u7B5B\u9009\u4E0B\u8FD8\u6CA1\u6709\u4EFB\u52A1" : "\u5728\u622A\u56FE\u4E0A\u6846\u9009\u4E00\u4E2A\u533A\u57DF\uFF0C\u6DFB\u52A0\u7B2C\u4E00\u4E2A\u4FEE\u6539\u70B9\u3002" }));
    const count = taskPane.querySelector(".ssb-task-count");
    if (count) count.textContent = tasks.length;
  }
  function renderInspector() {
    if (!taskPane) return;
    const s = shot(), t = task(), filter = el("select", { "aria-label": "\u7B5B\u9009\u4EFB\u52A1\u72B6\u6001", onchange: (e) => {
      state.filter = e.target.value;
      renderTaskList();
    } }, el("option", { value: "all", text: "\u5168\u90E8\u72B6\u6001" }), Object.entries(STATUSES).map(([k, v]) => el("option", { value: k, text: v })));
    filter.value = state.filter;
    taskPane.replaceChildren(el("div", { class: "ssb-inspector-head" }, el("div", {}, el("strong", { text: "\u4FEE\u6539\u4EFB\u52A1" }), el("span", { class: "ssb-task-count", text: s?.tasks.length || 0 })), filter), el("div", { class: "ssb-progress" }, el("div", { class: "ssb-progress-fill" })), el("div", { class: "ssb-task-list" }), el("div", { class: "ssb-inspector-divider" }));
    renderTaskList();
    renderCounts();
    if (!s) {
      taskPane.append(el("div", { class: "ssb-editor-empty" }, icon("frame", 32), el("p", { text: "\u622A\u56FE\u91CC\u7684\u6BCF\u4E00\u4E2A\u4FEE\u6539\u70B9\uFF0C\n\u90FD\u4F1A\u6210\u4E3A\u4E00\u5F20\u4EFB\u52A1\u5361\u3002" })));
      return;
    }
    if (!t) {
      const title2 = el("input", { value: s.title, maxlength: 120, "aria-label": "\u622A\u56FE\u540D\u79F0", oninput: (e) => {
        s.title = e.target.value;
        changed();
        renderTabs();
      } });
      taskPane.append(el(
        "div",
        { class: "ssb-editor" },
        field("\u622A\u56FE\u540D\u79F0", title2),
        el("div", { class: "ssb-image-info", text: s.original.width + " \xD7 " + s.original.height + " px \xB7 " + (s.original.size / 1024 / 1024).toFixed(2) + " MB" }),
        button(s.after ? "\u66FF\u6362\u4FEE\u6539\u540E\u622A\u56FE" : "\u6DFB\u52A0\u4FEE\u6539\u540E\u622A\u56FE", "compare", pickAfter, "ssb-wide"),
        el("p", { class: "ssb-hint", text: "\u4FEE\u6539\u540E\u622A\u56FE\u7528\u4E8E\u4EBA\u5DE5\u5BF9\u7167\u9A8C\u6536\u3002\u4EFB\u52A1\u72B6\u6001\u4E0D\u4F1A\u7531\u56FE\u7247\u81EA\u52A8\u5224\u5B9A\u3002" }),
        button("\u79FB\u9664\u8FD9\u5F20\u622A\u56FE", "trash", () => {
          if (!confirm("\u79FB\u9664\u622A\u56FE\u548C\u5B83\u7684\u5168\u90E8\u4EFB\u52A1\uFF1F")) return;
          state.board.screenshots = state.board.screenshots.filter((x) => x.id !== s.id);
          state.shotId = state.board.screenshots[0]?.id;
          state.taskId = null;
          changed();
          render();
        }, "ssb-text-danger")
      ));
      return;
    }
    const index = s.tasks.indexOf(t), title = el("input", { value: t.title, maxlength: 160, "aria-label": "\u4EFB\u52A1\u6807\u9898", oninput: (e) => {
      t.title = e.target.value;
      changed();
      renderTaskList();
    } }), note = el("textarea", { value: t.note, rows: 3, maxlength: 8e3, placeholder: "\u4F60\u770B\u5230\u7684\u95EE\u9898\uFF0C\u6216\u6700\u521D\u7684\u60F3\u6CD5\u2026", "aria-label": "\u539F\u59CB\u6279\u6CE8", oninput: (e) => {
      t.note = e.target.value;
      changed();
    } }), requirement = el("textarea", { value: t.requirement, rows: 3, maxlength: 1e4, placeholder: "\u4F4D\u7F6E + \u73B0\u72B6 + \u671F\u671B\uFF0C\u4F8B\u5982\uFF1A\u5217\u8868\u884C\u95F4\u8DDD\u8F83\u5927\uFF0C\u5E0C\u671B\u66F4\u7D27\u51D1\u3002", "aria-label": "\u671F\u671B\u4FEE\u6539", oninput: (e) => {
      t.requirement = e.target.value;
      requirementChanged();
    } }), acceptance = el("textarea", { value: t.acceptance, rows: 3, maxlength: 6e3, placeholder: "\u53EF\u89C2\u5BDF\u7684\u5B8C\u6210\u6761\u4EF6\uFF0C\u4F8B\u5982\uFF1A\u540C\u4E00\u7A97\u53E3\u80FD\u770B\u5230\u56DB\u884C\uFF0C\u6587\u5B57\u4E0D\u91CD\u53E0\u3002", "aria-label": "\u9A8C\u6536\u6761\u4EF6", oninput: (e) => {
      t.acceptance = e.target.value;
      requirementChanged();
    } });
    const readiness = el("p", { class: "ssb-hint ssb-readiness", "aria-live": "polite" }), confirmed = el("input", { type: "checkbox", checked: t.clarity === "confirmed", "aria-label": "\u9700\u6C42\u5DF2\u7531\u6211\u786E\u8BA4", onchange: (e) => {
      t.clarity = e.target.checked ? "confirmed" : "draft";
      changed();
      updateReadiness();
    } });
    function updateReadiness() {
      const issues = taskIssues(t);
      readiness.textContent = issues.length ? "\u5F85\u6F84\u6E05\uFF1A" + issues.join("\uFF1B") : "\u4FE1\u606F\u5DF2\u9F50\u5168\uFF0C\u53EF\u4EE5\u5728\u4EA4\u63A5\u65F6\u9009\u4E3A\u6267\u884C\u4EFB\u52A1\u3002";
      renderTaskList();
    }
    function requirementChanged() {
      t.clarity = "draft";
      confirmed.checked = false;
      changed();
      updateReadiness();
    }
    const kind = el("select", { "aria-label": "\u95EE\u9898\u7C7B\u578B", onchange: (e) => {
      t.kind = e.target.value;
      t.clarity = "draft";
      changed();
      renderInspector();
    } }, el("option", { value: "visual", text: "\u5916\u89C2\u8C03\u6574" }), el("option", { value: "interaction", text: "\u4EA4\u4E92\u6545\u969C" }));
    kind.value = t.kind;
    const clarification = el("textarea", { value: t.clarification, rows: 2, maxlength: 6e3, "aria-label": "\u5F85\u6F84\u6E05\u95EE\u9898", placeholder: "\u8FD8\u6CA1\u60F3\u6E05\u695A\u7684\u65B9\u5411\u6216\u9700\u8981\u8BA8\u8BBA\u7684\u95EE\u9898\uFF1B\u786E\u8BA4\u540E\u6E05\u7A7A\u3002", oninput: (e) => {
      t.clarification = e.target.value;
      requirementChanged();
    } });
    const reproduction2 = t.kind === "interaction" ? el(
      "div",
      { class: "ssb-reproduction" },
      el("p", { class: "ssb-hint", text: "\u4EA4\u4E92\u6545\u969C\u9700\u8981\u64CD\u4F5C\u9A8C\u8BC1\u3002\u4F8B\uFF1A\u8FDB\u5165\u5217\u8868 \u2192 \u5220\u9664 \u2192 \u53D6\u6D88\uFF1B\u5B9E\u9645\u4ECD\u5220\u9664\uFF1B\u9884\u671F\u9879\u76EE\u4FDD\u7559\u3002" }),
      [["steps", "\u590D\u73B0\u6B65\u9AA4", "\u4ECE\u54EA\u4E2A\u9875\u9762\u5F00\u59CB\uFF0C\u4F9D\u6B21\u70B9\u51FB\u4EC0\u4E48\uFF1F"], ["actual", "\u5B9E\u9645\u7ED3\u679C", "\u5B9E\u9645\u53D1\u751F\u4E86\u4EC0\u4E48\uFF1F"], ["expected", "\u9884\u671F\u7ED3\u679C", "\u5E94\u8BE5\u53D1\u751F\u4EC0\u4E48\uFF1F"], ["environment", "\u73AF\u5883\u4E0E\u64CD\u4F5C\u6761\u4EF6", "\u6309\u9700\u586B\u5199\uFF1A\u6D4F\u89C8\u5668\u3001\u7A97\u53E3\u5C3A\u5BF8\u3001\u767B\u5F55/\u6570\u636E\u72B6\u6001\uFF1B\u4E0D\u8981\u586B\u5199\u5BC6\u7801\u3002"]].map(([key, label, placeholder]) => field(label, el("textarea", { value: t.reproduction[key], rows: 2, maxlength: 6e3, "aria-label": label, placeholder, oninput: (e) => {
        t.reproduction[key] = e.target.value;
        requirementChanged();
      } })))
    ) : null;
    const status = el("select", { "aria-label": "\u4EFB\u52A1\u72B6\u6001", onchange: (e) => {
      try {
        setStatus(t, e.target.value);
      } catch (error) {
        toast(error.message, true);
      }
    } }, Object.entries(STATUSES).map(([k, v]) => el("option", { value: k, text: v })));
    status.value = t.status;
    const priority = el("select", { "aria-label": "\u4EFB\u52A1\u4F18\u5148\u7EA7", onchange: (e) => {
      t.priority = e.target.value;
      changed();
      renderTaskList();
    } }, Object.entries(PRIORITIES).map(([k, v]) => el("option", { value: k, text: v + "\u4F18\u5148\u7EA7" })));
    priority.value = t.priority;
    const record2 = el("textarea", { rows: 2, maxlength: 2e3, placeholder: "\u8865\u5145\u8BA8\u8BBA\u3001\u6267\u884C\u7ED3\u679C\u6216\u9A8C\u6536\u8BF4\u660E\u2026", "aria-label": "\u65B0\u589E\u8BA8\u8BBA\u8BB0\u5F55" });
    taskPane.append(el(
      "div",
      { class: "ssb-editor" },
      el("div", { class: "ssb-editor-heading" }, el("span", { class: "ssb-eyebrow", text: "\u4FEE\u6539\u70B9 " + String(index + 1).padStart(2, "0") }), el(
        "div",
        { class: "ssb-editor-order" },
        button("\u4E0A\u79FB\u4EFB\u52A1", "up", () => moveTask(-1), "ssb-icon-only", { disabled: index === 0 }),
        button("\u4E0B\u79FB\u4EFB\u52A1", "down", () => moveTask(1), "ssb-icon-only", { disabled: index === s.tasks.length - 1 }),
        button("\u5220\u9664\u4EFB\u52A1", "trash", () => {
          if (!confirm("\u5220\u9664\u8FD9\u4E2A\u4FEE\u6539\u70B9\uFF1F")) return;
          s.tasks.splice(index, 1);
          state.taskId = null;
          changed();
          renderTabs();
          renderCanvas();
          renderInspector();
        }, "ssb-icon-only")
      )),
      field("\u4EFB\u52A1\u6807\u9898", title),
      el("div", { class: "ssb-field-row" }, field("\u72B6\u6001", status), field("\u4F18\u5148\u7EA7", priority)),
      field("\u95EE\u9898\u7C7B\u578B", kind),
      field("\u539F\u59CB\u6279\u6CE8", note),
      el("details", { class: "ssb-writing-help" }, el("summary", { text: "\u8FD8\u6CA1\u60F3\u6E05\u695A\u600E\u4E48\u5199\uFF1F" }), el("p", { text: "\u5148\u4FDD\u7559\u539F\u8BDD\uFF0C\u518D\u8865\u5145\u4F4D\u7F6E\u3001\u73B0\u72B6\u3001\u671F\u671B\u548C\u5B8C\u6210\u6761\u4EF6\u3002\u53EF\u9009\u65B9\u5411\uFF1A\u5217\u8868\u66F4\u7D27\u51D1\u3001\u6807\u9898\u5C42\u7EA7\u66F4\u6E05\u695A\u3001\u5371\u9669\u64CD\u4F5C\u66F4\u96BE\u8BEF\u89E6\u3002\u8FD9\u91CC\u53EA\u63D0\u4F9B\u793A\u4F8B\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u5199\u5165\u5C3A\u5BF8\u3001\u989C\u8272\u6216\u884C\u4E3A\u3002" })),
      field("\u671F\u671B\u4FEE\u6539", requirement),
      field("\u9A8C\u6536\u6761\u4EF6", acceptance),
      reproduction2,
      field("\u5F85\u6F84\u6E05\u95EE\u9898\uFF08\u53EF\u7559\u7A7A\uFF09", clarification),
      el("label", { class: "ssb-confirm" }, confirmed, el("span", { text: "\u9700\u6C42\u5DF2\u7531\u6211\u786E\u8BA4" })),
      readiness,
      button("\u91CD\u753B\u6807\u6CE8\u533A\u57DF", "frame", () => {
        state.view = "original";
        state.redrawTaskId = t.id;
        setMode("rect");
        renderCanvas();
        toast("\u8BF7\u5728\u539F\u56FE\u4E0A\u91CD\u65B0\u6846\u9009\u8FD9\u4E2A\u4EFB\u52A1\u7684\u533A\u57DF");
      }, "ssb-wide"),
      el("div", { class: "ssb-review-actions" }, button("\u9A8C\u6536\u901A\u8FC7", "check", () => setStatus(t, "accepted"), "ssb-accept"), button("\u9700\u8981\u4FEE\u6539", null, () => setStatus(t, "returned"))),
      button(s.after ? "\u67E5\u770B\u4FEE\u6539\u524D\u540E\u5BF9\u6BD4" : "\u6DFB\u52A0\u4FEE\u6539\u540E\u622A\u56FE", "compare", () => {
        if (!s.after) return pickAfter();
        state.view = "compare";
        state.zoom = null;
        renderTools();
        renderCanvas();
      }, "ssb-wide"),
      el("div", { class: "ssb-history-heading" }, icon("history", 16), el("strong", { text: "\u8BA8\u8BBA\u4E0E\u9A8C\u6536\u8BB0\u5F55" })),
      record2,
      button("\u6DFB\u52A0\u8BB0\u5F55", "plus", () => {
        if (!record2.value.trim()) return;
        if (t.history.length >= 100) throw new Error("\u8BB0\u5F55\u5DF2\u6EE1\uFF0C\u8BF7\u5BFC\u51FA\u540E\u53E6\u5EFA\u4EFB\u52A1");
        t.history.push({ id: uid(), text: record2.value.trim(), createdAt: (/* @__PURE__ */ new Date()).toISOString() });
        changed();
        renderInspector();
      }, "ssb-wide"),
      el("div", { class: "ssb-history" }, [...t.history].reverse().map((h) => el("div", { class: "ssb-history-item" }, el("small", { text: new Date(h.createdAt).toLocaleString("zh-CN") }), el("p", { text: h.text }))))
    ));
    updateReadiness();
  }
  function moveTask(delta) {
    const s = shot(), i = s.tasks.findIndex((t) => t.id === state.taskId), next = i + delta;
    if (next < 0 || next >= s.tasks.length) return;
    [s.tasks[i], s.tasks[next]] = [s.tasks[next], s.tasks[i]];
    changed();
    renderCanvas();
    renderInspector();
  }
  function setStatus(t, value) {
    if (t.status === value) return;
    if (t.history.length >= 100) throw new Error("\u8BB0\u5F55\u5DF2\u6EE1\uFF0C\u8BF7\u5148\u5BFC\u51FA\u4EFB\u52A1\u677F");
    t.history.push({ id: uid(), text: "\u72B6\u6001\uFF1A" + STATUSES[t.status] + " \u2192 " + STATUSES[value], createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    t.status = value;
    changed();
    renderCanvas();
    renderInspector();
  }
  async function annotatedImage(s) {
    const img = await loadImage(assetUrl(s.original)), c = document.createElement("canvas");
    c.width = s.original.width;
    c.height = s.original.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const stroke = Math.max(2, c.width / 450), font = Math.max(14, Math.min(36, c.width / 45));
    for (const [i, t] of s.tasks.entries()) {
      const r = t.rect, a = r.x * c.width, b = r.y * c.height, w = r.w * c.width, h = r.h * c.height;
      x.fillStyle = t.status === "accepted" ? "#229b7218" : "#7656d918";
      x.fillRect(a, b, w, h);
      x.strokeStyle = t.status === "accepted" ? "#169b70" : "#7956db";
      x.lineWidth = stroke;
      x.strokeRect(a, b, w, h);
      const size = font * 1.5, by = Math.max(0, b - size + stroke);
      x.fillStyle = x.strokeStyle;
      x.beginPath();
      x.roundRect(a, by, size, size, Math.max(3, size * 0.15));
      x.fill();
      x.fillStyle = "#fff";
      x.font = "600 " + font + "px system-ui";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(String(i + 1), a + size / 2, by + size / 2);
    }
    const dataUrl = c.toDataURL("image/png");
    if (dataUrl.length > MAX_IMAGE_BYTES * 1.4) throw new Error("\u6279\u6CE8\u56FE\u8D85\u8FC7 8 MB\uFF0C\u8BF7\u7F29\u5C0F\u539F\u56FE\u540E\u91CD\u8BD5");
    return dataUrl;
  }
  async function backup() {
    const board = structuredClone(state.board), assets = {};
    for (const s of board.screenshots) for (const a of [s.original, s.after].filter(Boolean)) if (!assets[a.id]) {
      const blob = await api("assets/" + a.id);
      assets[a.id] = await fileData(blob);
    }
    download(new Blob([JSON.stringify({ format: FORMAT, version: 1, board, assets }, null, 2)], { type: "application/json" }), fileName(board.title, ".backup.json"));
    toast("\u5907\u4EFD\u5DF2\u5BFC\u51FA\uFF0C\u5305\u542B\u5F53\u524D\u7F16\u8F91\u4E0E\u5168\u90E8\u56FE\u7247");
  }
  async function exportZip(selection, expectedBoard) {
    await flush();
    if (state.board !== expectedBoard) throw new Error("\u4EFB\u52A1\u677F\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u4EA4\u63A5\u9884\u89C8");
    const board = structuredClone(expectedBoard), revision = board.revision, rendered = {};
    for (const s of board.screenshots) rendered[s.id] = await annotatedImage(s);
    const blob = await api("boards/" + board.id + "/export", "POST", { revision, rendered, selection });
    download(blob, fileName(board.title, ".handoff.zip"));
    toast("\u4EA4\u63A5\u5305\u5DF2\u5BFC\u51FA\uFF1A\u6267\u884C\u8303\u56F4\u3001\u4EFB\u52A1\u8BF4\u660E\u548C\u56FE\u7247");
  }
  async function handoff() {
    if (state.busy) return toast("\u8BF7\u7B49\u5F85\u56FE\u7247\u5904\u7406\u5B8C\u6210");
    const expectedBoard = state.board;
    try {
      await flush();
    } catch (e) {
      toast(e.message, true);
    }
    if (state.board !== expectedBoard || state.disposed) return;
    const board = state.board, initial = handoffForBoard(board), selection = { executionTaskIds: [...initial.executionTaskIds], referenceTaskIds: [...initial.referenceTaskIds], clarificationTaskIds: [...initial.clarificationTaskIds] }, preview = el("textarea", { class: "ssb-markdown-preview", readonly: true, "aria-label": "\u4EA4\u63A5\u8BF4\u660E\u9884\u89C8" }), summary = el("p", { class: "ssb-scope-summary", "aria-live": "polite" }), choices = el("div", { class: "ssb-scope-list" });
    const currentMarkdown = () => {
      if (state.board !== board) throw new Error("\u4EFB\u52A1\u677F\u5DF2\u5207\u6362\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u4EA4\u63A5\u9884\u89C8");
      return markdownForHandoff(board, handoffForBoard(board, selection));
    };
    function updatePreview() {
      const plan = handoffForBoard(board, selection);
      preview.value = markdownForHandoff(board, plan);
      summary.textContent = `\u6267\u884C ${plan.executionTaskIds.length} \u9879 \xB7 \u5F85\u6F84\u6E05 ${plan.clarificationTaskIds.length} \u9879 \xB7 \u53C2\u8003 ${plan.referenceTaskIds.length} \u9879 \xB7 \u4E0D\u5305\u542B ${plan.omittedTaskIds.length} \u9879`;
    }
    board.screenshots.forEach((s, i) => s.tasks.forEach((t, n) => {
      const issues = taskIssues(t), select = el(
        "select",
        { "aria-label": `\u4EA4\u63A5\u8303\u56F4 ${i + 1}.${n + 1} ${t.title}` },
        el("option", { value: "executionTaskIds", text: "\u672C\u6B21\u6267\u884C", disabled: !!issues.length }),
        el("option", { value: "clarificationTaskIds", text: "\u5F85\u6F84\u6E05" }),
        el("option", { value: "referenceTaskIds", text: "\u4EC5\u4F9B\u53C2\u8003" }),
        el("option", { value: "omit", text: "\u4E0D\u5305\u542B" })
      );
      select.value = Object.keys(selection).find((key) => selection[key].includes(t.id)) || "omit";
      select.addEventListener("change", () => {
        for (const key of Object.keys(selection)) selection[key] = selection[key].filter((id2) => id2 !== t.id);
        if (select.value !== "omit") selection[select.value].push(t.id);
        updatePreview();
      });
      choices.append(el("div", { class: "ssb-scope-row" }, el("div", {}, el("strong", { text: `${i + 1}.${n + 1} ${t.title}` }), el("small", { text: STATUSES[t.status] + (issues.length ? " \xB7 " + issues.join("\uFF1B") : " \xB7 \u7528\u6237\u5DF2\u786E\u8BA4") })), select));
    }));
    updatePreview();
    dialog("\u4EA4\u63A5\u4E0E\u5BFC\u51FA", el(
      "div",
      {},
      el("p", { class: "ssb-hint", text: "\u5F85\u5904\u7406\u3001\u5904\u7406\u4E2D\u3001\u9700\u4FEE\u6539\u4E14\u8D44\u6599\u5DF2\u786E\u8BA4\u7684\u4EFB\u52A1\u9ED8\u8BA4\u6267\u884C\uFF1B\u5F85\u9A8C\u6536\u548C\u5DF2\u901A\u8FC7\u9ED8\u8BA4\u53EA\u4F9B\u53C2\u8003\u3002\u672A\u786E\u8BA4\u6216\u7F3A\u4FE1\u606F\u7684\u4EFB\u52A1\u9700\u5148\u6F84\u6E05\u3002\u53EF\u9010\u9879\u8C03\u6574\u8303\u56F4\uFF1B\u56FE\u7247\u548C board.json \u4ECD\u4FDD\u7559\u5B8C\u6574\u80CC\u666F\u3002\u4E0B\u8F7D\u65F6\u8BB0\u5F55\u5B9E\u9645 UTC \u5BFC\u51FA\u65F6\u95F4\u3002" }),
      state.error ? el("p", { class: "ssb-hint is-error", text: "\u5F53\u524D\u7F16\u8F91\u5C1A\u672A\u4FDD\u5B58\uFF0C\u4E0B\u9762\u4E3A\u672C\u7A97\u53E3\u9884\u89C8\u3002\u89E3\u51B3\u4FDD\u5B58\u51B2\u7A81\u524D\u53EA\u80FD\u5907\u4EFD\uFF0C\u4E0D\u80FD\u5BFC\u51FA\u6267\u884C\u5305\u3002" }) : null,
      summary,
      choices,
      preview
    ), [
      button("\u5907\u4EFD JSON", "save", backup),
      state.error ? button("\u91CD\u65B0\u8F7D\u5165", "history", async () => {
        if (!confirm("\u91CD\u65B0\u8F7D\u5165\u4F1A\u653E\u5F03\u672C\u7A97\u53E3\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\u3002\u8BF7\u5148\u5BFC\u51FA\u5907\u4EFD JSON\u3002\u7EE7\u7EED\u5417\uFF1F")) return;
        clearTimeout(state.timer);
        if (state.saving) await state.saving.catch(() => {
        });
        const saved = await api("boards/" + state.board.id);
        state.board = saved;
        state.changes = state.saved = 0;
        state.error = "";
        state.shotId = saved.screenshots[0]?.id;
        state.taskId = null;
        closeDialog();
        render();
        toast("\u5DF2\u8F7D\u5165\u672C\u673A\u4FDD\u5B58\u7684\u6700\u65B0\u7248\u672C");
      }) : null,
      button("\u4E0B\u8F7D\u8BF4\u660E", "download", async () => {
        await flush();
        download(new Blob([currentMarkdown()], { type: "text/markdown;charset=utf-8" }), fileName(board.title, ".tasks.md"));
      }),
      button("\u590D\u5236\u8BF4\u660E", "copy", async () => {
        await flush();
        await navigator.clipboard.writeText(currentMarkdown());
        toast("\u4EA4\u63A5\u8BF4\u660E\u5DF2\u590D\u5236");
      }),
      button("\u5BFC\u51FA\u4EA4\u63A5\u5305", "download", () => exportZip(selection, board), "ssb-primary")
    ]);
  }
  let resumeSnapshot = null;
  function minimize() {
    const active = document.activeElement;
    resumeSnapshot = {
      active,
      selection: typeof active?.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null,
      scroll: [...root.querySelectorAll(".ssb-stage,.ssb-inspector,.ssb-dialog-body,.ssb-task-list")].map((node) => [node, node.scrollLeft, node.scrollTop])
    };
    state.suspended = true;
    options.onMinimize?.();
    flush().catch((e) => toast(e.message, true));
  }
  function resume() {
    state.suspended = false;
    if (!resumeSnapshot) return;
    const saved = resumeSnapshot;
    requestAnimationFrame(() => {
      if (state.suspended || state.disposed) return;
      for (const [node, left, top] of saved.scroll) {
        node.scrollLeft = left;
        node.scrollTop = top;
      }
      if (saved.active?.isConnected) {
        saved.active.focus({ preventScroll: true });
        if (saved.selection) saved.active.setSelectionRange(...saved.selection);
      }
    });
  }
  function beforeUnload(e) {
    if (state.changes !== state.saved) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  async function onPaste(e) {
    if (state.disposed || state.suspended || state.dialog || !root.contains(document.activeElement)) return;
    const file = [...e.clipboardData?.items || []].find((i) => i.kind === "file" && ["image/png", "image/jpeg"].includes(i.type))?.getAsFile();
    if (file) {
      e.preventDefault();
      try {
        await addFiles([file]);
      } catch (error) {
        toast(error.message, true);
      }
    }
  }
  root.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      root.classList.add("ssb-drop-active");
    }
  });
  root.addEventListener("dragleave", (e) => {
    if (!root.contains(e.relatedTarget)) root.classList.remove("ssb-drop-active");
  });
  root.addEventListener("drop", async (e) => {
    root.classList.remove("ssb-drop-active");
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    try {
      await addFiles([...e.dataTransfer.files]);
    } catch (error) {
      toast(error.message, true);
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.dialog) closeDialog();
      else setMode("select");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      flush().then(() => toast("\u5DF2\u4FDD\u5B58")).catch((error) => toast(error.message, true));
    }
  });
  document.addEventListener("paste", onPaste);
  window.addEventListener("beforeunload", beforeUnload);
  let resizeTimer, lastWidth = 0, lastHeight = 0;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    if (state.suspended || !root.clientWidth || !root.clientHeight) return;
    const width = root.clientWidth, height = root.clientHeight;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    resizeTimer = setTimeout(() => {
      if (!state.suspended && !state.zoom && state.board) {
        const left = stage?.scrollLeft || 0, top = stage?.scrollTop || 0;
        renderCanvas();
        if (stage) {
          stage.scrollLeft = left;
          stage.scrollTop = top;
        }
      }
    }, 80);
  });
  observer.observe(root);
  const ready = (async () => {
    app.append(el("div", { class: "ssb-loading", text: "\u6B63\u5728\u6253\u5F00\u672C\u5730\u4EFB\u52A1\u677F\u2026" }));
    try {
      token = (await api("session")).token;
      state.boards = await api("boards");
      const last = readPref("board"), selected = state.boards.find((b) => b.id === last) || state.boards[0];
      if (selected) await openBoard(selected.id);
      else render();
    } catch (e) {
      if (e.name !== "AbortError") app.replaceChildren(el("div", { class: "ssb-loading" }, el("h2", { text: "\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u4EFB\u52A1\u677F" }), el("p", { text: e.message }), button("\u91CD\u8BD5", "history", () => location.reload())));
    }
  })();
  return { ready, flush, resume, dispose() {
    state.disposed = true;
    abort.abort();
    clearTimeout(state.timer);
    clearTimeout(toastTimer);
    clearTimeout(resizeTimer);
    observer.disconnect();
    document.removeEventListener("paste", onPaste);
    window.removeEventListener("beforeunload", beforeUnload);
    root.replaceChildren();
  } };
}

// src/client/index.js
window.__ModuleLoader__.load({
  id: "dsh-screenshot-board",
  factory(require2) {
    const React = require2("react");
    let instance = null, overlay = null;
    function open() {
      if (overlay?.isConnected) {
        overlay.hidden = false;
        instance?.resume();
        return;
      }
      installStyle();
      overlay = document.createElement("div");
      overlay.className = "ssb-host";
      const root = document.createElement("div");
      root.tabIndex = -1;
      overlay.append(root);
      document.body.append(overlay);
      instance = mountBoardApp(root, { onMinimize: () => {
        overlay.hidden = true;
        document.querySelector(".ssb-launcher")?.focus();
      }, onClose: () => {
        instance?.dispose();
        overlay?.remove();
        instance = null;
        overlay = null;
      } });
      root.focus();
    }
    function Launcher() {
      return React.createElement("button", { className: "ssb-launcher", onClick: open, type: "button", "aria-label": "\u6253\u5F00\u6216\u6062\u590D\u622A\u56FE\u4EFB\u52A1\u677F", title: "\u6253\u5F00\u6216\u6062\u590D\u622A\u56FE\u4EFB\u52A1\u677F\uFF1B\u6536\u8D77\u540E\u4FDD\u7559\u5F53\u524D\u7F16\u8F91" }, "\u25A3 \u622A\u56FE\u4EFB\u52A1\u677F");
    }
    function Settings(props) {
      return React.createElement(
        "div",
        { className: "ssb-setting-launch" },
        React.createElement("div", null, React.createElement("h3", null, "\u622A\u56FE\u4EFB\u52A1\u677F"), React.createElement("p", null, "\u6846\u9009\u6279\u6CE8\u3001\u6574\u7406\u4FEE\u6539\u4EFB\u52A1\u3001\u5BFC\u51FA\u4EA4\u63A5\u6750\u6599\u5E76\u9010\u9879\u9A8C\u6536\u3002")),
        React.createElement("button", { type: "button", onClick: () => {
          props?.close?.();
          open();
        } }, "\u6253\u5F00\u5DE5\u4F5C\u53F0")
      );
    }
    return {
      name: "dsh-screenshot-board",
      inject: ["slots", "locale"],
      apply(ctx) {
        installStyle();
        ctx.effect(() => ctx.locale.register("dsh-screenshot-board", { zh: { nav: "\u622A\u56FE\u4EFB\u52A1\u677F" }, en: { nav: "Screenshot Board" } }), "screenshot-board: locale");
        const t = ctx.locale.bind("dsh-screenshot-board");
        ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "dsh-screenshot-board", order: 35, label: () => t("nav") }, Settings));
        ctx.slots.inject("shell.overlay", function* () {
          yield ctx.slots.register({ name: "shell.overlay", id: "dsh-screenshot-board", order: 900 }, Launcher);
        });
        ctx.effect(() => () => {
          instance?.dispose();
          overlay?.remove();
          instance = null;
          overlay = null;
        }, "screenshot-board: workspace lifecycle");
      }
    };
  }
});
