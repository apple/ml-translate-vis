// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { config } from '../../config';
import d3 from '../../utils/d3-import';
import type {
  Padding,
  Size,
  ChallengeData,
  ChallengeSet,
  TranslateSentence,
  Keyword,
  SourceIDBinData,
  IntersectionBinData,
  IntersectionData,
  DateCount,
  Filters
} from 'src/CustomTypes';
import { PlotType } from '../../CustomTypes';
import type { SetView } from './SetView';

const titleY = 16;

const plotLabelMap: Map<PlotType, string> = new Map();
plotLabelMap.set(PlotType.Keyword, 'Keywords');
plotLabelMap.set(PlotType.Chrf, 'ChrF');
plotLabelMap.set(PlotType.SourceID, 'Input Source');
plotLabelMap.set(PlotType.Embedding, 'Embeddings');
plotLabelMap.set(PlotType.Familiarity, 'Familiarities');
plotLabelMap.set(PlotType.UnitTest, 'Unit Tests');

let chrfPosition: number | null = null;
let chrfBrush: d3.BrushBehavior<unknown> | null = null;
let chrfTotal = 0;

let familiarityPosition: number | null = null;
let familiarityBrush: d3.BrushBehavior<unknown> | null = null;
let familiarityTotal = 0;

/**
 * Draw the familiarity plot at the focus vis position
 */
