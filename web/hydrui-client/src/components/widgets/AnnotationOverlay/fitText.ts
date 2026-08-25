export const MIN_ANNOTATION_FONT_SIZE = 14;
export const MAX_ANNOTATION_FONT_SIZE = 72;

type FitsAtFontSize = (fontSize: number) => boolean;

export function findLargestFittingFontSize(
  fitsAtFontSize: FitsAtFontSize,
): number {
  let smallestFit = MIN_ANNOTATION_FONT_SIZE;
  let largestCandidate = MAX_ANNOTATION_FONT_SIZE;

  if (!fitsAtFontSize(smallestFit)) return smallestFit;

  while (smallestFit < largestCandidate) {
    const candidate = Math.ceil((smallestFit + largestCandidate) / 2);
    if (fitsAtFontSize(candidate)) {
      smallestFit = candidate;
    } else {
      largestCandidate = candidate - 1;
    }
  }

  return smallestFit;
}

export function fitAnnotationFontSize(
  element: HTMLElement,
  text: string,
): number {
  const fitsAtFontSize = (fontSize: number) => {
    element.style.fontSize = `${fontSize}px`;
    return (
      element.clientWidth > 0 &&
      element.clientHeight > 0 &&
      element.scrollWidth <= element.clientWidth &&
      element.scrollHeight <= element.clientHeight
    );
  };

  const fontSize = text.trim()
    ? findLargestFittingFontSize(fitsAtFontSize)
    : MIN_ANNOTATION_FONT_SIZE;
  element.style.fontSize = `${fontSize}px`;
  return fontSize;
}
