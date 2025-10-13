export const isServerMode =
  document.body.getAttribute("data-server-mode") === "true";
export const noAuth = document.body.getAttribute("data-no-auth") === "true";
