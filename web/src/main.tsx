import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { Dashboard } from "./pages/Dashboard";
import { Pay } from "./pages/Pay";
import { config } from "./lib/config";
import "./styles.css";

/**
 * Two routes, so a router library would be more configuration than code. The
 * payment path is a real URL rather than a hash because that URL is the
 * product — it gets pasted into invoices and messages.
 */
function useLinkId(): bigint | undefined {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const match = path.replace(config.base, "/").match(/^\/pay\/(\d+)$/);
  return match ? BigInt(match[1]!) : undefined;
}

function App() {
  const id = useLinkId();
  return id === undefined ? <Dashboard /> : <Pay id={id} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing the #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
