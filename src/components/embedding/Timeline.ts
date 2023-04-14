// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { config } from '../../config';
import d3 from '../../utils/d3-import';
import type { Padding, DateCount } from 'src/CustomTypes';
import {
  getTooltipStoreDefaultValue,
  getTimelineStoreDefaultValue
} from '../../store';
import type { TooltipStoreValue, TimelineStoreValue } from '../../store';
import type { Writable } from 'svelte/store';

export class Timeline {
  component: HTMLElement;
  svg: d3.Selection<Element, unknown, null, undefined>;
  brush: d3.BrushBehavior<unknown> | null = null;
  dateCount: DateCount[] | null;

  padding: Padding;
  xAxisHeight = 15;
  width: number;
  height: number;
  bandwidth = 0;
  transformK = 1.0;

  xScale: d3.ScaleTime<number, number, never> | null = null;
  orgXScale: d3.ScaleTime<number, number, never> | null = null;
  xScaleBand: d3.ScaleBand<string> | null = null;
  yScale: d3.ScaleLinear<number, number, never> | null = null;

  xAxis: d3.Axis<Date | d3.NumberValue> | null = null;
  brushSelection: number[] | null = null;

  tooltipStore: Writable<TooltipStoreValue>;
  tooltipStoreValue: TooltipStoreValue;

  timelineStore: Writable<TimelineStoreValue>;
  timelineStoreValue: TimelineStoreValue;

  constructor({
    component,
    tooltipStore,
    timelineStore,
    padding,
    dateCount
  }: {
    component: HTMLElement;
    tooltipStore: Writable<TooltipStoreValue>;
    timelineStore: Writable<TimelineStoreValue>;
    padding?: Padding;
    dateCount?: DateCount[];
  }) {
    this.component = component;

    if (dateCount) {
      this.dateCount = dateCount;
    } else {
      this.dateCount = null;
    }

    // Initialize the svg
    this.svg = d3.select(this.component).select('svg.timeline-svg');
    this.svg
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewbox', '0 0 600 60')
      .attr('preserveAspectRatio', 'none');

    if (padding) {
      this.padding = padding;
    } else {
      this.padding = { top: 20, bottom: 7, left: 10, right: 10 };
    }

    const svgBBox = (this.svg.node() as HTMLElement).getBoundingClientRect();
    this.width = svgBBox.width - this.padding.left - this.padding.right;
    this.height = svgBBox.height - this.padding.top - this.padding.bottom;

    // Initialize stores
    this.tooltipStore = tooltipStore;
    this.tooltipStoreValue = getTooltipStoreDefaultValue();

    this.timelineStore = timelineStore;
    this.timelineStoreValue = getTimelineStoreDefaultValue();

    this.subscribeStores();

    // Initialize the content group
    this.svg
      .append('g')
      .attr('class', 'content')
      .attr(
        'transform',
        `translate(${this.padding.left}, ${this.padding.top})`
      );
    this.initDensityPlot();
  }

  /**
   * Subscribe to all used stores
   */
  subscribeStores = () => {
    this.tooltipStore.subscribe(value => {
      this.tooltipStoreValue = value;
    });

    this.timelineStore.subscribe(value => {
      this.timelineStoreValue = value;
    });
  };

