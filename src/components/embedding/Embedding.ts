// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { config } from '../../config';
import d3 from '../../utils/d3-import';
import type {
  Padding,
  DailyData,
  ChallengeSet,
  ChallengeData,
  SamplePoint,
  GridJSONData,
  LogGridJSONData,
  GridMetaData
} from 'src/CustomTypes';
import { Timeline } from './Timeline';
import {
  getTooltipStoreDefaultValue,
  getChallengeStoreDefaultValue,
  getTimelineStoreDefaultValue,
  getEmbeddingSettingStoreDefaultValue
} from '../../store';
import type {
  TooltipStoreValue,
  ChallengeStoreValue,
  TimelineStoreValue,
  EmbeddingSettingStoreValue
} from '../../store';
import type { Writable } from 'svelte/store';

const POINT_RADIUS = 2;
const CHALLENGE_STROKE_WIDTH = 0.4;
let timerID: number | null = null;
// let dailyScatterTimerID: number | null = null;
let cache: Cache | null = null;

export class Embedding {
  component: HTMLElement;
  challengeSet: ChallengeSet;
  challengeData: ChallengeData;
  focusPosition: number;
  embeddingUpdated: () => void;
  svg: d3.Selection<Element, unknown, null, undefined>;

  padding: Padding;
  width: number;
  height: number;

  xScale: d3.ScaleLinear<number, number, never> | null = null;
  yScale: d3.ScaleLinear<number, number, never> | null = null;
  initXScale: d3.ScaleLinear<number, number, never> | null = null;
  initYScale: d3.ScaleLinear<number, number, never> | null = null;
  transformK = 1.0;

  contourMeta: GridMetaData | null = null;
  backgroundContourPromise: Promise<void>;

  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue;

  timelineStore: Writable<TimelineStoreValue>;
  timelineStoreValue: TimelineStoreValue;

  embeddingSettingStore: Writable<EmbeddingSettingStoreValue>;
  embeddingSettingStoreValue: EmbeddingSettingStoreValue;

  backgroundDensityColorScale: (t: number) => string;

  constructor({
    component,
    challengeSet,
    challengeData,
    focusPosition,
    embeddingUpdated,
    tooltipStore,
    timelineStore,
    embeddingSettingStore
  }: {
    component: HTMLElement;
    challengeSet: ChallengeSet;
    challengeData: ChallengeData;
    focusPosition: number;
    embeddingUpdated: () => void;
    tooltipStore: Writable<TooltipStoreValue>;
    timelineStore: Writable<TimelineStoreValue>;
    embeddingSettingStore: Writable<EmbeddingSettingStoreValue>;
  }) {
    this.component = component;
    this.challengeSet = challengeSet;
    this.challengeData = challengeData;
    this.focusPosition = focusPosition;
    this.embeddingUpdated = embeddingUpdated;

    // Initialize the svg
    this.svg = d3.select(this.component).select('svg.embedding-svg');
    this.svg
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewbox', '0 0 600 600')
      .attr('preserveAspectRatio', 'none');

    this.padding = { top: 1, bottom: 1, left: 1, right: 1 };
    const svgBBox = (this.svg.node() as HTMLElement).getBoundingClientRect();

    this.width = svgBBox.width - this.padding.left - this.padding.right;
    this.height = svgBBox.height - this.padding.top - this.padding.bottom;

    if (this.width !== this.height) {
      // console.warn(
      //   'SVG width is not equal to height. Modified height.',
      //   svgBBox
      // );
      this.height = this.width;
    }

    const content = this.svg.append('g').attr('class', 'content');
    content.append('g').attr('class', 'content-bottom');
    content.append('g').attr('class', 'content-top');

    // Init the background density
    // We interpolate from [white, 0] to [color, 1]
    this.backgroundDensityColorScale = d3.interpolateHcl(
      config.colors['gray-50'],
      config.colors['blue-900']
    );

    this.backgroundContourPromise = this.initBackgroundContour();
    // this.initBackgroundDensity();

    // Initialize the store values
    this.tooltipStore = tooltipStore;
    this.tooltipStoreValue = getTooltipStoreDefaultValue();

    this.timelineStore = timelineStore;
    this.timelineStoreValue = getTimelineStoreDefaultValue();

    this.embeddingSettingStore = embeddingSettingStore;
    this.embeddingSettingStoreValue = getEmbeddingSettingStoreDefaultValue();

    // Subscribe stores
    this.subscribeStores();

    // Draw the challenging points
    this.backgroundContourPromise.then(() => {
      this.drawChallengeSetScatter();
      this.drawLogContour(['20220301']);
    });

    this.initZoom();

    // Draw the thumbnail
    this.initThumbnailBackgroundContour();
  }