export function drawFamiliarityFocus(this: SetView, position: number) {
  // Initialize the view
  familiarityPosition = position;
  const localPadding: Padding = {
    top: 65,
    left: 10,
    right: 10,
    bottom: 10
  };
  const legendLabelOffsetY = 20;
  const legendLabelOffsetX = 35;
  const content = this.focusSVGs[position].select('.content');
  const binCount = 19;
  const bins = Array(binCount)
    .fill(0.0)
    .map((d, i) => (i + 1) * (1 / (binCount + 1)));

  const firstDraw = !this.focusScales.has('familiarity');

  if (firstDraw) {
    content.append('g').attr('class', 'bar-group');
    const values = this.challengeData.familiarity.filter(
      (d): d is number => d !== null
    );

    const bin = d3.bin().domain([0, 1]).thresholds(bins);
    const buckets = bin(values);
    const counts = buckets.map(d => d.length);

    if (buckets[0].x0 !== 0) {
      buckets[0].x0 = 0.0;
    }

    // Create scales
    const xScale = d3
      .scaleLinear()
      // For chrf and familiarity, the range is always [0, 1]
      .domain([0, 1])
      .range([
        legendLabelOffsetX,
        this.focusSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(...counts), 0])
      .range([localPadding.top, this.focusSize.height - legendLabelOffsetY]);

    // Draw the axes
    const axisGroup = content.append('g').attr('class', 'axis-group');
    axisGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr(
        'transform',
        `translate(0, ${this.focusSize.height - legendLabelOffsetY})`
      )
      .call(d3.axisBottom(xScale));

    axisGroup
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${legendLabelOffsetX}, ${0})`)
      .call(d3.axisLeft(yScale));

    // Draw the title
    content
      .append('text')
      .attr(
        'transform',
        `translate(${
          legendLabelOffsetX +
          (this.focusSize.width -
            localPadding.left -
            localPadding.right -
            legendLabelOffsetX) /
            2
        }, ${titleY})`
      )
      .style('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text('Sample Familiarity Distribution')
      .append('tspan')
      .attr('class', 'tspan-log')
      .style('font-size', '0.92em')
      .attr('dominant-baseline', 'middle')
      .attr('dy', '1.1em')
      .attr('x', 0)
      .text(`(${values.length} usage log samples)`);

    familiarityTotal = values.length;

    // Store the scales
    this.focusScales.set('familiarity', [xScale, yScale]);
  }

  const scales = this.focusScales.get('familiarity')!;
  const xScale = scales[0];
  const yScale = scales[1] as d3.ScaleLinear<number, number, never>;
  const barGroup = content.select('g.bar-group');

  const filteredIndexes = new Set(this.filteredIndexes);
  const values = this.challengeData.familiarity
    .filter((d, i) => filteredIndexes.has(i))
    .filter((d): d is number => d !== null);

  const bin = d3.bin().domain([0, 1]).thresholds(bins);
  const buckets = bin(values);
  const barMaxHeight = this.focusSize.height - legendLabelOffsetY;
  const barWidth = xScale(bins[1]) - xScale(bins[0]);

  if (buckets[0].x0 !== 0) {
    buckets[0].x0 = 0.0;
  }

  const trans = d3
    .transition('update-familiarity-focus')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  barGroup
    .selectAll('g.familiarity-bar')
    .data(buckets)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'familiarity-bar')
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );

        bars
          .append('rect')
          .attr('class', 'familiarity-rect')
          .attr('width', barWidth)
          .attr('height', d => barMaxHeight - yScale(d.length));

        // Draw the bin labels
        bars
          .append('text')
          .attr('class', 'bar-label is-left is-log')
          .attr('x', barWidth / 2)
          .attr('y', -3)
          .style('text-anchor', 'middle')
          .style('opacity', d => (d.length === 0 ? 0 : 1))
          .text(d => d.length);

        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );

        update
          .select('rect')
          .transition(trans)
          .attr('height', d => barMaxHeight - yScale(d.length));

        update
          .select('text')
          .style('opacity', d => (d.length === 0 ? 0 : 1))
          .text(d => d.length);

        return update;
      },
      exit => exit.remove()
    );

  // Update the subheader
  let title = '';
  if (values.length === familiarityTotal) {
    title = `(${values.length} log samples)`;
  } else {
    title = `(${values.length} out of ${familiarityTotal} log samples)`;
  }
  content.select('.tspan-log').text(title);

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (firstDraw) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');

    // Add brushing
    let brushSelection: number[] = [];
    const brushed = (event: d3.D3BrushEvent<d3.BaseType>) => {
      if (event.selection === null) return;

      const preBrushSelection = [brushSelection[0], brushSelection[1]];
      brushSelection = (event.selection as number[]).map(d => {
        const digit = xScale.invert(d);
        const binSize = 1 / (binCount + 1);
        const multiple = Math.floor(Math.floor(digit * 100) / (binSize * 100));
        return multiple * binSize;
      });

      if (
        brushSelection[0] !== preBrushSelection[0] ||
        brushSelection[1] !== preBrushSelection[1]
      ) {
        this.filters.familiarity = [];

        for (const [
          i,
          familiarity
        ] of this.challengeData.familiarity.entries()) {
          if (familiarity !== null) {
            if (
              familiarity >= brushSelection[0] &&
              familiarity <= brushSelection[1]
            ) {
              this.filters.familiarity.push(i);
            }
          }
        }

        this.syncFilters();
      }
    };

    const brushEnded = (event: d3.D3BrushEvent<d3.BaseType>) => {
      if (event.selection === null) {
        this.filters.familiarity = [];
        this.syncFilters();
      }
    };

    familiarityBrush = d3
      .brushX()
      .extent([
        [
          this.focusPadding.left + legendLabelOffsetX,
          this.focusPadding.top + localPadding.top - 1
        ],
        [
          this.focusSize.width - localPadding.right - 4,
          this.focusPadding.top + this.focusSize.height - legendLabelOffsetY - 1
        ]
      ])
      .on('brush', brushed)
      .on('end', brushEnded);

    this.focusSVGs[position]
      .append('g')
      .attr('class', 'familiarity-brush-group')
      .call(familiarityBrush);
  }
}

export function resetFamiliarityPlots(this: SetView) {
  if (familiarityPosition && familiarityBrush) {
    this.focusSVGs[familiarityPosition]
      .select<SVGGElement>('g.familiarity-brush-group')
      .call(g => familiarityBrush!.move(g, null));
  }
}

/**
 * Draw the familiarity thumbnail at one position
 * @param position Order of this thumbnail (0 to 4)
 */
export function drawFamiliarityThumbnail(this: SetView, position: number) {
  const content = this.thumbnailSVGs[position]
    .select('.content')
    .style('opacity', 0.6);
  const binCount = 19;
  const bins = Array(binCount)
    .fill(0.0)
    .map((d, i) => (i + 1) * (1 / (binCount + 1)));
  const bin = d3.bin().domain([0, 1]).thresholds(bins);

  // Create scales
  const localPadding: Padding = {
    top: 5,
    left: 5,
    right: 0,
    bottom: 5
  };

  const legendLabelOffsetY = 5;
  const legendLabelOffsetX = 5;

  const firstDraw = !this.thumbnailScales.has('familiarity');

  if (firstDraw) {
    // Update the label
    this.thumbnailLabels[position].text(
      plotLabelMap.get(PlotType.Familiarity)!
    );

    content.append('g').attr('class', 'bar-group');

    const values = this.challengeData.familiarity.filter(
      (d): d is number => d !== null
    );
    const buckets = bin(values);
    const counts = buckets.map(d => d.length);

    const xScale = d3
      .scaleLinear()
      // For chrf and familiarity, the range is always [0, 1]
      .domain([0, 1])
      .range([
        legendLabelOffsetX,
        this.thumbnailSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(...counts), 0])
      .range([
        localPadding.top,
        this.thumbnailSize.height - legendLabelOffsetY
      ]);

    // Draw the axes
    const axisGroup = content
      .append('g')
      .attr('class', 'axis-group')
      .style('opacity', 0.6);

    axisGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr(
        'transform',
        `translate(0, ${this.thumbnailSize.height - legendLabelOffsetY})`
      )
      .call(d3.axisBottom(xScale).tickValues([]));

    axisGroup
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${legendLabelOffsetX}, ${0})`)
      .call(d3.axisLeft(yScale).tickValues([]));

    this.thumbnailScales.set('familiarity', [xScale, yScale]);
  }

  // Draw the bins
  const barGroup = content.select('g.bar-group');
  const result = this.thumbnailScales.get('familiarity')!;
  const xScale = result[0];
  const yScale = result[1] as d3.ScaleLinear<number, number, never>;

  const filteredIndexes = new Set(this.filteredIndexes);
  const values = this.challengeData.familiarity
    .filter((d, i) => filteredIndexes.has(i))
    .filter((d): d is number => d !== null);
  const buckets = bin(values);
  const barMaxHeight = this.thumbnailSize.height - legendLabelOffsetY;
  const barWidth = xScale(bins[1]) - xScale(bins[0]);
  if (buckets[0].x0 !== 0) {
    buckets[0].x0 = 0.0;
  }

  barGroup
    .selectAll('g.familiarity-bar')
    .data(buckets)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'familiarity-bar')
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );
        bars
          .append('rect')
          .attr('class', 'familiarity-rect')
          .attr('width', barWidth)
          .attr('height', d => barMaxHeight - yScale(d.length));
        return bars;
      },
      update => {
        update
          .transition('update-familiarity-thumbnail')
          .duration(200)
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );
        update
          .select('rect')
          .transition('update-familiarity-thumbnail')
          .duration(200)
          .attr('height', d => barMaxHeight - yScale(d.length));
        return update;
      },
      exit => exit.remove()
    );

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (firstDraw) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');
  }
}

