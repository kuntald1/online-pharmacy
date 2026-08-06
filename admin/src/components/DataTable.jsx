export default function DataTable({ columns, rows, keyField = "id", emptyMessage = "Nothing here yet." }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-card border border-border shadow-card p-12 text-center">
        <p className="text-ink-soft text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card border border-border shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left font-medium text-ink-soft text-xs uppercase tracking-wider px-5 py-3"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[keyField]} className="border-b border-border last:border-0 hover:bg-bg/40">
              {columns.map((col) => (
                <td key={col.key} className="px-5 py-3.5 align-middle">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