  /**
   * Draw the training data density plot in the background.
   */
  initBackgroundDensity = async () => {
    // The density data array is an (w, w) array with values between 0 and 1
    const gridJSONData: GridJSONData | undefined = await d3.json(
      `${import.meta.env.BASE_URL}data/density-grid.json`
    );

    if (gridJSONData === undefined) {
      console.error('Cannot load density data.');
      return;
    }

    const gridData = gridJSONData.data;

    // Set up a temporary canvas in order to resize image later
    const imageLength = gridData.length;
    const bufferCanvas = document.createElement('canvas');
    const bufferContext = bufferCanvas.getContext('2d')!;
    bufferCanvas.width = imageLength;
    bufferCanvas.height = imageLength;

    // Fill image pixel array
    const imageSingle = bufferContext.getImageData(
      0,
      0,
      imageLength,
      imageLength
    );
    const imageSingleArray = imageSingle.data;

    // Iterating by 4 where each step we fill (R, G, B, A)
    for (let i = 0; i < imageSingleArray.length; i += 4) {
      const pixelIndex = Math.floor(i / 4);
      const row = Math.floor(pixelIndex / imageLength);
      const column = pixelIndex % imageLength;
      const curData = gridData[row][column].pdf;
      const color = d3.rgb(this.backgroundDensityColorScale(curData));

      imageSingleArray[i] = color.r;
      imageSingleArray[i + 1] = color.g;
      imageSingleArray[i + 2] = color.b;
      imageSingleArray[i + 3] = 255;
    }

    // Resize the canvas
    const largeCanvas = document.createElement('canvas');
    const largeCanvasLength =
      this.width + this.padding.left + this.padding.right;
    largeCanvas.width = largeCanvasLength;
    largeCanvas.height = largeCanvasLength;
    const largeCanvasContext = largeCanvas.getContext('2d')!;

    // Use drawImage to resize the original pixel array, and put the new image
    // (canvas) into corresponding canvas
    bufferContext.putImageData(imageSingle, 0, 0);
    largeCanvasContext.drawImage(
      bufferCanvas,
      0,
      0,
      imageLength,
      imageLength,
      this.padding.left,
      this.padding.top,
      this.width,
      this.width
    );

    const imageDataURL = largeCanvas.toDataURL();

    const contentBottom = this.svg
      .select('g.content')
      .select('.content-bottom');

    contentBottom
      .append('image')
      .attr('transform', 'scale(1, -1)')
      .attr('transform-origin', 'center')
      .attr('class', 'background-density')
      .attr('xlink:href', imageDataURL)
      .style('opacity', 0.3);
  };

