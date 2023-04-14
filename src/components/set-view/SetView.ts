// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { config } from '../../config';
import d3 from '../../utils/d3-import';
import { Timeline } from '../embedding/Timeline';
import type {
  Padding,
  Size,
  ChallengeData,
  ChallengeSet,
  TranslateSentence,
  Keyword,
  FilterTag,
  SourceIDBinData,
  IntersectionBinData,
  IntersectionData,
  DateCount,
  Filters,
  Header
} from 'src/CustomTypes';
import { PlotType, FilterType, HeaderKey } from '../../CustomTypes';
import {
  drawFamiliarityFocus,
  drawFamiliarityThumbnail,
  resetFamiliarityPlots,
  drawChrfFocus,
  drawChrfThumbnail,
  resetChrfPlots
} from './Continuous';
import {
  drawSourceIDFocus,
  drawSourceIDThumbnail,
  resetSourceIDPlots,
  drawUnitTestFocus,
  drawUnitTestThumbnail,
  resetUnitTestPlots
} from './Categorical';
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
import { tick } from 'svelte';
import type { Writable } from 'svelte/store';

const rowBackgroundColor = '#ffffff';
const titleY = 16;
let countLabelTimer: number | null = null;

const plotLabelMap: Map<PlotType, string> = new Map();
plotLabelMap.set(PlotType.Keyword, 'Keywords');
plotLabelMap.set(PlotType.Chrf, 'ChrF');
plotLabelMap.set(PlotType.SourceID, 'Input Source');
plotLabelMap.set(PlotType.Embedding, 'Embeddings');
plotLabelMap.set(PlotType.Familiarity, 'Familiarities');
plotLabelMap.set(PlotType.UnitTest, 'Unit Tests');

const plotColorMap: Map<PlotType, string> = new Map();
plotColorMap.set(PlotType.Keyword, config.colors['pink-200']);
plotColorMap.set(PlotType.Chrf, config.colors['blue-200']);
plotColorMap.set(PlotType.SourceID, config.colors['green-200']);
plotColorMap.set(PlotType.Embedding, config.colors['orange-200']);
plotColorMap.set(PlotType.Familiarity, config.colors['purple-200']);
plotColorMap.set(PlotType.UnitTest, config.colors['yellow-200']);

interface CurPlotTypes {
  focus: PlotType;
  thumbnails: PlotType[];
}

export class SetView {
  component: HTMLElement;
  challengeSet: ChallengeSet;
  challengeData: ChallengeData;
  curKeywords: Keyword[];
  mySetViewUpdated: () => void;

  trainingCount = 0;
  logCount = 0;
  countLabel: d3.Selection<d3.BaseType, unknown, null, undefined>;

  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue;

  challengeStore: Writable<ChallengeStoreValue>;
  challengeStoreValue: ChallengeStoreValue;

  timelineStore: Writable<TimelineStoreValue>;
  timelineStoreValue: TimelineStoreValue;

  embeddingSettingStore: Writable<EmbeddingSettingStoreValue>;
  embeddingSettingStoreValue: EmbeddingSettingStoreValue;

  // Detail row data
  selectedSetName = '';
  selectedSetSentences: TranslateSentence[] = [];
  selectedSetKeywords: Keyword[] = [];
  editMode = false;

  timeline: Timeline;
  curSentences: TranslateSentence[] = [];
  filteredIndexes: number[] = [];

  // Track all the filter indexes under each condition
  filters: Filters = {
    date: [],
    keyword: [],
    embedding: [],
    chrf: [],
    familiarity: [],
    sourceID: [],
    otherSet: [],
    search: []
  };
  filterSearchMatchIndexes = new Map<number, number[][]>();
  filterKeywordMatchIndexes = new Map<number, number[][]>();

  filterTags: FilterTag[] = [];

  focusScales = new Map<
    string,
    [
      d3.ScaleLinear<number, number, never>,
      d3.ScaleLinear<number, number, never> | d3.ScaleBand<string>
    ]
  >();
  thumbnailScales = new Map<
    string,
    [
      d3.ScaleLinear<number, number, never>,
      d3.ScaleLinear<number, number, never> | d3.ScaleBand<string>
    ]
  >();
  sourceIDMap: { [key: number]: string[] } | null = null;
  intersectionData: IntersectionData | null = null;

  // SVG elements
  focusSVGs: d3.Selection<d3.BaseType, unknown, null, undefined>[];
  thumbnailSVGs: d3.Selection<d3.BaseType, unknown, null, undefined>[];

  focusLabel: d3.Selection<d3.BaseType, unknown, null, undefined>;
  thumbnailLabels: d3.Selection<d3.BaseType, unknown, null, undefined>[];

  focusPadding: Padding;
  thumbnailPadding: Padding;

  focusSize: Size;
  thumbnailSize: Size;

