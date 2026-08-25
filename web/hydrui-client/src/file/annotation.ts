import * as z from "zod/mini";

import { FileMetadata } from "@/api/types";

const hybooruSubNotePattern = String.raw`\n*(.*?)\n#! ([^\n]*)\n?`;
const hybooruSubNoteMatcher = new RegExp(hybooruSubNotePattern, "s");

let nextLocalAnnotationId = 0;
function newLocalAnnotationId(): string {
  return `annotation-${nextLocalAnnotationId++}`;
}

interface AnnotationFormat {
  name: string;
  noteMatches: (name: string, text: string) => boolean;
  parse: (text: string) => Annotations | null;
  emit: (annotations: Annotations) => string;
  warnings: (annotations: Annotations) => string[];
}

const hydruiAnnotationsNoteName = "hydrui annotations";

const hydruiAnnotationFormat: AnnotationFormat = {
  name: "Hydrui Annotations",
  noteMatches: (name, text) =>
    name === hydruiAnnotationsNoteName && text.startsWith("["),
  parse: parseHydruiAnnotations,
  emit: emitHydruiAnnotations,
  warnings: () => [],
};

const danbooruNoteFormat: AnnotationFormat = {
  name: "Danbooru Notes",
  noteMatches: (name, text) =>
    name === "danbooru notes" && text.startsWith("["),
  parse: parseDanbooruNotes,
  emit: emitDanbooruNotes,
  warnings: danbooruWarnings,
};

const hybooruSubnotesFormat: AnnotationFormat = {
  name: "Hybooru Subnotes",
  noteMatches: (_name, text) => hybooruSubNoteMatcher.test(text),
  parse: parseHybooruSubnotes,
  emit: emitHybooruSubnotes,
  warnings: hybooruWarnings,
};

const annotationFormats: AnnotationFormat[] = [
  hydruiAnnotationFormat,
  danbooruNoteFormat,
  hybooruSubnotesFormat,
];

export const AnnotationContentSchema = z.looseObject({
  language: z.string(),
  contentType: z.string(),
  body: z.string(),
});

export type AnnotationContent = z.infer<typeof AnnotationContentSchema>;

export const AnnotationSchema = z.looseObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  body: z.string(),
  contents: z.optional(z.array(AnnotationContentSchema)),

  imageWidth: z.optional(z.number()),
  imageHeight: z.optional(z.number()),

  danbooru_id: z.optional(z.number()),
  danbooru_created_at: z.optional(z.string()),
  danbooru_updated_at: z.optional(z.string()),
  danbooru_is_active: z.optional(z.boolean()),
  danbooru_post_id: z.optional(z.number()),
  danbooru_version: z.optional(z.number()),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

export type LocalAnnotation = Annotation & {
  $hydrusNote: string;
  $format: AnnotationFormat;
  $id: string;
  $pending?: boolean;

  imageWidth: number;
  imageHeight: number;
};

export const AnnotationsSchema = z.array(AnnotationSchema);

export type Annotations = z.infer<typeof AnnotationsSchema>;

export const DanbooruNoteSchema = z.looseObject({
  id: z.optional(z.number()),
  created_at: z.optional(z.string()),
  updated_at: z.optional(z.string()),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  is_active: z.optional(z.boolean()),
  post_id: z.optional(z.number()),
  body: z.string(),
  version: z.optional(z.number()),
});

export type DanbooruNote = z.infer<typeof DanbooruNoteSchema>;

export const DanbooruNotesSchema = z.array(DanbooruNoteSchema);

export type DanbooruNotes = z.infer<typeof DanbooruNotesSchema>;

export function parseHydruiAnnotations(
  text: string | undefined,
): Annotations | null {
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    const result = AnnotationsSchema.safeParse(obj);
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function emitHydruiAnnotations(annotations: Annotations): string {
  return JSON.stringify(
    annotations.map((annotation) => {
      return Object.fromEntries(
        Object.entries(annotation).filter(([name]) => !name.startsWith("$")),
      );
    }),
  );
}

function danbooruNotesToHydruiAnnotations(notes: DanbooruNotes): Annotations {
  return notes.map(
    ({
      id,
      created_at,
      updated_at,
      x,
      y,
      width,
      height,
      is_active,
      post_id,
      body,
      version,
    }) => ({
      x,
      y,
      width,
      height,
      body,

      danbooru_id: id,
      danbooru_created_at: created_at,
      danbooru_updated_at: updated_at,
      danbooru_is_active: is_active,
      danbooru_post_id: post_id,
      danbooru_version: version,
    }),
  );
}

function hydruiAnnotationsToDanbooruNotes(
  annotations: Annotations,
): DanbooruNotes {
  return annotations.map(
    ({
      danbooru_created_at,
      danbooru_updated_at,
      x,
      y,
      width,
      height,
      body,
      danbooru_id,
      danbooru_is_active,
      danbooru_post_id,
      danbooru_version,
    }) => ({
      x,
      y,
      width,
      height,
      body,
      id: danbooru_id,
      created_at: danbooru_created_at,
      updated_at: danbooru_updated_at,
      is_active: danbooru_is_active,
      post_id: danbooru_post_id,
      version: danbooru_version,
    }),
  );
}

export function parseDanbooruNotes(
  text: string | undefined,
): Annotations | null {
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    const result = DanbooruNotesSchema.safeParse(obj);
    if (result.success) {
      return danbooruNotesToHydruiAnnotations(result.data);
    }
    return null;
  } catch {
    return null;
  }
}

