async function crawler() {
  const visited = new Set();
  const queue = ["/src/main.tsx"];
  const errors = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    try {
      const res = await fetch("http://localhost:3000" + current);
      if (!res.ok) {
        errors.push({ path: current, status: res.status });
        continue;
      }
      const cType = res.headers.get("content-type") || "";
      if (current.includes(".css")) {
        continue;
      }
      if (!cType.includes("javascript")) {
        errors.push({ path: current, status: res.status, cType });
        continue;
      }
      const code = await res.text();
      const importRegex = /(?:from\s+["']|import\s+["']|import\s*\(\s*["'])([^"']+)["']/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        let dep = match[1];
        let target = dep;
        if (dep.startsWith("/")) {
          target = dep;
        } else if (dep.startsWith("./") || dep.startsWith("../")) {
          const parts = current.split("/");
          parts.pop();
          const base = parts.join("/");
          target = new URL(dep, "http://localhost:3000" + base + "/").pathname;
        }
        if (target.includes("MyComponent") || target.endsWith("index.js")) {
          console.log(`FOUND! Parent: ${current} imports: ${dep} -> ${target}`);
        }
        if (!visited.has(target)) queue.push(target);
      }
    } catch (err) {
      errors.push({ path: current, error: err.message });
    }
  }

  console.log("Total modules crawled:", visited.size);
  console.log("Errors found:", errors.length);
  if (errors.length > 0) {
    console.log("Error details:", JSON.stringify(errors, null, 2));
  }
}
crawler();
