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
  Header
} from '../../CustomTypes';
import { HeaderKey } from '../../CustomTypes';
import {
  getTooltipStoreDefaultValue,
  getChallengeStoreDefaultValue
} from '../../store';
import type { TooltipStoreValue, ChallengeStoreValue } from '../../store';
import type { Writable } from 'svelte/store';

export class TableView {
  component: HTMLElement;
  myTableViewUpdated: () => void;
  challengeSets: ChallengeSet[];
  challengeSetDataMap: Map<string, ChallengeData>;
  svgSize: Size;

  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue;

  challengeStore: Writable<ChallengeStoreValue>;
  challengeStoreValue: ChallengeStoreValue;

  // Detail row data
  selectedSetName = '';
  selectedSetSentences: TranslateSentence[] = [];
  selectedSetKeywords: Keyword[] = [];

  constructor({
    component,
    myTableViewUpdated,
    challengeSets,
    challengeSetDataMap,
    tooltipStore,
    challengeStore
  }: {
    component: HTMLElement;
    myTableViewUpdated: () => void;
    challengeSets: ChallengeSet[];
    challengeSetDataMap: Map<string, ChallengeData>;
    tooltipStore: Writable<TooltipStoreValue>;
    challengeStore: Writable<ChallengeStoreValue>;
  }) {
    this.component = component;
    this.myTableViewUpdated = myTableViewUpdated;
    this.challengeSets = challengeSets;
    this.challengeSetDataMap = challengeSetDataMap;

    // Initialize the store values
    this.tooltipStore = tooltipStore;
    this.tooltipStoreValue = getTooltipStoreDefaultValue();

    this.challengeStore = challengeStore;
    this.challengeStoreValue = getChallengeStoreDefaultValue();

    // Subscribe stores
    this.subscribeStores();

    // Initialize the height of in-row svg
    const svgBBox = (
      d3
        .select(this.component)
        .select('tr:not(.hide) .cell-svg')
        .node() as HTMLElement
    ).getBoundingClientRect();
    this.svgSize = {
      width: 50,
      height: svgBBox.height
    };

    // Draw the inline small figures
    this.drawRowHistograms('chrf', false);
    this.drawRowHistograms('familiarity', false);
    this.drawRowRatio();
    this.drawRowTrainCountBar();
    this.drawRowLogCountBar();

    // this.rowClicked(challengeSets[6]);
  }

  subscribeStores = () => {
    // Tooltip store => just update values
    this.tooltipStore.subscribe(value => {
      this.tooltipStoreValue = value;
    });

    // Challenge set store => redraw challenge dots when value changed
    this.challengeStore.subscribe(value => {
      this.challengeStoreValue = value;
    });
  };

  // Event handler when a user clicks a row. This function loads the
  // corresponding challenge set JSON file to populate samples
  rowClicked = (challengeSet: ChallengeSet) => {
    const randomGen = d3.randomUniform();

    if (challengeSet.fileName === this.selectedSetName) {
      this.selectedSetName = '';
    } else {
      this.selectedSetName = challengeSet.fileName;

      // Add 100 unique sentences (with translation) in the preview
      const existingSources: Set<string> = new Set();
      const curData = this.challengeSetDataMap.get(this.selectedSetName)!;
      this.selectedSetSentences = [];
      for (let i = 0; i < Math.min(curData.source.length, 100); i++) {
        if (
          !existingSources.has(curData.source[i]) &&
          curData.hyp[i] !== null
        ) {
          this.selectedSetSentences.push({
            source: curData.source[i],
            hyp: curData.hyp[i],
            showHyp: false
          });
          existingSources.add(curData.source[i]);
        }
      }

      // Populate the keywords
      const tempSelectedSetKeywords: Keyword[] = [];
      const MAX_KEYWORDS = 50;
      for (const [w, v] of curData.keywords) {
        tempSelectedSetKeywords.push({
          word: w,
          value: v
        });
      }

      this.selectedSetKeywords = tempSelectedSetKeywords.slice(0, MAX_KEYWORDS);

      // Figure out the color for each keyword
      const valueExtent = d3.extent(this.selectedSetKeywords, d => d.value) as [
        number,
        number
      ];
      const colorTScale = d3
        .scaleLinear()
        .domain(valueExtent)
        // .range([0.1, 0.6]);
        .range([0.005, 0.3]);

      for (const k of this.selectedSetKeywords) {
        k.color = d3.interpolateGreys(colorTScale(k.value));
        // k.color = d3.interpolateBlues(colorTScale(k.value));
      }

      // Sort the keywords based on their values
      this.selectedSetKeywords.sort((a, b) => b.value - a.value);
    }
    this.myTableViewUpdated();
  };

