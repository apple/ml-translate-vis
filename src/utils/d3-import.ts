// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { select, selectAll } from 'd3-selection';

import { json } from 'd3-fetch';

import {
  scaleLinear,
  scaleSqrt,
  scalePoint,
  scaleBand,
  scalePow,
  scaleOrdinal,
  scaleLog,
  scaleSequential,
  scaleTime,
  scaleUtc
} from 'd3-scale';

import {
  schemeTableau10,
  interpolateRainbow,
  interpolateBlues,
  interpolateGreens,
  interpolateGreys,
  interpolateReds,
  interpolateOranges,
  interpolateViridis
} from 'd3-scale-chromatic';

import { lch, hsl, color, rgb } from 'd3-color';

import { quantize, interpolate, interpolateHcl } from 'd3-interpolate';

import {
  max,
  maxIndex,
  min,
  minIndex,
  extent,
  sum,
  bin,
  shuffle
} from 'd3-array';

import { timeout } from 'd3-timer';

import { transition } from 'd3-transition';

import {
  easeLinear,
  easePolyInOut,
  easeQuadInOut,
  easeCubicInOut,
  easeElasticOut
} from 'd3-ease';

import { axisLeft, axisBottom } from 'd3-axis';

import {
  line,
  curveStepAfter,
  curveBasis,
  curveMonotoneX,
  curveMonotoneY,
  arc,
  linkHorizontal,
  linkVertical
} from 'd3-shape';

import { path } from 'd3-path';

import { hierarchy, partition, tree } from 'd3-hierarchy';

import { brush, brushX } from 'd3-brush';

import { zoom, zoomIdentity } from 'd3-zoom';

import { drag } from 'd3-drag';

import { format } from 'd3-format';

import {
  timeSecond,
  timeMinute,
  timeHour,
  timeDay,
  timeWeek,
  timeMonth,
  timeYear
} from 'd3-time';

import { timeFormat, utcParse, utcFormat } from 'd3-time-format';

import { randomNormal, randomUniform, randomInt } from 'd3-random';

import { contours } from 'd3-contour';

import { geoPath } from 'd3-geo';

export default {
  select,
  selectAll,
  json,
  scaleLinear,
  scaleSqrt,
  scalePoint,
  scaleBand,
  scalePow,
  scaleOrdinal,
  scaleLog,
  scaleSequential,
  scaleTime,
  scaleUtc,
  schemeTableau10,
  interpolateRainbow,
  interpolateBlues,
  interpolateGreens,
  interpolateReds,
  interpolateOranges,
  interpolateGreys,
  interpolateViridis,
  lch,
  hsl,
  rgb,
  color,
  quantize,
  interpolate,
  interpolateHcl,
  max,
  maxIndex,
  min,
  minIndex,
  extent,
  sum,
  shuffle,
  bin,
  timeout,
  transition,
  easeLinear,
  easePolyInOut,
  easeQuadInOut,
  easeCubicInOut,
  easeElasticOut,
  axisLeft,
  axisBottom,
  line,
  curveStepAfter,
  brush,
  brushX,
  zoom,
  zoomIdentity,
  drag,
  format,
  curveMonotoneX,
  curveMonotoneY,
  curveBasis,
  timeFormat,
  utcParse,
  utcFormat,
  timeSecond,
  timeMinute,
  timeHour,
  timeDay,
  timeWeek,
  timeMonth,
  timeYear,
  hierarchy,
  partition,
  tree,
  arc,
  linkHorizontal,
  linkVertical,
  path,
  randomNormal,
  randomUniform,
  randomInt,
  contours,
  geoPath
};
