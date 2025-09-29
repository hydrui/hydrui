export * from "@zip.js/zip.js";

// The entrypoint for zip.js is @zip.js/zip.js/index.
//
// This causes Vite to choose index as the name for the split bundle when we
// lazy load it.
//
// That, in turn, breaks the heuristic that Hydrui Server uses to find the main
// bundle.
//
// This file just exists to do nothing other than make a bundle-splitting point
// called zipjs.