export function emitDanbooruNotes(annotations: Annotations): string {
  return JSON.stringify(hydruiAnnotationsToDanbooruNotes(annotations));
}

export function danbooruWarnings(annotations: Annotations): string[] {
  const warnings = [];
  for (const annotation of annotations) {
    if (annotation.imageWidth || annotation.imageHeight) {
      warnings.push(
        "Original image dimensions of annotations will not be saved.",
      );
    }
    if (annotation.contents?.length) {
      warnings.push("Complex annotation data will be discarded.");
    }
  }
  return warnings;
}

function parseHybooruSubnotes(note: string): Annotations | null {
  const subNotes: Annotation[] = [];
  const subNoteRegex = new RegExp(hybooruSubNotePattern, "gs");
  try {
    let match;
    while ((match = subNoteRegex.exec(note))) {
      const data = JSON.parse(match[2] || "");
      if (!Array.isArray(data))
        throw new Error(`Expected array, got ${match[2]}`);

      let [left, top, width, height, postWidth, postHeight] = data;

      if (typeof left !== "number") left = 0;
      if (typeof top !== "number") top = 0;
      if (typeof width !== "number") width = 0;
      if (typeof height !== "number") height = 0;
      if (typeof postWidth !== "number") postWidth = 100;
      if (typeof postHeight !== "number") postHeight = 100;

      subNotes.push({
        x: left,
        y: top,
        width,
        height,
        imageWidth: postWidth,
        imageHeight: postHeight,
        body: match[1] || "",
      });
    }
  } catch {
    return null;
  }
  return subNotes.length > 0 ? subNotes : null;
}

export function emitHybooruSubnotes(annotations: Annotations): string {
  return annotations
    .map((annotation) => {
      const imageWidth = annotation.imageWidth ?? 100;
      const imageHeight = annotation.imageHeight ?? 100;
      const left = Math.round(annotation.x);
      const top = Math.round(annotation.y);
      const width = Math.round(annotation.width);
      const height = Math.round(annotation.height);
      const body = annotation.body || "";
      return `${body}\n#! [${left},${top},${width},${height},${imageWidth},${imageHeight}]`;
    })
    .join("\n");
}

export function hybooruWarnings(annotations: Annotations): string[] {
  const warnings = [];
  for (const annotation of annotations) {
    if (annotation.contents?.length) {
      warnings.push("Complex annotation data will be discarded.");
      break;
    }
  }
  for (const annotation of annotations) {
    if (
      annotation.danbooru_id ||
      annotation.danbooru_created_at ||
      annotation.danbooru_updated_at ||
      annotation.danbooru_is_active ||
      annotation.danbooru_post_id ||
      annotation.danbooru_version
    ) {
      warnings.push("Danbooru-specific annotation metadata will be discarded.");
      break;
    }
  }
  return warnings;
}

export function fileHasAnnotations(fileData: FileMetadata): boolean {
  if (!fileData.notes) return false;
  for (const [name, text] of Object.entries(fileData.notes))
    for (const format of annotationFormats)
      if (format.noteMatches(name, text)) return true;
  return false;
}

export function deserializeAnnotations(
  fileData: FileMetadata,
): LocalAnnotation[] {
  const annotations: LocalAnnotation[] = [];
  if (!fileData.notes) return annotations;
  for (const [name, text] of Object.entries(fileData.notes)) {
    for (const format of annotationFormats) {
      if (format.noteMatches(name, text)) {
        const parsedData = format.parse(text);
        if (!parsedData) {
          continue;
        }
        annotations.push(
          ...parsedData.map((data) => ({
            ...data,
            $hydrusNote: name,
            $format: format,
            $id: newLocalAnnotationId(),
            imageWidth: data.imageWidth || fileData.width!,
            imageHeight: data.imageHeight || fileData.height!,
          })),
        );
        break;
      }
    }
  }
  return annotations;
}

export function serializeAnnotations(
  annotations: LocalAnnotation[],
): Record<string, string> {
  const annotationsByNoteName = new Map<string, LocalAnnotation[]>();
  for (const annotation of annotations) {
    let list = annotationsByNoteName.get(annotation.$hydrusNote);
    if (!list) {
      list = [];
      annotationsByNoteName.set(annotation.$hydrusNote, list);
    }
    list.push(annotation);
  }
  const updatedNotes: Record<string, string> = {};
  for (const [name, annotations] of annotationsByNoteName.entries()) {
    const format = annotations[0]?.$format;
    if (!format) continue; // ???
    updatedNotes[name] = format.emit(annotations);
  }
  return updatedNotes;
}

export interface AnnotationNoteUpdate {
  notes: Record<string, string>;
  noteNamesToDelete: string[];
}

export function buildAnnotationNoteUpdate(
  annotations: LocalAnnotation[],
  originalNoteNames: Iterable<string>,
): AnnotationNoteUpdate {
  const notes = serializeAnnotations(annotations);
  const noteNamesToDelete = Array.from(originalNoteNames).filter(
    (name) => !(name in notes),
  );
  return { notes, noteNamesToDelete };
}

export function newAnnotation(
  x: number,
  y: number,
  width: number,
  height: number,
  body: string,
  imageWidth: number,
  imageHeight: number,
  contents?: AnnotationContent[],
): LocalAnnotation {
  const $id = newLocalAnnotationId();
  const note: LocalAnnotation = {
    x,
    y,
    width,
    height,
    imageWidth,
    imageHeight,
    body,
    ...(contents === undefined ? {} : { contents }),
    $hydrusNote: hydruiAnnotationsNoteName,
    $format: hydruiAnnotationFormat,
    $id,
  };
  return note;
}
