'use strict';

import * as d3 from 'd3';
import Color from 'color';
import _ from 'lodash';

import { getCategoryColorFromString } from '~/util/color';
import { seconds_to_duration } from '~/util/time';
import { IEvent } from '~/util/interfaces';

const textColor = '#333';
const AFK_HATCH_COLOR = '#ff4d4f';

function create(container: HTMLElement) {
  // Clear element
  container.innerHTML = '';

  // Create svg canvas
  const svg = d3.select(container).append('svg');
  svg.attr('width', '100%').attr('height', '100px').attr('class', 'appsummary');
}

function set_status(container: HTMLElement, msg: string) {
  // Select svg canvas
  const svg_elem = container.querySelector('.appsummary');
  const svg = d3.select(svg_elem);
  svg_elem.innerHTML = '';

  svg
    .append('text')
    .attr('x', '0px')
    .attr('y', '25px')
    .text(msg)
    .attr('font-family', 'sans-serif')
    .attr('font-size', '20px')
    .attr('fill', '#999');
}

interface Entry {
  name: string;
  hovertext: string;
  duration: number;
  color?: string;
  colorSegments?: {
    color: string;
    duration: number;
    label?: string;
  }[];
  afkDuration?: number;
  colorKey?: string;
  link?: string;
}

function entryColor(app: Entry): string {
  return app.color || getCategoryColorFromString(app.colorKey || app.name);
}

function normalizedColorSegments(app: Entry, fallbackColor: string) {
  const segments = (app.colorSegments || [])
    .filter(segment => segment && segment.duration > 0 && segment.color)
    .map(segment => ({
      ...segment,
      duration: Number(segment.duration || 0),
    }));

  const segmentDuration = _.sumBy(segments, 'duration');
  const remainder = Math.max(0, Number(app.duration || 0) - segmentDuration);
  if (remainder > 0) {
    segments.push({
      color: fallbackColor,
      duration: remainder,
      label: 'Other',
    });
  }

  return segments;
}

function segmentTooltip(app: Entry, segments) {
  if (!segments || segments.length <= 1) {
    return '';
  }

  const segmentTotal = Math.max(Number(app.duration || 0), _.sumBy(segments, 'duration')) || 1;
  return (
    '\n\n' +
    segments
      .map(segment => {
        const percent = Math.round((segment.duration / segmentTotal) * 100);
        return `${segment.label || 'Other'}: ${percent}% (${seconds_to_duration(
          segment.duration
        )})`;
      })
      .join('\n')
  );
}

function normalizedAfkDuration(app: Entry): number {
  const duration = Number(app.duration || 0);
  return Math.max(0, Math.min(Number(app.afkDuration || 0), duration));
}

function afkTooltip(app: Entry) {
  const afkDuration = normalizedAfkDuration(app);
  if (afkDuration <= 0 || app.duration <= 0) {
    return '';
  }

  const percent = Math.round((afkDuration / app.duration) * 100);
  return `\nAFK time: ${seconds_to_duration(afkDuration)} (${percent}%)`;
}

