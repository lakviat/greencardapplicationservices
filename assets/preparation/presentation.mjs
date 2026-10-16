// Shared question order and field grouping for editor, preview and PDF export.
export function questionGroups(section) {
  if (section.id !== "identity")
    return [{ title: section.title, fields: section.fields }];
  return [
    ["1. Name", section.fields.slice(0, 3)],
    ["2. Sex", section.fields.filter((f) => f.id.endsWith(".sex"))],
    [
      "3. Birth date",
      section.fields.filter((f) => f.id.endsWith(".birthDate")),
    ],
    [
      "4. City where you were born",
      section.fields.filter((f) => f.id.endsWith(".birthCity")),
    ],
    [
      "5. Country where you were born",
      section.fields.filter((f) => f.id.endsWith(".birthCountry")),
    ],
  ].map(([title, fields]) => ({ title, fields }));
}
export function fieldRows(group) {
  const rows = [];
  for (let i = 0; i < group.fields.length;) {
    const next = group.fields.slice(i, i + 3);
    if (next.length === 3 && next.every((f) => f.type === "name")) {
      rows.push(next);
      i += 3;
    } else {
      rows.push([group.fields[i]]);
      i++;
    }
  }
  return rows;
}
export function preparedDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
