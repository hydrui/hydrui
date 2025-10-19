export const isServerMode =
  document.body.getAttribute("data-server-mode") === "true";
export const noAuth = document.body.getAttribute("data-no-auth") === "true";
export const isDemoMode =
  new URL(document.URL).search === "?demo" && !isServerMode;
