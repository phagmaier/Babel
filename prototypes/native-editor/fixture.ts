/** Deterministic synthetic input only; page equivalents are workload labels, not PDF claims. */
export function makeFixture(pageEquivalent: 120 | 300 | 600) {
  const paragraphs: string[] = [];
  for (let page = 0; page < pageEquivalent; page++) {
    for (let block = 0; block < 20; block++) {
      const index = page * 20 + block;
      if (block % 10 === 0) {
        paragraphs.push(`INT. SYNTHETIC ROOM ${page + 1} - DAY`);
      } else if (block % 10 === 4) {
        paragraphs.push(`MARA ${index}`);
      } else if (block % 10 === 5 || block % 10 === 6) {
        paragraphs.push(
          `A quiet line of dialogue ${index}. The signal stays local.`,
        );
      } else if (block % 10 === 8) {
        paragraphs.push(
          `The long synthetic paragraph ${index} holds a lantern, a timetable, and a string of ordinary words repeated for wrapping. `.repeat(
            3,
          ),
        );
      } else {
        paragraphs.push(
          `Action ${index}: rain crosses the empty platform while a distant light moves behind the windows.`,
        );
      }
    }
  }
  const text = paragraphs.join('\n');
  return {
    paragraphs,
    text,
    pages: pageEquivalent,
    lines: paragraphs.length,
    blocks: paragraphs.length,
  };
}