  /**
   * Draw the bar chart to indicate the training sample numbers in each
   * challenge set
   */
  drawRowTrainCountBar = () => {
    const table = d3.select(this.component).select('table.table');

    // Find the max count and create a linear scale
    const maxCount = d3.max(this.challengeSets, d => d.trainCount)!;
    const xScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([this.svgSize.width, 0]);

    // Draw the bars
    for (const c of this.challengeSets) {
      const curSVG = table.select(`#cell-train-count-${c.fileName}`);

      const content = curSVG.append('g').attr('class', 'content');

      // Background bar
      content
        .append('rect')
        .attr('class', 'count-bar-back train')
        .attr('width', this.svgSize.width)
        .attr('height', this.svgSize.height);

      // Front bar
      content
        .append('rect')
        .attr('class', 'count-bar-front train')
        .attr('x', xScale(c.trainCount))
        .attr('width', this.svgSize.width - xScale(c.trainCount))
        .attr('height', this.svgSize.height);
    }
  };

  /**
   * Draw the bar chart to indicate the log sample numbers in each challenge set
   */
  drawRowLogCountBar = () => {
    const table = d3.select(this.component).select('table.table');

    // Find the max count and create a linear scale
    const maxCount = d3.max(this.challengeSets, d => d.logCount)!;
    const xScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([this.svgSize.width, 0]);

    // Draw the bars
    for (const c of this.challengeSets) {
      const curSVG = table.select(`#cell-log-count-${c.fileName}`);

      const content = curSVG.append('g').attr('class', 'content');

      // Background bar
      content
        .append('rect')
        .attr('class', 'count-bar-back log')
        .attr('width', this.svgSize.width)
        .attr('height', this.svgSize.height);

      // Front bar
      content
        .append('rect')
        .attr('class', 'count-bar-front log')
        .attr('x', xScale(c.logCount))
        .attr('width', this.svgSize.width - xScale(c.logCount))
        .attr('height', this.svgSize.height);
    }
  };

  /**
   * Draw half pie charts to indicate the percentage of training data in each
   */
  drawRowRatio = () => {
    const table = d3.select(this.component).select('table.table');

    for (const c of this.challengeSets) {
      const ratio = c.trainLogRatio ? c.trainLogRatio : 0;
      const curSVG = table.select(`#cell-ratio-${c.fileName}`);

      // Shrink the svg width since we are drawing a small arc here
      curSVG.style('width', `${2 * this.svgSize.height}px`);

      // Generate the arcs
      const arc = d3.arc();

      const arcBackObj: d3.DefaultArcObject = {
        innerRadius: 0,
        outerRadius: this.svgSize.height,
        startAngle: Math.PI / 2,
        endAngle: (Math.PI * 3) / 2
      };

      const arcFrontObj: d3.DefaultArcObject = {
        innerRadius: 0,
        outerRadius: this.svgSize.height,
        startAngle: Math.PI / 2,
        endAngle: Math.PI / 2 + Math.PI * ratio
      };

      const content = curSVG
        .append('g')
        .attr('class', 'content')
        .attr(
          'transform',
          `rotate(180, ${this.svgSize.height}, ${this.svgSize.height / 2})`
        );

      content
        .append('path')
        .attr('transform', `translate(${this.svgSize.height}, 0)`)
        .attr('class', 'arc-back')
        .attr('d', arc(arcBackObj));

      content
        .append('path')
        .attr('transform', `translate(${this.svgSize.height}, 0)`)
        .attr('class', 'arc-front')
        .attr('d', arc(arcFrontObj));
    }
  };