  /**
   * Draw the training data density plot in the background.
   */
  initBackgroundContour = async () => {
    // The density data array is an (w, w) array with values between 0 and 1
    const gridJSONData: GridJSONData | undefined = await d3.json(
      `${import.meta.env.BASE_URL}data/density-grid.json`
    );

    if (gridJSONData === undefined) {
      console.error('Cannot load density data.');
      return;
    }

    const gridData = gridJSONData.data;
    const gridMeta = gridJSONData.meta;
    this.contourMeta = gridMeta;

    // Create a grid to generate contour path
    const grid: number[] = [];
    for (let i = 0; i < gridData.length; i++) {
      for (let j = 0; j < gridData.length; j++) {
        grid.push(gridData[i][j].pdf);
      }
    }

    // Initialize the scales
    this.initXScale = d3
      .scaleLinear()
      .domain([gridMeta.vmin, gridMeta.vmax])
      .range([this.padding.left, this.padding.left + this.width]);

    this.xScale = d3
      .scaleLinear()
      .domain([gridMeta.vmin, gridMeta.vmax])
      .range([this.padding.left, this.padding.left + this.width]);

    this.initYScale = d3
      .scaleLinear()
      .domain([gridMeta.vmin, gridMeta.vmax])
      .range([this.padding.top + this.height, this.padding.top]);

    this.yScale = d3
      .scaleLinear()
      .domain([gridMeta.vmin, gridMeta.vmax])
      .range([this.padding.top + this.height, this.padding.top]);

    const THRESHOLDS = [
      0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1
    ];

    const contours = d3
      .contours()
      .size([gridData.length, gridData.length])
      .thresholds(THRESHOLDS)(grid)
      .map((polygon: d3.ContourMultiPolygon) => {
        const newPolygon: d3.ContourMultiPolygon = {
          type: polygon.type,
          value: polygon.value,
          coordinates: polygon.coordinates.map(rings => {
            return rings.map(points => {
              return points.map(([x, y]) => [
                this.xScale!(
                  gridJSONData.meta.vmin + gridJSONData.meta.step * x
                ),
                this.yScale!(
                  gridJSONData.meta.vmin + gridJSONData.meta.step * y
                )
              ]);
            });
          })
        };
        return newPolygon;
      });

    // Draw the contours
    const contentBottom = this.svg
      .select('g.content')
      .select('.content-bottom')
      .append('g')
      .attr('class', 'contour-train');

    const color = d3.scaleSequential(
      d3.extent(THRESHOLDS) as [number, number],
      d3.interpolateGreys
    );

    contentBottom
      .selectAll('path')
      .data(contours)
      .join('path')
      .attr('class', 'contour')
      .attr('d', d3.geoPath())
      .style('fill', d => color(d.value));

    contentBottom
      .append('rect')
      .attr('class', 'contour-mask')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('fill', 'white')
      .style('opacity', 0.4);
  };

