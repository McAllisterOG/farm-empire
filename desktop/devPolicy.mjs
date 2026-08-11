export function isFarmEmpireHtml(html) {
  return /<title>Farm Empire<\/title>/i.test(html) && html.includes('id="game-canvas"');
}