  /**
   *  Draw all the histograms (chrf and familiarity) in the table
   * @param metric 'chrf' or 'familiarity'
   * @param topicSetOnly True if skip non-topic challenge sets
   */
  drawRowHistograms = (metric: string, topicSetOnly: boolean) => {
    const table = d3.select(this.component).select('table.table');

    for (const c of this.challengeSets) {
      if (topicSetOnly && c.type !== 'topic') continue;

      let values: number[] = [];
      if (metric === 'chrf') {
        values = this.challengeSetDataMap
          .get(c.fileName)!
          .chrf.filter((d): d is number => d !== null);
      } else if (metric === 'familiarity') {
        values = this.challengeSetDataMap
          .get(c.fileName)!
          .familiarity.filter((d): d is number => d !== null);
      } else {
        console.error('Unknown metric', metric);
        return;
      }

      const curSVG = table.select(`#cell-${metric}-${c.fileName}`);

      // Bin the data
      const binCount = 9;
      const bins = Array(binCount)
        .fill(0.0)
        .map((d, i) => (i + 1) * (1 / (binCount + 1)));
      const bin = d3.bin().domain([0, 1]).thresholds(bins);
      const buckets = bin(values);
      const counts = buckets.map(d => d.length);

      const content = curSVG.append('g').attr('class', 'content');

      if (metric === 'chrf' && values.length === 0) {
        content
          .selectAll('rect.hist-bar')
          .data([0])
          .join('rect')
          .attr('class', `hist-bar ${metric} missing`)
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', this.svgSize.width)
          .attr('height', this.svgSize.height);
        continue;
      }

      // Create scales
      const xScale = d3
        .scaleLinear()
        // For chrf and familiarity, the range is always [0, 1]
        .domain([0, 1])
        .range([0, this.svgSize.width]);

      const yScale = d3
        .scaleLinear()
        .domain([0, Math.max(...counts)])
        .range([this.svgSize.height, 0]);

      // Draw the bars
      const barWidth = xScale(0.1) - xScale(0);
      const leftMargin = 0.5;
      const rightMargin = 0.5;

      content
        .selectAll('rect.hist-bar')
        .data(buckets)
        .join('rect')
        .attr('class', `hist-bar ${metric}`)
        .attr('x', d => xScale(d.x0!) + leftMargin)
        .attr('y', d => yScale(d.length))
        .attr('width', Math.max(0, barWidth - leftMargin - rightMargin))
        .attr('height', d => this.svgSize.height - yScale(d.length));
    }
  };

  /**
   * Event handler for clicking the show detail button in one row
   * @param challengeSet Corresponding challenge set
   */
  showDetailClicked = (challengeSet: ChallengeSet) => {
    this.challengeStoreValue.selectedFileName = challengeSet.fileName;
    this.challengeStoreValue.challengeSet = challengeSet;
    this.challengeStoreValue.challengeData = this.challengeSetDataMap.get(
      challengeSet.fileName
    )!;
    this.challengeStore.set(this.challengeStoreValue);
  };

  headerMouseenter = (e: MouseEvent, header: Header) => {
    let message = '';

    switch (header.key) {
      case HeaderKey.chrf: {
        message =
          'Average of ChrF scores (translation quality) on the training data';
        break;
      }
      case HeaderKey.trainCount: {
        message = 'Number of all training samples in this challenge set';
        break;
      }
      case HeaderKey.logCount: {
        message = 'Number of all log samples in this challenge set';
        break;
      }
      case HeaderKey.familiarity: {
        message =
          "Likelyhood of seeing a usage log sample under the training data's distributition";
        break;
      }
      case HeaderKey.trainLogRatio: {
        message =
          'Percentage of training samples in this set (training and log samples)';
        break;
      }
      default: {
        return;
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
          'Most representative keywords in this set, sorted by their\
          representativeness. A darker background means the word is\
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
}
