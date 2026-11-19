// Match the published wording so a new description from the bakery takes effect immediately.
const descriptions = new Map([
  ["A flavour combination that just works. The dough is infused with fragrant Pandan and filled with coconut and gula Melaka.", "Pandan dough swirled with coconut and gula Melaka."],
  ["This banana cake is moist and buttery , with a bruled banana on top.", "Buttery banana cake topped with brûléed banana."],
  ["Homemade Sourdough, 24h cold proven. 4 year old starter", "Cold-proofed for 24 hours with our four-year-old starter."],
  ["Four Irresistable classic, thin and crunchy chocolate chip cookies", "Four thin, crunchy chocolate chip cookies."],
  ["Four Irresistable chocolate chip cookies made with nutty brown butter, pools of melty chocolate, and a hint of sea salt.", "Four brown butter cookies with pools of chocolate and a hint of sea salt."],
]);

export function mobileBakeCopy(note) {
  return descriptions.get(note) ?? note;
}