  curPlotTypes: CurPlotTypes;
  curSelectedThumbnailID = 0;
  curSelectedKeywords = new Set<string>();

  // Add methods defined in other files
  drawFamiliarityFocus = drawFamiliarityFocus;
  drawFamiliarityThumbnail = drawFamiliarityThumbnail;
  resetFamiliarityPlots = resetFamiliarityPlots;

  drawChrfFocus = drawChrfFocus;
  drawChrfThumbnail = drawChrfThumbnail;
  resetChrfPlots = resetChrfPlots;

  drawSourceIDFocus = drawSourceIDFocus;
  drawSourceIDThumbnail = drawSourceIDThumbnail;
  resetSourceIDPlots = resetSourceIDPlots;

  drawUnitTestFocus = drawUnitTestFocus;
  drawUnitTestThumbnail = drawUnitTestThumbnail;
  resetUnitTestPlots = resetUnitTestPlots;

  constructor({
    component,
    challengeSet,
    challengeData,
    mySetViewUpdated,
    tooltipStore,
    challengeStore,
    timelineStore,
    embeddingSettingStore
  }: {
    component: HTMLElement;
    challengeSet: ChallengeSet;
    challengeData: ChallengeData;
    mySetViewUpdated: () => void;
    tooltipStore: Writable<TooltipStoreValue>;
    challengeStore: Writable<ChallengeStoreValue>;
    timelineStore: Writable<TimelineStoreValue>;
    embeddingSettingStore: Writable<EmbeddingSettingStoreValue>;
  }) {
    this.component = component;
    this.challengeSet = challengeSet;
    this.challengeData = challengeData;
    this.mySetViewUpdated = mySetViewUpdated;
    this.countLabel = d3
      .select(this.component)
      .select('#sentence-list-count-label');

    // Initialize the store values
    this.tooltipStore = tooltipStore;
    this.tooltipStoreValue = getTooltipStoreDefaultValue();

    this.challengeStore = challengeStore;
    this.challengeStoreValue = getChallengeStoreDefaultValue();

    this.timelineStore = timelineStore;
    this.timelineStoreValue = getTimelineStoreDefaultValue();

    this.embeddingSettingStore = embeddingSettingStore;
    this.embeddingSettingStoreValue = getEmbeddingSettingStoreDefaultValue();

    // Pair up the source and hyp
    this.initTranslateSentences();

    // SVG selections
    this.focusSVGs = [];
    this.thumbnailSVGs = [];

    this.focusLabel = d3
      .select(this.component)
      .select('.vis-focus')
      .select('.vis-label');
    this.thumbnailLabels = [];

    this.focusPadding = { top: 5, bottom: 5, left: 5, right: 5 };
    this.thumbnailPadding = { top: 5, bottom: 5, left: 5, right: 5 };

    this.focusSize = { width: 0, height: 0 };
    this.thumbnailSize = { width: 0, height: 0 };

    const initFocusType = PlotType.Keyword;
    this.curPlotTypes = {
      focus: initFocusType,
      thumbnails: [
        PlotType.Keyword,
        PlotType.Embedding,
        PlotType.Chrf,
        PlotType.Familiarity,
        PlotType.SourceID,
        PlotType.UnitTest
      ]
    };
    this.curSelectedThumbnailID =
      this.curPlotTypes.thumbnails.indexOf(initFocusType);

    this.initSVGs().then(_ => {
      // Initialize the visualizations
      this.initVis();
    });

    // Initialize the keywords
    this.curKeywords = this.initializeKeywords();

    // Initialize the timeline
    const padding = { top: 5, bottom: 7, left: 3, right: 3 };
    const dateCountData = this.initDateCountData();
    this.timeline = new Timeline({
      component,
      tooltipStore,
      timelineStore,
      padding,
      dateCount: dateCountData
    });

    // Subscribe stores
    this.subscribeStores();
  }

