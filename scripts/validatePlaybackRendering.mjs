import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { advancePlaybackTimeSec, PLAYBACK_SPEEDS } = await server.ssrLoadModule('/src/utils/playbackClock.ts');
  const { evaluateMasterTimeline } = await server.ssrLoadModule('/src/utils/timelineEngine.ts');
  const { getDiseaseById } = await server.ssrLoadModule('/src/data/diseases/index.ts');
  const { HeartDiagram } = await server.ssrLoadModule('/src/components/HeartDiagram.tsx');
  for (const speed of PLAYBACK_SPEEDS) {
    assert.equal(advancePlaybackTimeSec(0, 1, 2.4, speed), speed);
    assert.ok(Math.abs(advancePlaybackTimeSec(2.3, 1, 2.4, speed) - ((2.3 + speed) % 2.4)) < 1e-12);
  }
  const afterChange = advancePlaybackTimeSec(advancePlaybackTimeSec(0.3, 0.1, 2.4, 0.25), 0.1, 2.4, 1);
  assert.ok(Math.abs(afterChange - 0.425) < 1e-12, 'changing speed must not reset the phase');
  const junctional = getDiseaseById('junctional_rhythm');
  let atrialSamples = 0;
  const lowerRAFronts = [];
  for (let t = 0; t < junctional.scenarioDurationSec; t += 0.005) {
    const snapshot = evaluateMasterTimeline(junctional, t);
    assert.equal(snapshot.saNodeFiring, false);
    assert.equal(snapshot.sourceRegion, 'av_junction');
    if (snapshot.subSegments.ra_inferior.phase !== 'front_active') continue;
    atrialSamples++;
    const svg = renderToStaticMarkup(React.createElement(HeartDiagram, { snapshot, showElectricVector: false, isJunctionalRhythm: true }));
    assert.ok(svg.includes('洞結節：停止（発火なし）'));
    assert.ok(svg.includes('M 184 170 L 151 159'), 'RA conduction must start at the AV junction');
    assert.ok(svg.includes('M 184 170 L 211 148'), 'LA conduction must start at the AV junction');
    assert.ok(!svg.includes('d="M 108 85'), 'no atrial emission from the sinus node');
    assert.equal((svg.match(/data-segment=/g) ?? []).length, 14);
    const front = svg.match(/data-front="ra_inferior" transform="translate\(([^,]+), ([^)]+)\)"/);
    assert.ok(front, 'retrograde lower RA front must render');
    lowerRAFronts.push({ p: snapshot.subSegments.ra_inferior.frontProgress, y: Number(front[2]) });
  }
  assert.ok(atrialSamples > 0);
  lowerRAFronts.sort((a, b) => a.p - b.p);
  assert.ok(lowerRAFronts.at(-1).y < lowerRAFronts[0].y, 'retrograde atrial front must rise toward the upper atrium');
  const normal = evaluateMasterTimeline(getDiseaseById('normal'), 0.06);
  const normalSvg = renderToStaticMarkup(React.createElement(HeartDiagram, { snapshot: normal, showElectricVector: false }));
  assert.ok(normalSvg.includes('d="M 108 85'), 'normal antegrade conduction must retain its sinus origin');
  const completeBlock = getDiseaseById('complete_av_block');
  let sinusSamples = 0;
  let atrialContractions = 0;
  let ventricularContractions = 0;
  let atriumWasContracting = false;
  let ventricleWasContracting = false;
  for (let t = 0; t < completeBlock.scenarioDurationSec; t += 0.005) {
    const snapshot = evaluateMasterTimeline(completeBlock, t);
    assert.notEqual(snapshot.atrialPropagation, 'retrograde', 'complete AV block must not retrogradely capture the atria');
    const atriumContracting = snapshot.walls.ra_wall.contraction > 0.1;
    const ventricleContracting = snapshot.walls.lv_lateral.contraction > 0.1;
    if (atriumContracting && !atriumWasContracting) atrialContractions++;
    if (ventricleContracting && !ventricleWasContracting) ventricularContractions++;
    atriumWasContracting = atriumContracting;
    ventricleWasContracting = ventricleContracting;
    if (!snapshot.saNodeFiring) continue;
    sinusSamples++;
    const svg = renderToStaticMarkup(React.createElement(HeartDiagram, { snapshot, showElectricVector: false, isJunctionalRhythm: false }));
    assert.ok(!svg.includes('洞結節：停止'), 'sinus node must remain active in complete AV block');
    assert.ok(svg.includes('d="M 108 85'), 'atrial conduction must retain its sinus origin');
    assert.ok(!svg.includes('d="M 184 170 L 151 159'), 'junctional retrograde drawing must not affect complete AV block');
  }
  assert.ok(sinusSamples > 0);
  assert.equal(atrialContractions, 4, 'four independent sinus atrial contractions');
  assert.equal(ventricularContractions, 2, 'two independent ventricular escape contractions');
  console.log(`PASS: complete AV block keeps ${sinusSamples} sinus activation samples, 4 atrial and 2 ventricular independent contractions, without retrograde capture.`);
  console.log(`PASS: 3 playback speeds, loop wrapping, phase continuity; ${atrialSamples} junctional atrial samples with AV-origin rendering, ascending front and 14 segments; normal sinus origin retained.`);
} finally {
  await server.close();
}