  /**
   * Draw the training data density plot in the background.
   */
  initThumbnailBackgroundContour = async () => {
    // The density data array is an (w, w) array with values between 0 and 1
    const gridJSONData: GridJSONData | undefined = await d3.json(
      `${import.meta.env.BASE_URL}data/density-grid.json`
    );

    if (gridJSONData === undefined) {
      console.error('Cannot load density data.');
      return;
    }

    const gridData = gridJSONData.data;
    const gridMeta = gridJSONData.meta;
    this.contourMeta = gridMeta;

    // Create a grid to generate contour path
    const grid: number[] = [];
    for (let i = 0; i < gridData.length; i++) {
      for (let j = 0; j < gridData.length; j++) {
        grid.push(gridData[i][j].pdf);
      }
    }

    // Initialize the scales
    const svg = d3.select(`div#thumbnail-${this.focusPosition}`).select('svg');
    const svgBBox = (svg.node() as HTMLElement).getBoundingClientRect();
    const width = svgBBox.width;
    const height = svgBBox.height;

    const xScale = d3
      .scaleLinear()
      .domain([gridMeta.vmin, gridMeta.vmax])
      .range([this.padding.left, this.padding.left + width]);

    const yScale = d3
      .scaleLinear()
      .domain([gridMeta.vmin, gridMeta.vmax])
      .range([this.padding.top + height, this.padding.top]);

    const THRESHOLDS = [
      0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1
    ];

    const contours = d3
      .contours()
      .size([gridData.length, gridData.length])
      .thresholds(THRESHOLDS)(grid)
      .map((polygon: d3.ContourMultiPolygon) => {
        const newPolygon: d3.ContourMultiPolygon = {
          type: polygon.type,
          value: polygon.value,
          coordinates: polygon.coordinates.map(rings => {
            return rings.map(points => {
              return points.map(([x, y]) => [
                xScale(gridJSONData.meta.vmin + gridJSONData.meta.step * x),
                yScale(gridJSONData.meta.vmin + gridJSONData.meta.step * y)
              ]);
            });
          })
        };
        return newPolygon;
      });

    // Draw the contours
    const contentBottom = svg
      .append('g')
      .attr('class', 'contour-train')
      .style('transform-origin', 'center')
      .style('transform', 'scale(1.3)');

    const color = d3.scaleSequential(
      d3.extent(THRESHOLDS) as [number, number],
      d3.interpolateGreys
    );

    contentBottom
      .selectAll('path')
      .data(contours)
      .join('path')
      .attr('class', 'contour')
      .attr('d', d3.geoPath())
      .style('fill', d => color(d.value));

    contentBottom
      .append('rect')
      .attr('class', 'contour-mask')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'white')
      .style('opacity', 0.4);
  };

  /**
   * Draw the log data density plot in the background.
   * @param dates String dates to draw contour on
   * @returns
   */
  drawLogContour = async (dates: string[]) => {
    const grid: number[] = [];
    const dateWeight = 1 / dates.length;
    let gridWidth = 0;
    let initialized = false;

    if (!this.contourMeta) {
      console.error('contourMeta is not initialized, quit drawing.');
      return;
    }

    // If there is no dates selected, remove the contours
    if (dates.length === 0) {
      this.svg.selectAll('g.contour-log').remove();
      return;
    }

    for (const d of dates) {
      // The density data array is an (w, w) array with values between 0 and 1
      const gridJSONData: LogGridJSONData | undefined = await d3.json(
        `${import.meta.env.BASE_URL}data/density-grid-logs.json`
      );

      if (gridJSONData === undefined) {
        console.error(`Cannot load density data on ${d}.`);
        return;
      }

      const curGridData = gridJSONData.data;

      if (!initialized) {
        gridWidth = curGridData.length;
        initialized = true;
      }

      // Update the overall pdfs (use average score here)
      if (grid.length === 0) {
        // Create a grid to generate contour path
        for (let i = 0; i < curGridData.length; i++) {
          for (let j = 0; j < curGridData.length; j++) {
            grid.push(curGridData[i][j] * dateWeight);
          }
        }
      } else {
        // Update the the grid
        for (let i = 0; i < curGridData.length; i++) {
          for (let j = 0; j < curGridData.length; j++) {
            grid[i * curGridData.length + j] += curGridData[i][j] * dateWeight;
          }
        }
      }
    }

    // Use the same scale as the training contour
    const THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

    const contours = d3
      .contours()
      .size([gridWidth, gridWidth])
      .thresholds(THRESHOLDS)(grid)
      .map((polygon: d3.ContourMultiPolygon) => {
        const newPolygon: d3.ContourMultiPolygon = {
          type: polygon.type,
          value: polygon.value,
          coordinates: polygon.coordinates.map(rings => {
            return rings.map(points => {
              return points.map(([x, y]) => [
                this.initXScale!(
                  this.contourMeta!.vmin + this.contourMeta!.step * x
                ),
                this.initYScale!(
                  this.contourMeta!.vmin + this.contourMeta!.step * y
                )
              ]);
            });
          })
        };
        return newPolygon;
      });

    // Draw the contours
    const contentBottom = this.svg
      .select('g.content-bottom')
      .selectAll('g.contour-log')
      .data([0])
      .join('g')
      .attr('class', 'contour-log')
      .style('visibility', 'hidden');

    const color = d3.scaleSequential(
      d3.extent(THRESHOLDS) as [number, number],
      // d3.interpolateBlues
      ['hsl(174, 100%, 95%)', 'hsl(174, 100%, 23%)']
    );

    // Draw / update the contour path
    contentBottom
      .selectAll<SVGElement, d3.ContourMultiPolygon>('path')
      .data(contours, d => d.value)
      .join('path')
      .attr('class', 'contour-log')
      .style('fill', d => color(d.value))
      .style('opacity', 0.15)
      .attr('d', d3.geoPath());
  };

  /**
   * Draw the top scatter plot
   * @param dates Dates to draw the scatter plot from
   * @param topK Top-k rarest dots to draw
   */
  drawRareDailyPoints = async (days: string[], topK = 3000) => {
    const dailyDataArray: DailyData[] = [];
    cache = await caches.open('cache');

    // Load all related json files
    for (const curDay of days) {
      let dailyData: DailyData | undefined = undefined;

      // Check if the json file is cached
      const JSON_URL = `${
        import.meta.env.BASE_URL
      }data/log-daily/daily-${curDay}.json`;
      const response = await cache.match(JSON_URL);

      // If the file was cached
      if (response) {
        dailyData = (await response.json()) as DailyData;
      } else {
        // Save the json file to cache
        await cache.add(JSON_URL);
        const newResponse = await cache.match(JSON_URL);
        dailyData = (await newResponse?.json()) as DailyData;
      }

      if (dailyData === undefined) {
        console.error('Cannot load density data.');
        continue;
      }

      dailyDataArray.push(dailyData);
    }

    const totalDataNum = dailyDataArray.reduce(
      (a: number, b: DailyData) => a + b.umap.length,
      0
    );

    // Step 1: Find the top-k points by round robin all days
    const dailyPoints: SamplePoint[] = [];
    const existingSources = new Set<string>();

    for (let i = 0; i < totalDataNum; i++) {
      const curData = dailyDataArray[i % dailyDataArray.length];
      const curIndex = Math.floor(i / dailyDataArray.length);
      if (
        dailyPoints.length < topK &&
        !existingSources.has(curData.source[curIndex])
      ) {
        dailyPoints.push({
          x: curData.umap[curIndex][0],
          y: curData.umap[curIndex][1],
          source: curData.source[curIndex],
          name: `${days[i]}-${curIndex}`
        });
        existingSources.add(curData.source[curIndex]);
      }
    }

    // Step 2: Draw the points
    this.drawDailyScatter(dailyPoints);
  };

  /**
   * Draw the given daily points
   * @param dailyPoints Array of sample points to draw
   */
  drawDailyScatter = (dailyPoints: SamplePoint[]) => {
    const contentTop = this.svg.select('g.content-top');
    const pointGroup = contentTop
      .selectAll('g.daily-point-group')
      .data([0])
      .join('g')
      .attr('class', 'daily-point-group');

    pointGroup
      .selectAll<SVGElement, SamplePoint>('g.daily-point')
      .data(dailyPoints, d => d.name)
      .join(
        enter => {
          const pointGroups = enter
            .append('g')
            .attr('class', 'daily-point')
            .attr(
              'transform',
              d =>
                `translate(${this.initXScale!(d.x)}, ${this.initYScale!(d.y)})`
            )
            .on('mouseenter', this.pointMouseenterHandler)
            .on('mouseleave', this.pointMouseleaveHandler);

          pointGroups
            .append('circle')
            .attr('cx', -POINT_RADIUS)
            .attr('cy', -POINT_RADIUS)
            .attr('r', Math.max((1 / this.transformK) * POINT_RADIUS, 0.5));

          return pointGroups;
        },
        update => {
          return update.attr(
            'transform',
            d => `translate(${this.initXScale!(d.x)}, ${this.initYScale!(d.y)})`
          );
        },
        exit => {
          return exit.remove();
        }
      );
  };

  drawChallengeSetScatter = () => {
    // Step 1: Convert object fields into individual objects
    const challengePoints: SamplePoint[] = [];
    for (let i = 0; i < this.challengeData.x.length; i++) {
      challengePoints.push({
        source: this.challengeData.source[i],
        hyp: this.challengeData.hyp[i],
        x: this.challengeData.x[i],
        y: this.challengeData.y[i],
        name: `${this.challengeSet.fileName}-${i}`,
        isTrain: this.challengeData.train[i] === 1,
        index: i
      });
    }

    // Step 2: Draw the points
    const contentTop = this.svg.select('g.content-top');
    const pointGroup = contentTop
      .append('g')
      .attr('class', 'challenge-point-group');

    const points = pointGroup
      .selectAll('g.challenge-point')
      .data(challengePoints)
      .join('g')
      .attr('class', 'challenge-point')
      .classed('train-sample', d => (d.isTrain ? true : false))
      .attr(
        'transform',
        d => `translate(${this.initXScale!(d.x)}, ${this.initYScale!(d.y)})`
      )
      .style('stroke-width', CHALLENGE_STROKE_WIDTH)
      .on('mouseenter', this.pointMouseenterHandler)
      .on('mouseleave', this.pointMouseleaveHandler);

    points
      .append('circle')
      .attr('cx', -POINT_RADIUS)
      .attr('cy', -POINT_RADIUS)
      .attr('r', Math.max((1 / this.transformK) * POINT_RADIUS, 0.5));
  };

  pointMouseenterHandler = (e: MouseEvent, d: SamplePoint) => {
    if (e.target === null) {
      return;
    }

    // Cancel the previous timeout if it is pending
    if (timerID !== null) {
      window.clearTimeout(timerID);
      timerID = null;
    }

    const showTooltip = () => {
      // Compute the tooltip position
      const point = d3.select(e.target as HTMLElement);
      const pointBBox = point.node()!.getBoundingClientRect()!;
      const top = pointBBox.y;
      const left = pointBBox.x + pointBBox.width / 2;

      // Show the tooltip
      if (d.hyp) {
        this.tooltipStoreValue.html = `<div class='translate'>\
        <span>${d.source}</span>\
        <span class='arrow'></span>\
        <span>${d.hyp}</span></div>`;
      } else {
        this.tooltipStoreValue.html = d.source;
      }

      this.tooltipStoreValue.show = true;
      this.tooltipStoreValue.maxWidth = 400;
      this.tooltipStoreValue.top = top;
      this.tooltipStoreValue.left = left;
      this.tooltipStore.set(this.tooltipStoreValue);
    };

    timerID = window.setTimeout(showTooltip, 200);
  };

  pointMouseleaveHandler = (e: MouseEvent) => {
    if (e.target === null) {
      return;
    }

    // Show the tooltip
    this.tooltipStoreValue.show = false;
    this.tooltipStore.set(this.tooltipStoreValue);

    if (timerID !== null) {
      window.clearTimeout(timerID);
      timerID = null;
    }
  };

  /**
   * Make the embedding view zoomable and pannable
   */
  initZoom = () => {
    const zoom = d3
      .zoom()
      .scaleExtent([1, 40])
      .translateExtent([
        [0, 0],
        [
          this.width + this.padding.left + this.padding.right,
          this.height + this.padding.top + this.padding.bottom
        ]
      ])
      .on('zoom', this.zoomed);

    this.svg.call(zoom);

    const content = this.svg.select<Element>('g.content');

    // Recenter the plot
    const svgBBox = (this.svg.node() as HTMLElement).getBoundingClientRect();
    const yOffset = (svgBBox.width - svgBBox.height) / 2;
    const initTransform = d3.zoomIdentity.translate(0, -yOffset);

    // Listen to double click to reset zoom
    this.svg.on('dblclick.zoom', null);
    content.on('dblclick.zoom', null);
    content.on('dblclick', () => {
      this.svg
        .transition('reset')
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(selection => zoom.transform(selection, initTransform));
    });

    // Recenter the plot once the background is drawn
    this.backgroundContourPromise.then(() => {
      this.svg.call(selection => zoom.transform(selection, initTransform));
    });
  };

  zoomed = (event: d3.D3ZoomEvent<Element, SamplePoint>) => {
    const transform = event.transform;
    this.transformK = transform.k;
    const content = this.svg.select('g.content');

    // Scale the daily points and challenge points
    content
      .selectAll('g.daily-point')
      .selectAll('circle')
      .attr('r', Math.max((1 / transform.k) * POINT_RADIUS, 0.5));

    content
      .selectAll('g.challenge-point')
      .selectAll('circle')
      .attr('r', Math.max((1 / transform.k) * POINT_RADIUS, 0.5))
      .style(
        'stroke-width',
        Math.max((1 / transform.k) * CHALLENGE_STROKE_WIDTH, 0.1)
      );

    content.attr('transform', transform.toString());
    this.xScale = transform.rescaleX(this.xScale!);
    this.yScale = transform.rescaleY(this.yScale!);
  };

  subscribeStores = () => {
    // Tooltip store => just update values
    this.tooltipStore.subscribe(value => {
      this.tooltipStoreValue = value;
    });

    // Timeline store => Update the daily dots when value changed
    this.timelineStore.subscribe(value => {
      this.timelineStoreValue = value;

      const updatePlotsFromTimelineUpdate = () => {
        // Update the log contour
        this.drawLogContour(this.timelineStoreValue.selectedDates);

        // Update the scatter dots
        // This one is slower, so we add a timer to delay it if users are
        // selecting different bins rapidly
        // if (dailyScatterTimerID) {
        //   window.clearTimeout(dailyScatterTimerID);
        //   dailyScatterTimerID = null;
        // }

        // dailyScatterTimerID = window.setTimeout(() => {
        //   this.drawRareDailyPoints(
        //     this.timelineStoreValue.selectedDates,
        //     this.embeddingSettingStoreValue.curSample
        //   );
        // }, 50);
      };

      if (this.contourMeta) {
        updatePlotsFromTimelineUpdate();
      } else {
        // If background contour has not been drawn yet, wait for it
        this.backgroundContourPromise.then(() => {
          updatePlotsFromTimelineUpdate();
        });
      }
    });

    // Embedding setting store => Update the log data sampling
    this.embeddingSettingStore.subscribe(value => {
      this.embeddingSettingStoreValue = value;

      // this.drawRareDailyPoints(
      //   this.timelineStoreValue.selectedDates,
      //   this.embeddingSettingStoreValue.curSample
      // );
      const filteredIndexes = new Set(
        this.embeddingSettingStoreValue.filteredIndexes
      );

      // Show/pointGroup points based on the filtered indexes
      this.svg
        .select('g.content-top g.challenge-point-group')
        .selectAll('g.challenge-point')
        .classed('hide', d => !filteredIndexes.has((d as SamplePoint).index!));

      // Toggle to show / hide log contour
      this.svg
        .select('g.contour-log')
        .style('visibility', value.showLogContour ? 'unset' : 'hidden');

      // Toggle to show / hide log sample
      this.svg
        .select('g.content')
        .selectAll('.challenge-point:not(.train-sample)')
        .style('visibility', value.showLogSample ? 'unset' : 'hidden');

      // Toggle to show / hide train sample
      this.svg
        .select('g.content')
        .selectAll('g.challenge-point.train-sample')
        .style('visibility', value.showTrainSample ? 'unset' : 'hidden');

      this.embeddingUpdated();
    });
  };
}