  /**
   * Count number of requests in this challenge set across all dates
   */
  initDateCountData = () => {
    const dateCount = new Map<number, number>();
    const datePattern = /(\d{4})(\d{2})(\d{2})/;
    for (const d of this.challengeData.date) {
      if (d === null) continue;
      if (dateCount.has(d)) {
        dateCount.set(d, dateCount.get(d)! + 1);
      } else {
        dateCount.set(d, 1);
      }
    }

    const dateData: DateCount[] = [...dateCount.entries()]
      .map(([d, c]) => {
        const curDate = new Date(String(d).replace(datePattern, '$1-$2-$3'));
        return {
          date: curDate,
          count: c
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return dateData;
  };

  /**
   * Create date count data from the selected sentences
   */
  getCurDateCountData = () => {
    const dateCount = new Map<number, number>();

    // Initialize the date count map
    for (const date of this.timeline.dateCount!) {
      const dateNum = parseInt(
        `${date.date.getUTCFullYear()}${(date.date.getUTCMonth() + 1)
          .toString()
          .padStart(2, '0')}${date.date
          .getUTCDate()
          .toString()
          .padStart(2, '0')}`
      );

      dateCount.set(dateNum, 0);
    }

    // Re-count sentences
    const datePattern = /(\d{4})(\d{2})(\d{2})/;
    for (const i of this.filteredIndexes) {
      const curDateNum = this.challengeData.date[i];
      if (curDateNum !== null) {
        dateCount.set(curDateNum, dateCount.get(curDateNum)! + 1);
      }
    }

    const dateData: DateCount[] = [...dateCount.entries()]
      .map(([d, c]) => {
        const curDate = new Date(String(d).replace(datePattern, '$1-$2-$3'));
        return {
          date: curDate,
          count: c
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return dateData;
  };

  initializeKeywords = () => {
    const tempSelectedSetKeywords: Keyword[] = [];
    let result: Keyword[] = [];
    const MAX_KEYWORDS = 50;
    for (const [w, v] of this.challengeData.keywords) {
      tempSelectedSetKeywords.push({
        word: w,
        value: v
      });
    }

    result = tempSelectedSetKeywords.slice(0, MAX_KEYWORDS);

    // Figure out the color for each keyword
    const valueExtent = d3.extent(result, d => d.value) as [number, number];
    const preScale = d3.scaleLinear().domain(valueExtent).range([0, 1]);
    const colorScale = d3.interpolateHcl(
      config.colors['gray-50'],
      d3.hsl(204, 0.13, 0.76)
    );

    for (const k of result) {
      k.color = colorScale(preScale(k.value));
    }

    // Sort the keywords based on their values
    result.sort((a, b) => b.value - a.value);

    return result;
  };

  /**
   * Sync all filters to update this.filteredIndexes
   */
  syncFilters = () => {
    let workingIndexes = new Set(
      Array(this.challengeData.source.length)
        .fill(0)
        .map((d, i) => i)
    );

    let k: keyof Filters;
    for (k in this.filters) {
      const curIndexes = new Set(this.filters[k]);
      if (curIndexes.size === 0) {
        // Remove tag if possible
        const tagIndex = this.filterTags.map(d => d.type.toString()).indexOf(k);
        if (tagIndex !== -1) {
          this.filterTags.splice(tagIndex, 1);
        }
        continue;
      }

      // This filter is active, create a tag for it
      if (this.filterTags.filter(d => d.type === k).length > 0) {
        // This tag exists, update it
      } else {
        // Create a new tag
        let newTag: FilterTag;
        switch (k) {
          case 'date': {
            newTag = {
              type: FilterType.Date,
              message: 'Dates'
            };
            this.filterTags.push(newTag);
            break;
          }
          case 'sourceID': {
            newTag = {
              type: FilterType.SourceID,
              message: 'Input Source'
            };
            this.filterTags.push(newTag);
            break;
          }
          case 'chrf': {
            newTag = {
              type: FilterType.Chrf,
              message: 'ChrF'
            };
            this.filterTags.push(newTag);
            break;
          }
          case 'familiarity': {
            newTag = {
              type: FilterType.Familiarity,
              message: 'Familiarity'
            };
            this.filterTags.push(newTag);
            break;
          }
          case 'keyword': {
            newTag = {
              type: FilterType.Keyword,
              message: 'Keyword'
            };
            this.filterTags.push(newTag);
            break;
          }
          case 'otherSet': {
            newTag = {
              type: FilterType.OtherSet,
              message: 'Overlapping Sets'
            };
            this.filterTags.push(newTag);
            break;
          }
          case 'search': {
            newTag = {
              type: FilterType.Search,
              message: 'Search Result'
            };
            this.filterTags.push(newTag);
            break;
          }
        }
      }

      workingIndexes = new Set(
        [...workingIndexes].filter(d => curIndexes.has(d))
      );
    }

    // Update the filteredIndexes
    this.filteredIndexes = [...workingIndexes].sort((a, b) => a - b);

    // Update the sentences. We also need to highlight keywords if there are any
    this.curSentences = [];
    this.trainingCount = 0;
    this.logCount = 0;
    for (const i of this.filteredIndexes) {
      if (
        this.filterSearchMatchIndexes.has(i) ||
        this.filterKeywordMatchIndexes.has(i)
      ) {
        // Combine the matched indexes
        const highlightRange: number[][] = [];

        if (this.filterSearchMatchIndexes.has(i)) {
          for (const range of this.filterSearchMatchIndexes.get(i)!) {
            // Add third element to indicate the type of this highlight
            highlightRange.push([range[0], range[1], 1]);
          }
        }

        if (this.filterKeywordMatchIndexes.has(i)) {
          for (const range of this.filterKeywordMatchIndexes.get(i)!) {
            // Add third element to indicate the type of this highlight
            highlightRange.push([range[0], range[1], 0]);
          }
        }

        highlightRange.sort((a, b) => a[0] - b[0]);

        this.curSentences.push({
          source: this.challengeData.source[i],
          hyp: this.challengeData.hyp[i],
          showHyp: false,
          highlightRange,
          type: this.challengeData.train[i] === 1 ? 'train' : 'log'
        });
      } else {
        this.curSentences.push({
          source: this.challengeData.source[i],
          hyp: this.challengeData.hyp[i],
          showHyp: false,
          type: this.challengeData.train[i] === 1 ? 'train' : 'log'
        });
      }

      // Update the counts
      if (this.challengeData.train[i] === 1) {
        this.trainingCount += 1;
      } else {
        this.logCount += 1;
      }
    }

    // Update all focus and thumbnails
    if (this.focusScales.has('chrf')) {
      this.drawChrfFocus(2);
      this.drawChrfThumbnail(2);
    }

    if (this.focusScales.has('familiarity')) {
      this.drawFamiliarityFocus(3);
      this.drawFamiliarityThumbnail(3);
    }

    if (this.focusScales.has('sourceid')) {
      this.drawSourceIDFocus(4);
      this.drawSourceIDThumbnail(4);
    }

    if (this.focusScales.has('unittest')) {
      this.drawUnitTestFocus(5);
      this.drawUnitTestThumbnail(5);
    }

    // Update the timeline
    const newDateCount = this.getCurDateCountData();
    this.timeline.updateDateCount(newDateCount);

    this.mySetViewUpdated();

    // Show the count label briefly
    if (!this.countLabel.classed('shown')) {
      this.countLabel
        .style('opacity', 0)
        .classed('shown', true)
        .transition('show')
        .duration(300)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    }

    if (countLabelTimer !== null) {
      clearTimeout(countLabelTimer);
      countLabelTimer = null;
    }

    countLabelTimer = setTimeout(() => {
      this.countLabel
        .transition('hide')
        .duration(300)
        .ease(d3.easeCubicInOut)
        .style('opacity', 0)
        .on('end', () => {
          this.countLabel.classed('shown', false);
        });
    }, 3000);

    // Update the embedding view
    this.embeddingSettingStoreValue.filteredIndexes = this.filteredIndexes;
    this.embeddingSettingStore.set(this.embeddingSettingStoreValue);
  };

  subscribeStores = () => {
    // Tooltip store => just update values
    this.tooltipStore.subscribe(value => {
      this.tooltipStoreValue = value;
    });

    // Challenge set store => redraw challenge dots when value changed
    this.challengeStore.subscribe(value => {
      this.challengeStoreValue = value;
    });

    // Timeline store => update the filter and update visualizations
    this.timelineStore.subscribe(value => {
      this.timelineStoreValue = value;
      const newIndexes = [];

      if (value.selectedDates.length !== 0) {
        const selectedDates = new Set(this.timelineStoreValue.selectedDates);
        for (let i = 0; i < this.challengeData.source.length; i++) {
          if (selectedDates.has(String(this.challengeData.date[i]))) {
            newIndexes.push(i);
          }
        }
      }

      this.filters.date = newIndexes;
      this.syncFilters();
    });

    this.embeddingSettingStore.subscribe(value => {
      this.embeddingSettingStoreValue = value;
    });
  };

  /**
   * Initialize the paired translate sentences
   * @returns Paired sentences
   */
  initTranslateSentences = () => {
    this.curSentences = [];
    this.filteredIndexes = [];

    for (let i = 0; i < this.challengeData.source.length; i++) {
      this.curSentences.push({
        source: this.challengeData.source[i],
        hyp: this.challengeData.hyp[i],
        showHyp: false,
        type: this.challengeData.train[i] === 1 ? 'train' : 'log'
      });
      this.filteredIndexes.push(i);
    }
  };

  /**
   * Initialize all svg elements in the view
   */
  initSVGs = async () => {
    await tick();

    this.focusLabel.text(plotLabelMap.get(PlotType.Embedding)!);

    // Initialize thumbnail svgs
    for (let i = 0; i < this.curPlotTypes.thumbnails.length; i++) {
      const svg = d3
        .select(this.component)
        .select(`#focus-${i}`)
        .select('.focus-svg')
        .attr('viewbox', '0 0 530 360')
        .attr('preserveAspectRatio', 'none');

      svg
        .append('g')
        .attr('class', 'content')
        .attr(
          'transform',
          `translate(${this.focusPadding.left}, ${this.focusPadding.top})`
        );

      this.focusSVGs.push(svg);
    }

    // Cannot use the embedding focus view to initialize the size (its svg
    // is set `display: none;`)
    const svgBBox = (
      this.focusSVGs[2].node() as HTMLElement
    ).getBoundingClientRect();
    this.focusSize.width =
      svgBBox.width - this.focusPadding.left - this.focusPadding.right;
    this.focusSize.height =
      svgBBox.height - this.focusPadding.top - this.focusPadding.bottom;

    // Initialize thumbnail svgs
    for (let i = 0; i < this.curPlotTypes.thumbnails.length; i++) {
      const svg = d3
        .select(this.component)
        .select(`#thumbnail-${i}`)
        .select('.thumbnail-svg')
        .attr('viewbox', '0 0 100 100')
        .attr('preserveAspectRatio', 'none');

      svg
        .append('g')
        .attr('class', 'content')
        .attr(
          'transform',
          `translate(${this.thumbnailPadding.left}, ${this.thumbnailPadding.top})`
        );

      this.thumbnailSVGs.push(svg);

      // Add the vis label
      const label = d3
        .select(this.component)
        .select(`#thumbnail-${i}`)
        .select('.vis-label');
      this.thumbnailLabels.push(label);
    }

    // Initialize the thumbnail size
    const thumbnailSVGBBox = (
      this.thumbnailSVGs[1].node() as HTMLElement
    ).getBoundingClientRect();
    this.thumbnailSize.width =
      thumbnailSVGBBox.width -
      this.thumbnailPadding.left -
      this.thumbnailPadding.right;
    this.thumbnailSize.height =
      thumbnailSVGBBox.height -
      this.thumbnailPadding.top -
      this.thumbnailPadding.bottom;
  };

  /**
   * Draw the focus plot based on the curPlotType
   */
  updateFocusPlot = (i: number) => {
    switch (this.curPlotTypes.thumbnails[i]) {
      case PlotType.Keyword: {
        this.drawKeywordFocus(i);
        break;
      }
      case PlotType.Chrf: {
        this.drawChrfFocus(i);
        break;
      }
      case PlotType.SourceID: {
        this.drawSourceIDFocus(i);
        break;
      }
      case PlotType.Embedding: {
        this.drawEmbeddingFocus(i);
        break;
      }
      case PlotType.Familiarity: {
        this.drawFamiliarityFocus(i);
        break;
      }
      case PlotType.UnitTest: {
        this.drawUnitTestFocus(i);
        break;
      }
    }
  };

  /**
   * Update the thumbnail plot based on the curPlotType
   * @param i Index of the thumbnail
   */
  updateThumbnailPlot = (i: number) => {
    this.thumbnailSVGs[i].select('g.content').selectAll('*').remove();
    switch (this.curPlotTypes.thumbnails[i]) {
      case PlotType.Keyword: {
        this.drawKeywordThumbnail(i);
        break;
      }
      case PlotType.Chrf: {
        this.drawChrfThumbnail(i);
        break;
      }
      case PlotType.SourceID: {
        this.drawSourceIDThumbnail(i);
        break;
      }
      case PlotType.Embedding: {
        this.drawEmbeddingThumbnail(i);
        break;
      }
      case PlotType.Familiarity: {
        this.drawFamiliarityThumbnail(i);
        break;
      }
      case PlotType.UnitTest: {
        this.drawUnitTestThumbnail(i);
        break;
      }
    }
  };

  /**
   * Initialize the plots
   */
  initVis = () => {
    // Draw the focus plots
    for (const [i, _] of this.curPlotTypes.thumbnails.entries()) {
      this.updateFocusPlot(i);
    }

    // Draw the thumbnails
    for (const [i, _] of this.curPlotTypes.thumbnails.entries()) {
      this.updateThumbnailPlot(i);
    }
  };

  /**
   * Temporarily draw a box in the focus plot
   */
  drawFocusBox = (position: number) => {
    // Locate the correct focus svg
    const content = this.focusSVGs[position].select('.content');
    const curType = this.curPlotTypes.thumbnails[position];

    content
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.focusSize.width)
      .attr('height', this.focusSize.height)
      .style('fill', plotColorMap.get(curType)!);
  };

  /**
   * Temporarily draw a box in the thumbnail plot
   * @param position
   */
  drawThumbnailBox = (position: number) => {
    const content = this.thumbnailSVGs[position].select('.content');
    content
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.thumbnailSize.width)
      .attr('height', this.thumbnailSize.height)
      .style('fill', plotColorMap.get(this.curPlotTypes.thumbnails[position])!)
      .style('stroke', 'white');
  };

  /**
   * Draw the embedding plot at the focus vis position
   */
  drawEmbeddingFocus = (position: number) => {
    // Update the label
    this.focusLabel.text(plotLabelMap.get(PlotType.Embedding)!);
  };

  /**
   * Draw the keyword plot at the focus vis position
   */
  drawKeywordFocus = (position: number) => {
    // Update the vis
    this.drawFocusBox(position);
  };

  /**
   * Draw the embedding thumbnail at one position
   * @param position Order of this thumbnail (0 to 4)
   */
  drawEmbeddingThumbnail = (position: number) => {
    // Update the label
    this.thumbnailLabels[position].text(plotLabelMap.get(PlotType.Embedding)!);
  };

  /**
   * Draw the Keyword thumbnail at one position
   * @param position Order of this thumbnail (0 to 4)
   */
  drawKeywordThumbnail = (position: number) => {
    // Update the label
    this.thumbnailLabels[position].text(plotLabelMap.get(PlotType.Keyword)!);
  };

  /**
   * Event handler for clicking on the thumbnail
   * @param e Mouse event
   * @param i Index of the thumbnail
   */
  thumbnailClicked = (e: MouseEvent, i: number, showAnimation = false) => {
    if (this.curSelectedThumbnailID === i) return;

    // Update the focus view
    const newFocusType = this.curPlotTypes.thumbnails[i];
    this.curPlotTypes.focus = newFocusType;

    const drawNewView = () => {
      this.curSelectedThumbnailID = this.curPlotTypes.thumbnails.indexOf(
        this.curPlotTypes.focus
      );
      this.focusLabel.text(plotLabelMap.get(newFocusType)!);

      // Update the label
      this.mySetViewUpdated();
    };

    // Play animation when swapping the plots
    if (showAnimation) {
      const thumbnailNode = this.thumbnailSVGs[i].node() as HTMLElement;
      const thumbnailCloneNode = thumbnailNode.cloneNode(true) as HTMLElement;
      const thumbnailClone = d3.select(thumbnailCloneNode);
      document.querySelector('body')!.appendChild(thumbnailCloneNode);

      // Get the initial position
      const startBBox = thumbnailNode.getBoundingClientRect();
      // Get the ending position
      const endBBox = (
        this.focusSVGs[this.curSelectedThumbnailID].node() as HTMLElement
      ).getBoundingClientRect();

      // Fix the width and height and put the element at the end position
      const xScale = endBBox.width / startBBox.width;
      const yScale = endBBox.height / startBBox.height;
      const xDelta = endBBox.x - startBBox.x;
      const yDelta = endBBox.y - startBBox.y;

      thumbnailClone
        .style('position', 'absolute')
        .attr('preserveAspectRatio', 'none')
        .style('top', `${startBBox.y}px`)
        .style('left', `${startBBox.x}px`)
        .style('width', `${startBBox.width}px`)
        .style('height', `${startBBox.height}px`)
        .style('transform-origin', 'top left')
        .style('z-index', 3)
        .style('opacity', 1);

      thumbnailClone
        .transition('move')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style(
          'transform',
          `translate(${xDelta}px, ${yDelta}px) scale(${xScale}, ${yScale})`
        )
        .style('opacity', 0)
        .on('end', () => {
          // Update the focus view
          thumbnailClone.remove();
          drawNewView();
        });
    }

    if (!showAnimation) {
      drawNewView();
    }
  };

  /**
   * Event handler for clicking the edit button
   */
  editClicked = () => {
    this.editMode = !this.editMode;
    this.mySetViewUpdated();
  };

  /**
   * Event handler for clicking the back icon on the header
   */
  backClicked = () => {
    this.challengeStoreValue.selectedFileName = '';
    this.challengeStore.set(this.challengeStoreValue);
  };

  /**
   * Event handler for input change in the search bar
   */
  searchKeyChanged = (e: InputEvent | null) => {
    let searchKey: string;

    if (e !== null) {
      searchKey = d3
        .select(e.target as HTMLElement)
        .property('value') as string;
    } else {
      searchKey = '';
    }

    this.filters.search = [];
    this.filterSearchMatchIndexes = new Map<number, number[][]>();

    // Search all sentences to find matches
    if (searchKey !== '') {
      const searchKeyLower = searchKey.toLowerCase();

      let noMatching = true;
      for (const [i, source] of this.challengeData.source.entries()) {
        const matchIndexes = [
          ...source.matchAll(new RegExp(searchKeyLower, 'gi'))
        ].map(a => [a.index!, searchKeyLower.length]);

        if (matchIndexes.length !== 0) {
          this.filters.search.push(i);
          this.filterSearchMatchIndexes.set(i, matchIndexes);
          noMatching = false;
        }
      }

      if (noMatching) {
        // Because we assume to select all indexes when the array is empty, we
        // need to fake it with some invalid index to has length > 0 to show
        // empty results in the sentence view
        this.filters.search = [-1];
      }
    }

    this.syncFilters();
    this.mySetViewUpdated();
  };

  /**
   * Clear the search filter
   */
  resetSearchKey = () => {
    const searchBar = this.component.querySelector(
      '.search-bar-input'
    ) as HTMLInputElement;
    searchBar.value = '';

    this.searchKeyChanged(null);
  };

  /**
   * Helper function to display the translation source. It highlights the
   * highlighted words in the sentence
   * @param sentence Translation sentence
   */
  displaySource = (sentence: TranslateSentence) => {
    const source = sentence.source.replaceAll('iframe', 'REDACTED');
    if (sentence.highlightRange === undefined) {
      return source;
    } else {
      const result = [];
      result.push(`${source.substring(0, sentence.highlightRange[0][0])}`);

      let iLast = 0;
      for (const [
        i,
        [start, span, type]
      ] of sentence.highlightRange.entries()) {
        iLast = start + span;
        const curClass = type === 1 ? 'highlight-search' : 'highlight-keyword';
        result.push(
          `<span class="${curClass}">${source.substring(
            start,
            start + span
          )}</span>`
        );

        if (i === sentence.highlightRange.length - 1) {
          // Add the trailing block
          result.push(`${source.substring(iLast)}`);
        } else {
          // Add the block up to next occurrence
          result.push(
            `${source.substring(iLast, sentence.highlightRange[i + 1][0])}`
          );
        }
      }
      return result.join('');
    }
  };

  keywordClicked = (keyword: Keyword) => {
    if (this.curSelectedKeywords.has(keyword.word)) {
      this.curSelectedKeywords.delete(keyword.word);
    } else {
      this.curSelectedKeywords.add(keyword.word);
    }

    // Update the keyword selection filtering
    this.filters.keyword = [];
    this.filterKeywordMatchIndexes = new Map<number, number[][]>();

    if (this.curSelectedKeywords.size !== 0) {
      for (const [i, source] of this.challengeData.source.entries()) {
        for (const keyword of this.curSelectedKeywords) {
          const searchKeyLower = keyword.toLowerCase();
          const matchIndexes = [
            ...source.matchAll(new RegExp(searchKeyLower, 'gi'))
          ].map(a => [a.index!, searchKeyLower.length]);

          if (matchIndexes.length !== 0) {
            this.filters.keyword.push(i);
            this.filterKeywordMatchIndexes.set(i, matchIndexes);
          }
        }
      }
    }

    this.syncFilters();
    this.mySetViewUpdated();
  };

  /**
   * Clear the keyword filtering
   */
  resetKeyword = () => {
    this.curSelectedKeywords.clear();

    // Update the keyword selection filtering
    this.filters.keyword = [];
    this.filterKeywordMatchIndexes = new Map<number, number[][]>();

    this.syncFilters();
    this.mySetViewUpdated();
  };

  filterHelperMouseenter = (e: MouseEvent, content = 'filter') => {
    switch (content) {
      case 'filter': {
        this.tooltipStoreValue.html =
          'Interact the tool to apply filters. For example, you can brush the\
       timeline to filter sentences by dates. Or you can click keywords to\
       choose sentences that include certain keywords.';
        break;
      }

      case 'keyword': {
        this.tooltipStoreValue.html =
          'List of most representative keywords in this set. Keywords are\
          sorted by representativeness: darker background means the word is\
          more representative.';
        break;
      }

      case 'embedding': {
        this.tooltipStoreValue.html =
          'Position of each sample in the semantic embedding space.';
        break;
      }

      case 'chrf': {
        this.tooltipStoreValue.html =
          'Distribution of ChrF scores from training samples. Higher score\
          suggests better translation quality.';
        break;
      }

      case 'familiarity': {
        this.tooltipStoreValue.html =
          'Distribution of the familiarity scores from log samples. Higher\
          value indicates closer distance to the training distribution.';
        break;
      }

      case 'sourceid': {
        this.tooltipStoreValue.html =
          'Distribution of the source apps of translation requests.';
        break;
      }

      case 'test': {
        this.tooltipStoreValue.html =
          'Distribution of sentences that are also in other challenge sets.';
        break;
      }
    }

    const element = e.currentTarget as HTMLElement;
    const elementBBox = element.getBoundingClientRect();

    this.tooltipStoreValue.show = true;
    this.tooltipStoreValue.top = elementBBox.y;
    this.tooltipStoreValue.left = elementBBox.x + elementBBox.width / 2;
    this.tooltipStoreValue.maxWidth = 260;
    this.tooltipStore.set(this.tooltipStoreValue);
  };

  filterHelperMouseleave = (e: MouseEvent) => {
    this.tooltipStoreValue.show = false;
    this.tooltipStore.set(this.tooltipStoreValue);
  };

  /**
   * Remove the filtering if its tag is clicked
   * @param tag Current filter tag
   */
  tagCloseClicked = (tag: FilterTag) => {
    switch (tag.type) {
      case FilterType.SourceID: {
        this.resetSourceIDPlots();
        break;
      }
      case FilterType.Chrf: {
        this.resetChrfPlots();
        break;
      }
      case FilterType.Date: {
        this.timeline.brushClear();
        break;
      }
      case FilterType.Familiarity: {
        this.resetFamiliarityPlots();
        break;
      }
      case FilterType.Keyword: {
        this.resetKeyword();
        break;
      }
      case FilterType.OtherSet: {
        this.resetUnitTestPlots();
        break;
      }
      case FilterType.Search: {
        this.resetSearchKey();
        break;
      }
    }
  };

  headerMouseenter = (e: MouseEvent, header: Header) => {
    let message = '';

    switch (header.key) {
      case HeaderKey.chrf: {
        message = 'Average of sentence-level ChrF scores on the training data.';
        break;
      }
      case HeaderKey.trainCount: {
        message = 'Number of training samples in this challenge set';
        break;
      }
      case HeaderKey.logCount: {
        message = 'Number of log samples in this challenge set';
        break;
      }
      case HeaderKey.familiarity: {
        message =
          "Likelyhood of seeing a usage log sample under the training data's distributition";
        break;
      }
      case HeaderKey.trainLogRatio: {
        message = 'Percentage of all samples that are from the training data.';
      }
    }
    this.tooltipStoreValue.html = message;
    const element = e.currentTarget as HTMLElement;
    const elementBBox = element.querySelector('span')!.getBoundingClientRect();

    this.tooltipStoreValue.show = true;
    this.tooltipStoreValue.top = elementBBox.y;
    this.tooltipStoreValue.maxWidth = 200;
    this.tooltipStoreValue.left = elementBBox.x + elementBBox.width / 2;
    this.tooltipStore.set(this.tooltipStoreValue);
  };

  headerMouseleave = (e: MouseEvent, header: Header) => {
    this.tooltipStoreValue.show = false;
    this.tooltipStore.set(this.tooltipStoreValue);
  };

  exportClicked = () => {
    const exportObject: {
      source: string[];
      translation: string[];
    } = {
      source: [],
      translation: []
    };

    for (const sentence of this.curSentences) {
      exportObject.source.push(sentence.source);
      exportObject.translation.push(sentence.hyp);
    }

    downloadJSON(
      exportObject,
      null,
      `challenge-set-${this.challengeSet.displayName}.json`
    );
  };

  exportMouseEnter = (e: MouseEvent) => {
    this.tooltipStoreValue.html =
      'Download filtered (or all if no filters) source-translation pairs.';
    const element = e.currentTarget as HTMLElement;
    const elementBBox = element.getBoundingClientRect();

    this.tooltipStoreValue.show = true;
    this.tooltipStoreValue.top = elementBBox.y;
    this.tooltipStoreValue.maxWidth = 200;
    this.tooltipStoreValue.left = elementBBox.x + elementBBox.width / 2;
    this.tooltipStore.set(this.tooltipStoreValue);
  };

  exportMouseLeave = (e: MouseEvent) => {
    this.tooltipStoreValue.show = false;
    this.tooltipStore.set(this.tooltipStoreValue);
  };

  deleteClicked = (e: MouseEvent, sentence: TranslateSentence) => {
    e.preventDefault();
    e.stopPropagation();

    const curIndex = this.curSentences.indexOf(sentence);
    this.curSentences.splice(curIndex, 1);

    // Remove this sentence from the challenge set
    const setIndex = this.challengeData.source.indexOf(sentence.source);
    this.challengeData.source_id.splice(setIndex, 1);
    this.challengeData.chrf.splice(setIndex, 1);
    this.challengeData.date.splice(setIndex, 1);
    this.challengeData.familiarity.splice(setIndex, 1);
    this.challengeData.hyp.splice(setIndex, 1);
    this.challengeData.source.splice(setIndex, 1);
    this.challengeData.train.splice(setIndex, 1);
    this.challengeData.x.splice(setIndex, 1);
    this.challengeData.y.splice(setIndex, 1);

    // Adjust filter indexes
    const removeFilterIndex = (indexes: number[]) => {
      for (let i = indexes.length - 1; i >= 0; i--) {
        if (indexes[i] > setIndex) {
          indexes[i] -= 1;
        } else if (indexes[i] === setIndex) {
          indexes.splice(i, 1);
        }
      }
    };

    let k: keyof Filters;
    for (k in this.filters) {
      removeFilterIndex(this.filters[k]);
    }

    this.mySetViewUpdated();
  };
}

/**
 * Download a JSON file
 * @param {any} object
 * @param {HTMLElement | null} [dlAnchorElem]
 * @param {string} [fileName]
 */
export const downloadJSON = (
  object: object,
  dlAnchorElem: HTMLElement | null = null,
  fileName = 'download.json'
) => {
  const dataStr =
    'data:text/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify(object));

  // Create dlAnchor if it is not given
  let myDlAnchorElem = dlAnchorElem;
  let needToRemoveAnchor = false;

  if (dlAnchorElem === null) {
    myDlAnchorElem = document.createElement('a');
    myDlAnchorElem.style.display = 'none';
    needToRemoveAnchor = true;
  }

  myDlAnchorElem?.setAttribute('href', dataStr);
  myDlAnchorElem?.setAttribute('download', `${fileName}`);
  myDlAnchorElem?.click();

  if (needToRemoveAnchor) {
    myDlAnchorElem?.remove();
  }
};
