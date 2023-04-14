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

const sourceIDNameToIDMap = new Map<string, number | null>();
const selectedSourceIDs = new Set<number | null>();
let sourceIDTotal = 0;
let sourceIDYScale: d3.ScaleBand<string> | null = null;
let sourceIDYAxis: d3.Selection<SVGGElement, unknown, null, undefined> | null =
  null;

let unitTestYScale: d3.ScaleBand<string> | null = null;
let unitTestYAxis: d3.Selection<SVGGElement, unknown, null, undefined> | null =
  null;

/**
 * Draw the sourceID plot at the focus vis position
 */
export async function drawSourceIDFocus(this: SetView, position: number) {
  const content = this.focusSVGs[position].select('.content');
  const localPadding: Padding = {
    top: 45,
    left: 10,
    right: 10,
    bottom: 10
  };

  const legendLabelOffsetY = 20;
  const legendLabelOffsetX = 90;

  const drawFirst = !this.focusScales.has('sourceid');

  if (drawFirst) {
    // Read the source id mapping
    // Check if the json file is cached
    const JSON_URL = `${import.meta.env.BASE_URL}data/dataset-id-map.json`;
    const cache = await caches.open('cache');
    const response = await cache.match(JSON_URL);

    // If the file was cached
    // Read sourceIDMap if it is null
    if (this.sourceIDMap === null) {
      this.sourceIDMap = {};
      if (response) {
        this.sourceIDMap = (await response.json()) as {
          [key: number]: string[];
        };
      } else {
        // Save the json file to cache
        await cache.add(JSON_URL);
        const newResponse = await cache.match(JSON_URL);
        this.sourceIDMap = (await newResponse?.json()) as {
          [key: number]: string[];
        };
      }
    }

    content.append('g').attr('class', 'bar-group');

    // Count the number of source ids in each category
    const categoryCount = new Map<string | null, number>();
    for (const key of Object.keys(this.sourceIDMap)) {
      categoryCount.set(key, 0);
    }
    categoryCount.set(null, 0);

    for (const [i, id] of this.challengeData.source_id.entries()) {
      if (this.challengeData.train[i] === 0) {
        categoryCount.set(id, categoryCount.get(id)! + 1);
      }
    }

    // Create bin data
    const binData: SourceIDBinData[] = [];
    for (const [id, count] of categoryCount.entries()) {
      let displayName = '';

      if (id === null) {
        displayName = 'Redacted/Others';
      } else {
        displayName = this.sourceIDMap[parseInt(id)][1];
      }

      if (!sourceIDNameToIDMap.has(displayName)) {
        sourceIDNameToIDMap.set(displayName, id ? parseInt(id) : null);
      }

      binData.push({
        id,
        count,
        displayName
      });
    }

    // Sort bin data by their count
    binData.sort((a, b) => b.count - a.count);

    const countExtent = d3.extent(binData, d => d.count) as [number, number];

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain(countExtent)
      .range([
        legendLabelOffsetX,
        this.focusSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleBand()
      .domain(binData.map(d => d.displayName))
      .range([localPadding.top, this.focusSize.height - legendLabelOffsetY])
      .padding(0.2);

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

    const yAxis = axisGroup
      .append('g')
      .attr('class', 'y-axis y-axis-cat')
      .attr('transform', `translate(${legendLabelOffsetX}, ${0})`)
      .call(d3.axisLeft(yScale));

    // Record the yScale and yAxis in the module scope
    sourceIDYScale = yScale;
    sourceIDYAxis = yAxis;

    // Bind the label with categorical selection
    // for (const v of sourceIDNameToIDMap.values()) {
    //   selectedSourceIDs.add(v);
    // }

    yAxis
      .selectAll('.tick')
      .on('click', (e, d) => {
        const name = d as string;
        const id = sourceIDNameToIDMap.get(name)!;
        if (selectedSourceIDs.has(id)) {
          selectedSourceIDs.delete(id);
        } else {
          selectedSourceIDs.add(id);
        }

        yAxis
          .selectAll('.tick')
          .select('text')
          .classed(
            'selected',
            dd =>
              selectedSourceIDs.size === 0 ||
              selectedSourceIDs.has(sourceIDNameToIDMap.get(dd as string)!)
          );

        // Update the filter index
        this.filters.sourceID = [];
        if (selectedSourceIDs.size > 0) {
          for (const [i, id] of this.challengeData.source_id.entries()) {
            if (selectedSourceIDs.has(id ? parseInt(id) : null)) {
              this.filters.sourceID.push(i);
            }
          }
        }

        this.syncFilters();
      })
      .select('text')
      .classed(
        'selected',
        dd =>
          selectedSourceIDs.size === 0 ||
          selectedSourceIDs.has(sourceIDNameToIDMap.get(dd as string)!)
      );

    // Draw the title
    sourceIDTotal = [...categoryCount.values()].reduce((a, b) => a + b);
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
      .text('Input Source Distribution')
      .append('tspan')
      .attr('class', 'tspan-log')
      .style('font-size', '0.92em')
      .attr('dy', '1.1em')
      .attr('dominant-baseline', 'middle')
      .attr('x', 0)
      .text(`(${sourceIDTotal} usage log samples)`);

    this.focusScales.set('sourceid', [xScale, yScale]);
  }

  // Draw the bars
  const barGroup = content.select('g.bar-group');

  // Get the current bin data
  // Count the number of source ids in each category
  const categoryCount = new Map<string | null, number>();
  for (const key of Object.keys(this.sourceIDMap!)) {
    categoryCount.set(key, 0);
  }
  categoryCount.set(null, 0);

  const filteredIndexes = new Set(this.filteredIndexes);
  for (const [i, id] of this.challengeData.source_id.entries()) {
    if (filteredIndexes.has(i) && this.challengeData.train[i] === 0) {
      categoryCount.set(id, categoryCount.get(id)! + 1);
    }
  }

  const trans = d3
    .transition('update-sourceid-focus')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  // Create bin data
  const binData: SourceIDBinData[] = [];
  for (const [id, count] of categoryCount.entries()) {
    let displayName = '';

    if (id === null) {
      displayName = 'Redacted/Others';
    } else {
      displayName = this.sourceIDMap![parseInt(id)][1];
    }

    binData.push({
      id,
      count,
      displayName
    });
  }

  // Sort bin data by their count
  binData.sort((a, b) => b.count - a.count);

  const result = this.focusScales.get('sourceid')!;
  const xScale = result[0];
  const yScale = result[1] as d3.ScaleBand<string>;
  const countExtent = xScale.domain();

  barGroup
    .selectAll('g.count-bar')
    .data(binData, d => (d as SourceIDBinData).displayName)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'count-bar')
          .attr(
            'transform',
            d => `translate(${legendLabelOffsetX}, ${yScale(d.displayName)})`
          );

        bars
          .append('rect')
          .attr('class', 'bar-rect is-log')
          .attr('width', d => xScale(d.count) - xScale(0))
          .attr('height', yScale.bandwidth());

        // Add texts
        bars
          .append('text')
          .attr('class', 'bar-label is-log')
          .classed('is-left', d => d.count <= countExtent[1] / 2)
          .attr('x', d =>
            d.count > countExtent[1] / 2
              ? xScale(d.count) - xScale(0) - 5
              : xScale(d.count) - xScale(0) + 2
          )
          .attr(
            'y',
            (yScale.paddingInner() * yScale.bandwidth()) / 2 +
              yScale.bandwidth() / 2
          )
          .attr('dominant-baseline', 'baseline')
          .text(d => d.count);
        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d => `translate(${legendLabelOffsetX}, ${yScale(d.displayName)})`
          );

        update
          .select('rect')
          .transition(trans)
          .attr('width', d => xScale(d.count) - xScale(0));

        update
          .select('text')
          .text(d => d.count)
          .classed('is-left', d => d.count <= countExtent[1] / 2)
          .transition(trans)
          // .style('opacity', d => (d.count === 0 ? 0 : 1))
          .attr('x', d =>
            d.count > countExtent[1] / 2
              ? xScale(d.count) - xScale(0) - 5
              : xScale(d.count) - xScale(0) + 2
          );

        return update;
      },
      exit => exit.remove()
    );

  // Update the subheader
  const newTotal = [...categoryCount.values()].reduce((a, b) => a + b);
  let title = '';
  if (newTotal === sourceIDTotal) {
    title = `(${sourceIDTotal} log samples)`;
  } else {
    title = `(${newTotal} out of ${sourceIDTotal} log samples)`;
  }
  content.select('.tspan-log').text(title);

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (drawFirst) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');
  }
}

