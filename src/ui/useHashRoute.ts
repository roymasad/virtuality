import { useEffect, useMemo, useState } from "react";

export type Route =
  | { name: "gallery" }
  | { name: "scene"; sceneId: string }
  | { name: "source"; sceneId: string };

export function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return useMemo(() => parseHash(hash), [hash]);
}

export function navigate(route: Route) {
  if (route.name === "gallery") window.location.hash = "#/";
  if (route.name === "scene") window.location.hash = `#/scene/${route.sceneId}`;
  if (route.name === "source") window.location.hash = `#/source/${route.sceneId}`;
}

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "scene" && parts[1]) return { name: "scene", sceneId: parts[1] };
  if (parts[0] === "source" && parts[1]) return { name: "source", sceneId: parts[1] };
  return { name: "gallery" };
}