  /**
   * Draw the training data density plot in the background.
   */
  initDensityPlot = async () => {
    let dateData: DateCount[];

    if (this.dateCount) {
      dateData = this.dateCount;
    } else {
      // The density data array is an (w, w) array with values between 0 and 1
      const timelineData: number[][] | undefined = await d3.json(
        `${import.meta.env.BASE_URL}data/daily-count-202203.json`
      );

      if (timelineData === undefined) {
        console.error('Cannot load density data.');
        return;
      }

      // Make sure dates are sorted
      dateData = timelineData
        .map(d => {
          const datePattern = /(\d{4})(\d{2})(\d{2})/;
          return {
            date: new Date(String(d[0]).replace(datePattern, '$1-$2-$3')),
            count: d[1]
          };
        })
        .sort((a, b) => (a.date < b.date ? -1 : 1));
    }

    // Create date scales
    const content = this.svg.select('g.content');

    // Add a day at the beginning and a day at the end
    const dateExtent = d3.extent(dateData, x => x.date) as Date[];
    dateExtent[0] = new Date(
      new Date(dateExtent[0].valueOf()).setDate(dateExtent[0].getDate() - 1)
    );
    dateExtent[1] = new Date(
      new Date(dateExtent[1].valueOf()).setDate(dateExtent[1].getDate() + 1)
    );

    // Create a multi-scale x axis for dates
    // const formatDay = d3.utcFormat('%a %d'),
    //   formatWeek = d3.utcFormat('%a %d'),
    //   formatMonth = d3.utcFormat('%B'),
    //   formatYear = d3.utcFormat('%Y');

    // const multiTimeFormat = (date: Date | d3.NumberValue) => {
    //   const curDate = date as Date;
    //   let curFormat = formatYear;
    //   if (d3.timeMonth(curDate) < date) {
    //     if (d3.timeWeek(curDate) < date) {
    //       curFormat = formatDay;
    //     } else {
    //       curFormat = formatWeek;
    //     }
    //   } else {
    //     if (d3.timeYear(curDate) < date) {
    //       curFormat = formatMonth;
    //     } else {
    //       curFormat = formatYear;
    //     }
    //   }
    //   return curFormat(curDate);
    // };

    // Draw the density plot
    const densityGroup = content.append('g').attr('class', 'density-group');
    this.xScale = d3.scaleUtc().domain(dateExtent).range([0, this.width]);
    this.orgXScale = d3.scaleUtc().domain(dateExtent).range([0, this.width]);

    // Create the domain array for scaleBand()
    const bandDomains: string[] = [];
    for (
      let curDate = dateExtent[0];
      curDate <= dateExtent[1];
      curDate.setDate(curDate.getDate() + 1)
    ) {
      bandDomains.push(curDate.toDateString());
    }

    this.xScaleBand = d3
      .scaleBand()
      .domain(bandDomains)
      .range([0, this.width])
      .padding(0.3);

    this.yScale = d3
      .scaleLinear()
      .domain([0, d3.max(dateData, x => x.count) as number])
      .range([this.height - this.xAxisHeight, 0]);

    this.bandwidth = this.xScaleBand!.bandwidth();
    densityGroup
      .selectAll('rect.density-bar')
      .data(dateData)
      .join('rect')
      .attr('class', 'density-bar')
      .attr('x', d => this.xScale!(d.date) - this.bandwidth / 2)
      .attr('y', d => this.yScale!(d.count))
      .attr('width', this.bandwidth)
      .attr(
        'height',
        d => this.height - this.xAxisHeight - this.yScale!(d.count)
      );

    // Create a background clone
    densityGroup
      .clone(true)
      .lower()
      .attr('class', 'density-group-clone')
      .selectAll('rect.density-bar')
      .data(dateData);

    // Draw the x axis
    this.xAxis = d3.axisBottom(this.xScale);
    const axisGroup = content
      .append('g')
      .attr('class', 'x-axis-group')
      .attr('transform', `translate(0, ${this.height - this.xAxisHeight})`)
      .style('cursor', 'inherent')
      .call(this.xAxis);

    // Remove labels that are outside the main axis path
    const axisPath = axisGroup.select('path.domain');
    const axisPathBBox = (
      axisPath.node() as HTMLElement
    ).getBoundingClientRect();
    axisGroup.selectAll('g.tick').each((d, i, g) => {
      const curElem = g[i] as HTMLElement;
      const curBBox = curElem.getBoundingClientRect();
      if (curBBox.x < axisPathBBox.x) {
        curElem.remove();
      }
      if (curBBox.x + curBBox.width > axisPathBBox.x + axisPathBBox.width) {
        curElem.remove();
      }
    });

    // Add zooming
    const zoom = d3
      .zoom()
      .scaleExtent([1, 4])
      .translateExtent([
        [0, 0],
        [this.width, this.height]
      ])
      .extent([
        [0, 0],
        [this.width, this.height]
      ])
      .on('zoom', this.zoomed);

    this.svg.call(zoom);

    // Listen to double click to reset zoom
    this.svg.on('dblclick.zoom', null);
    this.svg.on('dblclick', () => {
      this.svg
        .transition('reset')
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(selection => zoom.transform(selection, d3.zoomIdentity));
      this.removeOutOfBoundAxisLabels(axisGroup);
    });
    this.svg.style('cursor', 'default');

    // Add brushing
    this.brush = d3
      .brushX()
      .extent([
        [this.padding.left, 0],
        [
          this.width + this.padding.left,
          this.height - this.xAxisHeight + this.padding.top - 1
        ]
      ])
      .on('brush', this.brushed)
      .on('end', this.brushEnd);

    const brushGroup = this.svg
      .append('g')
      .attr('class', 'timeline-brush-group')
      .call(this.brush);

    // Listen to mouse move events on top of the brush group
    // Show the tooltip
    brushGroup.on('mousemove', (e: MouseEvent) => {
      const brushBBox = (
        brushGroup.node()! as SVGElement
      ).getBoundingClientRect();

      const mouseX = e.clientX - brushBBox.x;
      const dateFormatter = d3.utcFormat('%B %d (%a), %Y');
      const countFormatter = d3.format('.2f');

      this.svg
        .select('.density-group')
        .selectAll<SVGElement, DateCount>('rect.density-bar')
        .classed('mouseover', d => {
          const curX = this.xScale!(d.date);
          let mouseover = false;
          if (
            mouseX - (this.xScaleBand!.bandwidth() * this.transformK) / 2 <
              curX &&
            mouseX + (this.xScaleBand!.bandwidth() * this.transformK) / 2 > curX
          ) {
            mouseover = true;
          } else {
            mouseover = false;
          }

          // Show the tooltip
          if (mouseover) {
            if (this.dateCount) {
              this.tooltipStoreValue.html = `<div class="tb"><span class="date">\
              ${dateFormatter(d.date)}</span>\
              <span class="count">${d.count} \
              requests</span>\
              </div>
            `;
            } else {
              this.tooltipStoreValue.html = `<div class="tb"><span class="date">\
              ${dateFormatter(d.date)}</span>\
              <span class="count">${countFormatter((d.count * 100) / 1e6)}M \
              requests</span>\
              </div>
            `;
            }

            this.tooltipStoreValue.show = true;
            this.tooltipStoreValue.top = brushBBox.y;
            this.tooltipStoreValue.left = curX + brushBBox.x;
            this.tooltipStore.set(this.tooltipStoreValue);
          }

          return mouseover;
        });
    });

    // Cancel the tooltip on mouseleave
    brushGroup.on('mouseleave', () => {
      this.svg
        .select('.density-group')
        .selectAll<SVGElement, DateCount>('rect.density-bar')
        .classed('mouseover', false);

      this.tooltipStoreValue.show = false;
      this.tooltipStore.set(this.tooltipStoreValue);
    });

    brushGroup.on('mousedown', (e: MouseEvent) => {
      // Avoid triggering the zoom's dragging
      e.stopPropagation();
    });

    // Initialize the brush selection to select the first two days
    // We use the `dateData` (date count json) to determine the start and
    // end date
    // const dateFormatter = d3.utcFormat('%Y%m%d');
    // for (const d of dateData) {
    //   this.timelineStoreValue.allDates.push(d.date);
    // }
    // this.timelineStoreValue.dateFormatter = dateFormatter;
    // const day1 = this.timelineStoreValue.allDates[0];
    // const day2 = this.timelineStoreValue.allDates[1];
    // this.timelineStoreValue.selectedDates = [
    //   dateFormatter(day1),
    //   dateFormatter(day2)
    // ];
    // this.timelineStore.set(this.timelineStoreValue);

    // // Also initialize the timeline store
    // brushGroup.call(selection => {
    //   brush.move(selection, [
    //     this.padding.left +
    //       this.xScale!(day1) -
    //       this.xScaleBand!.bandwidth() / 2 -
    //       3,
    //     this.padding.left +
    //       this.xScale!(day2) +
    //       this.xScaleBand!.bandwidth() / 2 +
    //       3
    //   ]);
    // });
  };

