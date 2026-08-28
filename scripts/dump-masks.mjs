import { TEMPLATES } from "../src/data/templates.js";

function renderMask(mask) {
  return mask.map((row) => row.map((cell) => (cell ? "██" : "··")).join("")).join("\n");
}

for (const t of TEMPLATES) {
  console.log(`\n=== ${t.name} (gridSize=${t.gridSize}) ===`);
  console.log(renderMask(t.mask));
  console.log("Views:");
  console.log("front:");
  console.log(renderMask(t.views.front));
  console.log("back:");
  console.log(renderMask(t.views.back));
  console.log("leftSleeve:");
  console.log(renderMask(t.views.leftSleeve));
  console.log("rightSleeve:");
  console.log(renderMask(t.views.rightSleeve));
}
