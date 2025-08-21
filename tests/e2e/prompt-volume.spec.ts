import { test, expect } from '@playwright/test';

test('prompt-volume: 4-scene final prompt structure/volume check', async ({ page }) => {
  await page.goto('/wizard');

  // Enable movie pack (4-scene)
  const moviePack = page.locator('#movie-pack');
  await expect(moviePack).toBeVisible();
  if (!(await moviePack.isChecked())) {
    await moviePack.check();
  }

  // Use sample and generate
  await page.getByTestId('sample-fill-btn').click();
  const genBtn = page.getByTestId('generate-btn-side');
  await expect(genBtn).toBeEnabled();
  await genBtn.click();

  // Wait for final prompt to appear
  const finalTitle = page.getByText('최종 프롬프트');
  await expect(finalTitle).toBeVisible({ timeout: 30000 });

  // Find a <pre> that contains the header
  const pres = page.locator('pre');
  const count = await pres.count();
  let finalText = '';
  for (let i = 0; i < count; i++) {
    const txt = (await pres.nth(i).textContent()) || '';
    if (txt.includes('CINEMATIC MOVIE PROMPTS')) {
      finalText = txt;
      break;
    }
  }
  expect(finalText).not.toEqual('');

  // Structural assertions
  expect(finalText).toContain('CINEMATIC MOVIE PROMPTS');
  expect(finalText).toContain('SCENE 1');
  expect(finalText).toContain('SCENE 2');
  expect(finalText).toContain('SCENE 3');
  expect(finalText).toContain('SCENE 4');

  // Volume assertions
  expect(finalText.length).toBeGreaterThan(1500); // conservative threshold in mock mode

  // Check each scene JSON block exists
  const sceneJsons = finalText.split(/SCENE \d+/).slice(1);
  expect(sceneJsons.length).toBeGreaterThanOrEqual(4);
  for (const block of sceneJsons.slice(0, 4)) {
    // Try to extract first JSON object
    const start = block.indexOf('{');
    const end = block.lastIndexOf('}');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const jsonText = block.slice(start, end + 1);
    // JSON parse should succeed
    let parsed: any;
    try { parsed = JSON.parse(jsonText); } catch (e) { parsed = null; }
    expect(parsed).toBeTruthy();
    expect(parsed?.metadata).toBeTruthy();
    expect(Array.isArray(parsed?.key_elements)).toBeTruthy();
    expect(Array.isArray(parsed?.timeline)).toBeTruthy();
  }
});