  updateDateCount = (newDateCount: DateCount[]) => {
    const content = this.svg.select('g.content');
    const densityGroup = content.select('g.density-group');
    const trans = d3
      .transition('update')
      .duration(200) as unknown as d3.Transition<
      d3.BaseType,
      d3.Bin<number, number>,
      d3.BaseType,
      unknown
    >;

    densityGroup
      .selectAll('rect.density-bar')
      .data(newDateCount)
      .attr('x', d => this.xScale!(d.date) - this.bandwidth / 2)
      .attr('width', this.bandwidth)
      .transition(trans)
      .attr('y', d => this.yScale!(d.count))
      .attr(
        'height',
        d => this.height - this.xAxisHeight - this.yScale!(d.count)
      );
  };

  zoomed = (event: d3.D3ZoomEvent<Element, d3.BaseType>) => {
    const transform = event.transform;
    const content = this.svg.select('g.content');
    const axisGroup = content.select<SVGGElement>('.x-axis-group');
    this.transformK = transform.k;

    // Cancel the tooltip if it is shown
    this.svg
      .select('.density-group')
      .selectAll<SVGElement, DateCount>('rect.density-bar')
      .classed('mouseover', false);

    this.tooltipStoreValue.show = false;
    this.tooltipStore.set(this.tooltipStoreValue);

    // Update the scale and axis
    this.xScale = transform.rescaleX(this.orgXScale!);
    this.xAxis!.scale(this.xScale);
    axisGroup.call(this.xAxis!);

    // Update the density bars
    this.bandwidth = this.xScaleBand!.bandwidth() * transform.k;
    const densityGroup = content.select('.density-group');
    densityGroup
      .selectAll<SVGAElement, DateCount>('rect.density-bar')
      .attr('x', d => this.xScale!(d.date) - this.bandwidth / 2)
      .attr('width', this.bandwidth);

    const densityGroupClone = content.select('.density-group-clone');
    densityGroupClone
      .selectAll<SVGAElement, DateCount>('rect.density-bar')
      .attr('x', d => this.xScale!(d.date) - this.bandwidth / 2)
      .attr('width', this.bandwidth);

    this.removeOutOfBoundAxisLabels(axisGroup);

    // Change cursor to drag when zoomed
    if (transform.k > 1) {
      this.svg.style('cursor', 'move');
    } else {
      this.svg.style('cursor', 'default');
    }

    // Update the selected dates
    if (this.brushSelection !== null) {
      this.brushSelectionChanged();
    }
  };