function update(container: HTMLElement, apps: Entry[]) {
  // No apps, sets status to "No data"
  if (apps.length <= 0) {
    set_status(container, 'No data');
    return container;
  }

  const svg_elem = container.querySelector('.appsummary');
  svg_elem.innerHTML = '';
  const svg = d3.select(svg_elem);

  // Remove apps without a duration from list
  apps = apps.filter(function (app) {
    return app.duration !== undefined;
  });

  let curr_y = 0;
  const longest_duration = apps[0].duration;
  const clipPrefix = `summary_clip_${Math.random().toString(36).slice(2)}_`;
  const defs = svg.append('defs');
  const hatchPatternId = `${clipPrefix}afk_hatch`;
  const hatchPattern = defs
    .append('pattern')
    .attr('id', hatchPatternId)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 10)
    .attr('height', 10)
    .attr('patternTransform', 'rotate(45)');
  hatchPattern
    .append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', 10)
    .style('stroke', AFK_HATCH_COLOR)
    .style('stroke-width', 2)
    .style('opacity', 0.9);

  _.each(apps, function (app, i) {
    // TODO: Expand on click and list titles

    // Variables
    const widthPercent = (app.duration / longest_duration) * 100;
    const width = widthPercent + '%';
    const barHeight = 46;
    const textSize = 14;
    const appcolor = entryColor(app);
    const segments = normalizedColorSegments(app, appcolor);
    const segmentTotal = Math.max(Number(app.duration || 0), _.sumBy(segments, 'duration')) || 1;
    const afkDuration = normalizedAfkDuration(app);

    // Add a parent <a> element if link is set
    const a = app.link ? svg.append('a').attr('href', app.link) : svg;

    // The group representing an entry in the barchart
    const eg = a.append('g');
    eg.attr('id', 'summary_' + i)
      .on('mouseover', function () {
        eg.selectAll('.summary-bar-segment').style('fill', function () {
          const color = d3.select(this).attr('data-color') || appcolor;
          return Color(color).darken(0.1).hex();
        });
      })
      .on('mouseout', function () {
        eg.selectAll('.summary-bar-segment').style('fill', function () {
          return d3.select(this).attr('data-color') || appcolor;
        });
      });

    eg.append('title').text(
      app.hovertext +
        '\n' +
        seconds_to_duration(app.duration) +
        afkTooltip(app) +
        segmentTooltip(app, segments)
    );

    const clipId = `${clipPrefix}${i}`;
    defs
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', 0)
      .attr('y', curr_y)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('width', width)
      .attr('height', barHeight);

    const bar = eg.append('g').attr('clip-path', `url(#${clipId})`);
    let segmentOffsetPercent = 0;
    for (const segment of segments) {
      const segmentWidthPercent = widthPercent * (segment.duration / segmentTotal);
      bar
        .append('rect')
        .attr('class', 'summary-bar-segment')
        .attr('data-color', segment.color)
        .attr('x', segmentOffsetPercent + '%')
        .attr('y', curr_y)
        .attr('width', segmentWidthPercent + '%')
        .attr('height', barHeight)
        .style('fill', segment.color);
      segmentOffsetPercent += segmentWidthPercent;
    }

    if (afkDuration > 0) {
      const afkWidthPercent = widthPercent * (afkDuration / Number(app.duration || 1));
      const afkXPercent = widthPercent - afkWidthPercent;
      bar
        .append('rect')
        .attr('class', 'summary-afk-overlay')
        .attr('x', afkXPercent + '%')
        .attr('y', curr_y)
        .attr('width', afkWidthPercent + '%')
        .attr('height', barHeight)
        .style('fill', `url(#${hatchPatternId})`)
        .style('stroke', AFK_HATCH_COLOR)
        .style('stroke-width', 1.5)
        .style('pointer-events', 'none');
    }

    // App name
    eg.append('text')
      .attr('x', 5)
      .attr('y', curr_y + 1.4 * textSize)
      .text(app.name)
      .attr('font-family', 'sans-serif')
      .attr('font-size', textSize + 'px')
      .attr('fill', textColor);

    // Duration
    eg.append('text')
      .attr('x', 5)
      .attr('y', curr_y + 2.6 * textSize)
      .text(seconds_to_duration(app.duration))
      .attr('font-family', 'sans-serif')
      .attr('font-size', textSize - 3 + 'px')
      .attr('fill', '#444');

    curr_y += barHeight + 5;
  });
  curr_y -= 5;

  svg.attr('height', curr_y);

  return container;
}

function updateSummedEvents(
  container: HTMLElement,
  summedEvents: IEvent[],
  titleKeyFunc: (event: IEvent) => string,
  hoverKeyFunc: (event: IEvent) => string,
  colorKeyFunc: (event: IEvent) => string,
  linkKeyFunc: (event: IEvent) => string = () => null
) {
  if (hoverKeyFunc == null) {
    hoverKeyFunc = titleKeyFunc;
  }
  const apps = _.map(summedEvents, e => {
    return {
      name: titleKeyFunc(e),
      hovertext: hoverKeyFunc(e),
      duration: e.duration,
      color: e.data['$color'],
      colorSegments: e.data['$colorSegments'],
      afkDuration: e.data['$afkDuration'],
      colorKey: colorKeyFunc(e),
      link: linkKeyFunc(e),
    } as Entry;
  });
  update(container, apps);
}

export default {
  create: create,
  update: update,
  updateSummedEvents: updateSummedEvents,
  set_status: set_status,
};
