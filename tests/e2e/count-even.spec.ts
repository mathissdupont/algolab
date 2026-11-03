import { expect, test, type Page } from "@playwright/test";

// End-to-end vertical slice (ALG-E002): build the flowchart with the real
// editor from a clean browser session, run it, step it, and check examples.

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const selectedId = async (page: Page) => (await page.locator(".react-flow__node.selected").getAttribute("data-id"))!;

async function select(page: Page, id: string) {
  await node(page, id).click({ position: { x: 20, y: 10 } });
}

async function add(page: Page, kind: string) {
  await page.getByRole("button", { name: kind, exact: true }).click();
  return selectedId(page);
}

async function connect(page: Page, from: string, port: string, to: string, targetHandle = "in") {
  const src = node(page, from).locator(`.react-flow__handle[data-handleid="${port}"]`);
  const dst = node(page, to).locator(`.react-flow__handle[data-handleid="${targetHandle}"]`);
  const a = (await src.boundingBox())!;
  const b = (await dst.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function fill(page: Page, field: string, value: string) {
  await page.locator(`#field-${field}`).fill(value);
}

test("solve Count Even Readings with a flowchart", async ({ page }) => {
  await page.goto("/algolab/problems/count-even/");
  await expect(page.getByRole("heading", { name: "Count Even Readings" })).toBeVisible();
  await expect(node(page, "start")).toBeVisible();
  await expect(page.getByText(/issues? to fix/)).toBeVisible();

  // Move Return out of the way, then build the program top-down.
  const ret = node(page, "return");
  const rb = (await ret.boundingBox())!;
  await page.mouse.move(rb.x + 30, rb.y + 10);
  await page.mouse.down();
  await page.mouse.move(rb.x + 400, rb.y + 10, { steps: 8 });
  await page.mouse.up();

  await select(page, "input");
  const count0 = await add(page, "Assign");
  await fill(page, "target", "count");
  await fill(page, "expression", "0");
  const i0 = await add(page, "Assign");
  await fill(page, "target", "i");
  await fill(page, "expression", "0");
  const loop = await add(page, "While");
  await fill(page, "condition", "i < len(numbers)");
  const isEven = await add(page, "Decision");
  await fill(page, "condition", "numbers[i] % 2 == 0");
  const incCount = await add(page, "Assign");
  await fill(page, "target", "count");
  await fill(page, "expression", "count + 1");
  const incI = await add(page, "Assign");
  await fill(page, "target", "i");
  await fill(page, "expression", "i + 1");

  await page.getByRole("button", { name: "Fit View" }).click();
  await page.waitForTimeout(300);
  await select(page, "return");
  await fill(page, "expression", "count");

  await connect(page, isEven, "false", incI);
  await connect(page, incI, "next", loop, "loop");
  await connect(page, loop, "exit", "return");
  expect([count0, i0].every(Boolean)).toBe(true);

  await expect(page.getByText("Flowchart is valid")).toBeVisible();

  // Run example 1 → 3
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Matches the expected output")).toBeVisible();
  await expect(page.getByText("Returned", { exact: true }).locator("..")).toContainText("3");

  // Step through from the beginning; the active node is highlighted.
  await page.getByRole("button", { name: "Clear run" }).click();
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect(page.locator(".flow-node.is-active")).toHaveCount(1);
  await expect(page.getByText(/Paused at step 1 of/)).toBeVisible();
  for (let k = 0; k < 5; k++) await page.getByRole("button", { name: "Step forward" }).click();
  await expect(page.getByText(/Paused at step 6 of/)).toBeVisible();
  await page.screenshot({ path: "test-results/debug-step.png" });
  await page.getByRole("button", { name: "Run to breakpoint" }).click();
  await expect(page.getByText("Matches the expected output")).toBeVisible();

  // Without a judge the toolbar button checks the public examples in the
  // browser; with NEXT_PUBLIC_JUDGE_URL it submits to the real judge.
  if (process.env.NEXT_PUBLIC_JUDGE_URL) {
    await page.getByRole("button", { name: "Judge solution" }).click();
    await expect(page.getByText("Accepted")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/5 \/ 5 tests passed \(public \+ hidden\)/)).toBeVisible();
    await expect(page.getByText("Hidden test 5")).toBeVisible();
  } else {
    await page.getByRole("button", { name: "Check examples" }).first().click();
    await expect(page.getByText("Accepted")).toBeVisible();
    await expect(page.getByText(/2 \/ 2 examples passed/)).toBeVisible();
  }

  await page.screenshot({ path: "test-results/count-even-solved.png" });

  // A deliberate infinite loop stops with a typed error.
  await select(page, incI);
  await fill(page, "expression", "i + 0");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("The run never finished")).toBeVisible();
  await expect(page.getByText("STEP_LIMIT_EXCEEDED")).toBeVisible();

  // The draft survives a reload.
  await page.reload();
  await expect(node(page, incI)).toContainText("i + 0");
});

test("every problem opens a workspace, including ones that need maps", async ({ page }) => {
  await page.goto("/algolab/problems/");
  await expect(page.getByText("60 of 60 problems")).toBeVisible();
  await expect(page.getByText("Coming soon")).toHaveCount(0);
  await page.goto("/algolab/problems/distinct-count/");
  await expect(page.getByRole("heading", { name: "Count Different Codes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
});

test("invalid flowcharts cannot be run", async ({ page }) => {
  await page.goto("/algolab/problems/array-sum/");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Return expression: Expression is empty")).toBeVisible();
  await expect(page.locator(".flow-node.has-error")).toHaveCount(2);
});

test("nodes can be connected without dragging, and clearing the chart asks first", async ({ page }) => {
  await page.goto("/algolab/problems/array-sum/");
  await select(page, "input");
  const ret = await add(page, "Return");
  await fill(page, "expression", "0");
  // The new Return was linked after Input; point Input at the starter Return instead, from the Inspector.
  await select(page, "input");
  await page.getByLabel("Then go to").selectOption("return");
  await expect(page.getByText(/is not reachable from Start/).first()).toHaveCount(0);
  await select(page, "return");
  await fill(page, "expression", "0");
  await select(page, ret);
  await page.getByRole("button", { name: "Delete node" }).click();
  await expect(page.getByText("Flowchart is valid")).toBeVisible();

  await page.locator(".react-flow__pane").click({ position: { x: 400, y: 400 } });
  await page.getByRole("button", { name: "Clear chart" }).click();
  const dialog = page.getByRole("dialog", { name: /Delete all nodes in “Sum the Readings”\?/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Flowchart is valid")).toBeVisible();
});