/**
 * Draw the sourceID thumbnail at one position
 * @param position Order of this thumbnail (0 to 4)
 */
export function drawSourceIDThumbnail(this: SetView, position: number) {
  // Draw the thumbnail
  const content = this.thumbnailSVGs[position]
    .select('.content')
    .style('opacity', 0.6);
  const localPadding: Padding = {
    top: 5,
    left: 5,
    right: 0,
    bottom: 5
  };

  const legendLabelOffsetY = 5;
  const legendLabelOffsetX = 5;

  const drawFirst = !this.thumbnailScales.has('sourceid');

  if (drawFirst) {
    // Update the label
    this.thumbnailLabels[position].text(plotLabelMap.get(PlotType.SourceID)!);

    // Count the number of source ids in each category
    const categoryCount = new Map<string | null, number>();
    categoryCount.set(null, 0);

    for (const [i, id] of this.challengeData.source_id.entries()) {
      if (this.challengeData.train[i] === 1) continue;

      if (categoryCount.has(id)) {
        categoryCount.set(id, categoryCount.get(id)! + 1);
      } else {
        categoryCount.set(id, 1);
      }
    }

    // Create bin data
    const binData: SourceIDBinData[] = [];
    for (const [id, count] of categoryCount.entries()) {
      const displayName = '';

      binData.push({
        id,
        count,
        displayName
      });
    }

    // Sort bin data by their count
    binData.sort((a, b) => b.count - a.count);

    // Create scales
    const countExtent = d3.extent([...categoryCount.entries()], d => d[1]) as [
      number,
      number
    ];
    const xScale = d3
      .scaleLinear()
      .domain(countExtent)
      .range([
        legendLabelOffsetX,
        this.thumbnailSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleBand()
      .domain(binData.map(d => String(d.id)))
      .range([localPadding.top, this.thumbnailSize.height - legendLabelOffsetY])
      .padding(0.2);

    // Draw the axes
    content.append('g').attr('class', 'bar-group');
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

    this.thumbnailScales.set('sourceid', [xScale, yScale]);
  }

  // Draw the bars
  const barGroup = content.select('g.bar-group');
  const result = this.thumbnailScales.get('sourceid')!;
  const xScale = result[0];
  const yScale = result[1] as d3.ScaleBand<string>;

  // Get the current bin data
  // Count the number of source ids in each category
  const categoryCount = new Map<string | null, number>();
  const filteredIndexes = new Set(this.filteredIndexes);

  for (const [i, id] of this.challengeData.source_id.entries()) {
    if (this.challengeData.train[i] === 1) continue;

    if (filteredIndexes.has(i)) {
      if (categoryCount.has(id)) {
        categoryCount.set(id, categoryCount.get(id)! + 1);
      } else {
        categoryCount.set(id, 1);
      }
    }
  }

  for (const id of this.challengeData.source_id) {
    if (!categoryCount.has(id)) {
      categoryCount.set(id, 0);
    }
  }

  // Create bin data
  const binData: SourceIDBinData[] = [];
  for (const [id, count] of categoryCount.entries()) {
    const displayName = '';

    binData.push({
      id,
      count,
      displayName
    });
  }

  // Sort bin data by their count
  binData.sort((a, b) => b.count - a.count);

  const trans = d3
    .transition('update-sourceid-thumbnail')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  barGroup
    .selectAll('g.count-bar')
    .data(binData, d => {
      const dd = d as SourceIDBinData;
      if (dd === null) {
        return 'redacted';
      } else {
        return dd.id!;
      }
    })
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'count-bar')
          .attr('transform', d => {
            return `translate(${legendLabelOffsetX}, ${yScale(String(d.id))})`;
          });

        bars
          .append('rect')
          .attr('class', 'bar-rect is-log')
          .attr('width', d => xScale(d.count) - xScale(0))
          .attr('height', yScale.bandwidth());

        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d => `translate(${legendLabelOffsetX}, ${yScale(String(d.id))})`
          );
        update
          .select('rect')
          .transition(trans)
          .attr('width', d => xScale(d.count) - xScale(0));

        return update;
      },
      exit => exit.remove()
    );

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (drawFirst) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');
  }
}