/**
 * Draw the chrf plot at the focus vis position
 */
export function drawChrfFocus(this: SetView, position: number) {
  // Update the vis
  chrfPosition = position;
  const content = this.focusSVGs[position].select('.content');
  const binCount = 19;
  const bins = Array(binCount)
    .fill(0.0)
    .map((d, i) => (i + 1) * (1 / (binCount + 1)));
  const bin = d3.bin().domain([0, 1]).thresholds(bins);
  // Create scales
  const localPadding: Padding = {
    top: 65,
    left: 10,
    right: 10,
    bottom: 10
  };

  const legendLabelOffsetY = 20;
  const legendLabelOffsetX = 35;
  const firstDraw = !this.focusScales.has('chrf');

  if (firstDraw) {
    content.append('g').attr('class', 'bar-group');
    const values = this.challengeData.chrf.filter(
      (d): d is number => d !== null
    );

    const buckets = bin(values);
    // Force the first bucket and the last bucket to start and end at 0 and 1
    if (buckets[0].x0 !== 0) {
      buckets[0].x0 = 0.0;
    }
    const counts = buckets.map(d => d.length);

    const xScale = d3
      .scaleLinear()
      // For chrf and familiarity, the range is always [0, 1]
      .domain([0, 1])
      .range([
        legendLabelOffsetX,
        this.focusSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(...counts), 0])
      .range([localPadding.top, this.focusSize.height - legendLabelOffsetY]);

    // Draw the axes
    const axisGroup = content.append('g').attr('class', 'axis-group');
    axisGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr(
        'transform',
        `translate(0, ${this.focusSize.height - legendLabelOffsetY})`
      )
      .call(d3.axisBottom(xScale));

    axisGroup
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${legendLabelOffsetX}, ${0})`)
      .call(d3.axisLeft(yScale));

    // Draw the title
    content
      .append('text')
      .attr(
        'transform',
        `translate(${
          legendLabelOffsetX +
          (this.focusSize.width -
            localPadding.left -
            localPadding.right -
            legendLabelOffsetX) /
            2
        }, ${titleY})`
      )
      .style('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text('ChrF Score Distribution')
      .append('tspan')
      .attr('class', 'tspan-train')
      .style('font-size', '0.92em')
      .attr('dominant-baseline', 'middle')
      .attr('dy', '1.1em')
      .attr('x', 0)
      .text(`(${values.length} training samples)`);

    chrfTotal = values.length;
    this.focusScales.set('chrf', [xScale, yScale]);
  }

  // Draw the bins
  const result = this.focusScales.get('chrf')!;
  const xScale = result[0];
  const yScale = result[1] as d3.ScaleLinear<number, number, never>;

  const filteredIndexes = new Set(this.filteredIndexes);
  const values = this.challengeData.chrf
    .filter((d, i) => filteredIndexes.has(i))
    .filter((d): d is number => d !== null);
  let buckets = bin(values);
  if (buckets[0].x0 !== 0) {
    buckets[0].x0 = 0.0;
  }

  const barGroup = content.select('g.bar-group');
  const barMaxHeight = this.focusSize.height - legendLabelOffsetY;
  const barWidth = xScale(bins[1]) - xScale(bins[0]);

  const trans = d3
    .transition('update-chrf-focus')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  // Do not draw anything if the ChrF is nan
  if (values.length === 0) {
    buckets = [];
  }

  barGroup
    .selectAll('g.chrf-bar')
    .data(buckets)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'chrf-bar')
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );
        bars
          .append('rect')
          .attr('class', 'chrf-rect')
          .attr('width', barWidth)
          .attr('height', d => barMaxHeight - yScale(d.length));

        // Draw the bin labels
        bars
          .append('text')
          .attr('class', 'bar-label is-left is-train')
          .attr('x', barWidth / 2)
          .attr('y', -3)
          .style('text-anchor', 'middle')
          .style('opacity', d => (d.length === 0 ? 0 : 1))
          .text(d => d.length);

        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );

        update
          .select('rect')
          .transition(trans)
          .attr('height', d => barMaxHeight - yScale(d.length));

        update
          .select('text')
          .style('opacity', d => (d.length === 0 ? 0 : 1))
          .text(d => d.length);

        return update;
      },
      exit => exit.remove()
    );

  // Update the subheader
  let title = '';
  if (values.length === chrfTotal) {
    title = `(${values.length} training samples)`;
  } else {
    title = `(${values.length} out of ${chrfTotal} training samples)`;
  }
  content.select('.tspan-train').text(title);

  if (firstDraw) {
    // Create a clone of bars on the back to provide more context during
    // interactions
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');

    // Add brushing
    let brushSelection: number[] = [];
    const brushed = (event: d3.D3BrushEvent<d3.BaseType>) => {
      if (event.selection === null) return;

      const preBrushSelection = [brushSelection[0], brushSelection[1]];
      brushSelection = (event.selection as number[]).map(d => {
        const digit = xScale.invert(d);
        const binSize = 1 / (binCount + 1);
        const multiple = Math.floor(Math.floor(digit * 100) / (binSize * 100));
        return multiple * binSize;
      });

      if (
        brushSelection[0] !== preBrushSelection[0] ||
        brushSelection[1] !== preBrushSelection[1]
      ) {
        this.filters.chrf = [];

        for (const [i, chrf] of this.challengeData.chrf.entries()) {
          if (chrf !== null) {
            if (chrf >= brushSelection[0] && chrf <= brushSelection[1]) {
              this.filters.chrf.push(i);
            }
          }
        }

        this.syncFilters();
      }
    };

    const brushEnded = (event: d3.D3BrushEvent<d3.BaseType>) => {
      if (event.selection === null) {
        this.filters.chrf = [];
        this.syncFilters();
      }
    };

    chrfBrush = d3
      .brushX()
      .extent([
        [
          this.focusPadding.left + legendLabelOffsetX,
          this.focusPadding.top + localPadding.top - 1
        ],
        [
          this.focusSize.width - localPadding.right - 4,
          this.focusPadding.top + this.focusSize.height - legendLabelOffsetY - 1
        ]
      ])
      .on('brush', brushed)
      .on('end', brushEnded);

    this.focusSVGs[position]
      .append('g')
      .attr('class', 'chrf-brush-group')
      .call(chrfBrush);
  }
}

export function resetChrfPlots(this: SetView) {
  if (chrfPosition && chrfBrush) {
    this.focusSVGs[chrfPosition]
      .select<SVGGElement>('g.chrf-brush-group')
      .call(g => chrfBrush!.move(g, null));
  }
}

/**
 * Draw the chrf thumbnail at one position
 * @param position Order of this thumbnail (0 to 4)
 */
export function drawChrfThumbnail(this: SetView, position: number) {
  const content = this.thumbnailSVGs[position]
    .select('.content')
    .style('opacity', 0.6);

  const binCount = 19;
  const bins = Array(binCount)
    .fill(0.0)
    .map((d, i) => (i + 1) * (1 / (binCount + 1)));
  const bin = d3.bin().domain([0, 1]).thresholds(bins);

  // Create scales
  const localPadding: Padding = {
    top: 5,
    left: 5,
    right: 0,
    bottom: 5
  };

  const legendLabelOffsetY = 5;
  const legendLabelOffsetX = 5;

  const firstDraw = !this.thumbnailScales.has('chrf');

  if (firstDraw) {
    // Update the label
    this.thumbnailLabels[position].text(plotLabelMap.get(PlotType.Chrf)!);

    content.append('g').attr('class', 'bar-group');
    const values = this.challengeData.chrf.filter(
      (d): d is number => d !== null
    );
    const buckets = bin(values);
    if (buckets[0].x0 !== 0) {
      buckets[0].x0 = 0.0;
    }
    const counts = buckets.map(d => d.length);

    const xScale = d3
      .scaleLinear()
      // For chrf and familiarity, the range is always [0, 1]
      .domain([0, 1])
      .range([
        legendLabelOffsetX,
        this.thumbnailSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(...counts), 0])
      .range([
        localPadding.top,
        this.thumbnailSize.height - legendLabelOffsetY
      ]);

    // Draw the axes
    const axisGroup = content
      .append('g')
      .attr('class', 'axis-group')
      .style('opacity', 0.6);

    axisGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr(
        'transform',
        `translate(0, ${this.thumbnailSize.height - legendLabelOffsetY})`
      )
      .call(d3.axisBottom(xScale).tickValues([]));

    axisGroup
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${legendLabelOffsetX}, ${0})`)
      .call(d3.axisLeft(yScale).tickValues([]));

    this.thumbnailScales.set('chrf', [xScale, yScale]);
  }

  const results = this.thumbnailScales.get('chrf')!;
  const xScale = results[0];
  const yScale = results[1] as d3.ScaleLinear<number, number, never>;

  const barGroup = content.select('g.bar-group');
  const filteredIndexes = new Set(this.filteredIndexes);
  const values = this.challengeData.chrf
    .filter((d, i) => filteredIndexes.has(i))
    .filter((d): d is number => d !== null);
  let buckets = bin(values);
  if (buckets[0].x0 !== 0) {
    buckets[0].x0 = 0.0;
  }

  const barMaxHeight = this.thumbnailSize.height - legendLabelOffsetY;
  const barWidth = xScale(bins[1]) - xScale(bins[0]);

  const trans = d3
    .transition('update-chrf-thumbnail')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  // Do not draw anything if the ChrF is nan
  if (values.length === 0) {
    buckets = [];
  }

  // Draw the bins
  barGroup
    .selectAll('g.chrf-bar')
    .data(buckets)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'chrf-bar')
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );

        bars
          .append('rect')
          .attr('class', 'chrf-rect')
          .attr('width', barWidth)
          .attr('height', d => barMaxHeight - yScale(d.length));

        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d => `translate(${xScale(d.x0!)}, ${yScale(d.length)})`
          );

        update
          .select('rect')
          .transition(trans)
          .attr('height', d => barMaxHeight - yScale(d.length));

        return update;
      },
      exit => exit.remove()
    );

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (firstDraw) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');
  }
}