  /**
   * Update the date bar format and timeline store
   */
  brushSelectionChanged = () => {
    const selectedDates: Date[] = [];

    if (this.brushSelection !== null) {
      // Color bars and collect dates
      this.svg
        .select('.density-group')
        .selectAll<SVGElement, DateCount>('rect.density-bar')
        .classed('selected', d => {
          const curX = this.xScale!(d.date);
          if (
            curX >= this.brushSelection![0] &&
            curX < this.brushSelection![1]
          ) {
            selectedDates.push(d.date);
            return true;
          } else {
            return false;
          }
        });
    }

    // Update the timeline store with new selected dates
    const formatter = d3.utcFormat('%Y%m%d');
    const selectedDateStrings = selectedDates.map(formatter);
    if (
      !setsAreSame(
        new Set(selectedDateStrings),
        new Set(this.timelineStoreValue.selectedDates)
      )
    ) {
      this.timelineStoreValue.selectedDates = selectedDateStrings;
      this.timelineStore.set(this.timelineStoreValue);
    }
  };

  /**
   * Event handler for the brush event
   */
  brushed = (event: d3.D3BrushEvent<d3.BaseType>) => {
    if (event.selection === null) return;

    this.brushSelection = (event.selection as number[]).map(
      d => d - this.padding.left
    );

    // Cancel the tooltip
    this.svg
      .select('.density-group')
      .selectAll<SVGElement, DateCount>('rect.density-bar')
      .classed('mouseover', false);

    this.tooltipStoreValue.show = false;
    this.tooltipStore.set(this.tooltipStoreValue);

    this.brushSelectionChanged();
  };

  /**
   * Event handler for the brush clear event
   */
  brushEnd = (event: d3.D3BrushEvent<d3.BaseType>) => {
    if (event.selection === null) {
      this.svg
        .select('.density-group')
        .selectAll<SVGElement, DateCount>('rect.density-bar')
        .classed('selected', false);

      this.brushSelection = null;
      this.brushSelectionChanged();
    }
  };

  /**
   * Clear the brush
   */
  brushClear = () => {
    if (this.brush) {
      this.svg.select<SVGGElement>('g.timeline-brush-group').call(g => {
        this.brush!.move(g, null);
      });
    }
  };

  removeOutOfBoundAxisLabels = (
    axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>
  ) => {
    const axisPath = axisGroup.select('path.domain');
    const axisPathBBox = (
      axisPath.node() as HTMLElement
    ).getBoundingClientRect();
    axisGroup.selectAll('g.tick').each((d, i, g) => {
      const curElem = g[i] as HTMLElement;
      const curBBox = curElem.getBoundingClientRect();
      if (curBBox.x < axisPathBBox.x) {
        curElem.remove();
      }
      if (curBBox.x + curBBox.width > axisPathBBox.x + axisPathBBox.width) {
        curElem.remove();
      }
    });
  };
}

const setsAreSame = (set1: Set<unknown>, set2: Set<unknown>) => {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  for (const item of set2) {
    if (!set1.has(item)) return false;
  }
  return true;
};