export function resetSourceIDPlots(this: SetView) {
  if (sourceIDYScale === null || sourceIDYAxis === null) return;
  // Reset the selected
  selectedSourceIDs.clear();

  // Update the y axis
  sourceIDYAxis.selectAll('.tick').select('text').classed('selected', true);

  // Update the filter index
  this.filters.sourceID = [];

  this.syncFilters();
}

/**
 * Draw the unit test plot at the focus vis position
 */
export async function drawUnitTestFocus(this: SetView, position: number) {
  // Update the vis
  const content = this.focusSVGs[position].select('.content');

  // Read the intersection file
  if (this.intersectionData === null) {
    // Check if the json file is cached
    const JSON_URL = `${
      import.meta.env.BASE_URL
    }data/challenge-set/challenge-intersections.json`;
    const cache = await caches.open('cache');
    const response = await cache.match(JSON_URL);

    // Initialize intersectionData
    // If the file was cached
    if (response) {
      this.intersectionData = (await response.json()) as IntersectionData;
    } else {
      // Save the json file to cache
      await cache.add(JSON_URL);
      const newResponse = await cache.match(JSON_URL);
      this.intersectionData = (await newResponse?.json()) as IntersectionData;
    }
  }

  const localPadding: Padding = {
    top: 30,
    left: 10,
    right: 10,
    bottom: 10
  };
  const legendLabelOffsetY = 20;
  const legendLabelOffsetX = this.challengeSet.type === 'topic' ? 120 : 200;

  const drawFirst = !this.focusScales.has('unittest');

  if (drawFirst) {
    content.append('g').attr('class', 'bar-group');
    const tempIntersection =
      this.intersectionData![
        this.challengeSet.type === 'topic' ? 'topics' : 'tests'
      ];
    const curIntersection = tempIntersection[this.challengeSet.fileName] as {
      [key: string]: number[];
    };

    // Count the number of source ids in each category
    const categoryCount = new Map<string, number>();
    for (const key of Object.keys(curIntersection)) {
      categoryCount.set(key, curIntersection[key].length);
    }

    // Create bin data
    let binData: IntersectionBinData[] = [];
    const nameToIDMap = new Map<string, string>();
    for (const [id, count] of categoryCount.entries()) {
      let displayName =
        this.challengeSet.type === 'topic'
          ? id.replace('challenge-test_', '')
          : id.replace(/challenge-topic-\d+_/, '');
      nameToIDMap.set(displayName, id);

      if (displayName.length > 35) {
        displayName = displayName.slice(0, 35).concat('...');
      }

      binData.push({
        displayName,
        count,
        sampleIndexes: curIntersection[id]
      });
    }

    // Sort bin data by their count
    binData.sort((a, b) => b.count - a.count);

    // Only use the top K bins
    binData = binData.slice(0, 15);

    // Create scales
    const countExtent = d3.extent([...categoryCount.entries()], d => d[1]) as [
      number,
      number
    ];
    const xScale = d3
      .scaleLinear()
      .domain(countExtent)
      .range([
        legendLabelOffsetX,
        this.focusSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleBand()
      .domain(binData.map(d => d.displayName))
      .range([localPadding.top, this.focusSize.height - legendLabelOffsetY])
      .padding(0.2);

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

    const yAxis = axisGroup
      .append('g')
      .attr('class', 'y-axis y-axis-cat')
      .attr('transform', `translate(${legendLabelOffsetX}, ${0})`)
      .call(d3.axisLeft(yScale));

    unitTestYScale = yScale;
    unitTestYAxis = yAxis;

    // Bind the label with categorical selection
    const selectedTests = new Set<string>();

    yAxis
      .selectAll('.tick')
      .on('click', (e, d) => {
        const name = d as string;
        if (selectedTests.has(name)) {
          selectedTests.delete(name);
        } else {
          selectedTests.add(name);
        }

        yAxis
          .selectAll('.tick')
          .select('text')
          .classed(
            'selected',
            dd => selectedTests.size === 0 || selectedTests.has(dd as string)
          );

        // Update the filter index
        this.filters.otherSet = [];

        if (selectedTests.size > 0) {
          const selectedIndexes = new Set<number>();
          for (const name of selectedTests) {
            const id = nameToIDMap.get(name)!;
            for (const i of curIntersection[id]) {
              selectedIndexes.add(i);
            }
          }

          for (let i = 0; i < this.challengeData.source.length; i++) {
            if (selectedIndexes.has(i)) {
              this.filters.otherSet.push(i);
            }
          }
        }

        this.syncFilters();
      })
      .select('text')
      .classed('selected', dd => !selectedTests.has(dd as string));

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
      .text(
        this.challengeSet.type === 'topic'
          ? 'Overlapping with Unit Test Challenge Sets'
          : 'Overlapping with Topic Challenge Sets'
      );

    this.focusScales.set('unittest', [xScale, yScale]);
  }

  // Draw the bars
  const results = this.focusScales.get('unittest')!;
  const xScale = results[0];
  const yScale = results[1] as d3.ScaleBand<string>;
  const barGroup = content.select('g.bar-group');

  // Compute the current data
  const tempIntersection =
    this.intersectionData![
      this.challengeSet.type === 'topic' ? 'topics' : 'tests'
    ];
  const curIntersection = tempIntersection[this.challengeSet.fileName] as {
    [key: string]: number[];
  };

  // Count the number of source ids in each category
  const categoryCount = new Map<string, number>();
  const filteredIndexes = new Set(this.filteredIndexes);

  for (const key of Object.keys(curIntersection)) {
    categoryCount.set(
      key,
      curIntersection[key].filter(d => filteredIndexes.has(d)).length
    );
  }

  // Create bin data
  let binData: IntersectionBinData[] = [];
  for (const [id, count] of categoryCount.entries()) {
    let displayName =
      this.challengeSet.type === 'topic'
        ? id.replace('challenge-test_', '')
        : id.replace(/challenge-topic-\d+_/, '');

    if (displayName.length > 35) {
      displayName = displayName.slice(0, 35).concat('...');
    }

    binData.push({
      displayName,
      count,
      sampleIndexes: curIntersection[id]
    });
  }

  // Sort bin data by their count
  binData.sort((a, b) => b.count - a.count);

  // Only use the top K bins (from the first drawing)
  const selectedNames = new Set(yScale.domain());
  binData = binData.filter(d => selectedNames.has(d.displayName));
  const countExtent = xScale.domain();

  const trans = d3
    .transition('update-test-focus')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  barGroup
    .selectAll('g.count-bar')
    .data(binData, d => (d as IntersectionBinData).displayName)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'count-bar')
          .attr(
            'transform',
            d => `translate(${legendLabelOffsetX}, ${yScale(d.displayName)})`
          );

        bars
          .append('rect')
          .attr('class', 'bar-rect')
          .attr('width', d => xScale(d.count) - xScale(0))
          .attr('height', yScale.bandwidth());

        // Add texts
        bars
          .append('text')
          .attr('class', 'bar-label')
          .classed('is-left', d => d.count <= countExtent[1] / 2)
          .attr('x', d =>
            d.count > countExtent[1] / 2
              ? xScale(d.count) - xScale(0) - 5
              : xScale(d.count) - xScale(0) + 2
          )
          .attr(
            'y',
            (yScale.paddingInner() * yScale.bandwidth()) / 2 +
              yScale.bandwidth() / 2
          )
          .attr('dominant-baseline', 'baseline')
          .text(d => d.count);

        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d => `translate(${legendLabelOffsetX}, ${yScale(d.displayName)})`
          );

        update
          .select('rect')
          .transition(trans)
          .attr('width', d => xScale(d.count) - xScale(0));

        update
          .select('text')
          .classed('is-left', d => d.count <= countExtent[1] / 2)
          .text(d => d.count)
          .transition(trans)
          // .style('opacity', d => (d.count === 0 ? 0 : 1))
          .attr('x', d =>
            d.count > countExtent[1] / 2
              ? xScale(d.count) - xScale(0) - 5
              : xScale(d.count) - xScale(0) + 2
          );

        return update;
      },
      exit => exit.remove()
    );

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (drawFirst) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');
  }
}

