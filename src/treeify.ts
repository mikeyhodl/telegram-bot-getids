import * as html from "html-escaper";
import * as codes from "iso-lang-codes";

export function renderTree(
  object: Record<string, any>,
  title: string = "Root",
): string {
  return `<b>${title.toString()}</b>\n${renderLines(object).join("\n")}`;
}

function renderLines(
  object: Record<string, any> | any[],
  prefix: string[] = [],
): string[] {
  const isArr = Array.isArray(object);
  const keys = Object.keys(object);

  return keys.flatMap((key, index) => {
    const isLast = index === keys.length - 1;
    const value = object[key];

    if (isObjectLike(value)) {
      return [
        renderPrefix(prefix, isLast) + "<b>" + key + "</b>",
        ...renderLines(value, prefix.concat([isLast ? " " : "┊"])),
      ];
    }

    let text = renderPrefix(prefix, isLast) + (isArr ? "" : `<b>${key}:</b> `);
    text += renderValue(key, value);
    return [text];
  });
}

function isObjectLike(value: unknown): value is Record<string, any> | any[] {
  return value !== null && typeof value === "object";
}

function renderValue(key: string, rawValue: unknown): string {
  const value = rawValue as any;
  const valString = escapeHtml(value?.toString?.() ?? "");

  if (key === "username") {
    return '<a href="https://t.me/' + value + '">' + valString + "</a>";
  }

  if (key === "file_size" && typeof value !== "string") {
    return formatSizeUnits(value);
  }

  if (key === "set_name" && typeof value === "string") {
    return (
      '<a href="https://t.me/addstickers/' + value + '">' + valString + "</a>"
    );
  }

  if (key === "duration") {
    return formatTime(value);
  }

  if (key === "language_code") {
    const langString = (codes.locales as any)[valString] || "-";
    return `<code>${valString}</code> (${langString})`;
  }

  if (key === "message_id" || key === "created") {
    return value;
  }

  if (typeof value === "number" || key.includes("id")) {
    return "<code>" + valString + "</code>";
  }

  return valString;
}

function renderPrefix(prefix: string[], isLast: boolean): string {
  return " " + prefix.concat([isLast ? "└" : "├"]).join("  ") + " ";
}

export function formatSizeUnits(bytes: number): string {
  if (bytes >= 1073741824) {
    return (bytes / 1073741824).toFixed(2) + " GB";
  } else if (bytes >= 1048576) {
    return (bytes / 1048576).toFixed(2) + " MB";
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + " kB";
  } else if (bytes > 1) {
    return bytes + " bytes";
  } else if (bytes === 1) {
    return bytes + " byte";
  } else {
    return "0 bytes";
  }
}

function formatTime(seconds: number): string {
  const res: Record<string, number> = {};
  let started = false;

  const timeUnits: Array<[string, number]> = [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];

  timeUnits.forEach((unit) => {
    if (!started) {
      if (seconds > unit[1]) {
        started = true;
      } else {
        return;
      }
    }

    res[unit[0]] = Math.floor(seconds / unit[1]);
    seconds %= unit[1];
  });

  if (!started) {
    res.s = 0;
  }

  return Object.values(res).join(":") + " (" + Object.keys(res).join(":") + ")";
}

export function escapeHtml(unsafe: any): any {
  if (unsafe === undefined) {
    return unsafe;
  } else if (typeof unsafe === "object") {
    const result: Record<string, any> = {};
    for (const key in unsafe) {
      result[key] = escapeHtml(unsafe[key]);
    }
    return result;
  } else if (typeof unsafe === "string") {
    return html.escape(unsafe);
  } else {
    return unsafe;
  }
}