/**
 * Draw the unitTest thumbnail at one position
 * @param position Order of this thumbnail (0 to 4)
 */
export async function drawUnitTestThumbnail(this: SetView, position: number) {
  // Draw the thumbnail
  const content = this.thumbnailSVGs[position]
    .select('.content')
    .style('opacity', 0.6);
  const localPadding: Padding = {
    top: 5,
    left: 5,
    right: 0,
    bottom: 5
  };

  const legendLabelOffsetY = 5;
  const legendLabelOffsetX = 5;

  // Read the intersection file
  if (this.intersectionData === null) {
    // Check if the json file is cached
    const JSON_URL = `${
      import.meta.env.BASE_URL
    }data/challenge-set/challenge-intersections.json`;
    const cache = await caches.open('cache');
    const response = await cache.match(JSON_URL);

    // Initialize intersectionData
    // If the file was cached
    if (response) {
      this.intersectionData = (await response.json()) as IntersectionData;
    } else {
      // Save the json file to cache
      await cache.add(JSON_URL);
      const newResponse = await cache.match(JSON_URL);
      this.intersectionData = (await newResponse?.json()) as IntersectionData;
    }
  }

  const tempIntersection =
    this.intersectionData[
      this.challengeSet.type === 'topic' ? 'topics' : 'tests'
    ];
  const curIntersection = tempIntersection[this.challengeSet.fileName] as {
    [key: string]: number[];
  };

  const drawFirst = !this.thumbnailScales.has('unittest');

  if (drawFirst) {
    // Update the label
    if (this.challengeSet.type !== 'topic') {
      this.thumbnailLabels[position].text('Topics');
    } else {
      this.thumbnailLabels[position].text(plotLabelMap.get(PlotType.UnitTest)!);
    }

    // Count the number of source ids in each category
    const categoryCount = new Map<string, number>();
    for (const key of Object.keys(curIntersection)) {
      categoryCount.set(key, curIntersection[key].length);
    }

    // Create bin data
    let binData: IntersectionBinData[] = [];
    for (const [id, count] of categoryCount.entries()) {
      const displayName = id.replace('challenge-test_', '');

      binData.push({
        displayName,
        count,
        sampleIndexes: curIntersection[id]
      });
    }

    // Sort bin data by their count
    binData.sort((a, b) => b.count - a.count);
    binData = binData.slice(0, 15);

    // Create scales
    const countExtent = d3.extent([...categoryCount.entries()], d => d[1]) as [
      number,
      number
    ];
    const xScale = d3
      .scaleLinear()
      .domain(countExtent)
      .range([
        legendLabelOffsetX,
        this.thumbnailSize.width - localPadding.left - localPadding.right
      ]);

    const yScale = d3
      .scaleBand()
      .domain(binData.map(d => String(d.displayName)))
      .range([localPadding.top, this.thumbnailSize.height - legendLabelOffsetY])
      .padding(0.2);

    // Draw the axes
    content.append('g').attr('class', 'bar-group');
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

    this.thumbnailScales.set('unittest', [xScale, yScale]);
  }

  // Draw the bars
  const barGroup = content.select('g.bar-group');
  const results = this.thumbnailScales.get('unittest')!;
  const xScale = results[0];
  const yScale = results[1] as d3.ScaleBand<string>;

  // Get the current bin data
  // Count the number of source ids in each category
  const categoryCount = new Map<string, number>();
  const filteredIndexes = new Set(this.filteredIndexes);
  for (const key of Object.keys(curIntersection)) {
    categoryCount.set(
      key,
      curIntersection[key].filter(d => filteredIndexes.has(d)).length
    );
  }

  // Create bin data
  let binData: IntersectionBinData[] = [];
  for (const [id, count] of categoryCount.entries()) {
    const displayName = id.replace('challenge-test_', '');
    binData.push({
      displayName,
      count,
      sampleIndexes: curIntersection[id]
    });
  }

  // Sort bin data by their count
  binData.sort((a, b) => b.count - a.count);
  const selectedNames = new Set(yScale.domain());
  binData = binData.filter(d => selectedNames.has(d.displayName));

  const trans = d3
    .transition('update-test-thumbnail')
    .duration(200) as unknown as d3.Transition<
    d3.BaseType,
    d3.Bin<number, number>,
    d3.BaseType,
    unknown
  >;

  barGroup
    .selectAll('g.count-bar')
    .data(binData, d => (d as IntersectionBinData).displayName)
    .join(
      enter => {
        const bars = enter
          .append('g')
          .attr('class', 'count-bar')
          .attr(
            'transform',
            d =>
              `translate(${legendLabelOffsetX}, ${yScale(
                String(d.displayName)
              )})`
          );

        bars
          .append('rect')
          .attr('class', 'bar-rect')
          .attr('width', d => xScale(d.count) - xScale(0))
          .attr('height', yScale.bandwidth());
        return bars;
      },
      update => {
        update
          .transition(trans)
          .attr(
            'transform',
            d =>
              `translate(${legendLabelOffsetX}, ${yScale(
                String(d.displayName)
              )})`
          );
        update
          .select('rect')
          .transition(trans)
          .attr('width', d => xScale(d.count) - xScale(0));

        return update;
      },
      exit => exit.remove()
    );

  // Create a clone of bars on the back to provide more context during
  // interactions
  if (drawFirst) {
    barGroup.clone(true).lower().attr('class', 'bar-group-clone');
  }
}

export function resetUnitTestPlots(this: SetView) {
  if (unitTestYScale === null || unitTestYAxis === null) return;
  // Reset the selected
  this.filters.otherSet = [];

  // Update the y axis
  unitTestYAxis.selectAll('.tick').select('text').classed('selected', true);
  this.syncFilters();
}
